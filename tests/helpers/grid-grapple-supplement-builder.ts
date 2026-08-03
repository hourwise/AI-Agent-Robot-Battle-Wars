import {
  buildReadinessTestBundle,
  READINESS_TEST_EVALUATION_ID,
} from "./grid-readiness-bundle-builder.js";
import {
  anchorGridGrappleCoverageBaseV3,
  buildGridGrappleCoverageSupplementManifest,
  serializeGridGrappleCoverageSupplementManifest,
  serializeGridGrappleCoverageBaseReference,
  serializeGridGrappleCoverageMetrics,
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
  GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
  type GridGrappleCoverageBaseV3Reference,
  type GridGrappleCoverageSupplementManifestV1,
} from "../../src/readiness/grid-grapple-supplement-bundle.js";
import { readinessTestSeedRegistry } from "./grid-readiness-bundle-builder.js";
import { createGridGrappleCoverageScenarioRegistry } from "../../src/readiness/grid-grapple-scenarios.js";
import {
  buildGridGrappleCoverageRunPlan,
  gridGrappleCoveragePlanChecksum,
  type GridGrappleCoverageRunPlan,
} from "../../src/readiness/grid-grapple-run-plan.js";
import {
  executeGridGrappleCoverageSupplement,
  verifyGridGrappleCoverageDeterminism,
  type GridGrappleCoverageSupplementOutcome,
} from "../../src/readiness/grid-grapple-execution-core.js";
import { serializeGridActivationReadinessEnvelope } from "../../src/readiness/envelopes.schema.js";
import {
  computeGridGrappleCoverageMetrics,
  gridGrappleRunToMetricSource,
  type GridGrappleCoverageMetrics,
} from "../../src/readiness/grid-grapple-metrics.js";
import {
  buildGridGrappleCoverageDecision,
  buildGridActivationReadinessAddendum,
  deriveCombinedReadinessClassification,
  type GridGrappleCoverageDecisionV1,
  type GridActivationReadinessAddendumV1,
  type GridActivationReadinessCombinedClassification,
} from "../../src/readiness/grid-grapple-decision.js";
import { buildGridGrappleCoverageReport } from "../../src/readiness/grid-grapple-report.js";
import { serializeGridReadinessSeedRegistry } from "../../src/readiness/readiness-bundle.js";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import { GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT } from "../../src/readiness/grid-grapple-run-plan.js";
import { gridReadinessSeedRegistryChecksum } from "../../src/readiness/seed-registry.js";
import { gridGrappleCoverageScenarioRegistryChecksum } from "../../src/readiness/grid-grapple-scenarios.js";

export const GRAPPLE_SUPPLEMENT_TEST_ID = "33333333-3333-4333-8333-333333333333";
export const GRAPPLE_SUPPLEMENT_TEST_CREATED_AT = "2026-08-03T00:00:00.000Z";

export function grappleSupplementTestMatchIds(): string[] {
  return Array.from({ length: GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT }, (_, i) => {
    const tail = String(i).padStart(12, "0");
    return `44444444-4444-4444-8444-${tail}`;
  });
}

/**
 * The equivalent validated fixture base identity: the test evaluation bundle
 * from `buildReadinessTestBundle()` with the frozen official suite checksum
 * (identical registries and run plan) and the fixture evaluation ID.
 */
export function grappleSupplementFixtureBaseIdentity(): {
  evaluationId: string;
  suiteChecksum: string;
} {
  return {
    evaluationId: READINESS_TEST_EVALUATION_ID,
    suiteChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
  };
}

export interface GridGrappleSupplementFixture {
  contents: Record<string, string>;
  baseContents: Record<string, string>;
  baseReference: GridGrappleCoverageBaseV3Reference;
  supplementId: string;
  createdAt: string;
  seedRegistry: ReturnType<typeof readinessTestSeedRegistry>;
  scenarioRegistry: ReturnType<typeof createGridGrappleCoverageScenarioRegistry>;
  runPlan: GridGrappleCoverageRunPlan;
  planChecksum: string;
  primary: GridGrappleCoverageSupplementOutcome;
  repeat: GridGrappleCoverageSupplementOutcome;
  metrics: GridGrappleCoverageMetrics;
  decision: GridGrappleCoverageDecisionV1;
  addendum: GridActivationReadinessAddendumV1;
  combinedReadinessClassification: GridActivationReadinessCombinedClassification;
  manifest: GridGrappleCoverageSupplementManifestV1;
}

