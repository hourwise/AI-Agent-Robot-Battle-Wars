import type {
  Direction,
  GridFighterState,
  GridMatchResult,
  MatchConfig,
} from "../simulator/types.js";
import type { GridZone } from "../simulator/arena-grid.js";
import {
  getPlanarExposedArmourZones,
  getRelativeBearing,
  isGridZone,
} from "../simulator/arena-grid.js";
import { getMovementEventSubjectId } from "../events/battle-event.js";
import type { FactualMatchReportV2 } from "../schemas/factual-report.schema.js";
import { POSITIONING_MODEL_GRID } from "../schemas/positioning.schema.js";
import {
  GRID_CANARY_FLANK_BEARINGS,
  type GridCanaryFlankBearing,
} from "../schemas/grid-match-canary.schema.js";
import { toAsciiReplayInput } from "../replay/ascii/ascii-replay-renderer.js";
import { getStateAfterEvents } from "../replay/ascii/state-reconstructor.js";
import { runGridMatch } from "../simulator/grid-runtime.js";

/**
 * Pure grid canary evidence inspection (Milestone 0.2C Phase 3D2A.1).
 *
 * `inspectGridCanaryEvidence` inspects a direct `runGridMatch` result and
 * fails closed (throws `GridCanaryEvidenceError`) when any required evidence
 * is absent. All exposure evidence is derived only through the canonical
 * `getRelativeBearing` / `getPlanarExposedArmourZones` functions — a corner's
 * name or adjacency is never sufficient to infer exposure. The frozen scenario
 * observes a canonical lateral flank (`right`); strict rear exposure is
 * reported separately and truthfully (it may be false).
 *
 * `assertGridCanaryFinalAgreement` verifies that the final `round_ended`
 * event, the factual-report final states and the replay reconstruction agree.
 * Both reuse the canonical movement-event subject helper and the existing
 * geometry/bearing helpers only, and no check mutates the result, the report
 * or any event.
 */
export class GridCanaryEvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridCanaryEvidenceError";
  }
}

export interface GridCanaryEvidence {
  translatedCircleEvents: number;
  cornerZonesVisited: number;
  cornerZones: readonly string[];
  lateralFlankObserved: boolean;
  observedFlankBearings: readonly GridCanaryFlankBearing[];
  strictRearExposureObserved: boolean;
  stationaryFighterCellUnchanged: boolean;
  allMovementZonesCanonical: boolean;
  fighterATranslated: boolean;
  fighterBStationary: boolean;
  fighterBFacingSouth: boolean;
  combatEvents: readonly string[];
  finalZoneA: string;
  finalZoneB: string;
}

const COMBAT_EVENT_TYPES: ReadonlySet<string> = new Set<string>([
  "attack_attempted",
  "attack_missed",
  "attack_hit",
  "integrity_damaged",
  "component_damaged",
  "component_damage_resisted",
  "component_disabled",
  "robot_overturned",
]);

const CORNER_ZONES: ReadonlySet<string> = new Set<string>([
  "north_west",
  "north_east",
  "south_west",
  "south_east",
]);

const FLANK_BEARING_SET: ReadonlySet<string> = new Set<string>(
  GRID_CANARY_FLANK_BEARINGS,
);

function isCanonicalCorner(zone: string): boolean {
  return CORNER_ZONES.has(zone);
}

/**
 * The stationary opponent: the fighter with no `movement_resolved` events. In
 * the frozen flank-v1 scenario this is always fighter_b. If both fighters move
 * the reference falls back to fighter_b (the scenario contract's stationary
 * role); if neither moves the first fighter is used.
 */
function findStationaryFighter(result: GridMatchResult): "fighter_a" | "fighter_b" {
  const moved = new Set<string>();
  for (const event of result.events) {
    if (event.type === "movement_resolved") {
      const subject = getMovementEventSubjectId(event);
      if (subject !== null) moved.add(subject);
    }
  }
  if (moved.has("fighter_a") && !moved.has("fighter_b")) return "fighter_b";
  if (moved.has("fighter_b") && !moved.has("fighter_a")) return "fighter_a";
  return "fighter_b";
}

