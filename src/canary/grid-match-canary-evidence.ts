import type {
  Direction,
  GridFighterState,
  GridMatchResult,
  MatchConfig,
} from "../simulator/types.js";
import type { GridZone } from "../simulator/arena-grid.js";
import {
  getGridCoordinate,
  getPlanarExposedArmourZones,
  getRelativeBearing,
  isGridZone,
} from "../simulator/arena-grid.js";
import { getMovementEventSubjectId } from "../events/battle-event.js";
import type { FactualMatchReportV2 } from "../schemas/factual-report.schema.js";
import { POSITIONING_MODEL_GRID } from "../schemas/positioning.schema.js";
import { toAsciiReplayInput } from "../replay/ascii/ascii-replay-renderer.js";
import { getStateAfterEvents } from "../replay/ascii/state-reconstructor.js";
import { runGridMatch } from "../simulator/grid-runtime.js";

/**
 * Pure grid canary evidence inspection (Milestone 0.2C Phase 3D2A).
 *
 * `inspectGridCanaryEvidence` inspects a direct `runGridMatch` result and
 * fails closed (throws `GridCanaryEvidenceError`) when any required evidence
 * is absent. `assertGridCanaryFinalAgreement` verifies that the final
 * `round_ended` event, the factual-report final states and the replay
 * reconstruction agree. Both reuse the canonical movement-event subject helper
 * and the existing geometry/bearing helpers only — they never re-implement
 * movement subjects, zone membership or exposure, and no check mutates the
 * result, the report or any event.
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
  rearExposureObserved: true;
  allMovementZonesCanonical: true;
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

function isCanonicalCorner(zone: string): boolean {
  return CORNER_ZONES.has(zone);
}

function zonesAdjacent(a: GridZone, b: GridZone): boolean {
  const ca = getGridCoordinate(a);
  const cb = getGridCoordinate(b);
  const chebyshev = Math.max(Math.abs(ca.x - cb.x), Math.abs(ca.y - cb.y));
  return chebyshev <= 1 && !(ca.x === cb.x && ca.y === cb.y);
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
  let translatedCircleEvents = 0;
  let strictRearExposure = false;
  let cornerFlankExposure = false;
  const combatEvents: string[] = [];

  const fighterState = (fighter: "fighter_a" | "fighter_b"): GridFighterState =>
    fighter === "fighter_a" ? state.fighter_a : state.fighter_b;

  const setFighterState = (
    fighter: "fighter_a" | "fighter_b",
    zone: GridZone,
    facing: Direction,
  ): void => {
    const next = { ...fighterState(fighter), zone, facing };
    if (fighter === "fighter_a") state.fighter_a = next;
    else state.fighter_b = next;
  };

  const evaluatePosition = (): void => {
    const movingState = fighterState(moving);
    const stationaryState = fighterState(stationary);
    const exposed = getPlanarExposedArmourZones(
      getRelativeBearing(
        movingState.zone,
        stationaryState.zone,
        stationaryState.facing as Direction,
      ),
    );
    if (exposed.includes("rear")) strictRearExposure = true;
    if (
      isCanonicalCorner(movingState.zone) &&
      zonesAdjacent(movingState.zone, stationaryState.zone)
    ) {
      cornerFlankExposure = true;
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
      state.fighter_a = { ...state.fighter_a, zone: zoneA as GridZone };
      state.fighter_b = { ...state.fighter_b, zone: zoneB as GridZone };
      evaluatePosition();
    } else if (COMBAT_EVENT_TYPES.has(event.type)) {
      combatEvents.push(event.type);
    }
  }

  if (translatedCircleEvents < 1) {
    throw new GridCanaryEvidenceError(
      "no translated circle_left/circle_right event was observed",
    );
  }
  if (visitedZones.size < 1) {
    throw new GridCanaryEvidenceError("no canonical corner zone was visited");
  }
  if (!strictRearExposure && !cornerFlankExposure) {
    throw new GridCanaryEvidenceError(
      "no position exposes rear or rear-diagonal armour relative to the stationary opponent",
    );
  }
  if (combatEvents.length > 0) {
    throw new GridCanaryEvidenceError(
      `no-combat scenario produced combat events: ${combatEvents.join(", ")}`,
    );
  }

  return {
    translatedCircleEvents,
    cornerZonesVisited: visitedZones.size,
    cornerZones: [...visitedZones],
    rearExposureObserved: true,
    allMovementZonesCanonical: true,
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
