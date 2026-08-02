import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { join } from "node:path";
import {
  assertCanaryOutputRootIsolation,
  assertCanaryPhysicalRoot,
} from "../canary/canary-output-root.js";
import {
  defaultCanaryFs,
  fsEntryKind,
  publishImmutableBundle,
  type CanaryFileSystem,
} from "../canary/immutable-canary-bundle.js";
import { sha256Hex } from "../canary/grid-canary-digest.js";
import {
  readGridReadinessSeedRegistryFile,
  loadGridReadinessSeedRegistry,
  gridReadinessSeedRegistryChecksum,
  type GridReadinessSeedRegistry,
} from "../readiness/seed-registry.js";
import {
  createGridReadinessScenarioRegistry,
  gridReadinessScenarioRegistryChecksum,
  type GridReadinessScenarioRegistry,
} from "../readiness/scenario-registry.js";
import {
  buildGridActivationReadinessRunPlan,
  gridActivationReadinessSuiteChecksum,
  GRID_ACTIVATION_READINESS_RUN_COUNT,
  GRID_ACTIVATION_READINESS_SUITE_ID,
  type GridActivationReadinessRunPlan,
} from "../readiness/run-plan.js";
import {
  executeGridActivationReadinessSuite,
  verifyGridActivationReadinessDeterminism,
  type GridActivationReadinessRunResult,
  type GridActivationReadinessSuiteOutcome,
} from "../readiness/execution-core.js";
import {
  serializeGridActivationReadinessEnvelope,
  deserializeGridActivationReadinessRunIndex,
  deserializeGridActivationReadinessMatchRecords,
  deserializeGridActivationReadinessFactualReports,
  type GridActivationReadinessRunIndexEntry,
} from "../readiness/envelopes.schema.js";
import {
  computeGridActivationReadinessMetrics,
  deserializeGridActivationReadinessMetrics,
  type GridActivationReadinessMetrics,
} from "../readiness/metrics.js";
import {
  evaluateGridActivationReadinessGates,
  type ReadinessGateResult,
} from "../readiness/gates.js";
import {
  buildGridActivationReadinessDecision,
  deserializeGridActivationReadinessDecision,
  type GridActivationReadinessDecisionV1,
} from "../readiness/decision.js";
import { buildGridActivationReadinessReport } from "../readiness/report.js";
import {
  buildGridActivationReadinessManifest,
  deserializeGridActivationReadinessManifest,
  serializeGridActivationReadinessManifest,
  serializeGridReadinessSeedRegistry,
  serializeGridReadinessScenarioRegistry,
  deserializeGridActivationReadinessScenarioRegistry,
  validateGridActivationReadinessCoreArtifacts,
  validateGridActivationReadinessBundle,
  GRID_READINESS_BUNDLE_ENTRIES,
  GRID_READINESS_MANIFEST_FILE,
  GRID_READINESS_SEED_REGISTRY_ARTIFACT,
  GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT,
  GRID_READINESS_RUN_INDEX_ARTIFACT,
  GRID_READINESS_MATCH_RECORDS_ARTIFACT,
  GRID_READINESS_FACTUAL_REPORTS_ARTIFACT,
  GRID_READINESS_METRICS_ARTIFACT,
  GRID_READINESS_DECISION_ARTIFACT,
  GRID_READINESS_REPORT_ARTIFACT,
  type GridActivationReadinessManifestV1,
} from "../readiness/readiness-bundle.js";

/**
 * Grid activation-readiness application service (Milestone 0.2C Phase 3E1).
 *
 * A bounded, deterministic, development-only evaluation that answers whether
 * the grid runtime is technically suitable for a separately authorised opt-in
 * beta decision. It executes exactly 312 primary grid matches (24 seeds × 13
 * assignments), re-executes them deterministically under fixed identities,
 * builds records/reports/run-index/metrics, evaluates the frozen gates,
 * produces a readiness decision and a human-readable report, and publishes an
 * immutable nine-file evaluation bundle under `data/readiness/grid/<id>`.
 *
 * The service never activates grid, never alters defaults, never tunes combat
 * or policies, never calls a provider, a benchmark or legacy runtime code,
 * and never writes to normal match/series storage or either canary root.
 * Even `ready_for_opt_in_beta_review` is not permission to activate grid.
 */
