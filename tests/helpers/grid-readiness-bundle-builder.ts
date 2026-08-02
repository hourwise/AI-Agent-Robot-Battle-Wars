import registryJson from "../../config/readiness/grid-readiness-development-v1.json";
import {
  loadGridReadinessSeedRegistry,
  gridReadinessSeedRegistryChecksum,
} from "../../src/readiness/seed-registry.js";
import {
  createGridReadinessScenarioRegistry,
  gridReadinessScenarioRegistryChecksum,
} from "../../src/readiness/scenario-registry.js";
import {
  buildGridActivationReadinessRunPlan,
  gridActivationReadinessSuiteChecksum,
  GRID_ACTIVATION_READINESS_SUITE_ID,
  GRID_READINESS_ACTION_EVIDENCE_MODEL,
} from "../../src/readiness/run-plan.js";
import {
  executeGridActivationReadinessSuite,
  type GridActivationReadinessRunResult,
  type GridActivationReadinessSuiteOutcome,
} from "../../src/readiness/execution-core.js";
import { serializeGridActivationReadinessEnvelope } from "../../src/readiness/envelopes.schema.js";
import {
  computeGridActivationReadinessMetrics,
  wrapGridActivationReadinessMetricsV2,
  type GridActivationReadinessMetrics,
} from "../../src/readiness/metrics.js";
import { evaluateGridActivationReadinessGates } from "../../src/readiness/gates.js";
import {
  buildGridActivationReadinessDecision,
  type GridActivationReadinessDecisionV2,
} from "../../src/readiness/decision.js";
import { buildGridActivationReadinessReport } from "../../src/readiness/report.js";
import {
  buildGridActivationReadinessManifest,
  serializeGridActivationReadinessManifest,
  serializeGridReadinessSeedRegistry,
  serializeGridReadinessScenarioRegistry,
  GRID_READINESS_MANIFEST_FILE,
  GRID_READINESS_SEED_REGISTRY_ARTIFACT,
  GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT,
  GRID_READINESS_RUN_INDEX_ARTIFACT,
  GRID_READINESS_MATCH_RECORDS_ARTIFACT,
  GRID_READINESS_FACTUAL_REPORTS_ARTIFACT,
  GRID_READINESS_METRICS_ARTIFACT,
  GRID_READINESS_DECISION_ARTIFACT,
  GRID_READINESS_REPORT_ARTIFACT,
  type GridActivationReadinessManifestV2,
} from "../../src/readiness/readiness-bundle.js";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";

export const READINESS_TEST_EVALUATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const READINESS_TEST_CREATED_AT = "2024-06-01T00:00:00.000Z";

export function readinessTestMatchIds(): string[] {
  return Array.from({ length: 312 }, (_, i) => {
    const tail = String(i).padStart(12, "0");
    return `bbbbbbbb-bbbb-4bbb-8bbb-${tail}`;
  });
}

export function readinessTestSeedRegistry() {
  return loadGridReadinessSeedRegistry(registryJson);
}

export function readinessTestScenarioRegistry() {
  return createGridReadinessScenarioRegistry();
}

export function readinessTestRunPlan() {
  const seedRegistry = readinessTestSeedRegistry();
  const scenarioRegistry = readinessTestScenarioRegistry();
  return buildGridActivationReadinessRunPlan({ seedRegistry, scenarioRegistry });
}

export function executeReadinessTestSuite(): GridActivationReadinessSuiteOutcome {
  const seedRegistry = readinessTestSeedRegistry();
  const scenarioRegistry = readinessTestScenarioRegistry();
  const runPlan = readinessTestRunPlan();
  return executeGridActivationReadinessSuite({
    seedRegistry,
    scenarioRegistry,
    runPlan,
    identities: {
      evaluationId: READINESS_TEST_EVALUATION_ID,
      createdAt: READINESS_TEST_CREATED_AT,
      matchIds: readinessTestMatchIds(),
    },
  });
}

