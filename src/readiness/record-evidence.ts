import {
  isGridZone,
  getRelativeBearing,
  getPlanarExposedArmourZones,
  type GridZone,
  type RelativeBearing,
  type PlanarArmourZone,
} from "../simulator/arena-grid.js";
import {
  getMovementEventSubjectId,
  isMovementEventAction,
} from "../events/battle-event.js";
import { serializeMatchRecord, type MatchRecordV3 } from "../schemas/match-record.schema.js";
import {
  serializeFactualMatchReport,
  type FactualMatchReportV2,
} from "../schemas/factual-report.schema.js";
import { renderTextReplay } from "../replay/text-replay-renderer.js";
import { renderAsciiReplay } from "../replay/ascii/ascii-replay-renderer.js";
import { buildReviewUserPrompt } from "../prompts/review-prompt.v1.js";
import { POSITIONING_MODEL_GRID } from "../schemas/positioning.schema.js";
import { sha256Hex } from "../canary/grid-canary-digest.js";
import type {
  CombatAction,
  Direction,
  GridFighterState,
  GridMatchResult,
  MovementAction,
  SimulationEvent,
} from "../simulator/types.js";

/**
 * Shared persisted-record evidence inspector (Milestone 0.2C Phase 3E1.1).
 *
 * A single pure inspector derives the authoritative per-run readiness
 * evidence from a parsed match-record v3. Selected movement and combat
 * actions are derived from `policy_triggered` events (one per fighter per
 * completed round); translated ordinary movement continues to come from
 * ordinary `movement_resolved` events; knockback and grapple use
 * target-subject semantics and are never counted as selected actions. The
 * live execution core and the read-back bundle validator both use this same
 * inspector, so persisted-record evidence and live evidence are always
 * identical.
 *
 * The inspector is pure: it never reads or writes files, never mutates any
 * input, and fails closed (`GridActivationReadinessEvidenceError`) on any
 * malformed, missing, duplicate or impossible event fact.
 */
export class GridActivationReadinessEvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridActivationReadinessEvidenceError";
  }
}

export interface GridActivationReadinessRunEvidence {
  /** Selected movement-action counts from `policy_triggered` (contract). */
  readonly actionCounts: Readonly<Record<MovementAction, number>>;
  /** Explicit selected movement-action counts from `policy_triggered`. */
  readonly selectedMovementActionCounts: Readonly<Record<MovementAction, number>>;
  /** Selected combat-action counts from `policy_triggered`. */
  readonly selectedCombatActionCounts: Readonly<Record<CombatAction, number>>;
  /** Translated ordinary movement counts from `movement_resolved` (from != to). */
  readonly translatedActionCounts: Readonly<Record<MovementAction, number>>;
  /** Selected `hold` actions that do not translate. */
  readonly stationaryHoldCount: number;
  readonly zoneVisits: Readonly<Record<GridZone, number>>;
  readonly bearingCounts: Readonly<Record<RelativeBearing, number>>;
  readonly exposedPlanarArmourZoneCounts: Readonly<Record<PlanarArmourZone, number>>;
  readonly eventTypeCounts: Readonly<Record<string, number>>;
  readonly maximumConsecutiveNoProgressRounds: number;
  readonly attacksAttempted: number;
  readonly hits: number;
  readonly misses: number;
  readonly integrityDamageEvents: number;
  readonly criticalHits: number;
  readonly knockbackEvents: number;
  readonly grappleRepositionEvents: number;
  readonly overturnEvents: number;
  readonly componentDamaged: number;
  readonly componentDisabled: number;
  readonly componentDamageResisted: number;
}

export interface GridActivationReadinessRunChecksums {
  readonly recordChecksum: string;
  readonly reportChecksum: string;
  readonly textReplayChecksum: string;
  readonly asciiReplayChecksum: string;
  readonly reviewPromptChecksum: string;
}

const CARDINAL_FACINGS: ReadonlySet<string> = new Set<string>([
  "north",
  "east",
  "south",
  "west",
]);

const VALID_CONDITIONS: ReadonlySet<string> = new Set<string>([
  "overturned",
  "immobilised",
  "overheated",
  "stunned",
]);

const MOVEMENT_ACTIONS: readonly MovementAction[] = [
  "advance",
  "retreat",
  "circle_left",
  "circle_right",
  "hold",
];

const COMBAT_ACTIONS: readonly CombatAction[] = ["attack", "defend", "idle"];

