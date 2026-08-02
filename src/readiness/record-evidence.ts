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
import {
  serializeMatchRecord,
  type MatchRecordV3,
} from "../schemas/match-record.schema.js";
import {
  serializeFactualMatchReport,
  type FactualMatchReportV2,
} from "../schemas/factual-report.schema.js";
import { renderTextReplay } from "../replay/text-replay-renderer.js";
import { renderAsciiReplay } from "../replay/ascii/ascii-replay-renderer.js";
import { buildReviewUserPrompt } from "../prompts/review-prompt.v1.js";
import { projectFinalFighterState } from "../reports/final-state-projection.js";
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

const STRUCTURAL_EVENT_TYPES: ReadonlySet<string> = new Set<string>([
  "competition_started",
  "round_started",
  "policy_triggered",
  "round_ended",
  "competition_ended",
]);

/**
 * Complete event chronology validation (Phase 3E1.2, Phase 4). Validates the
 * authoritative chronological structure of a persisted v3 record:
 *
 *   - exactly one `competition_started`, and it is the first semantic event;
 *   - exactly one `competition_ended`, and it is the final event (no event of
 *     any type appears after it);
 *   - `competition_ended.round === record.rounds` and its terminal winner,
 *     method and rounds agree with the record result;
 *   - each completed round has exactly one `round_started`, exactly two
 *     `policy_triggered` (one per fighter) and exactly one `round_ended`;
 *   - both policy events occur after that round's `round_started` and before
 *     that round's `round_ended`;
 *   - round ordering is monotonic (all round-N events precede all round-(N+1)
 *     events, and a new round never begins before the previous round ended);
 *   - no ordinary or combat event occurs after the round's `round_ended`;
 *   - sequence-number invariants within the frozen runtime's two counters:
 *     structural events (competition_started / round_started / policy_triggered
 *     / round_ended / competition_ended) carry strictly increasing unique
 *     sequence numbers in array order, and non-structural (movement/combat)
 *     events carry strictly increasing unique sequence numbers within each
 *     round's segment. Cross-counter collisions between structural and
 *     non-structural sequence numbers are a documented frozen runtime emission
 *     behaviour (the grid adapter emits a per-round detail counter), so they
 *     are not rejected; non-monotonic or duplicate numbers within either
 *     counter are rejected.
 *
 * The array order (not round numbers alone) is the authoritative chronology;
 * this function fails closed on any violation.
 */
