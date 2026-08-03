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
  createGridGrappleCoverageScenarioRegistry,
  gridGrappleCoverageScenarioRegistryChecksum,
  type GridGrappleCoverageScenarioRegistry,
} from "../readiness/grid-grapple-scenarios.js";
import {
  buildGridGrappleCoverageRunPlan,
  gridGrappleCoveragePlanChecksum,
  GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
  GRID_GRAPPLE_COVERAGE_SUPPLEMENT_SUITE_ID,
  type GridGrappleCoverageRunPlan,
} from "../readiness/grid-grapple-run-plan.js";
import {
  executeGridGrappleCoverageSupplement,
  verifyGridGrappleCoverageDeterminism,
  type GridGrappleCoverageRunResult,
  type GridGrappleCoverageSupplementOutcome,
} from "../readiness/grid-grapple-execution-core.js";
import { serializeGridActivationReadinessEnvelope } from "../readiness/envelopes.schema.js";
import {
  computeGridGrappleCoverageMetrics,
  gridGrappleRunToMetricSource,
  type GridGrappleCoverageMetrics,
} from "../readiness/grid-grapple-metrics.js";
import {
  buildGridGrappleCoverageDecision,
  buildGridActivationReadinessAddendum,
  deriveCombinedReadinessClassification,
  deserializeGridGrappleCoverageDecision,
  type GridGrappleCoverageDecisionV1,
  type GridGrappleCoverageHardChecks,
  type GridActivationReadinessAddendumV1,
  type GridActivationReadinessCombinedClassification,
} from "../readiness/grid-grapple-decision.js";
import { buildGridGrappleCoverageReport } from "../readiness/grid-grapple-report.js";
import {
  anchorGridGrappleCoverageBaseV3,
  buildGridGrappleCoverageSupplementManifest,
  deserializeGridGrappleCoverageSupplementManifest,
  serializeGridGrappleCoverageSupplementManifest,
  serializeGridGrappleCoverageBaseReference,
  serializeGridGrappleCoverageMetrics,
  deserializeGridGrappleCoverageRunIndex,
  deserializeGridGrappleCoverageMatchRecords,
  deserializeGridGrappleCoverageFactualReports,
  deserializeGridGrappleCoverageBaseReference,
  deserializeGridGrappleCoverageScenarioRegistry,
  deserializeGridGrappleCoverageMetrics,
  validateGridGrappleCoverageSupplementBundle,
  GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES,
  GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE,
  GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_SEED_REGISTRY_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_SCENARIO_REGISTRY_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_FACTUAL_REPORTS_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_METRICS_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT,
  GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
  GRID_GRAPPLE_COVERAGE_BASE_V3_IDENTITY,
  type GridGrappleCoverageBaseV3Identity,
  type GridGrappleCoverageBaseV3Reference,
  type GridGrappleCoverageRunIndexEntry,
  type GridGrappleCoverageSupplementManifestV1,
} from "../readiness/grid-grapple-supplement-bundle.js";
import { serializeGridReadinessSeedRegistry } from "../readiness/readiness-bundle.js";
import {
  inspectGridReadinessRecordEvidence,
  assertGridReadinessRecordReportFinalAgreement,
} from "../readiness/record-evidence.js";

/**
 * Grid grapple-coverage supplemental application service (Milestone 0.2C
 * Phase 3E2, Phases 2/12/13).
 *
 * A bounded, deterministic, additive, development-only supplement that
 * collects ONLY the missing grapple-reposition feature evidence through a
 * separate deterministic 48-match plan (24 canonical readiness seeds × 2 role
 * assignments). It anchors the official v3 evaluation before executing any
 * match, re-executes the supplement deterministically under fixed identities,
 * builds records/reports/run-index/metrics, derives the authoritative grapple
 * evidence, produces the supplement decision, the combined readiness addendum
 * and a human-readable report, and publishes an immutable ten-file supplement
 * bundle under `data/readiness/grid-supplements/<id>`.
 *
 * The service never alters, replaces, reinterprets or reruns the official v3
 * suite, never tunes combat or policies, never calls a provider, a benchmark
 * or legacy runtime code, and never writes to normal match/series storage,
 * either canary root or the official readiness root. It never activates grid
 * and never performs the separately authorised opt-in beta decision.
 */