export function inspectGridCanaryEvidence(result: GridMatchResult): GridCanaryEvidence {
  assertGridIdentity(result);
  assertGridConfig(result);

  const stationary = findStationaryFighter(result);
  const moving = stationary === "fighter_a" ? "fighter_b" : "fighter_a";

  const state: { fighter_a: GridFighterState; fighter_b: GridFighterState } = {
    fighter_a: result.initialState.fighterA,
    fighter_b: result.initialState.fighterB,
  };

  if (!isGridZone(state.fighter_a.zone) || !isGridZone(state.fighter_b.zone)) {
    throw new GridCanaryEvidenceError(
      `initial zones must be canonical grid zones; received ${String(state.fighter_a.zone)} / ${String(state.fighter_b.zone)}`,
    );
  }

  const visitedZones = new Set<string>();
  const observedFlankBearings = new Set<GridCanaryFlankBearing>();
  let translatedCircleEvents = 0;
  let strictRearExposure = false;
  const combatEvents: string[] = [];

  // Frozen-scenario role invariants.
  const fighterCellChanges: Record<"fighter_a" | "fighter_b", number> = {
    fighter_a: 0,
    fighter_b: 0,
  };
  let fighterBFacing: string = state.fighter_b.facing;

  const fighterState = (fighter: "fighter_a" | "fighter_b"): GridFighterState =>
    fighter === "fighter_a" ? state.fighter_a : state.fighter_b;

  const setFighterState = (
    fighter: "fighter_a" | "fighter_b",
    zone: GridZone,
    facing: Direction,
  ): void => {
    const previous = fighterState(fighter);
    if (previous.zone !== zone) fighterCellChanges[fighter] += 1;
    const next = { ...previous, zone, facing };
    if (fighter === "fighter_a") state.fighter_a = next;
    else {
      state.fighter_b = next;
      fighterBFacing = facing;
    }
  };

  const evaluatePosition = (): void => {
    const movingState = fighterState(moving);
    const stationaryState = fighterState(stationary);
    const bearing = getRelativeBearing(
      movingState.zone,
      stationaryState.zone,
      stationaryState.facing as Direction,
    );
    const exposed = getPlanarExposedArmourZones(bearing);
    if (exposed.includes("rear")) strictRearExposure = true;
    if (FLANK_BEARING_SET.has(bearing)) {
      observedFlankBearings.add(bearing as GridCanaryFlankBearing);
    }
  };

  // Initial position.
  evaluatePosition();

  for (const event of result.events) {
    if (event.type === "movement_resolved") {
      const subject = getMovementEventSubjectId(event);
      if (subject === null || (subject !== "fighter_a" && subject !== "fighter_b")) {
        throw new GridCanaryEvidenceError(
          "movement_resolved event has no canonical subject",
        );
      }
      const from = event.data.from;
      const to = event.data.to;
      const facing = event.data.facing;
      const action = String(event.data.action);

      if (!isGridZone(from) || !isGridZone(to)) {
        throw new GridCanaryEvidenceError(
          `movement_resolved from/to must be canonical grid zones; received ${String(from)} -> ${String(to)}`,
        );
      }
      if (
        typeof facing !== "string" ||
        !["north", "east", "south", "west"].includes(facing)
      ) {
        throw new GridCanaryEvidenceError(
          `movement_resolved facing must be a cardinal direction; received ${String(facing)}`,
        );
      }

      if (isCanonicalCorner(to)) visitedZones.add(to);
      if (action === "circle_left" || action === "circle_right") {
        if (from !== to) translatedCircleEvents += 1;
      }

      setFighterState(subject, to as GridZone, facing as Direction);
      evaluatePosition();
    } else if (event.type === "round_ended") {
      const data = event.data as {
        fighterA: { zone: string };
        fighterB: { zone: string };
      };
      const zoneA = data.fighterA.zone;
      const zoneB = data.fighterB.zone;
      if (!isGridZone(zoneA) || !isGridZone(zoneB)) {
        throw new GridCanaryEvidenceError(
          `round_ended zones must be canonical grid zones; received ${String(zoneA)} / ${String(zoneB)}`,
        );
      }
      if (state.fighter_a.zone !== (zoneA as GridZone)) {
        fighterCellChanges.fighter_a += 1;
      }
      if (state.fighter_b.zone !== (zoneB as GridZone)) {
        fighterCellChanges.fighter_b += 1;
      }
      state.fighter_a = { ...state.fighter_a, zone: zoneA as GridZone };
      state.fighter_b = { ...state.fighter_b, zone: zoneB as GridZone };
      evaluatePosition();
    } else if (COMBAT_EVENT_TYPES.has(event.type)) {
      combatEvents.push(event.type);
    }
  }

  const fighterATranslated = fighterCellChanges.fighter_a > 0;
  const fighterBStationary = fighterCellChanges.fighter_b === 0;
  const fighterBFacingSouth = fighterBFacing === "south";
  const stationaryFighterCellUnchanged = fighterCellChanges[stationary] === 0;
  const lateralFlankObserved = observedFlankBearings.size > 0;

  // Scenario role invariants fail closed first.
  if (!fighterATranslated) {
    throw new GridCanaryEvidenceError(
      "scenario invariant failed: fighter A produced no translated movement",
    );
  }
  if (!fighterBStationary) {
    throw new GridCanaryEvidenceError(
      "scenario invariant failed: fighter B changed cells",
    );
  }
  if (!fighterBFacingSouth) {
    throw new GridCanaryEvidenceError(
      "scenario invariant failed: fighter B facing is not south",
    );
  }
  if (combatEvents.length > 0) {
    throw new GridCanaryEvidenceError(
      `no-combat scenario produced combat events: ${combatEvents.join(", ")}`,
    );
  }

  // Evidence requirements fail closed.
  if (translatedCircleEvents < 1) {
    throw new GridCanaryEvidenceError(
      "no translated circle_left/circle_right event was observed",
    );
  }
  if (visitedZones.size < 1) {
    throw new GridCanaryEvidenceError("no canonical corner zone was visited");
  }
  if (!lateralFlankObserved) {
    throw new GridCanaryEvidenceError(
      "no canonical flank bearing (left/right/rear_left/rear_right/rear) was observed",
    );
  }

  return {
    translatedCircleEvents,
    cornerZonesVisited: visitedZones.size,
    cornerZones: [...visitedZones],
    lateralFlankObserved,
    observedFlankBearings: [...observedFlankBearings],
    strictRearExposureObserved: strictRearExposure,
    stationaryFighterCellUnchanged,
    allMovementZonesCanonical: true,
    fighterATranslated,
    fighterBStationary,
    fighterBFacingSouth,
    combatEvents,
    finalZoneA: state.fighter_a.zone,
    finalZoneB: state.fighter_b.zone,
  };
}

