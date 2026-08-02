import { z } from "zod";
import { sha256Hex } from "../canary/grid-canary-digest.js";
import { machineBuildProposalSchema } from "../schemas/build.schema.js";
import { actionPolicySchema } from "../schemas/policy.schema.js";
import {
  loadGridReadinessSeedRegistry,
  gridReadinessSeedRegistryChecksum,
  assertCanonicalGridReadinessSeedRegistry,
  GRID_READINESS_CANONICAL_SEED_REGISTRY_CHECKSUM,
  type GridReadinessSeedRegistry,
} from "./seed-registry.js";
import {
  deepFreezeReadinessValue,
  gridReadinessScenarioRegistryChecksum,
  assertCanonicalGridReadinessScenarioRegistry,
  GRID_READINESS_CANONICAL_SCENARIO_REGISTRY_CHECKSUM,
  type GridReadinessScenarioRegistry,
} from "./scenario-registry.js";
import {
  buildGridActivationReadinessRunPlan,
  gridActivationReadinessSuiteChecksum,
  GRID_ACTIVATION_READINESS_RUN_COUNT,
  GRID_ACTIVATION_READINESS_SUITE_ID,
  GRID_ACTIVATION_READINESS_SUITE_ID_V1,
  GRID_ACTIVATION_READINESS_SUITE_ID_V2,
  GRID_READINESS_ACTION_EVIDENCE_MODEL,
  GRID_READINESS_PROVENANCE_MODEL,
} from "./run-plan.js";
import {
  deserializeGridActivationReadinessRunIndex,
  deserializeGridActivationReadinessMatchRecords,
  deserializeGridActivationReadinessFactualReports,
  type GridActivationReadinessRunIndexEnvelopeV3,
  type GridActivationReadinessMatchRecordsEnvelope,
  type GridActivationReadinessFactualReportsEnvelope,
} from "./envelopes.schema.js";
import {
  deserializeGridActivationReadinessMetrics,
  recomputeGridActivationReadinessMetricsFromArtifacts,
  stripGridActivationReadinessMetricsV3,
  type GridActivationReadinessMetrics,
  type GridActivationReadinessMetricsV3Artifact,
} from "./metrics.js";
import {
  deserializeGridActivationReadinessDecision,
  GRID_ACTIVATION_READINESS_DISCLAIMER,
  type GridActivationReadinessDecisionV3,
} from "./decision.js";
import {
  inspectGridReadinessRecordEvidence,
  recomputeGridActivationReadinessRunChecksums,
  type GridActivationReadinessRunEvidence,
} from "./record-evidence.js";
import {
  evaluateGridActivationReadinessGates,
  type GridActivationReadinessGateResults,
  type GridActivationReadinessOperationalEvidence,
} from "./gates.js";
import { deriveGridActivationReadinessDecision } from "./decision.js";
import { buildGridActivationReadinessReport } from "./report.js";

/**
 * Grid activation-readiness immutable evaluation bundle (Milestone 0.2C Phase
 * 3E1).
 *
 * Each official evaluation writes exactly nine regular files under
 * `data/readiness/grid/<evaluationId>/`:
 *
 *   manifest.json, seed-registry.json, scenario-registry.json, run-index.json,
 *   match-records.json, factual-reports.json, metrics.json, decision.json,
 *   report.txt
 *
 * The manifest carries the evaluation UUID, creation time, suite and runtime
 * identity, exact counts, registry/suite/outcome/report checksums, the
 * readiness decision, fixed artifact names and the SHA-256 digest of every
 * non-manifest artifact. Individual replay text is never included.
 */
export const GRID_READINESS_MANIFEST_FILE = "manifest.json" as const;
export const GRID_READINESS_SEED_REGISTRY_ARTIFACT = "seed-registry.json" as const;
export const GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT =
  "scenario-registry.json" as const;
export const GRID_READINESS_RUN_INDEX_ARTIFACT = "run-index.json" as const;
export const GRID_READINESS_MATCH_RECORDS_ARTIFACT = "match-records.json" as const;
export const GRID_READINESS_FACTUAL_REPORTS_ARTIFACT = "factual-reports.json" as const;
export const GRID_READINESS_METRICS_ARTIFACT = "metrics.json" as const;
export const GRID_READINESS_DECISION_ARTIFACT = "decision.json" as const;
export const GRID_READINESS_REPORT_ARTIFACT = "report.txt" as const;

/** Exact nine-entry bundle inventory (regular files only, no symlinks). */
export const GRID_READINESS_BUNDLE_ENTRIES: readonly string[] = Object.freeze([
  GRID_READINESS_MANIFEST_FILE,
  GRID_READINESS_SEED_REGISTRY_ARTIFACT,
  GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT,
  GRID_READINESS_RUN_INDEX_ARTIFACT,
  GRID_READINESS_MATCH_RECORDS_ARTIFACT,
  GRID_READINESS_FACTUAL_REPORTS_ARTIFACT,
  GRID_READINESS_METRICS_ARTIFACT,
  GRID_READINESS_DECISION_ARTIFACT,
  GRID_READINESS_REPORT_ARTIFACT,
]);

export const GRID_READINESS_NON_MANIFEST_ARTIFACTS: readonly string[] = Object.freeze(
  GRID_READINESS_BUNDLE_ENTRIES.filter((name) => name !== GRID_READINESS_MANIFEST_FILE),
);

// ── seed-registry artifact serialization ───────────────────────────────────

export function serializeGridReadinessSeedRegistry(
  registry: GridReadinessSeedRegistry,
): string {
  return JSON.stringify(
    {
      schemaVersion: registry.schemaVersion,
      registryId: registry.registryId,
      purpose: registry.purpose,
      partition: registry.partition,
      seedDomain: registry.seedDomain,
      generatorVersion: registry.generatorVersion,
      simulatorVersion: registry.simulatorVersion,
      positioningModel: registry.positioningModel,
      rulesetVersion: registry.rulesetVersion,
      catalogueVersion: registry.catalogueVersion,
      seeds: [...registry.seeds],
    },
    null,
    2,
  );
}