/**
 * Builds a fully consistent in-memory supplemental bundle from one real
 * 48-match execution (identical to the service pipeline, without filesystem
 * access), anchored to the equivalent validated fixture base bundle.
 */
export function buildGridGrappleSupplementFixture(): GridGrappleSupplementFixture {
  const base = buildReadinessTestBundle();
  const baseIdentity = grappleSupplementFixtureBaseIdentity();
  const baseReference = anchorGridGrappleCoverageBaseV3(base.contents, baseIdentity);

  const seedRegistry = readinessTestSeedRegistry();
  const scenarioRegistry = createGridGrappleCoverageScenarioRegistry();
  const runPlan = buildGridGrappleCoverageRunPlan({
    seedRegistry,
    scenarioRegistry,
    baseV3EvaluationId: baseIdentity.evaluationId,
    baseV3SuiteChecksum: baseIdentity.suiteChecksum,
  });
  const planChecksum = gridGrappleCoveragePlanChecksum(runPlan);

  const supplementId = GRAPPLE_SUPPLEMENT_TEST_ID;
  const createdAt = GRAPPLE_SUPPLEMENT_TEST_CREATED_AT;
  const identities = {
    supplementId,
    createdAt,
    matchIds: grappleSupplementTestMatchIds(),
  };
  const primary = executeGridGrappleCoverageSupplement({
    seedRegistry,
    scenarioRegistry,
    runPlan,
    identities,
  });
  const repeat = executeGridGrappleCoverageSupplement({
    seedRegistry,
    scenarioRegistry,
    runPlan,
    identities,
  });
  verifyGridGrappleCoverageDeterminism(primary, repeat);

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
    items: primary.results.map((run) => ({
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
    })),
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
    timing: { totalElapsedMs: 0, perMatchMs: [] },
  });

  const iso = metrics.isolation;
  const hardChecks = {
    allMatchesCompleted: true,
    determinismVerified: true,
    runtimeIdentityMatches: true,
    recordsValid: true,
    reportsValid: true,
    finalStateAgreementsComplete: true,
    chronologyValid: true,
    malformedGrappleEventsAbsent:
      iso.malformedOrResolverDisagreeingGrappleEvents === 0 &&
      iso.grappleEventsAttributedToWrongFighter === 0,
    resolverDisagreementsAbsent: iso.malformedOrResolverDisagreeingGrappleEvents === 0,
    inputsUnmodified: true,
    artifactIntegrityVerified: true,
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

  const g = metrics.grapple;
  const addendum = buildGridActivationReadinessAddendum({
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
      scenarioRegistryChecksum: scenarioRegistryChecksumValue(scenarioRegistry),
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
      scenarioRegistryChecksum: scenarioRegistryChecksumValue(scenarioRegistry),
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
    seedRegistryChecksum: seedRegistryChecksumValue(seedRegistry),
    scenarioRegistryId: scenarioRegistry.registryId,
    scenarioRegistryChecksum: scenarioRegistryChecksumValue(scenarioRegistry),
    planChecksum,
    metrics,
    decision: decision.decision,
    combinedReadinessClassification,
    addendum,
  });

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
  const serializedDecision = serializeGridActivationReadinessEnvelope(decision);
  const serializedBaseReference =
    serializeGridGrappleCoverageBaseReference(baseReference);
  const serializedReport = report;

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

  const manifest = buildGridGrappleCoverageSupplementManifest({
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

  const contents: Record<string, string> = {
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

  return {
    contents,
    baseContents: base.contents,
    baseReference,
    supplementId,
    createdAt,
    seedRegistry,
    scenarioRegistry,
    runPlan,
    planChecksum,
    primary,
    repeat,
    metrics,
    decision,
    addendum,
    combinedReadinessClassification,
    manifest,
  };
}

function seedRegistryChecksumValue(
  registry: ReturnType<typeof readinessTestSeedRegistry>,
): string {
  return gridReadinessSeedRegistryChecksum(registry);
}

function scenarioRegistryChecksumValue(
  registry: ReturnType<typeof createGridGrappleCoverageScenarioRegistry>,
): string {
  return gridGrappleCoverageScenarioRegistryChecksum(registry);
}