export function toReadinessTestRunIndexEntry(run: GridActivationReadinessRunResult) {
  return {
    runNumber: run.runNumber,
    scenarioId: run.scenarioId,
    assignmentId: run.assignmentId,
    seed: run.seed,
    fighterACompetitor: run.fighterACompetitor,
    fighterBCompetitor: run.fighterBCompetitor,
    roleSwapped: run.roleSwapped,
    matchId: run.matchId,
    recordIndex: run.recordIndex,
    reportIndex: run.reportIndex,
    winner: run.winner,
    resultMethod: run.resultMethod,
    rounds: run.rounds,
    eventCount: run.eventCount,
    actionCounts: run.evidence.actionCounts,
    selectedMovementActionCounts: run.evidence.selectedMovementActionCounts,
    selectedCombatActionCounts: run.evidence.selectedCombatActionCounts,
    translatedActionCounts: run.evidence.translatedActionCounts,
    zoneVisits: run.evidence.zoneVisits,
    bearingCounts: run.evidence.bearingCounts,
    exposedPlanarArmourZoneCounts: run.evidence.exposedPlanarArmourZoneCounts,
    eventTypeCounts: run.evidence.eventTypeCounts,
    maximumConsecutiveNoProgressRounds: run.evidence.maximumConsecutiveNoProgressRounds,
    recordChecksum: run.recordChecksum,
    reportChecksum: run.reportChecksum,
    textReplayChecksum: run.textReplayChecksum,
    asciiReplayChecksum: run.asciiReplayChecksum,
    reviewPromptChecksum: run.reviewPromptChecksum,
  };
}

export interface ReadinessTestBundle {
  contents: Record<string, string>;
  outcome: GridActivationReadinessSuiteOutcome;
  metrics: GridActivationReadinessMetrics;
  decision: GridActivationReadinessDecisionV2;
  manifest: GridActivationReadinessManifestV2;
  seedRegistry: ReturnType<typeof readinessTestSeedRegistry>;
  scenarioRegistry: ReturnType<typeof readinessTestScenarioRegistry>;
  runPlan: ReturnType<typeof readinessTestRunPlan>;
}

/**
 * Builds a fully consistent in-memory readiness bundle from one real suite
 * execution (identical to the service pipeline, without filesystem access).
 */