const BEARINGS: readonly RelativeBearing[] = [
  "same",
  "front",
  "front_right",
  "right",
  "rear_right",
  "rear",
  "rear_left",
  "left",
  "front_left",
];

const PLANAR_ZONES: readonly PlanarArmourZone[] = ["front", "left", "right", "rear"];

const GRID_ZONES: readonly GridZone[] = [
  "north_west",
  "north",
  "north_east",
  "west",
  "center",
  "east",
  "south_west",
  "south",
  "south_east",
];

const ORDINARY_MOVEMENT_SET: ReadonlySet<string> = new Set<string>(MOVEMENT_ACTIONS);

function emptyActionCounts(): Record<MovementAction, number> {
  return {
    advance: 0,
    retreat: 0,
    circle_left: 0,
    circle_right: 0,
    hold: 0,
  };
}

function emptyCombatCounts(): Record<CombatAction, number> {
  return { attack: 0, defend: 0, idle: 0 };
}

function emptyZoneVisits(): Record<GridZone, number> {
  const visits = {} as Record<GridZone, number>;
  for (const zone of GRID_ZONES) visits[zone] = 0;
  return visits;
}

function emptyBearingCounts(): Record<RelativeBearing, number> {
  const counts = {} as Record<RelativeBearing, number>;
  for (const bearing of BEARINGS) counts[bearing] = 0;
  return counts;
}

function emptyExposedCounts(): Record<PlanarArmourZone, number> {
  const counts = {} as Record<PlanarArmourZone, number>;
  for (const zone of PLANAR_ZONES) counts[zone] = 0;
  return counts;
}

/**
 * Tracks fighter positions and facings through the event stream to collect
 * canonical zone-visit, relative-bearing and exposed planar armour-zone
 * evidence. Never mutates any event or state.
 */
function collectPositionEvidence(
  initialState: { fighterA: GridFighterState; fighterB: GridFighterState },
  events: readonly SimulationEvent[],
): {
  zoneVisits: Record<GridZone, number>;
  bearingCounts: Record<RelativeBearing, number>;
  exposedPlanarArmourZoneCounts: Record<PlanarArmourZone, number>;
} {
  const zoneVisits = emptyZoneVisits();
  const bearingCounts = emptyBearingCounts();
  const exposed = emptyExposedCounts();

  let zoneA: GridZone = initialState.fighterA.zone;
  let facingA: Direction = initialState.fighterA.facing;
  let zoneB: GridZone = initialState.fighterB.zone;
  let facingB: Direction = initialState.fighterB.facing;

  const sample = (): void => {
    zoneVisits[zoneA] += 1;
    zoneVisits[zoneB] += 1;
    const bearingAToB = getRelativeBearing(zoneA, zoneB, facingB);
    const bearingBToA = getRelativeBearing(zoneB, zoneA, facingA);
    bearingCounts[bearingAToB] += 1;
    bearingCounts[bearingBToA] += 1;
    for (const exposedZone of getPlanarExposedArmourZones(bearingAToB)) {
      exposed[exposedZone] += 1;
    }
    for (const exposedZone of getPlanarExposedArmourZones(bearingBToA)) {
      exposed[exposedZone] += 1;
    }
  };

  sample();

  for (const event of events) {
    if (event.type === "movement_resolved") {
      const data = event.data as { from?: unknown; to?: unknown; facing?: unknown };
      const subject = getMovementEventSubjectId(event);
      if (subject === "fighter_a") {
        zoneA = data.to as GridZone;
        facingA = data.facing as Direction;
      } else if (subject === "fighter_b") {
        zoneB = data.to as GridZone;
        facingB = data.facing as Direction;
      }
      sample();
    } else if (event.type === "round_ended") {
      const data = event.data as {
        fighterA: { zone: string };
        fighterB: { zone: string };
      };
      zoneA = data.fighterA.zone as GridZone;
      zoneB = data.fighterB.zone as GridZone;
      sample();
    }
  }

  return { zoneVisits, bearingCounts, exposedPlanarArmourZoneCounts: exposed };
}

/**
 * Maximum consecutive rounds (within rounds 1..N) with no meaningful progress.
 * Meaningful progress: translated movement, attack attempt, integrity damage,
 * component transition, overturn, knockback/grapple reposition, or a
 * condition-set change.
 */