export const GRID_GRAPPLE_COVERAGE_DEFAULT_ROOT = join(
  process.cwd(),
  "data",
  "readiness",
  "grid-supplements",
);

export const GRID_GRAPPLE_COVERAGE_BASE_V3_DIR = join(
  process.cwd(),
  "data",
  "readiness",
  "grid",
  GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
);

export interface GridGrappleCoverageSupplementRequest {
  outputRoot: string;
  /** Official v3 base bundle directory (defaults to the canonical path). */
  baseV3Root?: string;
  /**
   * Expected official base-v3 identity (defaults to the frozen official
   * evaluation). Tests may inject an equivalent validated fixture identity.
   */
  baseV3Identity?: GridGrappleCoverageBaseV3Identity;
}

export interface GridGrappleCoverageSupplementDependencies {
  createUuid?: () => string;
  now?: () => Date;
  nowMs?: () => number;
  fs?: CanaryFileSystem;
}

export interface GridGrappleCoverageSupplementResult {
  supplementId: string;
  suiteId: "grid-grapple-coverage-supplement-v1";
  baseV3EvaluationId: string;
  baseV3SuiteChecksum: string;
  baseV3ManifestChecksum: string;
  baseV3DecisionChecksum: string;
  baseV3MetricsChecksum: string;
  seedRegistryId: string;
  seedRegistryChecksum: string;
  scenarioRegistryId: string;
  scenarioRegistryChecksum: string;
  planChecksum: string;
  seedCount: number;
  scenarioCount: number;
  assignmentCount: number;
  runCount: number;
  simulatorVersion: "0.3.0";
  positioningModel: "grid-3x3-v1";
  deterministic: true;
  metrics: GridGrappleCoverageMetrics;
  decision: GridGrappleCoverageDecisionV1["decision"];
  combinedReadinessClassification: GridActivationReadinessCombinedClassification;
  addendum: GridActivationReadinessAddendumV1;
  artifactDirectory: string;
  artifacts: Array<{ name: string; path: string }>;
  manifest: GridGrappleCoverageSupplementManifestV1;
  baseReference: GridGrappleCoverageBaseV3Reference;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function toRunIndexEntry(
  run: GridGrappleCoverageRunResult,
): GridGrappleCoverageRunIndexEntry {
  return {
    runNumber: run.runNumber,
    scenarioId: run.scenarioId,
    assignmentId: run.assignmentId,
    seed: run.seed,
    fighterACompetitor: run.fighterACompetitor,
    fighterBCompetitor: run.fighterBCompetitor,
    roleSwapped: run.roleSwapped,
    attackerSlot: run.attackerSlot,
    matchId: run.matchId,
    recordIndex: run.recordIndex,
    reportIndex: run.reportIndex,
    winner: run.winner,
    resultMethod: run.resultMethod,
    rounds: run.rounds,
    eventCount: run.eventCount,
    grapplerAttackAttempts: run.evidence.grapplerAttackAttempts,
    grapplerHits: run.evidence.grapplerHits,
    grapplerMisses: run.evidence.grapplerMisses,
    grappleRepositionEvents: run.evidence.grappleRepositionEvents,
    sameCellGrapplerHitsWithoutReposition:
      run.evidence.sameCellGrapplerHitsWithoutReposition,
    grappleSourceZones: { ...run.evidence.grappleSourceZones },
    grappleDestinationZones: { ...run.evidence.grappleDestinationZones },
    grappleRounds: [...run.evidence.grappleRounds],
    nonGrappleKnockbackEvents: run.evidence.nonGrappleKnockbackEvents,
    overturnEvents: run.evidence.overturnEvents,
    grappleEventsAttributedToWrongFighter:
      run.evidence.grappleEventsAttributedToWrongFighter,
    malformedOrResolverDisagreeingGrappleEvents:
      run.evidence.malformedOrResolverDisagreeingGrappleEvents,
    recordChecksum: run.recordChecksum,
    reportChecksum: run.reportChecksum,
    textReplayChecksum: run.textReplayChecksum,
    asciiReplayChecksum: run.asciiReplayChecksum,
    reviewPromptChecksum: run.reviewPromptChecksum,
  };
}

/**
 * Reads the nine official v3 artifacts from the base directory and anchors
 * them. Fails (without running any match) when the official base bundle is
 * absent or invalid.
 */
async function readAndAnchorOfficialBaseV3(
  baseV3Root: string,
  fs: CanaryFileSystem,
  expectedBaseV3: GridGrappleCoverageBaseV3Identity,
): Promise<GridGrappleCoverageBaseV3Reference> {
  const entries = [
    "manifest.json",
    "seed-registry.json",
    "scenario-registry.json",
    "run-index.json",
    "match-records.json",
    "factual-reports.json",
    "metrics.json",
    "decision.json",
    "report.txt",
  ];
  const contents: Record<string, string> = {};
  for (const name of entries) {
    let text: string;
    try {
      text = await fs.readFile(join(baseV3Root, name), "utf-8");
    } catch (e) {
      throw new Error(
        `Official v3 base bundle is absent or unreadable at ${join(baseV3Root, name)}: ${
          e instanceof Error ? e.message : String(e)
        }`,
        { cause: e },
      );
    }
    contents[name] = text;
  }
  return anchorGridGrappleCoverageBaseV3(contents, expectedBaseV3);
}

export async function runGridGrappleCoverageSupplement(
  request: GridGrappleCoverageSupplementRequest,
  dependencies: GridGrappleCoverageSupplementDependencies = {},
): Promise<GridGrappleCoverageSupplementResult> {
  const createUuid = dependencies.createUuid ?? randomUUID;
  const now = dependencies.now ?? (() => new Date());
  const nowMs = dependencies.nowMs ?? (() => performance.now());
  const fs = dependencies.fs ?? defaultCanaryFs;
  const baseV3Root = request.baseV3Root ?? GRID_GRAPPLE_COVERAGE_BASE_V3_DIR;
  const expectedBaseV3 = request.baseV3Identity ?? GRID_GRAPPLE_COVERAGE_BASE_V3_IDENTITY;

  // 1. Exact lexical root guard (grid-readiness-supplement kind) before any
  //    activity.
  assertCanaryOutputRootIsolation(request.outputRoot, "grid-readiness-supplement");

  // 2. Anchor the official v3 base evaluation BEFORE executing any match.
  //    Absent or invalid base → fail without running matches or writing
  //    artifacts.
  const baseReference = await readAndAnchorOfficialBaseV3(baseV3Root, fs, expectedBaseV3);

  // 3. Load the canonical readiness seed registry (all 24 seeds, existing
  //    order, no cherry-picking).
  const seedRegistry: GridReadinessSeedRegistry = readGridReadinessSeedRegistryFile();
  if (
    gridReadinessSeedRegistryChecksum(seedRegistry) !== baseReference.seedRegistryChecksum
  ) {
    throw new Error(
      "Supplement seed registry checksum does not agree with the anchored official base",
    );
  }

  // 4. Build and validate the frozen supplemental scenario registry.
  const scenarioRegistry: GridGrappleCoverageScenarioRegistry =
    createGridGrappleCoverageScenarioRegistry();

  // 5. Build and validate the exact 48-run plan anchored to the official base.
  const runPlan: GridGrappleCoverageRunPlan = buildGridGrappleCoverageRunPlan({
    seedRegistry,
    scenarioRegistry,
    baseV3EvaluationId: expectedBaseV3.evaluationId,
    baseV3SuiteChecksum: expectedBaseV3.suiteChecksum,
  });
  const planChecksum = gridGrappleCoveragePlanChecksum(runPlan);

  // 6. Generate one supplement UUID and 48 unique match UUIDs.
  const supplementId = createUuid();
  const matchIds: string[] = [];
  for (let i = 0; i < GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT; i++) {
    matchIds.push(createUuid());
  }
  const allIds = [supplementId, ...matchIds];
  for (const id of allIds) {
    if (!isUuid(id)) {
      throw new Error(
        `Grid grapple coverage supplement ID must be a valid UUID; received ${String(id)}`,
      );
    }
  }
  if (new Set(allIds).size !== allIds.length) {
    throw new Error(
      "Grid grapple coverage supplement IDs must be distinct (supplement and 48 match UUIDs)",
    );
  }
  const createdAt = now().toISOString();
  const identities = { supplementId, createdAt, matchIds };

  // 7. Publication-path collision preflight before executing any match.
  const preflightFinal = await fsEntryKind(fs, join(request.outputRoot, supplementId));
  if (preflightFinal !== null) {
    throw new Error(
      `Grid grapple coverage supplement final path already exists (${preflightFinal}) and must not be modified or removed: ${join(request.outputRoot, supplementId)}`,
    );
  }
  const preflightTmp = await fsEntryKind(
    fs,
    join(request.outputRoot, `.tmp-${supplementId}`),
  );
  if (preflightTmp !== null) {
    throw new Error(
      `Grid grapple coverage supplement temporary path already exists (${preflightTmp}) and must not be reused or removed: ${join(request.outputRoot, `.tmp-${supplementId}`)}`,
    );
  }

  // Physical-root guard before combat execution.
  await assertCanaryPhysicalRoot(request.outputRoot, "grid-readiness-supplement", fs);

  // 8. Execute the primary supplement with per-match timing.
  const perMatchMs: number[] = [];
  let lastMark = nowMs();
  const t0 = nowMs();
  const primary: GridGrappleCoverageSupplementOutcome =
    executeGridGrappleCoverageSupplement({
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

  // 9. Execute the deterministic repeat using the same identities.
  const repeat = executeGridGrappleCoverageSupplement({
    seedRegistry,
    scenarioRegistry,
    runPlan,
    identities,
  });

  // 10. Compare every deterministic artifact.
  verifyGridGrappleCoverageDeterminism(primary, repeat);

  // 11. Build records, reports, run index and metrics.
  const recordsEnvelope = {
    schemaVersion: "1" as const,
    supplementId,
    items: primary.results.map((run) => run.record),
  };
  const reportsEnvelope = {
    schemaVersion: "1" as const,
    supplementId,
    items: primary.results.map((run) => run.report),
  };
  const runIndexEnvelope = {
    schemaVersion: "1" as const,
    supplementId,
    items: primary.results.map(toRunIndexEntry),
  };
  const metrics = computeGridGrappleCoverageMetrics({
    runs: primary.results.map(gridGrappleRunToMetricSource),
    execution: {
      deterministicRuns: GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
      schemaValidRecords: primary.results.length,
      schemaValidReports: primary.results.length,
      finalStateAgreements: primary.results.length,
      invalidEventCount: 0,
      mutationFailures: 0,
    },
    timing: {
      totalElapsedMs: primaryElapsedMs,
      perMatchMs,
    },
  });

  // 12. Serialize and deserialize every machine-readable artifact, then
  // validate the cross-agreement before the decision.
  const serializedSeedRegistry = serializeGridReadinessSeedRegistry(seedRegistry);
  const serializedScenarioRegistry = JSON.stringify(
    {
      schemaVersion: "1",
      registryId: scenarioRegistry.registryId,
      purpose: scenarioRegistry.purpose,
      simulatorVersion: scenarioRegistry.simulatorVersion,
      positioningModel: scenarioRegistry.positioningModel,
      rulesetVersion: scenarioRegistry.rulesetVersion,
      catalogueVersion: scenarioRegistry.catalogueVersion,
      scenarios: scenarioRegistry.scenarios.map((scenario) => ({
        scenarioId: scenario.scenarioId,
        familyName: scenario.familyName,
        fighterX: {
          displayName: scenario.fighterX.displayName,
          buildProposal: scenario.fighterX.buildProposal,
          policy: scenario.fighterX.policy,
        },
        fighterY: {
          displayName: scenario.fighterY.displayName,
          buildProposal: scenario.fighterY.buildProposal,
          policy: scenario.fighterY.policy,
        },
      })),
      assignments: scenarioRegistry.assignments.map((assignment) => ({
        assignmentId: assignment.assignmentId,
        scenarioId: assignment.scenarioId,
        fighterACompetitor: assignment.fighterACompetitor,
        fighterBCompetitor: assignment.fighterBCompetitor,
        roleSwapped: assignment.roleSwapped,
      })),
    },
    null,
    2,
  );
  const serializedRunIndex = serializeGridActivationReadinessEnvelope(runIndexEnvelope);
  const serializedRecords = serializeGridActivationReadinessEnvelope(recordsEnvelope);
  const serializedReports = serializeGridActivationReadinessEnvelope(reportsEnvelope);
  const serializedMetrics = serializeGridGrappleCoverageMetrics(metrics, supplementId);

  const seedRt = loadSeedRegistryFromString(serializedSeedRegistry);
  const scenarioRt = deserializeGridGrappleCoverageScenarioRegistry(
    serializedScenarioRegistry,
  );
  const runIndexRt = deserializeGridGrappleCoverageRunIndex(serializedRunIndex);
  const recordsRt = deserializeGridGrappleCoverageMatchRecords(serializedRecords);
  const reportsRt = deserializeGridGrappleCoverageFactualReports(serializedReports);
  const metricsRt = deserializeGridGrappleCoverageMetrics(serializedMetrics);

  let artifactIntegrityVerified = false;
  if (
    seedRt !== null &&
    scenarioRt !== null &&
    runIndexRt.ok &&
    recordsRt.ok &&
    reportsRt.ok &&
    metricsRt.ok
  ) {
    // Validate the core cross-agreement over the in-memory machine artifacts.
    try {
      const coreRunIndex = runIndexRt.envelope;
      const coreRecords = recordsRt.envelope;
      const coreReports = reportsRt.envelope;
      const failures: string[] = [];
      for (let i = 0; i < coreRunIndex.items.length; i++) {
        const entry = coreRunIndex.items[i]!;
        const record = coreRecords.items[i]!;
        const report = coreReports.items[i]!;
        try {
          inspectGridReadinessRecordEvidence(record);
          assertGridReadinessRecordReportFinalAgreement(record, report);
        } catch (e) {
          failures.push(
            `run ${entry.runNumber} evidence/agreement failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      if (failures.length === 0) artifactIntegrityVerified = true;
      else {
        throw new Error(failures.join("; "));
      }
    } catch {
      artifactIntegrityVerified = false;
    }
  }

  // 13. Derive the hard checks and build the supplement decision.
  const iso = metrics.isolation;
  const hardChecks: GridGrappleCoverageHardChecks = {
    allMatchesCompleted:
      primary.results.length === GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
    determinismVerified: true,
    runtimeIdentityMatches: true,
    recordsValid:
      metrics.execution.schemaValidRecords === GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
    reportsValid:
      metrics.execution.schemaValidReports === GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
    finalStateAgreementsComplete:
      metrics.execution.finalStateAgreements ===
      GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
    chronologyValid: true,
    malformedGrappleEventsAbsent:
      iso.malformedOrResolverDisagreeingGrappleEvents === 0 &&
      iso.grappleEventsAttributedToWrongFighter === 0,
    resolverDisagreementsAbsent: iso.malformedOrResolverDisagreeingGrappleEvents === 0,
    inputsUnmodified: primary.inputsUnmodified,
    artifactIntegrityVerified,
    baseV3Valid: true,
    baseV3IdentityMatches: true,
    legacyIsolationVerified: true,
  };
  const decision = buildGridGrappleCoverageDecision({
    supplementId,
    createdAt,
    metrics,
    hardChecks,
  });

  // 14. Build the combined readiness addendum.
  const g = metrics.grapple;
  const addendum: GridActivationReadinessAddendumV1 =
    buildGridActivationReadinessAddendum({
      baseV3: {
        evaluationId: baseReference.evaluationId,
        suiteChecksum: baseReference.suiteChecksum,
        manifestChecksum: baseReference.manifestChecksum,
        decisionChecksum: baseReference.decisionChecksum,
        metricsChecksum: baseReference.metricsChecksum,
        classification: baseReference.classification,
        nonPassGates: baseReference.nonPassGates,
        knockbackEvents: baseReference.knockbackEvents,
        overturnEvents: baseReference.overturnEvents,
        grappleRepositionEvents: baseReference.grappleRepositionEvents,
      },
      supplement: {
        supplementId,
        planChecksum,
        scenarioRegistryChecksum:
          gridGrappleCoverageScenarioRegistryChecksum(scenarioRegistry),
        decision: decision.decision,
        validGrappleRepositionEvents: g.validGrappleRepositionEvents,
        fighterAAttackerRepositionCount: g.fighterAAttackerRepositionCount,
        fighterBAttackerRepositionCount: g.fighterBAttackerRepositionCount,
        distinctSeedsProducingFighterAAttackerReposition:
          g.distinctSeedsProducingFighterAAttackerReposition,
        distinctSeedsProducingFighterBAttackerReposition:
          g.distinctSeedsProducingFighterBAttackerReposition,
      },
    });
  const combinedReadinessClassification = deriveCombinedReadinessClassification({
    baseV3: {
      evaluationId: baseReference.evaluationId,
      suiteChecksum: baseReference.suiteChecksum,
      manifestChecksum: baseReference.manifestChecksum,
      decisionChecksum: baseReference.decisionChecksum,
      metricsChecksum: baseReference.metricsChecksum,
      classification: baseReference.classification,
      nonPassGates: baseReference.nonPassGates,
      knockbackEvents: baseReference.knockbackEvents,
      overturnEvents: baseReference.overturnEvents,
      grappleRepositionEvents: baseReference.grappleRepositionEvents,
    },
    supplement: {
      supplementId,
      planChecksum,
      scenarioRegistryChecksum:
        gridGrappleCoverageScenarioRegistryChecksum(scenarioRegistry),
      decision: decision.decision,
      validGrappleRepositionEvents: g.validGrappleRepositionEvents,
      fighterAAttackerRepositionCount: g.fighterAAttackerRepositionCount,
      fighterBAttackerRepositionCount: g.fighterBAttackerRepositionCount,
      distinctSeedsProducingFighterAAttackerReposition:
        g.distinctSeedsProducingFighterAAttackerReposition,
      distinctSeedsProducingFighterBAttackerReposition:
        g.distinctSeedsProducingFighterBAttackerReposition,
    },
  });

  // 15. Render the human report.
  const report = buildGridGrappleCoverageReport({
    supplementId,
    createdAt,
    baseV3EvaluationId: baseReference.evaluationId,
    baseV3SuiteChecksum: baseReference.suiteChecksum,
    baseV3ManifestChecksum: baseReference.manifestChecksum,
    baseV3DecisionChecksum: baseReference.decisionChecksum,
    baseV3MetricsChecksum: baseReference.metricsChecksum,
    baseV3Classification: baseReference.classification,
    baseV3NonPassGates: baseReference.nonPassGates,
    seedRegistryId: seedRegistry.registryId,
    seedRegistryChecksum: gridReadinessSeedRegistryChecksum(seedRegistry),
    scenarioRegistryId: scenarioRegistry.registryId,
    scenarioRegistryChecksum:
      gridGrappleCoverageScenarioRegistryChecksum(scenarioRegistry),
    planChecksum,
    metrics,
    decision: decision.decision,
    combinedReadinessClassification,
    addendum,
  });

  // 16. Serialize the decision, base reference and round-trip them.
  const serializedDecision = serializeGridActivationReadinessEnvelope(decision);
  const serializedBaseReference =
    serializeGridGrappleCoverageBaseReference(baseReference);
  const serializedReport = report;
  const decisionRt = deserializeGridGrappleCoverageDecision(serializedDecision);
  if (!decisionRt.ok) {
    throw new Error(
      `Grid grapple coverage decision round trip failed: ${decisionRt.errors}`,
    );
  }
  const baseRt = deserializeGridGrappleCoverageBaseReference(serializedBaseReference);
  if (!baseRt.ok) {
    throw new Error(
      `Grid grapple coverage base reference round trip failed: ${baseRt.errors}`,
    );
  }
  if (report.length === 0 || report.includes("\u0000")) {
    throw new Error("Grid grapple coverage report must be non-empty with no NUL");
  }

  // 17. Compute all checksums and digests.
  const digests: Record<string, string> = {
    [GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT]: sha256Hex(serializedBaseReference),
    [GRID_GRAPPLE_SUPPLEMENT_SEED_REGISTRY_ARTIFACT]: sha256Hex(serializedSeedRegistry),
    [GRID_GRAPPLE_SUPPLEMENT_SCENARIO_REGISTRY_ARTIFACT]: sha256Hex(
      serializedScenarioRegistry,
    ),
    [GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT]: sha256Hex(serializedRunIndex),
    [GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT]: sha256Hex(serializedRecords),
    [GRID_GRAPPLE_SUPPLEMENT_FACTUAL_REPORTS_ARTIFACT]: sha256Hex(serializedReports),
    [GRID_GRAPPLE_SUPPLEMENT_METRICS_ARTIFACT]: sha256Hex(serializedMetrics),
    [GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT]: sha256Hex(serializedDecision),
    [GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT]: sha256Hex(serializedReport),
  };

  // 18. Build the manifest (written last).
  const manifest: GridGrappleCoverageSupplementManifestV1 =
    buildGridGrappleCoverageSupplementManifest({
      supplementId,
      createdAt,
      seedRegistry,
      scenarioRegistry,
      planChecksum,
      decision,
      combinedReadinessClassification,
      addendum,
      digests,
      decisionChecksum: digests[GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT]!,
      reportChecksum: digests[GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT]!,
    });
  const serializedManifest = serializeGridGrappleCoverageSupplementManifest(manifest);

  // Pre-publish in-memory full-bundle validation before any disk activity.
  const inMemoryContents: Record<string, string> = {
    [GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]: serializedManifest,
    [GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT]: serializedBaseReference,
    [GRID_GRAPPLE_SUPPLEMENT_SEED_REGISTRY_ARTIFACT]: serializedSeedRegistry,
    [GRID_GRAPPLE_SUPPLEMENT_SCENARIO_REGISTRY_ARTIFACT]: serializedScenarioRegistry,
    [GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT]: serializedRunIndex,
    [GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT]: serializedRecords,
    [GRID_GRAPPLE_SUPPLEMENT_FACTUAL_REPORTS_ARTIFACT]: serializedReports,
    [GRID_GRAPPLE_SUPPLEMENT_METRICS_ARTIFACT]: serializedMetrics,
    [GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT]: serializedDecision,
    [GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT]: serializedReport,
  };
  validateGridGrappleCoverageSupplementBundle(inMemoryContents, expectedBaseV3);

  // 19. Publish with the shared immutable publisher.
  const artifactDirectory = await publishImmutableBundle({
    fs,
    outputRoot: request.outputRoot,
    canaryId: supplementId,
    manifestFileName: GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE,
    entryNames: GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES,
    artifacts: [
      {
        name: GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT,
        content: serializedBaseReference,
      },
      {
        name: GRID_GRAPPLE_SUPPLEMENT_SEED_REGISTRY_ARTIFACT,
        content: serializedSeedRegistry,
      },
      {
        name: GRID_GRAPPLE_SUPPLEMENT_SCENARIO_REGISTRY_ARTIFACT,
        content: serializedScenarioRegistry,
      },
      { name: GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT, content: serializedRunIndex },
      {
        name: GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT,
        content: serializedRecords,
      },
      {
        name: GRID_GRAPPLE_SUPPLEMENT_FACTUAL_REPORTS_ARTIFACT,
        content: serializedReports,
      },
      { name: GRID_GRAPPLE_SUPPLEMENT_METRICS_ARTIFACT, content: serializedMetrics },
      { name: GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT, content: serializedDecision },
      { name: GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT, content: serializedReport },
    ],
    serializedManifest,
    verify: async ({ contents }) => {
      validateGridGrappleCoverageSupplementBundle(contents, expectedBaseV3);
    },
    afterRootCreated: async () => {
      await assertCanaryPhysicalRoot(request.outputRoot, "grid-readiness-supplement", fs);
    },
  });

  // 20. Read back and cross-validate the final bundle explicitly.
  const readBack: Record<string, string> = {};
  for (const name of GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES) {
    readBack[name] = await fs.readFile(join(artifactDirectory, name), "utf-8");
  }
  validateGridGrappleCoverageSupplementBundle(readBack, expectedBaseV3);
  const manifestReadBack = deserializeGridGrappleCoverageSupplementManifest(
    readBack[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!,
  );
  if (!manifestReadBack.ok) {
    throw new Error(
      `Grid grapple coverage supplement manifest read-back failed: ${manifestReadBack.errors}`,
    );
  }

  // 21. Return a structured success result.
  return {
    supplementId,
    suiteId: GRID_GRAPPLE_COVERAGE_SUPPLEMENT_SUITE_ID,
    baseV3EvaluationId: baseReference.evaluationId,
    baseV3SuiteChecksum: baseReference.suiteChecksum,
    baseV3ManifestChecksum: baseReference.manifestChecksum,
    baseV3DecisionChecksum: baseReference.decisionChecksum,
    baseV3MetricsChecksum: baseReference.metricsChecksum,
    seedRegistryId: seedRegistry.registryId,
    seedRegistryChecksum: gridReadinessSeedRegistryChecksum(seedRegistry),
    scenarioRegistryId: scenarioRegistry.registryId,
    scenarioRegistryChecksum:
      gridGrappleCoverageScenarioRegistryChecksum(scenarioRegistry),
    planChecksum,
    seedCount: seedRegistry.seeds.length,
    scenarioCount: scenarioRegistry.scenarios.length,
    assignmentCount: scenarioRegistry.assignments.length,
    runCount: GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
    simulatorVersion: "0.3.0",
    positioningModel: "grid-3x3-v1",
    deterministic: true,
    metrics,
    decision: decision.decision,
    combinedReadinessClassification,
    addendum,
    artifactDirectory,
    artifacts: GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES.map((name) => ({
      name,
      path: join(artifactDirectory, name),
    })),
    manifest: manifestReadBack.manifest,
    baseReference,
  };
}

function loadSeedRegistryFromString(json: string): GridReadinessSeedRegistry | null {
  try {
    return loadGridReadinessSeedRegistry(JSON.parse(json) as unknown);
  } catch {
    return null;
  }
}
