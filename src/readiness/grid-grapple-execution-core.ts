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
import type { GridMatchResult, MatchConfig, VictoryMethod } from "../simulator/types.js";
import type { GridReadinessSeedRegistry } from "./seed-registry.js";
import type { GridReadinessCompetitor } from "./scenario-registry.js";
import {
  createGridGrappleCoverageFighterConfig,
  type GridGrappleCoverageScenarioFamily,
  type GridGrappleCoverageScenarioRegistry,
} from "./grid-grapple-scenarios.js";
import {
  gridGrappleCoveragePlanChecksum,
  type GridGrappleCoverageRun,
  type GridGrappleCoverageRunPlan,
} from "./grid-grapple-run-plan.js";
import { GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT } from "./grid-grapple-run-plan.js";
import {
  extractGridGrappleRunEvidence,
  type GridFighterSlot,
  type GridGrappleRunEvidence,
} from "./grid-grapple-evidence.js";
import {
  inspectGridReadinessRecordEvidence,
  recomputeGridActivationReadinessRunChecksums,
} from "./record-evidence.js";
import { assertGridReadinessRecordReportFinalAgreement } from "./record-evidence.js";

/**
 * Pure grid grapple-coverage supplemental execution core (Milestone 0.2C
 * Phase 3E2, Phases 6/7/8).
 *
 * Executes exactly 48 deterministic grid matches (24 canonical readiness
 * seeds × 2 role assignments) from the frozen supplemental run plan with
 * fresh scenario values per run, converts each to a match-record v3 (with
 * explicitly injected identities), builds and binds the factual-report v2,
 * validates every record and report, verifies report/final-state agreement,
 * renders text and ASCII replays and the grid-aware review prompt, derives
 * canonical per-run evidence through the shared persisted-record inspector
 * AND extracts the authoritative grapple-reposition evidence from the actual
 * event contract.
 *
 * The core is deliberately pure: it never reads or writes files, never
 * generates UUIDs, never reads the clock, never calls a provider, never calls
 * a benchmark or legacy runtime, and never mutates its inputs. It may call
 * only `runGridMatch` for simulation. Identities are injected by the service
 * layer.
 */
export interface GridGrappleCoverageIdentities {
  supplementId: string;
  createdAt: string;
  /** Exactly 48 unique match UUIDs, ordered by run number. */
  matchIds: readonly string[];
}

