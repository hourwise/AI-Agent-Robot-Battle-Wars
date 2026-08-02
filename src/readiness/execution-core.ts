import { runGridMatch } from "../simulator/grid-runtime.js";
import { MAX_ROUNDS } from "../simulator/constants.js";
import { matchResultToRecord } from "../persistence/match-converter.js";
import { buildGridFactualReport } from "../reports/factual-match-report.js";
import { bindGridFactualReportToMatchRecord } from "../reports/grid-factual-report-binding.js";
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
import { assertGridCanaryFinalAgreement } from "../canary/grid-match-canary-evidence.js";
import type { GridMatchResult, MatchConfig, VictoryMethod } from "../simulator/types.js";
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
import {
  gridRecordToGridResult,
  inspectGridReadinessRecordEvidence,
  recomputeGridActivationReadinessRunChecksums,
  type GridActivationReadinessRunEvidence,
} from "./record-evidence.js";

export type { GridActivationReadinessRunEvidence } from "./record-evidence.js";
export { computeMaximumConsecutiveNoProgressRounds } from "./record-evidence.js";

/**
 * Pure grid activation-readiness execution core (Milestone 0.2C Phase 3E1 /
 * 3E1.1).
 *
 * Executes exactly 312 deterministic grid matches from the frozen run plan
 * with fresh scenario values per run, converts each to a match-record v3 (with
 * explicitly injected identities), builds and binds the factual-report v2,
 * validates every record and report, verifies replay/report/final-round
 * agreement, renders text and ASCII replays and the grid-aware review prompt,
 * and derives canonical per-run evidence through the shared persisted-record
 * inspector (`inspectGridReadinessRecordEvidence`) — selected actions come
 * from `policy_triggered`, translated ordinary movement from
 * `movement_resolved`, and reposition events use target-subject semantics.
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

function deepSnapshot(value: unknown): string {
  return JSON.stringify(value);
}

function inspectRunResult(
  result: GridMatchResult,
  record: MatchRecordV3,
  run: GridActivationReadinessRun,
): GridActivationReadinessRunEvidence {
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

  // The shared persisted-record inspector validates every initial/event
  // zone, policy action, movement subject/action/facing, round-end condition
  // and no-progress fact from the actual persisted record.
  try {
    return inspectGridReadinessRecordEvidence(record);
  } catch (e) {
    if (e instanceof Error) {
      throw new GridActivationReadinessCoreError(`${label} ${e.message}`);
    }
    throw e;
  }
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

    // The shared persisted-record inspector derives the authoritative
    // per-run evidence (selected actions from policy_triggered, translated
    // ordinary movement, reposition events, zones, bearings, exposure,
    // no-progress and combat evidence) from the actual persisted record.
    const evidence = inspectRunResult(result, record, run);

    // Reconstruct the renderer-compatible grid result from the persisted
    // record so replay rendering, the review prompt, final agreement and the
    // derived checksums are identical to the read-back reconstruction.
    const renderResult = gridRecordToGridResult(record);
    assertGridCanaryFinalAgreement(renderResult, report);

    const serializedRecord = serializeMatchRecord(record);
    const serializedReport = serializeFactualMatchReport(report);
    const checksums = recomputeGridActivationReadinessRunChecksums(record, report);

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
      recordChecksum: checksums.recordChecksum,
      reportChecksum: checksums.reportChecksum,
      textReplayChecksum: checksums.textReplayChecksum,
      asciiReplayChecksum: checksums.asciiReplayChecksum,
      reviewPromptChecksum: checksums.reviewPromptChecksum,
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