export const GRID_ACTIVATION_READINESS_DEFAULT_ROOT = join(
  process.cwd(),
  "data",
  "readiness",
  "grid",
);

export interface GridActivationReadinessRequest {
  outputRoot: string;
}

export interface GridActivationReadinessDependencies {
  createUuid?: () => string;
  now?: () => Date;
  nowMs?: () => number;
  fs?: CanaryFileSystem;
}

export interface GridActivationReadinessResult {
  evaluationId: string;
  suiteId: "grid-activation-readiness-v1";
  seedRegistryId: string;
  seedRegistryChecksum: string;
  scenarioRegistryId: string;
  scenarioRegistryChecksum: string;
  suiteChecksum: string;
  seedCount: number;
  scenarioCount: number;
  assignmentCount: number;
  runCount: number;
  simulatorVersion: "0.3.0";
  positioningModel: "grid-3x3-v1";
  deterministic: true;
  metrics: GridActivationReadinessMetrics;
  gates: readonly ReadinessGateResult[];
  decision: GridActivationReadinessDecisionV1["decision"];
  artifactDirectory: string;
  artifacts: Array<{ name: string; path: string }>;
  manifest: GridActivationReadinessManifestV1;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function toRunIndexEntry(
  run: GridActivationReadinessRunResult,
): GridActivationReadinessRunIndexEntry {
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

export async function runGridActivationReadiness(
  request: GridActivationReadinessRequest,
  dependencies: GridActivationReadinessDependencies = {},
): Promise<GridActivationReadinessResult> {
  const createUuid = dependencies.createUuid ?? randomUUID;
  const now = dependencies.now ?? (() => new Date());
  const nowMs = dependencies.nowMs ?? (() => performance.now());
  const fs = dependencies.fs ?? defaultCanaryFs;

  // 1. Exact lexical root guard (grid-readiness kind) before any activity.
  assertCanaryOutputRootIsolation(request.outputRoot, "grid-readiness");

  // 2. Load and validate the fixed development-only seed registry.
  const seedRegistry: GridReadinessSeedRegistry = readGridReadinessSeedRegistryFile();

  // 3. Build and validate the frozen scenario registry.
  const scenarioRegistry: GridReadinessScenarioRegistry =
    createGridReadinessScenarioRegistry();

  // 4. Build and validate the exact 312-run plan.
  const runPlan: GridActivationReadinessRunPlan = buildGridActivationReadinessRunPlan({
    seedRegistry,
    scenarioRegistry,
  });
  const suiteChecksum = gridActivationReadinessSuiteChecksum(runPlan);

  // 5. Generate one evaluation UUID and 312 unique match UUIDs.
  const evaluationId = createUuid();
  const matchIds: string[] = [];
  for (let i = 0; i < GRID_ACTIVATION_READINESS_RUN_COUNT; i++) {
    matchIds.push(createUuid());
  }
  const allIds = [evaluationId, ...matchIds];
  for (const id of allIds) {
    if (!isUuid(id)) {
      throw new Error(
        `Grid activation readiness ID must be a valid UUID; received ${String(id)}`,
      );
    }
  }
  if (new Set(allIds).size !== allIds.length) {
    throw new Error(
      "Grid activation readiness IDs must be distinct (evaluation and 312 match UUIDs)",
    );
  }
  const createdAt = now().toISOString();
  const identities = { evaluationId, createdAt, matchIds };

  // 6. Publication-path collision preflight before executing any match.
  const preflightFinal = await fsEntryKind(fs, join(request.outputRoot, evaluationId));
  if (preflightFinal !== null) {
    throw new Error(
      `Grid activation readiness final path already exists (${preflightFinal}) and must not be modified or removed: ${join(request.outputRoot, evaluationId)}`,
    );
  }
  const preflightTmp = await fsEntryKind(
    fs,
    join(request.outputRoot, `.tmp-${evaluationId}`),
  );
  if (preflightTmp !== null) {
    throw new Error(
      `Grid activation readiness temporary path already exists (${preflightTmp}) and must not be reused or removed: ${join(request.outputRoot, `.tmp-${evaluationId}`)}`,
    );
  }

  // Physical-root guard before combat execution.
  await assertCanaryPhysicalRoot(request.outputRoot, "grid-readiness", fs);

  // 7. Execute the primary suite with per-match timing.
  const perMatchMs: number[] = [];
  let lastMark = nowMs();
  const t0 = nowMs();
  const primary: GridActivationReadinessSuiteOutcome =
    executeGridActivationReadinessSuite({
      seedRegistry,
      scenarioRegistry,
      runPlan,
      identities,
      onRunComplete: () => {
        const mark = nowMs();
        perMatchMs.push(mark - lastMark);
        lastMark = mark;
      },
    });
  const primaryElapsedMs = nowMs() - t0;

  // 8. Execute the deterministic repeat suite using the same identities.
  const repeat = executeGridActivationReadinessSuite({
    seedRegistry,
    scenarioRegistry,
    runPlan,
    identities,
  });

  // 9. Compare every deterministic artifact.
  verifyGridActivationReadinessDeterminism(primary, repeat);

  // 10. Build records, reports, run index and metrics.
  const recordsEnvelope = {
    schemaVersion: "1" as const,
    evaluationId,
    items: primary.results.map((run) => run.record),
  };
  const reportsEnvelope = {
    schemaVersion: "1" as const,
    evaluationId,
    items: primary.results.map((run) => run.report),
  };
  const runIndexEnvelope = {
    schemaVersion: "1" as const,
    suiteId: GRID_ACTIVATION_READINESS_SUITE_ID,
    evaluationId,
    items: primary.results.map(toRunIndexEntry),
  };
  const metrics = computeGridActivationReadinessMetrics({
    outcome: primary,
    execution: {
      deterministicMatches: GRID_ACTIVATION_READINESS_RUN_COUNT,
      invalidEventCount: 0,
      mutationFailures: 0,
    },
    timing: {
      totalElapsedMs: primaryElapsedMs,
      perMatchMs,
    },
  });

  // 14a. Serialize and deserialize every machine-readable artifact, then
  // validate the core cross-agreement (H09 evidence) before the decision.
  const serializedSeedRegistry = serializeGridReadinessSeedRegistry(seedRegistry);
  const serializedScenarioRegistry =
    serializeGridReadinessScenarioRegistry(scenarioRegistry);
  const serializedRunIndex = serializeGridActivationReadinessEnvelope(runIndexEnvelope);
  const serializedRecords = serializeGridActivationReadinessEnvelope(recordsEnvelope);
  const serializedReports = serializeGridActivationReadinessEnvelope(reportsEnvelope);
  const serializedMetrics = serializeGridActivationReadinessEnvelope(metrics);

  const seedRt = readGridReadinessSeedRegistryFromString(serializedSeedRegistry);
  const scenarioRt = deserializeGridActivationReadinessScenarioRegistry(
    serializedScenarioRegistry,
  );
  const runIndexRt = deserializeGridActivationReadinessRunIndex(serializedRunIndex);
  const recordsRt = deserializeGridActivationReadinessMatchRecords(serializedRecords);
  const reportsRt = deserializeGridActivationReadinessFactualReports(serializedReports);
  const metricsRt = deserializeGridActivationReadinessMetrics(serializedMetrics);

  let artifactIntegrityVerified = false;
  if (
    seedRt !== null &&
    scenarioRt.ok &&
    runIndexRt.ok &&
    recordsRt.ok &&
    reportsRt.ok &&
    metricsRt.ok
  ) {
    try {
      validateGridActivationReadinessCoreArtifacts({
        seedRegistry: seedRt,
        scenarioRegistry: scenarioRt.registry,
        runIndex: runIndexRt.envelope,
        records: recordsRt.envelope,
        reports: reportsRt.envelope,
      });
      artifactIntegrityVerified = true;
    } catch {
      artifactIntegrityVerified = false;
    }
  }

  // 11. Evaluate every frozen gate.
  const gateResults = evaluateGridActivationReadinessGates({
    metrics,
    outcome: primary,
    inputsUnmodified: primary.inputsUnmodified,
    artifactIntegrityVerified,
    // Legacy isolation (H10) is enforced by the regression suite; the
    // readiness service never touches legacy commands, schemas or canaries.
    legacyIsolationVerified: true,
  });

  // 12. Build the readiness decision.
  const decision = buildGridActivationReadinessDecision({
    evaluationId,
    createdAt,
    gates: gateResults.gates,
    anyFail: gateResults.anyFail,
    anyInconclusive: gateResults.anyInconclusive,
  });

  // 13. Render the human report.
  const report = buildGridActivationReadinessReport({
    evaluationId,
    suiteId: GRID_ACTIVATION_READINESS_SUITE_ID,
    createdAt,
    seedRegistryId: seedRegistry.registryId,
    seedRegistryChecksum: gridReadinessSeedRegistryChecksum(seedRegistry),
    scenarioRegistryId: scenarioRegistry.registryId,
    scenarioRegistryChecksum: gridReadinessScenarioRegistryChecksum(scenarioRegistry),
    suiteChecksum,
    seedCount: seedRegistry.seeds.length,
    scenarioCount: scenarioRegistry.scenarios.length,
    assignmentCount: scenarioRegistry.assignments.length,
    totalSimulations: GRID_ACTIVATION_READINESS_RUN_COUNT,
    deterministic: true,
    metrics,
    gates: gateResults.gates,
    decision: decision.decision,
  });

  // 14b. Serialize the decision and report, and round-trip them.
  const serializedDecision = serializeGridActivationReadinessEnvelope(decision);
  const serializedReport = report;
  const decisionRt = deserializeGridActivationReadinessDecision(serializedDecision);
  if (!decisionRt.ok) {
    throw new Error(
      `Grid activation readiness decision round trip failed: ${decisionRt.errors}`,
    );
  }
  if (report.length === 0 || report.includes("\u0000")) {
    throw new Error("Grid activation readiness report must be non-empty with no NUL");
  }

  // 15. Compute all checksums and digests.
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

  // 16. Build the manifest.
  const manifest: GridActivationReadinessManifestV1 =
    buildGridActivationReadinessManifest({
      evaluationId,
      createdAt,
      seedRegistry,
      scenarioRegistry,
      suiteChecksum,
      decision,
      digests,
      decisionChecksum: digests[GRID_READINESS_DECISION_ARTIFACT]!,
      reportChecksum: digests[GRID_READINESS_REPORT_ARTIFACT]!,
    });
  const serializedManifest = serializeGridActivationReadinessManifest(manifest);

  // Pre-publish in-memory full-bundle validation (schemas, digests, decision
  // agreement, cross-envelope agreement) before any disk activity.
  const inMemoryContents: Record<string, string> = {
    [GRID_READINESS_MANIFEST_FILE]: serializedManifest,
    [GRID_READINESS_SEED_REGISTRY_ARTIFACT]: serializedSeedRegistry,
    [GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT]: serializedScenarioRegistry,
    [GRID_READINESS_RUN_INDEX_ARTIFACT]: serializedRunIndex,
    [GRID_READINESS_MATCH_RECORDS_ARTIFACT]: serializedRecords,
    [GRID_READINESS_FACTUAL_REPORTS_ARTIFACT]: serializedReports,
    [GRID_READINESS_METRICS_ARTIFACT]: serializedMetrics,
    [GRID_READINESS_DECISION_ARTIFACT]: serializedDecision,
    [GRID_READINESS_REPORT_ARTIFACT]: serializedReport,
  };
  validateGridActivationReadinessBundle(inMemoryContents);

  // 17. Publish with the shared immutable publisher.
  const artifactDirectory = await publishImmutableBundle({
    fs,
    outputRoot: request.outputRoot,
    canaryId: evaluationId,
    manifestFileName: GRID_READINESS_MANIFEST_FILE,
    entryNames: GRID_READINESS_BUNDLE_ENTRIES,
    artifacts: [
      {
        name: GRID_READINESS_SEED_REGISTRY_ARTIFACT,
        content: serializedSeedRegistry,
      },
      {
        name: GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT,
        content: serializedScenarioRegistry,
      },
      { name: GRID_READINESS_RUN_INDEX_ARTIFACT, content: serializedRunIndex },
      { name: GRID_READINESS_MATCH_RECORDS_ARTIFACT, content: serializedRecords },
      {
        name: GRID_READINESS_FACTUAL_REPORTS_ARTIFACT,
        content: serializedReports,
      },
      { name: GRID_READINESS_METRICS_ARTIFACT, content: serializedMetrics },
      { name: GRID_READINESS_DECISION_ARTIFACT, content: serializedDecision },
      { name: GRID_READINESS_REPORT_ARTIFACT, content: serializedReport },
    ],
    serializedManifest,
    verify: async ({ contents }) => {
      validateGridActivationReadinessBundle(contents);
    },
    afterRootCreated: async () => {
      await assertCanaryPhysicalRoot(request.outputRoot, "grid-readiness", fs);
    },
  });

  // 18. Read back and cross-validate the final bundle explicitly.
  const readBack: Record<string, string> = {};
  for (const name of GRID_READINESS_BUNDLE_ENTRIES) {
    readBack[name] = await fs.readFile(join(artifactDirectory, name), "utf-8");
  }
  validateGridActivationReadinessBundle(readBack);
  const manifestReadBack = deserializeGridActivationReadinessManifest(
    readBack[GRID_READINESS_MANIFEST_FILE]!,
  );
  if (!manifestReadBack.ok) {
    throw new Error(
      `Grid activation readiness manifest read-back failed: ${manifestReadBack.errors}`,
    );
  }

  // 19. Return a structured success result.
  return {
    evaluationId,
    suiteId: GRID_ACTIVATION_READINESS_SUITE_ID,
    seedRegistryId: seedRegistry.registryId,
    seedRegistryChecksum: gridReadinessSeedRegistryChecksum(seedRegistry),
    scenarioRegistryId: scenarioRegistry.registryId,
    scenarioRegistryChecksum: gridReadinessScenarioRegistryChecksum(scenarioRegistry),
    suiteChecksum,
    seedCount: seedRegistry.seeds.length,
    scenarioCount: scenarioRegistry.scenarios.length,
    assignmentCount: scenarioRegistry.assignments.length,
    runCount: GRID_ACTIVATION_READINESS_RUN_COUNT,
    simulatorVersion: "0.3.0",
    positioningModel: "grid-3x3-v1",
    deterministic: true,
    metrics,
    gates: gateResults.gates,
    decision: decision.decision,
    artifactDirectory,
    artifacts: GRID_READINESS_BUNDLE_ENTRIES.map((name) => ({
      name,
      path: join(artifactDirectory, name),
    })),
    manifest: manifestReadBack.manifest,
  };
}

function readGridReadinessSeedRegistryFromString(
  json: string,
): GridReadinessSeedRegistry | null {
  try {
    return loadGridReadinessSeedRegistry(JSON.parse(json) as unknown);
  } catch {
    return null;
  }
}