export function computeMaximumConsecutiveNoProgressRounds(
  events: readonly SimulationEvent[],
): number {
  const progress = new Map<number, boolean>();
  let prevConditionsA = "";
  let prevConditionsB = "";
  let maxRound = 0;

  for (const event of events) {
    if (event.round > maxRound) maxRound = event.round;
    if (event.type === "movement_resolved") {
      const data = event.data as { from?: unknown; to?: unknown };
      if (data.from !== data.to) progress.set(event.round, true);
    } else if (
      event.type === "attack_attempted" ||
      event.type === "integrity_damaged" ||
      event.type === "component_damaged" ||
      event.type === "component_disabled" ||
      event.type === "component_damage_resisted" ||
      event.type === "robot_overturned"
    ) {
      progress.set(event.round, true);
    } else if (event.type === "round_ended") {
      const data = event.data as {
        fighterA: { conditions: readonly string[] };
        fighterB: { conditions: readonly string[] };
      };
      const keyA = [...data.fighterA.conditions].sort().join(",");
      const keyB = [...data.fighterB.conditions].sort().join(",");
      if (keyA !== prevConditionsA || keyB !== prevConditionsB) {
        progress.set(event.round, true);
      }
      prevConditionsA = keyA;
      prevConditionsB = keyB;
    }
  }

  let maxStreak = 0;
  let current = 0;
  for (let round = 1; round <= maxRound; round++) {
    if (progress.get(round) === true) current = 0;
    else current += 1;
    if (current > maxStreak) maxStreak = current;
  }
  return maxStreak;
}

function assertCanonicalInitialState(record: MatchRecordV3): void {
  for (const fighter of [record.initialState.fighterA, record.initialState.fighterB]) {
    if (!isGridZone(fighter.zone)) {
      throw new GridActivationReadinessEvidenceError(
        `initial zone is not canonical: ${String(fighter.zone)}`,
      );
    }
    if (!CARDINAL_FACINGS.has(fighter.facing)) {
      throw new GridActivationReadinessEvidenceError(
        `initial facing is not cardinal: ${String(fighter.facing)}`,
      );
    }
    for (const condition of fighter.conditions) {
      if (!VALID_CONDITIONS.has(condition)) {
        throw new GridActivationReadinessEvidenceError(
          `initial condition is not canonical: ${String(condition)}`,
        );
      }
    }
  }
}

interface SelectedPolicyAction {
  movement: MovementAction;
  combat: CombatAction;
}

/**
 * Pure authoritative evidence inspector for a persisted match-record v3.
 *
 * Validates every `policy_triggered` event (exactly one per fighter per
 * completed round; canonical actor, movement and combat selections; no
 * duplicates; no events after competition completion), counts selected
 * movement and combat actions, validates ordinary `movement_resolved` events
 * (canonical actor, zone, facing and exact agreement with the actor's
 * selected policy movement for the same round), counts translated ordinary
 * movement and reposition events, and derives zone, bearing, exposure,
 * event-type, no-progress and combat evidence. Fails closed on any violation.
 */
