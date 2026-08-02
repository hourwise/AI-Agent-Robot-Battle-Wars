import { runGridMatch } from "../simulator/grid-runtime.js";
import { MAX_ROUNDS } from "../simulator/constants.js";
import { matchResultToRecord } from "../persistence/match-converter.js";
import { buildGridFactualReport } from "../reports/factual-match-report.js";
import { bindGridFactualReportToMatchRecord } from "../reports/grid-factual-report-binding.js";
import { renderTextReplay } from "../replay/text-replay-renderer.js";
import { renderAsciiReplay } from "../replay/ascii/ascii-replay-renderer.js";
import { buildReviewUserPrompt } from "../prompts/review-prompt.v1.js";
import { POSITIONING_MODEL_GRID } from "../schemas/positioning.schema.js";
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
  isV3Record,
  serializeMatchRecord,
  validateMatchRecord,
  type MatchRecordV3,
} from "../schemas/match-record.schema.js";
import {
  serializeFactualMatchReport,
  validateFactualMatchReport,
  type FactualMatchReportV2,
} from "../schemas/factual-report.schema.js";
import { sha256Hex } from "../canary/grid-canary-digest.js";
import { assertGridCanaryFinalAgreement } from "../canary/grid-match-canary-evidence.js";
import type {
  Direction,
  GridFighterState,
  GridMatchResult,
  MatchConfig,
  MovementAction,
  SimulationEvent,
  VictoryMethod,
} from "../simulator/types.js";
import type { GridReadinessSeedRegistry } from "./seed-registry.js";
import {
  createGridReadinessFighterConfig,
  type GridReadinessCompetitor,
  type GridReadinessScenarioFamily,
  type GridReadinessScenarioRegistry,
} from "./scenario-registry.js";
import {
  gridActivationReadinessSuiteChecksum,
  type GridActivationReadinessRun,
  type GridActivationReadinessRunPlan,
} from "./run-plan.js";
import { GRID_ACTIVATION_READINESS_RUN_COUNT } from "./run-plan.js";

/**
 * Pure grid activation-readiness execution core (Milestone 0.2C Phase 3E1).
 *
 * Executes exactly 312 deterministic grid matches from the frozen run plan
 * with fresh scenario values per run, converts each to a match-record v3 (with
 * explicitly injected identities), builds and binds the factual-report v2,
 * validates every record and report, verifies replay/report/final-round
 * agreement, renders text and ASCII replays and the grid-aware review prompt,
 * collects canonical per-run evidence, and fails closed on any violation.
 *
 * The core is deliberately pure: it never reads or writes files, never
 * generates UUIDs, never reads the clock, never calls a provider, never calls
 * a benchmark or legacy runtime, and never mutates its inputs. Identities are
 * injected by the service layer.
 */
export interface GridActivationReadinessIdentities {
  evaluationId: string;
  createdAt: string;
  /** Exactly 312 unique match UUIDs, ordered by run number. */
  matchIds: readonly string[];
}