export function validateGridReadinessEventChronology(record: MatchRecordV3): void {
  const events = record.events;
  if (events.length === 0) {
    throw new GridActivationReadinessEvidenceError("record event stream is empty");
  }

  // ── Terminal events ──────────────────────────────────────────────────────
  const startedCount = events.filter((e) => e.type === "competition_started").length;
  if (startedCount !== 1) {
    throw new GridActivationReadinessEvidenceError(
      `record must contain exactly one competition_started; found ${startedCount}`,
    );
  }
  const endedCount = events.filter((e) => e.type === "competition_ended").length;
  if (endedCount !== 1) {
    throw new GridActivationReadinessEvidenceError(
      `record must contain exactly one competition_ended; found ${endedCount}`,
    );
  }
  const first = events[0]!;
  const last = events[events.length - 1]!;
  if (first.type !== "competition_started") {
    throw new GridActivationReadinessEvidenceError(
      `competition_started must be the first event; found ${first.type}`,
    );
  }
  if (first.round !== 0) {
    throw new GridActivationReadinessEvidenceError(
      `competition_started must be in round 0; found round ${first.round}`,
    );
  }
  if (last.type !== "competition_ended") {
    throw new GridActivationReadinessEvidenceError(
      `competition_ended must be the final event; found ${last.type} at the end`,
    );
  }
  if (last.round !== record.rounds) {
    throw new GridActivationReadinessEvidenceError(
      `competition_ended round ${last.round} must equal record.rounds ${record.rounds}`,
    );
  }
  const endedData = last.data as {
    winner?: unknown;
    loser?: unknown;
    method?: unknown;
    rounds?: unknown;
  };
  if (endedData.winner !== record.result.winner) {
    throw new GridActivationReadinessEvidenceError(
      "competition_ended winner does not agree with the record result",
    );
  }
  if (endedData.method !== record.result.method) {
    throw new GridActivationReadinessEvidenceError(
      "competition_ended method does not agree with the record result",
    );
  }
  if (endedData.rounds !== record.rounds) {
    throw new GridActivationReadinessEvidenceError(
      "competition_ended rounds does not agree with the record result",
    );
  }

  // ── Positional round structure and ordering ──────────────────────────────
  const roundStartedCounts = new Map<number, number>();
  const roundEndedCounts = new Map<number, number>();
  const roundPolicyActors = new Map<number, Set<string>>();

  let lastRound: number | null = null;
  let roundEndedLastSeen = false;
  let roundStartedLastSeen = false;

  // Sequence invariants within the frozen runtime's two counters.
  let lastStructuralSeq = -1;
  const structuralSeqs = new Set<number>();
  const nonStructuralByRound = new Map<number, { last: number; seen: Set<number> }>();

  for (let index = 0; index < events.length; index++) {
    const event = events[index]!;
    if (
      typeof event.sequence !== "number" ||
      !Number.isSafeInteger(event.sequence) ||
      event.sequence < 0
    ) {
      throw new GridActivationReadinessEvidenceError(
        `event ${index} has an invalid sequence number: ${String(event.sequence)}`,
      );
    }
    const isStructural = STRUCTURAL_EVENT_TYPES.has(event.type);
    if (isStructural) {
      if (event.sequence <= lastStructuralSeq) {
        throw new GridActivationReadinessEvidenceError(
          `structural event sequence numbers must be strictly increasing and unique; ${event.type} at sequence ${event.sequence} follows ${lastStructuralSeq}`,
        );
      }
      if (structuralSeqs.has(event.sequence)) {
        throw new GridActivationReadinessEvidenceError(
          `duplicate structural sequence number ${event.sequence}`,
        );
      }
      structuralSeqs.add(event.sequence);
      lastStructuralSeq = event.sequence;
    } else {
      const segment = nonStructuralByRound.get(event.round) ?? {
        last: -1,
        seen: new Set<number>(),
      };
      if (event.sequence <= segment.last) {
        throw new GridActivationReadinessEvidenceError(
          `non-structural event sequence numbers within round ${event.round} must be strictly increasing and unique; ${event.type} at sequence ${event.sequence}`,
        );
      }
      if (segment.seen.has(event.sequence)) {
        throw new GridActivationReadinessEvidenceError(
          `duplicate non-structural sequence number ${event.sequence} in round ${event.round}`,
        );
      }
      segment.seen.add(event.sequence);
      segment.last = event.sequence;
      nonStructuralByRound.set(event.round, segment);
    }

    if (event.type === "competition_ended") {
      // Already validated as the final event; nothing follows it in the loop.
      continue;
    }
    if (event.type === "competition_started") {
      if (index !== 0) {
        throw new GridActivationReadinessEvidenceError(
          "competition_started must be the first semantic event",
        );
      }
      lastRound = event.round;
      continue;
    }

    if (lastRound === null) {
      throw new GridActivationReadinessEvidenceError(
        "an event appears before competition_started",
      );
    }
    const round = event.round;
    if (round < lastRound) {
      throw new GridActivationReadinessEvidenceError(
        `round ordering must be monotonic; ${event.type} in round ${round} follows round ${lastRound}`,
      );
    }
    if (round > lastRound) {
      // Round 0 (competition_started) has no round_ended; every subsequent
      // new round must begin only after the previous completed round ended.
      if (lastRound >= 1 && !roundEndedLastSeen) {
        throw new GridActivationReadinessEvidenceError(
          `round ${round} begins before round ${lastRound} ended`,
        );
      }
      lastRound = round;
      roundEndedLastSeen = false;
      roundStartedLastSeen = false;
    }

    // Same round now.
    if (event.type === "round_started") {
      if (roundEndedLastSeen) {
        throw new GridActivationReadinessEvidenceError(
          `round_started appears after round ${round}'s round_ended`,
        );
      }
      if (roundStartedLastSeen) {
        throw new GridActivationReadinessEvidenceError(
          `duplicate round_started in round ${round}`,
        );
      }
      roundStartedLastSeen = true;
      roundStartedCounts.set(round, (roundStartedCounts.get(round) ?? 0) + 1);
    } else if (event.type === "policy_triggered") {
      if (!roundStartedLastSeen) {
        throw new GridActivationReadinessEvidenceError(
          `policy_triggered in round ${round} appears before the round's round_started`,
        );
      }
      if (roundEndedLastSeen) {
        throw new GridActivationReadinessEvidenceError(
          `policy_triggered in round ${round} appears after the round's round_ended`,
        );
      }
      const actors = roundPolicyActors.get(round) ?? new Set<string>();
      if (event.actorId !== "fighter_a" && event.actorId !== "fighter_b") {
        throw new GridActivationReadinessEvidenceError(
          `policy_triggered in round ${round} has a non-canonical actor`,
        );
      }
      if (actors.has(event.actorId)) {
        throw new GridActivationReadinessEvidenceError(
          `duplicate policy_triggered for ${event.actorId} in round ${round}`,
        );
      }
      actors.add(event.actorId);
      roundPolicyActors.set(round, actors);
    } else if (event.type === "round_ended") {
      if (roundEndedLastSeen) {
        throw new GridActivationReadinessEvidenceError(
          `duplicate round_ended in round ${round}`,
        );
      }
      roundEndedLastSeen = true;
      roundEndedCounts.set(round, (roundEndedCounts.get(round) ?? 0) + 1);
    } else {
      // Ordinary or combat event (movement_resolved, attack_*, integrity_*,
      // component_*, robot_*, ...): must not appear after the round's
      // round_ended, and must not appear before the round's round_started.
      if (roundEndedLastSeen) {
        throw new GridActivationReadinessEvidenceError(
          `ordinary or combat event ${event.type} in round ${round} appears after the round's round_ended`,
        );
      }
      if (!roundStartedLastSeen) {
        throw new GridActivationReadinessEvidenceError(
          `ordinary or combat event ${event.type} in round ${round} appears before the round's round_started`,
        );
      }
    }
  }

  // Every completed round must have exactly one round_started, two
  // policy_triggered (one per fighter) and one round_ended.
  for (let round = 1; round <= record.rounds; round++) {
    const started = roundStartedCounts.get(round) ?? 0;
    if (started !== 1) {
      throw new GridActivationReadinessEvidenceError(
        `completed round ${round} must have exactly one round_started; found ${started}`,
      );
    }
    const ended = roundEndedCounts.get(round) ?? 0;
    if (ended !== 1) {
      throw new GridActivationReadinessEvidenceError(
        `completed round ${round} must have exactly one round_ended; found ${ended}`,
      );
    }
    const actors = roundPolicyActors.get(round);
    if (
      !actors ||
      !actors.has("fighter_a") ||
      !actors.has("fighter_b") ||
      actors.size !== 2
    ) {
      throw new GridActivationReadinessEvidenceError(
        `completed round ${round} must have exactly two policy_triggered events (one per fighter)`,
      );
    }
  }
  // No structural round event may appear in a round beyond completion.
  for (const round of roundStartedCounts.keys()) {
    if (round > record.rounds) {
      throw new GridActivationReadinessEvidenceError(
        `round_started appears for round ${round} beyond competition completion (${record.rounds} rounds)`,
      );
    }
  }
  for (const round of roundEndedCounts.keys()) {
    if (round > record.rounds) {
      throw new GridActivationReadinessEvidenceError(
        `round_ended appears for round ${round} beyond competition completion (${record.rounds} rounds)`,
      );
    }
  }
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
  validateGridReadinessEventChronology(record);

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
    if (typeof combat !== "string" || !COMBAT_ACTIONS.includes(combat as CombatAction)) {
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
    if (
      !roundMap ||
      roundMap.fighter_a === undefined ||
      roundMap.fighter_b === undefined
    ) {
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
  // Current canonical facing per fighter, used to reject an emitted `hold`
  // that changes facing (impossible under the frozen grid runtime).
  const currentFacing: Record<"fighter_a" | "fighter_b", Direction> = {
    fighter_a: record.initialState.fighterA.facing,
    fighter_b: record.initialState.fighterB.facing,
  };
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
        currentFacing[subject] = data.facing as Direction;
        continue;
      }
      if (data.action === "grapple") {
        grappleRepositionEvents += 1;
        currentFacing[subject] = data.facing as Direction;
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
      if (action === "hold") {
        // Frozen grid runtime invariant: a `hold` never translates and never
        // changes facing. An emitted ordinary `hold` movement event must be
        // same-cell and same-facing.
        if (data.from !== data.to) {
          throw new GridActivationReadinessEvidenceError(
            `translated hold is impossible under the frozen grid runtime: ${subject} moved ${String(data.from)} -> ${String(data.to)}`,
          );
        }
        if (data.facing !== currentFacing[subject]) {
          throw new GridActivationReadinessEvidenceError(
            `hold must preserve facing; ${subject} facing changed from ${currentFacing[subject]} to ${String(data.facing)}`,
          );
        }
      }
      if (data.from !== data.to) translatedActionCounts[action] += 1;
      currentFacing[subject] = data.facing as Direction;
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
 * Complete record/report final-state agreement (Phase 3E1.2, Phase 8).
 *
 * Validates that a persisted match-record v3 and its bound factual-report v2
 * agree on every reconstructable fact:
 *
 *   - match ID, seed, rounds, winner and result method;
 *   - runtime identity (simulator/positioning/ruleset/catalogue);
 *   - every complete fighter A/B final state reconstructed from the event
 *     stream via the shared `projectFinalFighterState` (which applies the
 *     latest authoritative `round_ended` facts): integrity, max integrity,
 *     energy, heat, grid zone, facing, conditions, component lifecycle states
 *     (healthy/damaged/disabled) and the binary component projection;
 *   - armour where represented (the report's fighter summaries must equal the
 *     record build armour).
 *
 * A report never counts as agreeing merely because its winner and round count
 * match. Fails closed with a descriptive error on any disagreement. This is
 * the authoritative source for `replayAgreeingMatches`.
 */
export function assertGridReadinessRecordReportFinalAgreement(
  record: MatchRecordV3,
  report: FactualMatchReportV2,
): void {
  const failures: string[] = [];
  const label = `record ${record.matchId}`;

  // Identity and result agreement.
  if (report.matchId !== record.matchId) failures.push("matchId mismatch");
  if (report.seed !== record.seed) failures.push("seed mismatch");
  if (report.rounds !== record.rounds) failures.push("rounds mismatch");
  if (report.winner !== record.result.winner) failures.push("winner mismatch");
  if (report.resultMethod !== record.result.method) {
    failures.push("result method mismatch");
  }
  if (
    report.simulatorVersion !== "0.3.0" ||
    report.positioningModel !== "grid-3x3-v1" ||
    report.rulesetVersion !== "0.2.0" ||
    report.catalogueVersion !== "1"
  ) {
    failures.push("report runtime identity mismatch");
  }
  if (
    record.simulatorVersion !== "0.3.0" ||
    record.positioningModel !== "grid-3x3-v1" ||
    record.rulesetVersion !== "0.2.0" ||
    record.catalogueVersion !== "1"
  ) {
    failures.push("record runtime identity mismatch");
  }

  // Armour where represented (report fighter summaries vs record build armour).
  const armourA = report.fighterA.armour;
  const armourB = report.fighterB.armour;
  const recordArmourA = record.config.fighterA.build.proposal.armour;
  const recordArmourB = record.config.fighterB.build.proposal.armour;
  if (
    !sameRecordJson(armourA, recordArmourA) ||
    !sameRecordJson(armourB, recordArmourB)
  ) {
    failures.push("armour mismatch");
  }

  // Complete final state reconstruction per fighter.
  const fighterKeys = [
    { stateKey: "fighterA" as const, fighterId: "fighter_a" },
    { stateKey: "fighterB" as const, fighterId: "fighter_b" },
  ];
  for (const { stateKey, fighterId } of fighterKeys) {
    const projected = projectFinalFighterState(
      record.initialState[stateKey],
      record.events,
      fighterId,
      POSITIONING_MODEL_GRID,
    );
    const reportState = report.finalStates[stateKey];
    const fighter = stateKey;
    if (projected.integrity !== reportState.integrity) {
      failures.push(
        `${fighter} integrity ${reportState.integrity} != ${projected.integrity}`,
      );
    }
    if (projected.maxIntegrity !== reportState.maxIntegrity) {
      failures.push(
        `${fighter} maxIntegrity ${reportState.maxIntegrity} != ${projected.maxIntegrity}`,
      );
    }
    if (projected.energy !== reportState.energy) {
      failures.push(`${fighter} energy ${reportState.energy} != ${projected.energy}`);
    }
    if (projected.heat !== reportState.heat) {
      failures.push(`${fighter} heat ${reportState.heat} != ${projected.heat}`);
    }
    if (projected.zone !== reportState.zone) {
      failures.push(`${fighter} zone ${reportState.zone} != ${projected.zone}`);
    }
    if (projected.facing !== reportState.facing) {
      failures.push(`${fighter} facing ${reportState.facing} != ${projected.facing}`);
    }
    const projectedConditions = [...projected.conditions].sort().join(",");
    const reportConditions = [...reportState.conditions].sort().join(",");
    if (projectedConditions !== reportConditions) {
      failures.push(
        `${fighter} conditions [${reportConditions}] != [${projectedConditions}]`,
      );
    }
    const projectedMobilityDisabled = projected.comps.mobility.state === "disabled";
    const projectedWeaponDisabled = projected.comps.weapon.state === "disabled";
    const projectedUtilityDisabled = projected.comps.utility.state === "disabled";
    if (reportState.mobilityDisabled !== projectedMobilityDisabled) {
      failures.push(
        `${fighter} mobilityDisabled ${reportState.mobilityDisabled} != ${projectedMobilityDisabled}`,
      );
    }
    if (reportState.weaponDisabled !== projectedWeaponDisabled) {
      failures.push(
        `${fighter} weaponDisabled ${reportState.weaponDisabled} != ${projectedWeaponDisabled}`,
      );
    }
    if (reportState.utilityDisabled !== projectedUtilityDisabled) {
      failures.push(
        `${fighter} utilityDisabled ${reportState.utilityDisabled} != ${projectedUtilityDisabled}`,
      );
    }
    const projectedMobilityDamaged = projected.comps.mobility.state === "damaged";
    const projectedWeaponDamaged = projected.comps.weapon.state === "damaged";
    const projectedUtilityDamaged = projected.comps.utility.state === "damaged";
    if (reportState.mobilityDamaged !== projectedMobilityDamaged) {
      failures.push(
        `${fighter} mobilityDamaged ${reportState.mobilityDamaged} != ${projectedMobilityDamaged}`,
      );
    }
    if (reportState.weaponDamaged !== projectedWeaponDamaged) {
      failures.push(
        `${fighter} weaponDamaged ${reportState.weaponDamaged} != ${projectedWeaponDamaged}`,
      );
    }
    if (reportState.utilityDamaged !== projectedUtilityDamaged) {
      failures.push(
        `${fighter} utilityDamaged ${reportState.utilityDamaged} != ${projectedUtilityDamaged}`,
      );
    }
    if (
      reportState.machineName !== record.initialState[stateKey].build.proposal.machineName
    ) {
      failures.push(`${fighter} machineName mismatch`);
    }
  }

  if (failures.length > 0) {
    throw new GridActivationReadinessEvidenceError(
      `${label} report/final-state agreement failed: ${failures.join("; ")}`,
    );
  }
}

/** Structural JSON equality for nested plain values. */
function sameRecordJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
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
  const asciiReplay = renderAsciiReplay(
    result,
    { mode: "ascii" },
    POSITIONING_MODEL_GRID,
  );
  const reviewPrompt = buildReviewUserPrompt(report);
  return {
    recordChecksum: sha256Hex(serializedRecord),
    reportChecksum: sha256Hex(serializedReport),
    textReplayChecksum: sha256Hex(textReplay),
    asciiReplayChecksum: sha256Hex(asciiReplay),
    reviewPromptChecksum: sha256Hex(reviewPrompt),
  };
}