// ── scenario-registry artifact schema and serialization ────────────────────

const readinessScenarioFighterSchema = z.object({
  displayName: z.string().min(1),
  buildProposal: machineBuildProposalSchema,
  policy: actionPolicySchema,
});

const readinessScenarioArtifactSchema = z
  .object({
    registryId: z.literal("grid-readiness-scenarios-v1"),
    simulatorVersion: z.literal("0.3.0"),
    positioningModel: z.literal("grid-3x3-v1"),
    rulesetVersion: z.literal("0.2.0"),
    catalogueVersion: z.literal("1"),
    scenarios: z.array(
      z.object({
        scenarioId: z.string().min(1),
        familyName: z.string().min(1),
        fighterX: readinessScenarioFighterSchema,
        fighterY: readinessScenarioFighterSchema,
      }),
    ),
    assignments: z.array(
      z.object({
        assignmentId: z.string().min(1),
        scenarioId: z.string().min(1),
        fighterACompetitor: z.enum(["x", "y"]),
        fighterBCompetitor: z.enum(["x", "y"]),
        roleSwapped: z.boolean(),
      }),
    ),
  })
  .strict();

export type GridActivationReadinessScenarioArtifact = z.infer<
  typeof readinessScenarioArtifactSchema
>;

export function serializeGridReadinessScenarioRegistry(
  registry: GridReadinessScenarioRegistry,
): string {
  return JSON.stringify(
    {
      registryId: registry.registryId,
      simulatorVersion: registry.simulatorVersion,
      positioningModel: registry.positioningModel,
      rulesetVersion: registry.rulesetVersion,
      catalogueVersion: registry.catalogueVersion,
      scenarios: registry.scenarios.map((scenario) => ({
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
      assignments: registry.assignments.map((assignment) => ({
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
}

export function deserializeGridActivationReadinessScenarioRegistry(
  json: string,
): { ok: true; registry: GridReadinessScenarioRegistry } | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json) as unknown;
    const result = readinessScenarioArtifactSchema.safeParse(data);
    if (!result.success) return { ok: false, errors: result.error.message };
    const artifact = result.data;
    // Reconstruct with the same deep-freeze and no-shared-reference
    // guarantees as the live registry factory.
    const registry: GridReadinessScenarioRegistry = Object.freeze({
      registryId: artifact.registryId,
      simulatorVersion: artifact.simulatorVersion,
      positioningModel: artifact.positioningModel,
      rulesetVersion: artifact.rulesetVersion,
      catalogueVersion: artifact.catalogueVersion,
      scenarios: Object.freeze(
        artifact.scenarios.map((scenario) =>
          Object.freeze({
            scenarioId: scenario.scenarioId,
            familyName: scenario.familyName,
            fighterX: deepFreezeReadinessValue(scenario.fighterX),
            fighterY: deepFreezeReadinessValue(scenario.fighterY),
          }),
        ),
      ),
      assignments: Object.freeze(
        artifact.assignments.map((assignment) => deepFreezeReadinessValue(assignment)),
      ),
    });
    return { ok: true, registry };
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
  }
}

// ── manifest v2 (current) and v1 (historical) ───────────────────────────────

const manifestArtifactsSchema = z.object({
  manifest: z.literal(GRID_READINESS_MANIFEST_FILE),
  seedRegistry: z.literal(GRID_READINESS_SEED_REGISTRY_ARTIFACT),
  scenarioRegistry: z.literal(GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT),
  runIndex: z.literal(GRID_READINESS_RUN_INDEX_ARTIFACT),
  matchRecords: z.literal(GRID_READINESS_MATCH_RECORDS_ARTIFACT),
  factualReports: z.literal(GRID_READINESS_FACTUAL_REPORTS_ARTIFACT),
  metrics: z.literal(GRID_READINESS_METRICS_ARTIFACT),
  decision: z.literal(GRID_READINESS_DECISION_ARTIFACT),
  report: z.literal(GRID_READINESS_REPORT_ARTIFACT),
});

/** Current manifest v3 schema (suite v3, action-evidence + provenance models). */
export const gridActivationReadinessManifestV3Schema = z
  .object({
    schemaVersion: z.literal("3"),
    evaluationKind: z.literal("grid-activation-readiness"),
    suiteId: z.literal(GRID_ACTIVATION_READINESS_SUITE_ID),
    actionEvidenceModel: z.literal(GRID_READINESS_ACTION_EVIDENCE_MODEL),
    provenanceModel: z.literal(GRID_READINESS_PROVENANCE_MODEL),
    evaluationId: z.string().uuid(),
    createdAt: z.string().min(1),
    simulatorVersion: z.literal("0.3.0"),
    positioningModel: z.literal("grid-3x3-v1"),
    rulesetVersion: z.literal("0.2.0"),
    catalogueVersion: z.literal("1"),
    seedCount: z.literal(24),
    scenarioCount: z.literal(7),
    assignmentCount: z.literal(13),
    runCount: z.literal(GRID_ACTIVATION_READINESS_RUN_COUNT),
    seedRegistryId: z.literal("grid-readiness-development-v1"),
    seedRegistryChecksum: z.literal(
      "54acf0151360f59d429fd7b2a84f48b48f4a791e522cf58bc381b927d62b78a0",
    ),
    scenarioRegistryId: z.literal("grid-readiness-scenarios-v1"),
    scenarioRegistryChecksum: z.literal(
      "b07270171f6e38efac2d1992f051d7bd881e323c00cee92b9caa9490ddb85b67",
    ),
    suiteChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    decisionChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    reportChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    decision: z.enum(["ready_for_opt_in_beta_review", "inconclusive", "not_ready"]),
    artifacts: manifestArtifactsSchema,
    digests: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
    evidence: z.object({
      deterministicReexecutionPassed: z.literal(true),
      inputsUnmodified: z.literal(true),
      fullBundleReadBackPassed: z.literal(true),
      legacyIsolationRegressionPassed: z.literal(true),
    }),
  })
  .strict();

export type GridActivationReadinessManifestV3 = z.infer<
  typeof gridActivationReadinessManifestV3Schema
>;

/** Historical manifest v2 schema, retained for historical parsers only. */
export const gridActivationReadinessManifestV2Schema = z
  .object({
    schemaVersion: z.literal("2"),
    evaluationKind: z.literal("grid-activation-readiness"),
    suiteId: z.literal(GRID_ACTIVATION_READINESS_SUITE_ID_V2),
    actionEvidenceModel: z.literal(GRID_READINESS_ACTION_EVIDENCE_MODEL),
    evaluationId: z.string().uuid(),
    createdAt: z.string().min(1),
    simulatorVersion: z.literal("0.3.0"),
    positioningModel: z.literal("grid-3x3-v1"),
    rulesetVersion: z.literal("0.2.0"),
    catalogueVersion: z.literal("1"),
    seedCount: z.literal(24),
    scenarioCount: z.literal(7),
    assignmentCount: z.literal(13),
    runCount: z.literal(GRID_ACTIVATION_READINESS_RUN_COUNT),
    seedRegistryId: z.literal("grid-readiness-development-v1"),
    seedRegistryChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    scenarioRegistryId: z.literal("grid-readiness-scenarios-v1"),
    scenarioRegistryChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    suiteChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    decisionChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    reportChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    decision: z.enum(["ready_for_opt_in_beta_review", "inconclusive", "not_ready"]),
    artifacts: manifestArtifactsSchema,
    digests: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
    evidence: z.object({
      deterministicReexecutionPassed: z.literal(true),
      inputsUnmodified: z.literal(true),
      fullBundleReadBackPassed: z.literal(true),
      legacyIsolationRegressionPassed: z.literal(true),
    }),
  })
  .strict();

export type GridActivationReadinessManifestV2 = z.infer<
  typeof gridActivationReadinessManifestV2Schema
>;

/** Historical manifest v1 schema, retained for historical parsers only. */
export const gridActivationReadinessManifestV1Schema = z
  .object({
    schemaVersion: z.literal("1"),
    evaluationKind: z.literal("grid-activation-readiness"),
    suiteId: z.literal(GRID_ACTIVATION_READINESS_SUITE_ID_V1),
    evaluationId: z.string().uuid(),
    createdAt: z.string().min(1),
    simulatorVersion: z.literal("0.3.0"),
    positioningModel: z.literal("grid-3x3-v1"),
    rulesetVersion: z.literal("0.2.0"),
    catalogueVersion: z.literal("1"),
    seedCount: z.literal(24),
    scenarioCount: z.literal(7),
    assignmentCount: z.literal(13),
    runCount: z.literal(GRID_ACTIVATION_READINESS_RUN_COUNT),
    seedRegistryId: z.literal("grid-readiness-development-v1"),
    seedRegistryChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    scenarioRegistryId: z.literal("grid-readiness-scenarios-v1"),
    scenarioRegistryChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    suiteChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    decisionChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    reportChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    decision: z.enum(["ready_for_opt_in_beta_review", "inconclusive", "not_ready"]),
    artifacts: manifestArtifactsSchema,
    digests: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
    evidence: z.object({
      allArtifactsReadBack: z.literal(true),
      bundleCrossAgreementPassed: z.literal(true),
      deterministicReexecutionPassed: z.literal(true),
    }),
  })
  .strict();

export type GridActivationReadinessManifestV1 = z.infer<
  typeof gridActivationReadinessManifestV1Schema
>;

/** Current manifest artifact type (v3). */
export type GridActivationReadinessManifestV3Artifact = GridActivationReadinessManifestV3;

export class GridActivationReadinessBundleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridActivationReadinessBundleError";
  }
}

export interface BuildGridActivationReadinessManifestInput {
  evaluationId: string;
  createdAt: string;
  seedRegistry: GridReadinessSeedRegistry;
  scenarioRegistry: GridReadinessScenarioRegistry;
  suiteChecksum: string;
  decision: GridActivationReadinessDecisionV3;
  /** SHA-256 digest of every non-manifest artifact, keyed by artifact name. */
  digests: Record<string, string>;
  decisionChecksum: string;
  reportChecksum: string;
}

export function buildGridActivationReadinessManifest(
  input: BuildGridActivationReadinessManifestInput,
): GridActivationReadinessManifestV3 {
  const manifest: GridActivationReadinessManifestV3 = {
    schemaVersion: "3",
    evaluationKind: "grid-activation-readiness",
    suiteId: GRID_ACTIVATION_READINESS_SUITE_ID,
    actionEvidenceModel: GRID_READINESS_ACTION_EVIDENCE_MODEL,
    provenanceModel: GRID_READINESS_PROVENANCE_MODEL,
    evaluationId: input.evaluationId,
    createdAt: input.createdAt,
    simulatorVersion: "0.3.0",
    positioningModel: "grid-3x3-v1",
    rulesetVersion: "0.2.0",
    catalogueVersion: "1",
    seedCount: input.seedRegistry.seeds.length as 24,
    scenarioCount: input.scenarioRegistry.scenarios.length as 7,
    assignmentCount: input.scenarioRegistry.assignments.length as 13,
    runCount: GRID_ACTIVATION_READINESS_RUN_COUNT,
    seedRegistryId: input.seedRegistry.registryId,
    seedRegistryChecksum:
      GRID_READINESS_CANONICAL_SEED_REGISTRY_CHECKSUM as GridActivationReadinessManifestV3["seedRegistryChecksum"],
    scenarioRegistryId: input.scenarioRegistry.registryId,
    scenarioRegistryChecksum:
      GRID_READINESS_CANONICAL_SCENARIO_REGISTRY_CHECKSUM as GridActivationReadinessManifestV3["scenarioRegistryChecksum"],
    suiteChecksum: input.suiteChecksum,
    decisionChecksum: input.decisionChecksum,
    reportChecksum: input.reportChecksum,
    decision: input.decision.decision,
    artifacts: {
      manifest: GRID_READINESS_MANIFEST_FILE,
      seedRegistry: GRID_READINESS_SEED_REGISTRY_ARTIFACT,
      scenarioRegistry: GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT,
      runIndex: GRID_READINESS_RUN_INDEX_ARTIFACT,
      matchRecords: GRID_READINESS_MATCH_RECORDS_ARTIFACT,
      factualReports: GRID_READINESS_FACTUAL_REPORTS_ARTIFACT,
      metrics: GRID_READINESS_METRICS_ARTIFACT,
      decision: GRID_READINESS_DECISION_ARTIFACT,
      report: GRID_READINESS_REPORT_ARTIFACT,
    },
    digests: { ...input.digests },
    evidence: {
      deterministicReexecutionPassed: true,
      inputsUnmodified: true,
      fullBundleReadBackPassed: true,
      legacyIsolationRegressionPassed: true,
    },
  };
  const parsed = deserializeGridActivationReadinessManifest(
    serializeGridActivationReadinessManifest(manifest),
  );
  if (!parsed.ok || parsed.schemaVersion !== "3") {
    throw new GridActivationReadinessBundleError(
      `Grid activation readiness manifest failed its authoritative v3 schema: ${parsed.ok ? "not v3" : parsed.errors}`,
    );
  }
  return parsed.manifest as GridActivationReadinessManifestV3;
}

export function serializeGridActivationReadinessManifest(
  manifest:
    | GridActivationReadinessManifestV3
    | GridActivationReadinessManifestV2
    | GridActivationReadinessManifestV1,
): string {
  return JSON.stringify(manifest, null, 2);
}

/**
 * Version-aware manifest deserializer. Reads the current v3 contract and the
 * historical v2 and v1 contracts. Only v3 is accepted as current
 * activation-readiness evidence.
 */
export function deserializeGridActivationReadinessManifest(json: string):
  | {
      ok: true;
      manifest:
        | GridActivationReadinessManifestV3
        | GridActivationReadinessManifestV2
        | GridActivationReadinessManifestV1;
      schemaVersion: "1" | "2" | "3";
    }
  | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json) as unknown;
    const v3 = gridActivationReadinessManifestV3Schema.safeParse(data);
    if (v3.success) return { ok: true, manifest: v3.data, schemaVersion: "3" };
    const v2 = gridActivationReadinessManifestV2Schema.safeParse(data);
    if (v2.success) return { ok: true, manifest: v2.data, schemaVersion: "2" };
    const v1 = gridActivationReadinessManifestV1Schema.safeParse(data);
    if (v1.success) return { ok: true, manifest: v1.data, schemaVersion: "1" };
    return {
      ok: false,
      errors: `manifest matched neither v3 (${v3.error.message}) nor v2 (${v2.error.message}) nor v1 (${v1.error.message})`,
    };
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
  }
}