export interface GridActivationReadinessRunEvidence {
  readonly actionCounts: Readonly<Record<MovementAction, number>>;
  readonly translatedActionCounts: Readonly<Record<MovementAction, number>>;
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

export interface GridActivationReadinessRunResult {
  readonly runNumber: number;
  readonly scenarioId: string;
  readonly assignmentId: string;
  readonly seed: number;
  readonly fighterACompetitor: GridReadinessCompetitor;
  readonly fighterBCompetitor: GridReadinessCompetitor;
  readonly roleSwapped: boolean;
  readonly matchId: string;
  readonly recordIndex: number;
  readonly reportIndex: number;
  readonly winner: string | null;
  readonly resultMethod: VictoryMethod;
  readonly rounds: number;
  readonly eventCount: number;
  readonly evidence: GridActivationReadinessRunEvidence;
  readonly record: MatchRecordV3;
  readonly report: FactualMatchReportV2;
  readonly serializedRecord: string;
  readonly serializedReport: string;
  readonly recordChecksum: string;
  readonly reportChecksum: string;
  readonly textReplayChecksum: string;
  readonly asciiReplayChecksum: string;
  readonly reviewPromptChecksum: string;
}

export interface GridActivationReadinessSuiteOutcome {
  readonly evaluationId: string;
  readonly createdAt: string;
  readonly suiteChecksum: string;
  readonly inputsUnmodified: true;
  readonly matchCount: 312;
  readonly results: readonly GridActivationReadinessRunResult[];
}

export interface ExecuteGridActivationReadinessSuiteParams {
  seedRegistry: GridReadinessSeedRegistry;
  scenarioRegistry: GridReadinessScenarioRegistry;
  runPlan: GridActivationReadinessRunPlan;
  identities: GridActivationReadinessIdentities;
  /**
   * Optional per-run completion hook. The core never reads the clock; the
   * caller may use this hook to measure per-match timing with its own
   * monotonic timer.
   */
  onRunComplete?: (runNumber: number) => void;
}

export class GridActivationReadinessCoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridActivationReadinessCoreError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
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

function emptyActionCounts(): Record<MovementAction, number> {
  return {
    advance: 0,
    retreat: 0,
    circle_left: 0,
    circle_right: 0,
    hold: 0,
  };
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

function deepSnapshot(value: unknown): string {
  return JSON.stringify(value);
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

interface CollectedRunEvidence extends GridActivationReadinessRunEvidence {
  actionCounts: Record<MovementAction, number>;
  translatedActionCounts: Record<MovementAction, number>;
  zoneVisits: Record<GridZone, number>;
  bearingCounts: Record<RelativeBearing, number>;
  exposedPlanarArmourZoneCounts: Record<PlanarArmourZone, number>;
  eventTypeCounts: Record<string, number>;
}

function inspectRunResult(
  result: GridMatchResult,
  run: GridActivationReadinessRun,
): CollectedRunEvidence {
  const label = `run ${run.runNumber} (${run.scenarioId}/${run.assignmentId}, seed ${run.seed})`;

  if (result.runtime.simulatorVersion !== "0.3.0") {
    throw new GridActivationReadinessCoreError(
      `${label} must run simulator 0.3.0; received ${result.runtime.simulatorVersion}`,
    );
  }
  if (result.runtime.positioningModel !== "grid-3x3-v1") {
    throw new GridActivationReadinessCoreError(
      `${label} must use positioning model grid-3x3-v1; received ${result.runtime.positioningModel}`,
    );
  }
  if (result.config.rulesetVersion !== "0.2.0") {
    throw new GridActivationReadinessCoreError(
      `${label} must use ruleset 0.2.0; received ${result.config.rulesetVersion}`,
    );
  }
  if (result.config.catalogueVersion !== "1") {
    throw new GridActivationReadinessCoreError(
      `${label} must use catalogue 1; received ${result.config.catalogueVersion}`,
    );
  }
  if (result.rounds < 1 || result.rounds > MAX_ROUNDS) {
    throw new GridActivationReadinessCoreError(
      `${label} must have 1 <= rounds <= ${MAX_ROUNDS}; received ${result.rounds} rounds`,
    );
  }

  for (const fighter of [result.initialState.fighterA, result.initialState.fighterB]) {
    if (!isGridZone(fighter.zone)) {
      throw new GridActivationReadinessCoreError(
        `${label} initial zone is not canonical: ${String(fighter.zone)}`,
      );
    }
    if (!CARDINAL_FACINGS.has(fighter.facing)) {
      throw new GridActivationReadinessCoreError(
        `${label} initial facing is not cardinal: ${String(fighter.facing)}`,
      );
    }
    for (const condition of fighter.conditions) {
      if (!VALID_CONDITIONS.has(condition)) {
        throw new GridActivationReadinessCoreError(
          `${label} initial condition is not canonical: ${String(condition)}`,
        );
      }
    }
  }

  const actionCounts = emptyActionCounts();
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

  for (const event of result.events) {
    eventTypeCounts[event.type] = (eventTypeCounts[event.type] ?? 0) + 1;

    if (event.type === "movement_resolved") {
      const data = event.data as {
        from?: unknown;
        to?: unknown;
        facing?: unknown;
        action?: unknown;
      };
      if (!isGridZone(data.from) || !isGridZone(data.to)) {
        throw new GridActivationReadinessCoreError(
          `${label} movement_resolved from/to must be canonical grid zones; received ${String(data.from)} -> ${String(data.to)}`,
        );
      }
      if (!isMovementEventAction(data.action)) {
        throw new GridActivationReadinessCoreError(
          `${label} movement_resolved has a non-canonical action: ${String(data.action)}`,
        );
      }
      if (typeof data.facing !== "string" || !CARDINAL_FACINGS.has(data.facing)) {
        throw new GridActivationReadinessCoreError(
          `${label} movement_resolved facing must be a cardinal direction; received ${String(data.facing)}`,
        );
      }
      const subject = getMovementEventSubjectId(event);
      if (subject !== "fighter_a" && subject !== "fighter_b") {
        throw new GridActivationReadinessCoreError(
          `${label} movement_resolved event has no canonical subject`,
        );
      }
      if (data.action === "knockback") knockbackEvents += 1;
      else if (data.action === "grapple") grappleRepositionEvents += 1;
      else {
        const action = data.action as MovementAction;
        actionCounts[action] += 1;
        if (data.from !== data.to) translatedActionCounts[action] += 1;
      }
    } else if (event.type === "round_ended") {
      const data = event.data as {
        fighterA: { zone: string; conditions: readonly string[] };
        fighterB: { zone: string; conditions: readonly string[] };
      };
      if (!isGridZone(data.fighterA.zone) || !isGridZone(data.fighterB.zone)) {
        throw new GridActivationReadinessCoreError(
          `${label} round_ended zones must be canonical grid zones; received ${String(data.fighterA.zone)} / ${String(data.fighterB.zone)}`,
        );
      }
      for (const fighter of [data.fighterA, data.fighterB]) {
        for (const condition of fighter.conditions) {
          if (!VALID_CONDITIONS.has(condition)) {
            throw new GridActivationReadinessCoreError(
              `${label} round_ended condition is not canonical: ${String(condition)}`,
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

  const positionEvidence = collectPositionEvidence(result.initialState, result.events);

  return {
    actionCounts,
    translatedActionCounts,
    stationaryHoldCount: actionCounts.hold,
    zoneVisits: positionEvidence.zoneVisits,
    bearingCounts: positionEvidence.bearingCounts,
    exposedPlanarArmourZoneCounts: positionEvidence.exposedPlanarArmourZoneCounts,
    eventTypeCounts,
    maximumConsecutiveNoProgressRounds: computeMaximumConsecutiveNoProgressRounds(
      result.events,
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
 * Pure execution core. Requires exactly 312 unique match UUIDs and one
 * evaluation UUID, and throws on any evidence or schema violation.
 */
export function executeGridActivationReadinessSuite(
  params: ExecuteGridActivationReadinessSuiteParams,
): GridActivationReadinessSuiteOutcome {
  const { seedRegistry, scenarioRegistry, runPlan, identities } = params;

  if (runPlan.runCount !== GRID_ACTIVATION_READINESS_RUN_COUNT) {
    throw new GridActivationReadinessCoreError(
      `Readiness run plan must declare exactly ${GRID_ACTIVATION_READINESS_RUN_COUNT} runs; declared ${runPlan.runCount}`,
    );
  }
  if (runPlan.runs.length !== GRID_ACTIVATION_READINESS_RUN_COUNT) {
    throw new GridActivationReadinessCoreError(
      `Readiness run plan must contain exactly ${GRID_ACTIVATION_READINESS_RUN_COUNT} runs; found ${runPlan.runs.length}`,
    );
  }
  if (identities.matchIds.length !== GRID_ACTIVATION_READINESS_RUN_COUNT) {
    throw new GridActivationReadinessCoreError(
      `Readiness suite requires exactly ${GRID_ACTIVATION_READINESS_RUN_COUNT} match identities; received ${identities.matchIds.length}`,
    );
  }
  if (!isUuid(identities.evaluationId)) {
    throw new GridActivationReadinessCoreError(
      `Evaluation ID must be a valid UUID; received ${String(identities.evaluationId)}`,
    );
  }
  const seen = new Set<string>([identities.evaluationId]);
  for (const matchId of identities.matchIds) {
    if (!isUuid(matchId)) {
      throw new GridActivationReadinessCoreError(
        `Match ID must be a valid UUID; received ${String(matchId)}`,
      );
    }
    if (seen.has(matchId)) {
      throw new GridActivationReadinessCoreError(
        `Match IDs must be unique and distinct from the evaluation ID; duplicate ${matchId}`,
      );
    }
    seen.add(matchId);
  }

  // Input-immutability snapshot.
  const seedSnapshot = deepSnapshot(seedRegistry);
  const scenarioSnapshot = deepSnapshot(scenarioRegistry);
  const planSnapshot = deepSnapshot(runPlan);

  const scenarioById = new Map<string, GridReadinessScenarioFamily>();
  for (const scenario of scenarioRegistry.scenarios) {
    scenarioById.set(scenario.scenarioId, scenario);
  }

  const results: GridActivationReadinessRunResult[] = [];

  for (let index = 0; index < runPlan.runs.length; index++) {
    const run = runPlan.runs[index]!;
    const scenario = scenarioById.get(run.scenarioId);
    if (!scenario) {
      throw new GridActivationReadinessCoreError(
        `Run ${run.runNumber} references unknown scenario ${run.scenarioId}`,
      );
    }

    const configX = createGridReadinessFighterConfig(scenario, "x");
    const configY = createGridReadinessFighterConfig(scenario, "y");
    const fighterA = run.fighterACompetitor === "x" ? configX : configY;
    const fighterB = run.fighterBCompetitor === "x" ? configX : configY;

    const config: MatchConfig = {
      seed: run.seed,
      fighterA,
      fighterB,
      rulesetVersion: "0.2.0",
      catalogueVersion: "1",
    };

    const result = runGridMatch(config);

    const evidence = inspectRunResult(result, run);

    const identity = {
      matchId: identities.matchIds[index]!,
      createdAt: identities.createdAt,
    };
    const converted = matchResultToRecord(result, [], identity);
    if (!isV3Record(converted)) {
      throw new GridActivationReadinessCoreError(
        `Run ${run.runNumber} record must be schema v3`,
      );
    }
    const record: MatchRecordV3 = converted;

    const report = bindGridFactualReportToMatchRecord(
      buildGridFactualReport(result),
      record,
    );

    const recordValidation = validateMatchRecord(record);
    if (!recordValidation.ok) {
      throw new GridActivationReadinessCoreError(
        `Run ${run.runNumber} record failed validation: ${recordValidation.errors}`,
      );
    }
    const reportValidation = validateFactualMatchReport(report);
    if (!reportValidation.ok) {
      throw new GridActivationReadinessCoreError(
        `Run ${run.runNumber} factual report failed validation: ${reportValidation.errors}`,
      );
    }

    assertGridCanaryFinalAgreement(result, report);

    const textReplay = renderTextReplay(result);
    const asciiReplay = renderAsciiReplay(
      result,
      { mode: "ascii" },
      POSITIONING_MODEL_GRID,
    );
    const reviewPrompt = buildReviewUserPrompt(report);

    const serializedRecord = serializeMatchRecord(record);
    const serializedReport = serializeFactualMatchReport(report);

    results.push({
      runNumber: run.runNumber,
      scenarioId: run.scenarioId,
      assignmentId: run.assignmentId,
      seed: run.seed,
      fighterACompetitor: run.fighterACompetitor,
      fighterBCompetitor: run.fighterBCompetitor,
      roleSwapped: run.roleSwapped,
      matchId: record.matchId,
      recordIndex: run.runNumber - 1,
      reportIndex: run.runNumber - 1,
      winner: result.result.winner,
      resultMethod: result.result.method,
      rounds: result.rounds,
      eventCount: result.events.length,
      evidence,
      record,
      report,
      serializedRecord,
      serializedReport,
      recordChecksum: sha256Hex(serializedRecord),
      reportChecksum: sha256Hex(serializedReport),
      textReplayChecksum: sha256Hex(textReplay),
      asciiReplayChecksum: sha256Hex(asciiReplay),
      reviewPromptChecksum: sha256Hex(reviewPrompt),
    });

    params.onRunComplete?.(run.runNumber);
  }

  // Input immutability: nothing supplied may have been mutated.
  if (
    deepSnapshot(seedRegistry) !== seedSnapshot ||
    deepSnapshot(scenarioRegistry) !== scenarioSnapshot ||
    deepSnapshot(runPlan) !== planSnapshot
  ) {
    throw new GridActivationReadinessCoreError(
      "A supplied seed registry, scenario registry or run plan was mutated during execution",
    );
  }

  return {
    evaluationId: identities.evaluationId,
    createdAt: identities.createdAt,
    suiteChecksum: gridActivationReadinessSuiteChecksum(runPlan),
    inputsUnmodified: true,
    matchCount: GRID_ACTIVATION_READINESS_RUN_COUNT,
    results: Object.freeze(results),
  };
}

/**
 * Deterministic re-execution (Phase 6). Requires byte-identical serialized v3
 * records, serialized v2 reports, per-run evidence, replay checksums, ASCII
 * checksums, review-prompt checksums and ordered aggregate inputs. A mismatch
 * is a hard readiness failure.
 */
export function verifyGridActivationReadinessDeterminism(
  primary: GridActivationReadinessSuiteOutcome,
  repeat: GridActivationReadinessSuiteOutcome,
): void {
  if (primary.matchCount !== repeat.matchCount) {
    throw new GridActivationReadinessCoreError(
      `Readiness determinism failed: match count ${primary.matchCount} != ${repeat.matchCount}`,
    );
  }
  if (primary.suiteChecksum !== repeat.suiteChecksum) {
    throw new GridActivationReadinessCoreError(
      "Readiness determinism failed: suite checksum differs on re-execution",
    );
  }
  for (let index = 0; index < primary.results.length; index++) {
    const a = primary.results[index]!;
    const b = repeat.results[index]!;
    const label = `run ${a.runNumber}`;
    if (a.serializedRecord !== b.serializedRecord) {
      throw new GridActivationReadinessCoreError(
        `Readiness determinism failed: ${label} serialized v3 record differs`,
      );
    }
    if (a.serializedReport !== b.serializedReport) {
      throw new GridActivationReadinessCoreError(
        `Readiness determinism failed: ${label} serialized v2 report differs`,
      );
    }
    if (JSON.stringify(a.evidence) !== JSON.stringify(b.evidence)) {
      throw new GridActivationReadinessCoreError(
        `Readiness determinism failed: ${label} per-run evidence differs`,
      );
    }
    if (
      a.recordChecksum !== b.recordChecksum ||
      a.reportChecksum !== b.reportChecksum ||
      a.textReplayChecksum !== b.textReplayChecksum ||
      a.asciiReplayChecksum !== b.asciiReplayChecksum ||
      a.reviewPromptChecksum !== b.reviewPromptChecksum
    ) {
      throw new GridActivationReadinessCoreError(
        `Readiness determinism failed: ${label} artifact checksums differ`,
      );
    }
  }
}