export function buildReadinessTestBundle(): ReadinessTestBundle {
  const seedRegistry = readinessTestSeedRegistry();
  const scenarioRegistry = readinessTestScenarioRegistry();
  const runPlan = readinessTestRunPlan();
  const outcome = executeReadinessTestSuite();
  const suiteChecksum = gridActivationReadinessSuiteChecksum(runPlan);

  const recordsEnvelope = {
    schemaVersion: "1",
    evaluationId: READINESS_TEST_EVALUATION_ID,
    items: outcome.results.map((r) => r.record),
  };
  const reportsEnvelope = {
    schemaVersion: "1",
    evaluationId: READINESS_TEST_EVALUATION_ID,
    items: outcome.results.map((r) => r.report),
  };
  const runIndexEnvelope = {
    schemaVersion: "2" as const,
    suiteId: GRID_ACTIVATION_READINESS_SUITE_ID,
    evaluationId: READINESS_TEST_EVALUATION_ID,
    items: outcome.results.map(toReadinessTestRunIndexEntry),
  };

  const metrics = computeGridActivationReadinessMetrics({
    runs: outcome.results.map((run) => ({
      resultMethod: run.resultMethod,
      rounds: run.rounds,
      winner: run.winner,
      scenarioId: run.scenarioId,
      seed: run.seed,
      fighterACompetitor: run.fighterACompetitor,
      roleSwapped: run.roleSwapped,
      evidence: run.evidence,
    })),
    execution: {
      deterministicMatches: 312,
      invalidEventCount: 0,
      mutationFailures: 0,
    },
    timing: { totalElapsedMs: 0, perMatchMs: [] },
  });

  const gates = evaluateGridActivationReadinessGates({
    metrics,
    results: outcome.results.map((run) => ({
      record: run.record,
      report: run.report,
    })),
    inputsUnmodified: true,
    artifactIntegrityVerified: true,
    legacyIsolationVerified: true,
  });

  const decision = buildGridActivationReadinessDecision({
    evaluationId: READINESS_TEST_EVALUATION_ID,
    createdAt: READINESS_TEST_CREATED_AT,
    gates: gates.gates,
    anyFail: gates.anyFail,
    anyInconclusive: gates.anyInconclusive,
  });

  const report = buildGridActivationReadinessReport({
    evaluationId: READINESS_TEST_EVALUATION_ID,
    suiteId: GRID_ACTIVATION_READINESS_SUITE_ID,
    actionEvidenceModel: GRID_READINESS_ACTION_EVIDENCE_MODEL,
    createdAt: READINESS_TEST_CREATED_AT,
    seedRegistryId: seedRegistry.registryId,
    seedRegistryChecksum: gridReadinessSeedRegistryChecksum(seedRegistry),
    scenarioRegistryId: scenarioRegistry.registryId,
    scenarioRegistryChecksum: gridReadinessScenarioRegistryChecksum(scenarioRegistry),
    suiteChecksum,
    seedCount: seedRegistry.seeds.length,
    scenarioCount: scenarioRegistry.scenarios.length,
    assignmentCount: scenarioRegistry.assignments.length,
    totalSimulations: 312,
    deterministic: true,
    metrics,
    gates: gates.gates,
    decision: decision.decision,
  });

  const serializedSeedRegistry = serializeGridReadinessSeedRegistry(seedRegistry);
  const serializedScenarioRegistry =
    serializeGridReadinessScenarioRegistry(scenarioRegistry);
  const serializedRunIndex = serializeGridActivationReadinessEnvelope(runIndexEnvelope);
  const serializedRecords = serializeGridActivationReadinessEnvelope(recordsEnvelope);
  const serializedReports = serializeGridActivationReadinessEnvelope(reportsEnvelope);
  const serializedMetrics = serializeGridActivationReadinessEnvelope(
    wrapGridActivationReadinessMetricsV2(metrics),
  );
  const serializedDecision = serializeGridActivationReadinessEnvelope(decision);
  const serializedReport = report;

  const digests: Record<string, string> = {
    [GRID_READINESS_SEED_REGISTRY_ARTIFACT]: sha256Hex(serializedSeedRegistry),
    [GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT]: sha256Hex(serializedScenarioRegistry),
    [GRID_READINESS_RUN_INDEX_ARTIFACT]: sha256Hex(serializedRunIndex),
    [GRID_READINESS_MATCH_RECORDS_ARTIFACT]: sha256Hex(serializedRecords),
    [GRID_READINESS_FACTUAL_REPORTS_ARTIFACT]: sha256Hex(serializedReports),
    [GRID_READINESS_METRICS_ARTIFACT]: sha256Hex(serializedMetrics),
    [GRID_READINESS_DECISION_ARTIFACT]: sha256Hex(serializedDecision),
    [GRID_READINESS_REPORT_ARTIFACT]: sha256Hex(serializedReport),
  };

  const manifest = buildGridActivationReadinessManifest({
    evaluationId: READINESS_TEST_EVALUATION_ID,
    createdAt: READINESS_TEST_CREATED_AT,
    seedRegistry,
    scenarioRegistry,
    suiteChecksum,
    decision,
    digests,
    decisionChecksum: digests[GRID_READINESS_DECISION_ARTIFACT]!,
    reportChecksum: digests[GRID_READINESS_REPORT_ARTIFACT]!,
  });
  const serializedManifest = serializeGridActivationReadinessManifest(manifest);

  return {
    contents: {
      [GRID_READINESS_MANIFEST_FILE]: serializedManifest,
      [GRID_READINESS_SEED_REGISTRY_ARTIFACT]: serializedSeedRegistry,
      [GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT]: serializedScenarioRegistry,
      [GRID_READINESS_RUN_INDEX_ARTIFACT]: serializedRunIndex,
      [GRID_READINESS_MATCH_RECORDS_ARTIFACT]: serializedRecords,
      [GRID_READINESS_FACTUAL_REPORTS_ARTIFACT]: serializedReports,
      [GRID_READINESS_METRICS_ARTIFACT]: serializedMetrics,
      [GRID_READINESS_DECISION_ARTIFACT]: serializedDecision,
      [GRID_READINESS_REPORT_ARTIFACT]: serializedReport,
    },
    outcome,
    metrics,
    decision,
    manifest,
    seedRegistry,
    scenarioRegistry,
    runPlan,
  };
}