// ── pure bundle cross-agreement validators ─────────────────────────────────

function check(failures: string[], condition: boolean, message: string): void {
  if (!condition) failures.push(message);
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function buildPolicyMatches(recordPolicy: unknown, expectedPolicy: unknown): boolean {
  return sameJson(recordPolicy, expectedPolicy);
}

function buildProposalMatches(recordBuild: unknown, expectedProposal: unknown): boolean {
  const record = recordBuild as {
    proposal?: {
      machineName?: string;
      chassisId?: string;
      mobilityId?: string;
      weaponId?: string;
      utilityId?: string;
      armour?: unknown;
    };
  };
  const proposal = record?.proposal;
  if (!proposal) return false;
  const expected = expectedProposal as {
    machineName?: string;
    chassisId?: string;
    mobilityId?: string;
    weaponId?: string;
    utilityId?: string;
    armour?: unknown;
  };
  return (
    proposal.machineName === expected.machineName &&
    proposal.chassisId === expected.chassisId &&
    proposal.mobilityId === expected.mobilityId &&
    proposal.weaponId === expected.weaponId &&
    proposal.utilityId === expected.utilityId &&
    sameJson(proposal.armour, expected.armour)
  );
}

export interface GridActivationReadinessCoreArtifactsInput {
  seedRegistry: GridReadinessSeedRegistry;
  scenarioRegistry: GridReadinessScenarioRegistry;
  runIndex: GridActivationReadinessRunIndexEnvelopeV3;
  records: GridActivationReadinessMatchRecordsEnvelope;
  reports: GridActivationReadinessFactualReportsEnvelope;
}

/** Compares recomputed evidence with a persisted v3 run-index entry. */
function evidenceMatchesRunIndexEntry(
  evidence: GridActivationReadinessRunEvidence,
  entry: GridActivationReadinessRunIndexEnvelopeV3["items"][number],
): boolean {
  return (
    sameJson(evidence.actionCounts, entry.actionCounts) &&
    sameJson(evidence.selectedMovementActionCounts, entry.selectedMovementActionCounts) &&
    sameJson(evidence.selectedCombatActionCounts, entry.selectedCombatActionCounts) &&
    sameJson(evidence.translatedActionCounts, entry.translatedActionCounts) &&
    evidence.stationaryHoldCount === (entry.actionCounts.hold ?? 0) &&
    sameJson(evidence.zoneVisits, entry.zoneVisits) &&
    sameJson(evidence.bearingCounts, entry.bearingCounts) &&
    sameJson(
      evidence.exposedPlanarArmourZoneCounts,
      entry.exposedPlanarArmourZoneCounts,
    ) &&
    sameJson(evidence.eventTypeCounts, entry.eventTypeCounts) &&
    evidence.maximumConsecutiveNoProgressRounds ===
      entry.maximumConsecutiveNoProgressRounds
  );
}

/**
 * Core cross-agreement validation of the records/reports/run-index against
 * the persisted registries. This subset does not require the manifest or the
 * decision, so it can run before the decision is built (feeding the H09 gate)
 * and is reused by the full bundle validator. For every run it also
 * recomputes the authoritative per-run evidence and the derived artifact
 * checksums from the persisted record/report pair and requires exact
 * agreement with the persisted run-index entry (Phase 7).
 */
export function validateGridActivationReadinessCoreArtifacts(
  input: GridActivationReadinessCoreArtifactsInput,
): void {
  const failures: string[] = [];
  const { seedRegistry, scenarioRegistry, runIndex, records, reports } = input;

  // Phase 3E1.2 (Phase 2/3): the persisted registries must be the exact
  // frozen canonical registries, not merely self-consistent alternates.
  try {
    assertCanonicalGridReadinessSeedRegistry(seedRegistry);
  } catch (e) {
    failures.push(
      `persisted seed registry is not the canonical registry: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
  try {
    assertCanonicalGridReadinessScenarioRegistry(scenarioRegistry);
  } catch (e) {
    failures.push(
      `persisted scenario registry is not the canonical registry: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  check(
    failures,
    runIndex.items.length === GRID_ACTIVATION_READINESS_RUN_COUNT &&
      records.items.length === GRID_ACTIVATION_READINESS_RUN_COUNT &&
      reports.items.length === GRID_ACTIVATION_READINESS_RUN_COUNT,
    "envelopes must each contain exactly 312 items",
  );
  check(
    failures,
    runIndex.evaluationId === records.evaluationId &&
      runIndex.evaluationId === reports.evaluationId,
    "envelope evaluation IDs do not agree",
  );

  // The persisted registries must reproduce the persisted run index exactly.
  const plan = buildGridActivationReadinessRunPlan({ seedRegistry, scenarioRegistry });
  check(
    failures,
    plan.runs.length === runIndex.items.length,
    "recomputed run plan length does not match run-index",
  );
  for (let i = 0; i < runIndex.items.length; i++) {
    const entry = runIndex.items[i]!;
    const planned = plan.runs[i]!;
    check(
      failures,
      entry.runNumber === planned.runNumber &&
        entry.scenarioId === planned.scenarioId &&
        entry.assignmentId === planned.assignmentId &&
        entry.seed === planned.seed &&
        entry.roleSwapped === planned.roleSwapped &&
        entry.fighterACompetitor === planned.fighterACompetitor &&
        entry.fighterBCompetitor === planned.fighterBCompetitor,
      `run-index item ${i} does not match the recomputed run plan`,
    );
  }

  for (let i = 0; i < runIndex.items.length; i++) {
    const entry = runIndex.items[i]!;
    const record = records.items[i]!;
    const report = reports.items[i]!;
    const label = `run ${entry.runNumber} (index ${i})`;
    check(failures, record.matchId === entry.matchId, `${label} record matchId mismatch`);
    check(failures, report.matchId === entry.matchId, `${label} report matchId mismatch`);
    check(failures, record.seed === entry.seed, `${label} record seed mismatch`);
    check(failures, report.seed === entry.seed, `${label} report seed mismatch`);
    check(failures, record.rounds === entry.rounds, `${label} record rounds mismatch`);
    check(failures, report.rounds === entry.rounds, `${label} report rounds mismatch`);
    check(
      failures,
      record.result.winner === entry.winner,
      `${label} record winner mismatch`,
    );
    check(
      failures,
      record.result.method === entry.resultMethod,
      `${label} record result method mismatch`,
    );
    check(failures, report.winner === entry.winner, `${label} report winner mismatch`);
    check(
      failures,
      report.resultMethod === entry.resultMethod,
      `${label} report result method mismatch`,
    );
    check(
      failures,
      record.simulatorVersion === "0.3.0" &&
        record.positioningModel === "grid-3x3-v1" &&
        record.rulesetVersion === "0.2.0" &&
        record.catalogueVersion === "1",
      `${label} record runtime identity mismatch`,
    );
    check(
      failures,
      report.simulatorVersion === "0.3.0" &&
        report.positioningModel === "grid-3x3-v1" &&
        report.rulesetVersion === "0.2.0" &&
        report.catalogueVersion === "1",
      `${label} report runtime identity mismatch`,
    );
    // Record/report binding.
    check(
      failures,
      report.matchId === record.matchId &&
        report.seed === record.seed &&
        report.rounds === record.rounds &&
        report.winner === record.result.winner &&
        report.resultMethod === record.result.method,
      `${label} record/report binding mismatch`,
    );
    // Build/policy binding to the scenario assignment.
    const scenario = scenarioRegistry.scenarios.find(
      (s) => s.scenarioId === entry.scenarioId,
    );
    check(failures, scenario !== undefined, `${label} unknown scenario in registry`);
    if (scenario) {
      const configA =
        entry.fighterACompetitor === "x" ? scenario.fighterX : scenario.fighterY;
      const configB =
        entry.fighterBCompetitor === "x" ? scenario.fighterX : scenario.fighterY;
      check(
        failures,
        buildProposalMatches(record.config.fighterA.build, configA.buildProposal) &&
          buildPolicyMatches(record.config.fighterA.policy, configA.policy),
        `${label} fighterA build/policy does not match the scenario assignment`,
      );
      check(
        failures,
        buildProposalMatches(record.config.fighterB.build, configB.buildProposal) &&
          buildPolicyMatches(record.config.fighterB.policy, configB.policy),
        `${label} fighterB build/policy does not match the scenario assignment`,
      );
    }

    // Phase 7: recompute the authoritative per-run evidence and the derived
    // artifact checksums from the persisted record/report pair.
    let recomputedEvidence: GridActivationReadinessRunEvidence;
    try {
      recomputedEvidence = inspectGridReadinessRecordEvidence(record);
    } catch (e) {
      check(
        failures,
        false,
        `${label} persisted record failed the record-evidence inspector: ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }
    check(
      failures,
      evidenceMatchesRunIndexEntry(recomputedEvidence, entry),
      `${label} recomputed per-run evidence does not match the persisted run-index entry`,
    );
    const recomputedChecksums = recomputeGridActivationReadinessRunChecksums(
      record,
      report,
    );
    check(
      failures,
      recomputedChecksums.recordChecksum === entry.recordChecksum &&
        recomputedChecksums.reportChecksum === entry.reportChecksum &&
        recomputedChecksums.textReplayChecksum === entry.textReplayChecksum &&
        recomputedChecksums.asciiReplayChecksum === entry.asciiReplayChecksum &&
        recomputedChecksums.reviewPromptChecksum === entry.reviewPromptChecksum,
      `${label} recomputed artifact checksums do not match the persisted run-index entry`,
    );
  }

  if (failures.length > 0) {
    throw new GridActivationReadinessBundleError(
      `Grid activation readiness bundle cross-agreement failed: ${failures.join("; ")}`,
    );
  }
}

export interface GridActivationReadinessBundleValidationResult {
  evaluationId: string;
  decision: "ready_for_opt_in_beta_review" | "inconclusive" | "not_ready";
  digestAgreement: true;
}

/**
 * Pure cross-agreement validation of the complete read-back bundle (Phase 11).
 *
 * Establishes the provenance chain:
 *
 *   seed registry + scenario registry → exact run plan → each persisted match
 *   record and report → recomputed per-run evidence and render checksums →
 *   recomputed metrics → recomputed gates → recomputed decision → regenerated
 *   report → manifest identity and digests.
 *
 * All nine artifacts participate. A bundle is invalid when any derived
 * artifact disagrees with the persisted records, even when every file is
 * schema-valid and all manifest digests have been updated coherently.
 * Historical v1 artifacts parse through the version-aware deserializers but
 * are rejected as current v2 evidence.
 */
export function validateGridActivationReadinessBundle(
  contents: Record<string, string>,
): GridActivationReadinessBundleValidationResult {
  const failures: string[] = [];

  const manifestText = contents[GRID_READINESS_MANIFEST_FILE];
  const seedText = contents[GRID_READINESS_SEED_REGISTRY_ARTIFACT];
  const scenarioText = contents[GRID_READINESS_SCENARIO_REGISTRY_ARTIFACT];
  const runIndexText = contents[GRID_READINESS_RUN_INDEX_ARTIFACT];
  const recordsText = contents[GRID_READINESS_MATCH_RECORDS_ARTIFACT];
  const reportsText = contents[GRID_READINESS_FACTUAL_REPORTS_ARTIFACT];
  const metricsText = contents[GRID_READINESS_METRICS_ARTIFACT];
  const decisionText = contents[GRID_READINESS_DECISION_ARTIFACT];
  const reportText = contents[GRID_READINESS_REPORT_ARTIFACT];

  for (const name of GRID_READINESS_BUNDLE_ENTRIES) {
    check(
      failures,
      typeof contents[name] === "string",
      `bundle is missing artifact ${name}`,
    );
  }

  const manifestParsed = manifestText
    ? deserializeGridActivationReadinessManifest(manifestText)
    : { ok: false as const, errors: "missing manifest" };
  const seedParsed = seedText ? loadGridReadinessSeedRegistrySafe(seedText) : null;
  const scenarioParsed = scenarioText
    ? deserializeGridActivationReadinessScenarioRegistry(scenarioText)
    : null;
  const runIndexParsed = runIndexText
    ? deserializeGridActivationReadinessRunIndex(runIndexText)
    : null;
  const recordsParsed = recordsText
    ? deserializeGridActivationReadinessMatchRecords(recordsText)
    : null;
  const reportsParsed = reportsText
    ? deserializeGridActivationReadinessFactualReports(reportsText)
    : null;
  const metricsParsed = metricsText
    ? deserializeGridActivationReadinessMetrics(metricsText)
    : null;
  const decisionParsed = decisionText
    ? deserializeGridActivationReadinessDecision(decisionText)
    : null;

  if (!manifestParsed.ok) {
    failures.push(`invalid manifest: ${manifestParsed.errors}`);
  }
  if (seedParsed === null) {
    failures.push("invalid seed-registry artifact");
  }
  if (scenarioParsed && !scenarioParsed.ok) {
    failures.push(`invalid scenario-registry artifact: ${scenarioParsed.errors}`);
  }
  if (runIndexParsed && !runIndexParsed.ok) {
    failures.push(`invalid run-index: ${runIndexParsed.errors}`);
  }
  if (recordsParsed && !recordsParsed.ok) {
    failures.push(`invalid match-records: ${recordsParsed.errors}`);
  }
  if (reportsParsed && !reportsParsed.ok) {
    failures.push(`invalid factual-reports: ${reportsParsed.errors}`);
  }
  if (metricsParsed && !metricsParsed.ok) {
    failures.push(`invalid metrics: ${metricsParsed.errors}`);
  }
  if (decisionParsed && !decisionParsed.ok) {
    failures.push(`invalid decision: ${decisionParsed.errors}`);
  }

  // Current v3 evidence only: historical v1 and v2 artifacts parse but are
  // rejected as current activation-readiness evidence.
  if (manifestParsed.ok && manifestParsed.schemaVersion !== "3") {
    failures.push(
      `manifest is historical v${manifestParsed.schemaVersion}; only v3 is current readiness evidence`,
    );
  }
  if (runIndexParsed && runIndexParsed.ok && runIndexParsed.schemaVersion !== "3") {
    failures.push(
      `run-index is historical v${runIndexParsed.schemaVersion}; only v3 selected-action evidence is current`,
    );
  }
  if (metricsParsed && metricsParsed.ok && metricsParsed.schemaVersion !== "3") {
    failures.push(
      `metrics is historical v${metricsParsed.schemaVersion}; only v3 is current readiness evidence`,
    );
  }
  if (decisionParsed && decisionParsed.ok && decisionParsed.schemaVersion !== "3") {
    failures.push(
      `decision is historical v${decisionParsed.schemaVersion}; only v3 is current readiness evidence`,
    );
  }

  if (failures.length > 0) {
    throw new GridActivationReadinessBundleError(
      `Grid activation readiness bundle validation failed: ${failures.join("; ")}`,
    );
  }

  const manifest = manifestParsed.ok
    ? (manifestParsed.manifest as GridActivationReadinessManifestV3)
    : null;
  const seedRegistry = seedParsed;
  const scenarioRegistry =
    scenarioParsed && scenarioParsed.ok ? scenarioParsed.registry : null;
  const runIndex =
    runIndexParsed && runIndexParsed.ok
      ? (runIndexParsed.envelope as GridActivationReadinessRunIndexEnvelopeV3)
      : null;
  const records = recordsParsed && recordsParsed.ok ? recordsParsed.envelope : null;
  const reports = reportsParsed && reportsParsed.ok ? reportsParsed.envelope : null;
  const metrics =
    metricsParsed && metricsParsed.ok
      ? (metricsParsed.metrics as GridActivationReadinessMetricsV3Artifact)
      : null;
  const decision = decisionParsed && decisionParsed.ok ? decisionParsed.decision : null;

  if (
    manifest === null ||
    seedRegistry === null ||
    scenarioRegistry === null ||
    runIndex === null ||
    records === null ||
    reports === null ||
    metrics === null ||
    decision === null
  ) {
    throw new GridActivationReadinessBundleError(
      "Grid activation readiness bundle validation failed: one or more artifacts did not parse as current v3",
    );
  }

  // Digests: every non-manifest artifact must match its manifest digest.
  {
    for (const name of GRID_READINESS_NON_MANIFEST_ARTIFACTS) {
      const digest = manifest.digests[name];
      const actual = sha256Hex(contents[name]!);
      check(
        failures,
        digest !== undefined && digest === actual,
        `manifest digest mismatch for ${name}`,
      );
    }
    // Registry checksums are the canonical (compact) registry checksums, not
    // the pretty-printed artifact digests: recompute them from the parsed
    // registries and compare.
    check(
      failures,
      gridReadinessSeedRegistryChecksum(seedRegistry) === manifest.seedRegistryChecksum,
      "manifest seed-registry checksum does not match the canonical registry checksum",
    );
    check(
      failures,
      gridReadinessScenarioRegistryChecksum(scenarioRegistry) ===
        manifest.scenarioRegistryChecksum,
      "manifest scenario-registry checksum does not match the canonical registry checksum",
    );
    check(
      failures,
      manifest.decisionChecksum ===
        sha256Hex(contents[GRID_READINESS_DECISION_ARTIFACT]!),
      "manifest decision checksum mismatch",
    );
    check(
      failures,
      manifest.reportChecksum === sha256Hex(contents[GRID_READINESS_REPORT_ARTIFACT]!),
      "manifest report checksum mismatch",
    );
  }

  // Chain: registries → exact run plan → records/reports → per-run evidence
  // and render checksums (core validator) and the manifest suite checksum.
  const plan = buildGridActivationReadinessRunPlan({ seedRegistry, scenarioRegistry });
  check(
    failures,
    gridActivationReadinessSuiteChecksum(plan) === manifest.suiteChecksum,
    "manifest suite checksum does not match the recomputed run plan",
  );
  {
    const coreFailures: string[] = [];
    try {
      validateGridActivationReadinessCoreArtifacts({
        seedRegistry,
        scenarioRegistry,
        runIndex,
        records,
        reports,
      });
    } catch (e) {
      coreFailures.push(e instanceof Error ? e.message : String(e));
    }
    if (coreFailures.length > 0) failures.push(...coreFailures);
  }

  // Chain: persisted records → recomputed metrics must equal persisted
  // metrics (Phase 9: the non-timing execution fields are derived
  // authoritatively from the records and the explicit operational
  // attestations; timing is supplied as informational input and validated
  // independently).
  const operationalEvidence: GridActivationReadinessOperationalEvidence = {
    deterministicReexecutionPassed: manifest.evidence.deterministicReexecutionPassed,
    inputsUnmodified: manifest.evidence.inputsUnmodified,
    artifactIntegrityVerified: true,
    legacyIsolationVerified: manifest.evidence.legacyIsolationRegressionPassed,
  };
  let recomputedMetrics: GridActivationReadinessMetrics | null = null;
  try {
    recomputedMetrics = recomputeGridActivationReadinessMetricsFromArtifacts({
      runIndex,
      records,
      reports,
      operationalAttestations: {
        // Phase 7: deterministicMatches follows the manifest
        // deterministicReexecutionPassed attestation (312 when true).
        deterministicMatches: operationalEvidence.deterministicReexecutionPassed
          ? GRID_ACTIVATION_READINESS_RUN_COUNT
          : 0,
        // Phase 7: mutationFailures follows the manifest inputsUnmodified
        // attestation (0 when true).
        mutationFailures: operationalEvidence.inputsUnmodified ? 0 : -1,
      },
      persistedTiming: metrics.timing,
    });
  } catch (e) {
    failures.push(
      `persisted records/reports could not be re-reduced to metrics: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
  if (recomputedMetrics !== null) {
    // The persisted artifact carries the v3 schemaVersion/suiteId identity
    // wrapper; the recomputation returns the plain reduced shape, so compare
    // against the stripped persisted metrics.
    if (!sameJson(recomputedMetrics, stripGridActivationReadinessMetricsV3(metrics))) {
      failures.push(
        "persisted metrics do not match the metrics recomputed from the persisted records and reports",
      );
    }
    // Timing validation (Phase 10): all four values finite and non-negative;
    // mean ≈ totalElapsedMs / 312 within a documented tolerance; p95 >=
    // median. The mean is NOT required to lie between the median and p95.
    const timing = metrics.timing;
    if (
      !Number.isFinite(timing.totalElapsedMs) ||
      !Number.isFinite(timing.meanMsPerMatch) ||
      !Number.isFinite(timing.medianMsPerMatch) ||
      !Number.isFinite(timing.p95MsPerMatch) ||
      timing.totalElapsedMs < 0 ||
      timing.meanMsPerMatch < 0 ||
      timing.medianMsPerMatch < 0 ||
      timing.p95MsPerMatch < 0
    ) {
      failures.push("metrics timing values must be finite and non-negative");
    }
    // Documented numeric tolerance: mean must approximate totalElapsedMs / 312
    // within a relative tolerance of 0.05 plus a small absolute floor.
    const expectedMean = timing.totalElapsedMs / GRID_ACTIVATION_READINESS_RUN_COUNT;
    const meanTolerance = Math.max(expectedMean, 1) * 0.05 + Number.EPSILON;
    if (Math.abs(timing.meanMsPerMatch - expectedMean) > meanTolerance) {
      failures.push(
        `metrics timing meanMsPerMatch ${timing.meanMsPerMatch} does not approximate totalElapsedMs / 312 (${expectedMean.toFixed(4)})`,
      );
    }
    if (timing.p95MsPerMatch < timing.medianMsPerMatch) {
      failures.push("metrics timing p95MsPerMatch must be at least medianMsPerMatch");
    }
  }

  if (recomputedMetrics === null) {
    throw new GridActivationReadinessBundleError(
      `Grid activation readiness bundle cross-agreement failed: ${failures.join("; ")}`,
    );
  }

  // Chain: recomputed metrics + persisted records → recomputed gates must
  // exactly equal the persisted decision gates.
  const recomputedGates: GridActivationReadinessGateResults =
    evaluateGridActivationReadinessGates({
      metrics: recomputedMetrics,
      results: records.items.map((record, index) => ({
        record,
        report: reports.items[index]!,
      })),
      operational: operationalEvidence,
    });
  if (!sameJson(recomputedGates.gates, decision.gates)) {
    failures.push(
      "persisted decision gates do not match the gates recomputed from the persisted records and metrics",
    );
  }
  if (recomputedGates.anyFail !== decision.gates.some((g) => g.outcome === "fail")) {
    failures.push("persisted decision gate fail-summary does not match recomputation");
  }
  if (
    recomputedGates.anyInconclusive !==
    decision.gates.some((g) => g.outcome === "inconclusive")
  ) {
    failures.push(
      "persisted decision gate inconclusive-summary does not match recomputation",
    );
  }

  // Chain: recomputed classification must equal persisted and manifest.
  const recomputedDecision = deriveGridActivationReadinessDecision({
    anyFail: recomputedGates.anyFail,
    anyInconclusive: recomputedGates.anyInconclusive,
  });
  check(
    failures,
    decision.decision === recomputedDecision,
    "persisted decision classification does not match the recomputed classification",
  );
  check(
    failures,
    decision.decision === manifest.decision,
    "persisted decision classification does not match the manifest classification",
  );

  // Chain: the human report must regenerate byte-for-byte from the parsed
  // manifest identity, registries, recomputed metrics, gates and decision.
  const regeneratedReport = buildGridActivationReadinessReport({
    evaluationId: manifest.evaluationId,
    suiteId: manifest.suiteId,
    actionEvidenceModel: manifest.actionEvidenceModel,
    provenanceModel: manifest.provenanceModel,
    createdAt: manifest.createdAt,
    seedRegistryId: seedRegistry.registryId,
    seedRegistryChecksum: gridReadinessSeedRegistryChecksum(seedRegistry),
    scenarioRegistryId: scenarioRegistry.registryId,
    scenarioRegistryChecksum: gridReadinessScenarioRegistryChecksum(scenarioRegistry),
    suiteChecksum: manifest.suiteChecksum,
    seedCount: seedRegistry.seeds.length,
    scenarioCount: scenarioRegistry.scenarios.length,
    assignmentCount: scenarioRegistry.assignments.length,
    totalSimulations: GRID_ACTIVATION_READINESS_RUN_COUNT,
    deterministic: true,
    metrics: recomputedMetrics,
    gates: recomputedGates.gates,
    decision: recomputedDecision,
  });
  if (reportText !== regeneratedReport) {
    failures.push(
      "persisted report.txt does not byte-for-byte match the report regenerated from the persisted artifacts",
    );
  }

  // Report text contract (defence in depth beyond byte regeneration).
  if (reportText !== undefined) {
    check(failures, reportText.length > 0, "report.txt must be non-empty");
    check(failures, !reportText.includes("\u0000"), "report.txt must not contain NUL");
    check(
      failures,
      reportText.includes(GRID_ACTIVATION_READINESS_DISCLAIMER),
      "report.txt lacks the mandatory non-activation disclaimer",
    );
    check(
      failures,
      !/(^|[^a-z-])benchmark/i.test(reportText),
      "report.txt must not call the suite a benchmark",
    );
    check(
      failures,
      !/balance pass/i.test(reportText),
      "report.txt must not call a result a balance pass",
    );
  }

  if (failures.length > 0) {
    throw new GridActivationReadinessBundleError(
      `Grid activation readiness bundle cross-agreement failed: ${failures.join("; ")}`,
    );
  }

  return {
    evaluationId: manifest.evaluationId,
    decision: decision.decision,
    digestAgreement: true,
  };
}

function loadGridReadinessSeedRegistrySafe(
  json: string,
): GridReadinessSeedRegistry | null {
  try {
    return loadGridReadinessSeedRegistry(JSON.parse(json) as unknown);
  } catch {
    return null;
  }
}