export function inspectGridReadinessRecordEvidence(
  record: MatchRecordV3,
): GridActivationReadinessRunEvidence {
  if (record.rounds < 1) {
    throw new GridActivationReadinessEvidenceError(
      "record must contain at least one completed round",
    );
  }
  assertCanonicalInitialState(record);

  const selectedByRoundAndActor = new Map<
    number,
    { fighter_a?: SelectedPolicyAction; fighter_b?: SelectedPolicyAction }
  >();
  const selectedMovementActionCounts = emptyActionCounts();
  const selectedCombatActionCounts = emptyCombatCounts();

  // Pass 1: validate and count selected actions from policy_triggered.
  for (const event of record.events) {
    if (event.type !== "policy_triggered") continue;
    if (event.round > record.rounds) {
      throw new GridActivationReadinessEvidenceError(
        `policy_triggered event in round ${event.round} appears after competition completion (${record.rounds} rounds)`,
      );
    }
    if (event.round < 1) {
      throw new GridActivationReadinessEvidenceError(
        `policy_triggered event has an invalid round: ${event.round}`,
      );
    }
    const actor = event.actorId;
    if (actor !== "fighter_a" && actor !== "fighter_b") {
      throw new GridActivationReadinessEvidenceError(
        `policy_triggered event has no canonical actor; received ${String(actor)}`,
      );
    }
    const action = (event.data as { action?: unknown }).action;
    if (typeof action !== "object" || action === null || Array.isArray(action)) {
      throw new GridActivationReadinessEvidenceError(
        `policy_triggered event is missing a policy action object`,
      );
    }
    const movement = (action as { movement?: unknown }).movement;
    const combat = (action as { combat?: unknown }).combat;
    if (typeof movement !== "string" || !ORDINARY_MOVEMENT_SET.has(movement)) {
      throw new GridActivationReadinessEvidenceError(
        `policy_triggered event has an unknown movement selection: ${String(movement)}`,
      );
    }
    if (
      typeof combat !== "string" ||
      !COMBAT_ACTIONS.includes(combat as CombatAction)
    ) {
      throw new GridActivationReadinessEvidenceError(
        `policy_triggered event has an unknown combat selection: ${String(combat)}`,
      );
    }
    const selectedAction: SelectedPolicyAction = {
      movement: movement as MovementAction,
      combat: combat as CombatAction,
    };
    let roundMap = selectedByRoundAndActor.get(event.round);
    if (!roundMap) {
      roundMap = {};
      selectedByRoundAndActor.set(event.round, roundMap);
    }
    if (roundMap[actor] !== undefined) {
      throw new GridActivationReadinessEvidenceError(
        `duplicate policy_triggered for ${actor} in round ${event.round}`,
      );
    }
    roundMap[actor] = selectedAction;
    selectedMovementActionCounts[selectedAction.movement] += 1;
    selectedCombatActionCounts[selectedAction.combat] += 1;
  }

  // Every completed round must have exactly one policy action per fighter.
  for (let round = 1; round <= record.rounds; round++) {
    const roundMap = selectedByRoundAndActor.get(round);
    if (!roundMap || roundMap.fighter_a === undefined || roundMap.fighter_b === undefined) {
      throw new GridActivationReadinessEvidenceError(
        `completed round ${round} must have exactly two policy_triggered events (one per fighter)`,
      );
    }
  }
  const selectedTotal = MOVEMENT_ACTIONS.reduce(
    (total, action) => total + selectedMovementActionCounts[action],
    0,
  );
  if (selectedTotal !== 2 * record.rounds) {
    throw new GridActivationReadinessEvidenceError(
      `selected action total ${selectedTotal} must equal 2 × completed rounds (${2 * record.rounds})`,
    );
  }

  const translatedActionCounts = emptyActionCounts();
  const eventTypeCounts: Record<string, number> = {};
  let attacksAttempted = 0;
  let hits = 0;
  let misses = 0;
  let integrityDamageEvents = 0;
  let criticalHits = 0;
  let knockbackEvents = 0;
  let grappleRepositionEvents = 0;
  let overturnEvents = 0;
  let componentDamaged = 0;
  let componentDisabled = 0;
  let componentDamageResisted = 0;

  // Pass 2: validate ordinary movement, reposition and combat events.
  for (const event of record.events) {
    eventTypeCounts[event.type] = (eventTypeCounts[event.type] ?? 0) + 1;

    if (event.type === "movement_resolved") {
      const data = event.data as {
        from?: unknown;
        to?: unknown;
        facing?: unknown;
        action?: unknown;
      };
      if (!isGridZone(data.from) || !isGridZone(data.to)) {
        throw new GridActivationReadinessEvidenceError(
          `movement_resolved from/to must be canonical grid zones; received ${String(data.from)} -> ${String(data.to)}`,
        );
      }
      if (!isMovementEventAction(data.action)) {
        throw new GridActivationReadinessEvidenceError(
          `movement_resolved has a non-canonical action: ${String(data.action)}`,
        );
      }
      if (typeof data.facing !== "string" || !CARDINAL_FACINGS.has(data.facing)) {
        throw new GridActivationReadinessEvidenceError(
          `movement_resolved facing must be a cardinal direction; received ${String(data.facing)}`,
        );
      }
      const subject = getMovementEventSubjectId(event);
      if (subject !== "fighter_a" && subject !== "fighter_b") {
        throw new GridActivationReadinessEvidenceError(
          `movement_resolved event has no canonical subject`,
        );
      }
      if (data.action === "knockback") {
        knockbackEvents += 1;
        continue;
      }
      if (data.action === "grapple") {
        grappleRepositionEvents += 1;
        continue;
      }
      const action = data.action as MovementAction;
      const selected = selectedByRoundAndActor.get(event.round)?.[subject];
      if (selected === undefined) {
        throw new GridActivationReadinessEvidenceError(
          `ordinary movement_resolved for ${subject} in round ${event.round} has no selected policy movement`,
        );
      }
      if (selected.movement !== action) {
        throw new GridActivationReadinessEvidenceError(
          `ordinary movement_resolved action ${action} for ${subject} in round ${event.round} does not equal the selected policy movement ${selected.movement}`,
        );
      }
      if (data.from !== data.to) translatedActionCounts[action] += 1;
    } else if (event.type === "round_ended") {
      const data = event.data as {
        fighterA: { zone: string; conditions: readonly string[] };
        fighterB: { zone: string; conditions: readonly string[] };
      };
      if (!isGridZone(data.fighterA.zone) || !isGridZone(data.fighterB.zone)) {
        throw new GridActivationReadinessEvidenceError(
          `round_ended zones must be canonical grid zones; received ${String(data.fighterA.zone)} / ${String(data.fighterB.zone)}`,
        );
      }
      for (const fighter of [data.fighterA, data.fighterB]) {
        for (const condition of fighter.conditions) {
          if (!VALID_CONDITIONS.has(condition)) {
            throw new GridActivationReadinessEvidenceError(
              `round_ended condition is not canonical: ${String(condition)}`,
            );
          }
        }
      }
    } else if (event.type === "attack_attempted") {
      attacksAttempted += 1;
    } else if (event.type === "attack_hit") {
      hits += 1;
      const data = event.data as { isCritical?: unknown };
      if (data.isCritical === true) criticalHits += 1;
    } else if (event.type === "attack_missed") {
      misses += 1;
    } else if (event.type === "integrity_damaged") {
      integrityDamageEvents += 1;
    } else if (event.type === "robot_overturned") {
      overturnEvents += 1;
    } else if (event.type === "component_damaged") {
      componentDamaged += 1;
    } else if (event.type === "component_disabled") {
      componentDisabled += 1;
    } else if (event.type === "component_damage_resisted") {
      componentDamageResisted += 1;
    }
  }

  const positionEvidence = collectPositionEvidence(
    record.initialState as { fighterA: GridFighterState; fighterB: GridFighterState },
    record.events,
  );

  return {
    actionCounts: { ...selectedMovementActionCounts },
    selectedMovementActionCounts: { ...selectedMovementActionCounts },
    selectedCombatActionCounts: { ...selectedCombatActionCounts },
    translatedActionCounts,
    stationaryHoldCount: selectedMovementActionCounts.hold,
    zoneVisits: positionEvidence.zoneVisits,
    bearingCounts: positionEvidence.bearingCounts,
    exposedPlanarArmourZoneCounts: positionEvidence.exposedPlanarArmourZoneCounts,
    eventTypeCounts,
    maximumConsecutiveNoProgressRounds: computeMaximumConsecutiveNoProgressRounds(
      record.events,
    ),
    attacksAttempted,
    hits,
    misses,
    integrityDamageEvents,
    criticalHits,
    knockbackEvents,
    grappleRepositionEvents,
    overturnEvents,
    componentDamaged,
    componentDisabled,
    componentDamageResisted,
  };
}