function assertGridIdentity(result: GridMatchResult): void {
  if (result.runtime.simulatorVersion !== "0.3.0") {
    throw new GridCanaryEvidenceError(
      `result must be grid simulator 0.3.0; received ${result.runtime.simulatorVersion}`,
    );
  }
  if (result.runtime.positioningModel !== "grid-3x3-v1") {
    throw new GridCanaryEvidenceError(
      `result must use positioning model grid-3x3-v1; received ${result.runtime.positioningModel}`,
    );
  }
}

function assertGridConfig(result: GridMatchResult): void {
  if (result.config.rulesetVersion !== "0.2.0") {
    throw new GridCanaryEvidenceError(
      `config must use ruleset 0.2.0; received ${result.config.rulesetVersion}`,
    );
  }
  if (result.config.catalogueVersion !== "1") {
    throw new GridCanaryEvidenceError(
      `config must use catalogue 1; received ${result.config.catalogueVersion}`,
    );
  }
}

/**
 * Final-positioning agreement (evidence check 8): the final `round_ended`
 * event, the factual-report final states and the replay reconstruction must
 * agree on both fighters' final zone, and report and replay must also agree on
 * facing and integrity.
 */
export function assertGridCanaryFinalAgreement(
  result: GridMatchResult,
  factualReport: FactualMatchReportV2,
): void {
  const roundEnds = result.events.filter((e) => e.type === "round_ended");
  if (roundEnds.length === 0) {
    throw new GridCanaryEvidenceError("no round_ended event was produced");
  }
  const lastRoundEnd = roundEnds[roundEnds.length - 1]!;
  const roundEndData = lastRoundEnd.data as {
    fighterA: { zone: string };
    fighterB: { zone: string };
  };

  const replayState = getStateAfterEvents(
    toAsciiReplayInput(result),
    result.events,
    POSITIONING_MODEL_GRID,
  );

  const reportA = factualReport.finalStates.fighterA;
  const reportB = factualReport.finalStates.fighterB;

  const agreementFailures: string[] = [];
  for (const fighter of ["fighter_a", "fighter_b"] as const) {
    const report = fighter === "fighter_a" ? reportA : reportB;
    const replay = fighter === "fighter_a" ? replayState.fighterA : replayState.fighterB;
    const roundEndZone =
      fighter === "fighter_a" ? roundEndData.fighterA.zone : roundEndData.fighterB.zone;

    if (report.zone !== roundEndZone) {
      agreementFailures.push(
        `${fighter} report zone ${report.zone} != final round_ended zone ${roundEndZone}`,
      );
    }
    if (replay.zone !== roundEndZone) {
      agreementFailures.push(
        `${fighter} replay zone ${replay.zone} != final round_ended zone ${roundEndZone}`,
      );
    }
    if (report.zone !== replay.zone) {
      agreementFailures.push(
        `${fighter} report zone ${report.zone} != replay zone ${replay.zone}`,
      );
    }
    if (report.facing !== replay.facing) {
      agreementFailures.push(
        `${fighter} report facing ${report.facing} != replay facing ${replay.facing}`,
      );
    }
    if (report.integrity !== replay.integrity) {
      agreementFailures.push(
        `${fighter} report integrity ${report.integrity} != replay integrity ${replay.integrity}`,
      );
    }
  }

  if (agreementFailures.length > 0) {
    throw new GridCanaryEvidenceError(
      `final-positioning agreement failed: ${agreementFailures.join("; ")}`,
    );
  }
}

/**
 * Determinism evidence (check 9): re-executing the same seed and scenario
 * must reproduce the identical event stream, result and round count.
 */
export function verifyGridCanaryDeterminism(
  config: MatchConfig,
  expected: GridMatchResult,
): void {
  const rerun = runGridMatch(config);
  if (rerun.rounds !== expected.rounds) {
    throw new GridCanaryEvidenceError(
      `grid canary is not deterministic: rounds ${rerun.rounds} != ${expected.rounds}`,
    );
  }
  if (JSON.stringify(rerun.result) !== JSON.stringify(expected.result)) {
    throw new GridCanaryEvidenceError(
      "grid canary is not deterministic: result differs on re-execution",
    );
  }
  if (JSON.stringify(rerun.events) !== JSON.stringify(expected.events)) {
    throw new GridCanaryEvidenceError(
      "grid canary is not deterministic: event stream differs on re-execution",
    );
  }
}