export interface GridGrappleCoverageRunResult {
  readonly runNumber: number;
  readonly scenarioId: "grid-grapple-coverage";
  readonly assignmentId: string;
  readonly seed: number;
  readonly fighterACompetitor: GridReadinessCompetitor;
  readonly fighterBCompetitor: GridReadinessCompetitor;
  readonly roleSwapped: boolean;
  readonly attackerSlot: GridFighterSlot;
  readonly matchId: string;
  readonly recordIndex: number;
  readonly reportIndex: number;
  readonly winner: string | null;
  readonly resultMethod: VictoryMethod;
  readonly rounds: number;
  readonly eventCount: number;
  readonly evidence: GridGrappleRunEvidence;
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

export interface GridGrappleCoverageSupplementOutcome {
  readonly supplementId: string;
  readonly createdAt: string;
  readonly planChecksum: string;
  readonly inputsUnmodified: true;
  readonly matchCount: 48;
  readonly results: readonly GridGrappleCoverageRunResult[];
}

export interface ExecuteGridGrappleCoverageSupplementParams {
  seedRegistry: GridReadinessSeedRegistry;
  scenarioRegistry: GridGrappleCoverageScenarioRegistry;
  runPlan: GridGrappleCoverageRunPlan;
  identities: GridGrappleCoverageIdentities;
  /**
   * Optional per-run completion hook. The core never reads the clock; the
   * caller may use this hook to measure per-match timing with its own
   * monotonic timer.
   */
  onRunComplete?: (runNumber: number) => void;
}

export class GridGrappleCoverageCoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridGrappleCoverageCoreError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function deepSnapshot(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Returns the fighter slot that holds the Grapple Coverage Attacker for a
 * run, from the role assignment (competitor "x" is always the attacker).
 */
export function grappleAttackerSlotForRun(run: GridGrappleCoverageRun): GridFighterSlot {
  if (run.fighterACompetitor === "x" && run.fighterBCompetitor === "y") {
    return "fighter_a";
  }
  if (run.fighterACompetitor === "y" && run.fighterBCompetitor === "x") {
    return "fighter_b";
  }
  throw new GridGrappleCoverageCoreError(
    `Run ${run.runNumber} has an unknown role mapping (A=${run.fighterACompetitor}, B=${run.fighterBCompetitor})`,
  );
}

function inspectRunResult(
  result: GridMatchResult,
  record: MatchRecordV3,
  run: GridGrappleCoverageRun,
  attackerSlot: GridFighterSlot,
): GridGrappleRunEvidence {
  const label = `run ${run.runNumber} (${run.assignmentId}, seed ${run.seed})`;

  if (result.runtime.simulatorVersion !== "0.3.0") {
    throw new GridGrappleCoverageCoreError(
      `${label} must run simulator 0.3.0; received ${result.runtime.simulatorVersion}`,
    );
  }
  if (result.runtime.positioningModel !== "grid-3x3-v1") {
    throw new GridGrappleCoverageCoreError(
      `${label} must use positioning model grid-3x3-v1; received ${result.runtime.positioningModel}`,
    );
  }
  if (result.config.rulesetVersion !== "0.2.0") {
    throw new GridGrappleCoverageCoreError(
      `${label} must use ruleset 0.2.0; received ${result.config.rulesetVersion}`,
    );
  }
  if (result.config.catalogueVersion !== "1") {
    throw new GridGrappleCoverageCoreError(
      `${label} must use catalogue 1; received ${result.config.catalogueVersion}`,
    );
  }
  if (result.rounds < 1 || result.rounds > MAX_ROUNDS) {
    throw new GridGrappleCoverageCoreError(
      `${label} must have 1 <= rounds <= ${MAX_ROUNDS}; received ${result.rounds} rounds`,
    );
  }

  // The shared persisted-record inspector validates every initial/event
  // zone, policy action, movement subject/action/facing, round-end condition,
  // chronology and no-progress fact from the actual persisted record.
  try {
    inspectGridReadinessRecordEvidence(record);
  } catch (e) {
    if (e instanceof Error) {
      throw new GridGrappleCoverageCoreError(`${label} ${e.message}`);
    }
    throw e;
  }

  // Extract the authoritative grapple evidence from the actual event contract.
  try {
    return extractGridGrappleRunEvidence(record, attackerSlot);
  } catch (e) {
    if (e instanceof Error) {
      throw new GridGrappleCoverageCoreError(`${label} ${e.message}`);
    }
    throw e;
  }
}

/**
 * Pure execution core. Requires exactly 48 unique match UUIDs and one
 * supplement UUID, and throws on any evidence or schema violation. It may
 * call only `runGridMatch`.
 */
export function executeGridGrappleCoverageSupplement(
  params: ExecuteGridGrappleCoverageSupplementParams,
): GridGrappleCoverageSupplementOutcome {
  const { seedRegistry, scenarioRegistry, runPlan, identities } = params;

  if (runPlan.runCount !== GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT) {
    throw new GridGrappleCoverageCoreError(
      `Grid grapple coverage run plan must declare exactly ${GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT} runs; declared ${runPlan.runCount}`,
    );
  }
  if (runPlan.runs.length !== GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT) {
    throw new GridGrappleCoverageCoreError(
      `Grid grapple coverage run plan must contain exactly ${GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT} runs; found ${runPlan.runs.length}`,
    );
  }
  if (identities.matchIds.length !== GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT) {
    throw new GridGrappleCoverageCoreError(
      `Grid grapple coverage supplement requires exactly ${GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT} match identities; received ${identities.matchIds.length}`,
    );
  }
  if (!isUuid(identities.supplementId)) {
    throw new GridGrappleCoverageCoreError(
      `Supplement ID must be a valid UUID; received ${String(identities.supplementId)}`,
    );
  }
  const seen = new Set<string>([identities.supplementId]);
  for (const matchId of identities.matchIds) {
    if (!isUuid(matchId)) {
      throw new GridGrappleCoverageCoreError(
        `Match ID must be a valid UUID; received ${String(matchId)}`,
      );
    }
    if (seen.has(matchId)) {
      throw new GridGrappleCoverageCoreError(
        `Match IDs must be unique and distinct from the supplement ID; duplicate ${matchId}`,
      );
    }
    seen.add(matchId);
  }

  // Input-immutability snapshot.
  const seedSnapshot = deepSnapshot(seedRegistry);
  const scenarioSnapshot = deepSnapshot(scenarioRegistry);
  const planSnapshot = deepSnapshot(runPlan);

  const scenarioById = new Map<string, GridGrappleCoverageScenarioFamily>();
  for (const s of scenarioRegistry.scenarios) {
    scenarioById.set(s.scenarioId, s);
  }

  const results: GridGrappleCoverageRunResult[] = [];

  for (let index = 0; index < runPlan.runs.length; index++) {
    const run = runPlan.runs[index]!;
    const scenarioForRun = scenarioById.get(run.scenarioId);
    if (!scenarioForRun) {
      throw new GridGrappleCoverageCoreError(
        `Run ${run.runNumber} references unknown scenario ${run.scenarioId}`,
      );
    }

    const configX = createGridGrappleCoverageFighterConfig(scenarioForRun, "x");
    const configY = createGridGrappleCoverageFighterConfig(scenarioForRun, "y");
    const fighterA = run.fighterACompetitor === "x" ? configX : configY;
    const fighterB = run.fighterBCompetitor === "x" ? configX : configY;

    const config: MatchConfig = {
      seed: run.seed,
      fighterA,
      fighterB,
      rulesetVersion: "0.2.0",
      catalogueVersion: "1",
    };

    // The core may call only runGridMatch for simulation.
    const result = runGridMatch(config);

    const attackerSlot = grappleAttackerSlotForRun(run);

    const identity = {
      matchId: identities.matchIds[index]!,
      createdAt: identities.createdAt,
    };
    const converted = matchResultToRecord(result, [], identity);
    if (!isV3Record(converted)) {
      throw new GridGrappleCoverageCoreError(
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
      throw new GridGrappleCoverageCoreError(
        `Run ${run.runNumber} record failed validation: ${recordValidation.errors}`,
      );
    }
    const reportValidation = validateFactualMatchReport(report);
    if (!reportValidation.ok) {
      throw new GridGrappleCoverageCoreError(
        `Run ${run.runNumber} factual report failed validation: ${reportValidation.errors}`,
      );
    }

    // Complete report/final-state agreement through the shared rule.
    try {
      assertGridReadinessRecordReportFinalAgreement(record, report);
    } catch (e) {
      throw new GridGrappleCoverageCoreError(
        `Run ${run.runNumber} report/final-state agreement failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const evidence = inspectRunResult(result, record, run, attackerSlot);

    const serializedRecord = serializeMatchRecord(record);
    const serializedReport = serializeFactualMatchReport(report);
    const checksums = recomputeGridActivationReadinessRunChecksums(record, report);

    results.push({
      runNumber: run.runNumber,
      scenarioId: scenarioForRun.scenarioId,
      assignmentId: run.assignmentId,
      seed: run.seed,
      fighterACompetitor: run.fighterACompetitor,
      fighterBCompetitor: run.fighterBCompetitor,
      roleSwapped: run.roleSwapped,
      attackerSlot,
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
    throw new GridGrappleCoverageCoreError(
      "A supplied seed registry, scenario registry or run plan was mutated during execution",
    );
  }

  return {
    supplementId: identities.supplementId,
    createdAt: identities.createdAt,
    planChecksum: gridGrappleCoveragePlanChecksum(runPlan),
    inputsUnmodified: true,
    matchCount: GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
    results: Object.freeze(results),
  };
}

/**
 * Deterministic repeat (Phase 8). Requires byte-identical serialized v3
 * records, serialized v2 reports, per-run evidence, replay checksums, ASCII
 * checksums, review-prompt checksums and ordered aggregate inputs. A mismatch
 * is a hard supplement failure.
 */
export function verifyGridGrappleCoverageDeterminism(
  primary: GridGrappleCoverageSupplementOutcome,
  repeat: GridGrappleCoverageSupplementOutcome,
): void {
  if (primary.matchCount !== repeat.matchCount) {
    throw new GridGrappleCoverageCoreError(
      `Grid grapple coverage determinism failed: match count ${primary.matchCount} != ${repeat.matchCount}`,
    );
  }
  if (primary.planChecksum !== repeat.planChecksum) {
    throw new GridGrappleCoverageCoreError(
      "Grid grapple coverage determinism failed: plan checksum differs on re-execution",
    );
  }
  for (let index = 0; index < primary.results.length; index++) {
    const a = primary.results[index]!;
    const b = repeat.results[index]!;
    const label = `run ${a.runNumber}`;
    if (a.serializedRecord !== b.serializedRecord) {
      throw new GridGrappleCoverageCoreError(
        `Grid grapple coverage determinism failed: ${label} serialized v3 record differs`,
      );
    }
    if (a.serializedReport !== b.serializedReport) {
      throw new GridGrappleCoverageCoreError(
        `Grid grapple coverage determinism failed: ${label} serialized v2 report differs`,
      );
    }
    if (JSON.stringify(a.evidence) !== JSON.stringify(b.evidence)) {
      throw new GridGrappleCoverageCoreError(
        `Grid grapple coverage determinism failed: ${label} per-run evidence differs`,
      );
    }
    if (
      a.recordChecksum !== b.recordChecksum ||
      a.reportChecksum !== b.reportChecksum ||
      a.textReplayChecksum !== b.textReplayChecksum ||
      a.asciiReplayChecksum !== b.asciiReplayChecksum ||
      a.reviewPromptChecksum !== b.reviewPromptChecksum
    ) {
      throw new GridGrappleCoverageCoreError(
        `Grid grapple coverage determinism failed: ${label} artifact checksums differ`,
      );
    }
    if (
      a.attackerSlot !== b.attackerSlot ||
      a.assignmentId !== b.assignmentId ||
      a.seed !== b.seed
    ) {
      throw new GridGrappleCoverageCoreError(
        `Grid grapple coverage determinism failed: ${label} ordered aggregate inputs differ`,
      );
    }
  }
}