/**
 * Focused pure conversion from a validated match-record v3 to the
 * renderer-compatible grid result shape. No alternate renderer is created;
 * the canonical text/ASCII renderers and final-agreement helper consume the
 * reconstructed result.
 */
export function gridRecordToGridResult(record: MatchRecordV3): GridMatchResult {
  return {
    config: record.config as GridMatchResult["config"],
    events: record.events,
    result: record.result,
    rounds: record.rounds,
    initialState: {
      fighterA: record.initialState.fighterA as unknown as GridFighterState,
      fighterB: record.initialState.fighterB as unknown as GridFighterState,
    },
    runtime: {
      simulatorVersion: record.simulatorVersion as "0.3.0",
      positioningModel: record.positioningModel as "grid-3x3-v1",
    },
  };
}

/**
 * Reproduces the derived artifact checksums from each persisted record/report
 * pair using the canonical record/report serializers and the canonical
 * text/ASCII replay renderers and review-prompt builder.
 */
export function recomputeGridActivationReadinessRunChecksums(
  record: MatchRecordV3,
  report: FactualMatchReportV2,
): GridActivationReadinessRunChecksums {
  const serializedRecord = serializeMatchRecord(record);
  const serializedReport = serializeFactualMatchReport(report);
  const result = gridRecordToGridResult(record);
  const textReplay = renderTextReplay(result);
  const asciiReplay = renderAsciiReplay(result, { mode: "ascii" }, POSITIONING_MODEL_GRID);
  const reviewPrompt = buildReviewUserPrompt(report);
  return {
    recordChecksum: sha256Hex(serializedRecord),
    reportChecksum: sha256Hex(serializedReport),
    textReplayChecksum: sha256Hex(textReplay),
    asciiReplayChecksum: sha256Hex(asciiReplay),
    reviewPromptChecksum: sha256Hex(reviewPrompt),
  };
}
