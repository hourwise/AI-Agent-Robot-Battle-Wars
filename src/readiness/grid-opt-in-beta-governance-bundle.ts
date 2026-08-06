import { z } from "zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "../canary/grid-canary-digest.js";
import { SIMULATOR_VERSION, RULESET_VERSION } from "../simulator/constants.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import {
  GRID_RUNTIME_IDENTITY,
  LEGACY_RUNTIME_IDENTITY,
} from "../simulator/runtime-identity.js";
import {
  getComponentQualificationConfig,
  getComponentQualificationConfigChecksum,
  DEFAULT_COMPONENT_QUALIFICATION_ID,
} from "../simulator/component-qualification-registry.js";
import {
  anchorGridGrappleCoverageBaseV3,
  anchorOfficialGridGrappleCoverageSupplement,
  GRID_GRAPPLE_COVERAGE_BASE_V3_IDENTITY,
  GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
  GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_ID,
  GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
  GRID_GRAPPLE_COVERAGE_BASE_V3_SEED_REGISTRY_CHECKSUM,
  GRID_GRAPPLE_COVERAGE_BASE_V3_SCENARIO_REGISTRY_CHECKSUM,
  GRID_GRAPPLE_COVERAGE_BASE_V3_MANIFEST_CHECKSUM,
  GRID_GRAPPLE_COVERAGE_BASE_V3_DECISION_CHECKSUM,
  GRID_GRAPPLE_COVERAGE_BASE_V3_METRICS_CHECKSUM,
  GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_ID,
  GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_PLAN_CHECKSUM,
  GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_MANIFEST_CHECKSUM,
  GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_BASE_REFERENCE_CHECKSUM,
  GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_METRICS_CHECKSUM,
  GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_DECISION_CHECKSUM,
  GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_REPORT_CHECKSUM,
  GRID_GRAPPLE_SUPPLEMENT_METRICS_ARTIFACT,
} from "./grid-grapple-supplement-bundle.js";
import { GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM } from "./grid-grapple-scenarios.js";
import {
  buildGridOptInBetaGovernanceDecision,
  deserializeGridOptInBetaGovernanceDecision,
  gridOptInBetaGovernanceDecisionChecksum,
  GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT,
  GRID_OPT_IN_BETA_GOVERNANCE_REPOSITORY_NAME,
  type GridOptInBetaBaseV3EvidenceReference,
  type GridOptInBetaGovernanceDerivationInput,
  type GridOptInBetaGovernanceEvidence,
  type GridOptInBetaGovernanceOutcome,
  type GridOptInBetaSupplementEvidenceReference,
} from "./grid-opt-in-beta-governance.js";
import {
  GRID_OPT_IN_BETA_CONTRACT_ID,
  GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
  gridOptInBetaContractChecksum,
  isGridOptInBetaContractComplete,
  serializeGridOptInBetaContract,
  type GridOptInBetaContract,
} from "./grid-opt-in-beta-contract.js";
import { buildGridOptInBetaGovernanceReport } from "./grid-opt-in-beta-report.js";
import {
  sourceStateFromFacts,
  gridOptInBetaSourceStateProvenanceFailures,
} from "./grid-opt-in-beta-source-state-provenance.js";
import {
  gridOptInBetaReviewedSourceFactsFailures,
  type GridOptInBetaReviewedSourceFactsV1,
} from "./grid-opt-in-beta-source-facts.js";

// ── Frozen official evidence identity ───────────────────────────────────────

/** Frozen official v3 base evidence reference (governance input). */
export const GRID_OPT_IN_BETA_OFFICIAL_BASE_V3_REFERENCE: GridOptInBetaBaseV3EvidenceReference =
  Object.freeze({
    evaluationId: GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
    suiteId: GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_ID,
    suiteChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
    seedRegistryChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_SEED_REGISTRY_CHECKSUM,
    scenarioRegistryChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_SCENARIO_REGISTRY_CHECKSUM,
    classification: "inconclusive",
    nonPassGates: Object.freeze(["C04"]),
    manifestChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_MANIFEST_CHECKSUM,
    decisionChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_DECISION_CHECKSUM,
    metricsChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_METRICS_CHECKSUM,
  });

/** Frozen official supplemental grapple evidence reference (governance input). */
export const GRID_OPT_IN_BETA_OFFICIAL_SUPPLEMENT_REFERENCE: GridOptInBetaSupplementEvidenceReference =
  Object.freeze({
    supplementId: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_ID,
    suiteId: "grid-grapple-coverage-supplement-v1",
    scenarioRegistryChecksum: GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM,
    planChecksum: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_PLAN_CHECKSUM,
    decision: "coverage_confirmed",
    combinedReadinessClassification: "ready_for_opt_in_beta_review",
    manifestChecksum: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_MANIFEST_CHECKSUM,
    baseReferenceChecksum:
      GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_BASE_REFERENCE_CHECKSUM,
    metricsChecksum: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_METRICS_CHECKSUM,
    decisionChecksum: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_DECISION_CHECKSUM,
    reportChecksum: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_REPORT_CHECKSUM,
    grappleCoverage: Object.freeze({
      validGrappleRepositionEvents: 8,
      fighterAAttackerRepositionCount: 4,
      fighterBAttackerRepositionCount: 4,
      distinctSeedsProducingFighterAAttackerReposition: 4,
      distinctSeedsProducingFighterBAttackerReposition: 4,
    }),
  });

// ── Governance bundle inventory ─────────────────────────────────────────────

export const GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE = "manifest.json" as const;
export const GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT =
  "source-state.json" as const;
export const GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT =
  "base-evidence-reference.json" as const;
export const GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT =
  "supplement-evidence-reference.json" as const;
export const GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT =
  "beta-contract.json" as const;
export const GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT = "decision.json" as const;
export const GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT = "report.txt" as const;

/** Exact seven-entry governance bundle inventory (regular files only). */
export const GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES: readonly string[] =
  Object.freeze([
    GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE,
    GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT,
    GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT,
    GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT,
    GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT,
    GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT,
    GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT,
  ]);

export const GRID_OPT_IN_BETA_GOVERNANCE_NON_MANIFEST_ARTIFACTS: readonly string[] =
  Object.freeze(
    GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES.filter(
      (name) => name !== GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE,
    ),
  );

// ── Source state ────────────────────────────────────────────────────────────

export interface GridOptInBetaStaticPreflight {
  readonly normalMatchPathsCallLegacyRunMatch: boolean;
  readonly gridOnlyEnteredThroughExplicitRunGridMatch: boolean;
  readonly noNormalCommandImportsOrInvokesGovernanceService: boolean;
  readonly globalConstantsStill020020: boolean;
  readonly catalogueStill1: boolean;
  readonly gridIdentityFrozenSeparately: boolean;
  readonly schemaV3ConverterAndReplaySupportPresent: boolean;
  readonly schemaV2LegacyPersistenceUnchanged: boolean;
  readonly bothCanaryChecksUnchanged: boolean;
  readonly noBenchmarkOrProviderDependencyInGovernanceModule: boolean;
}

export interface GridOptInBetaCanaryIsolationStatus {
  readonly matchCanaryIsolated: boolean;
  readonly seriesCanaryIsolated: boolean;
}

export interface GridOptInBetaGovernanceInputs {
  readonly legacyIsActiveDefault: boolean;
  readonly schemaV3PersistenceAndReplayAvailable: boolean;
  readonly deterministicRollbackPossible: boolean;
  readonly frozenConstraintsUnchanged: boolean;
}

export interface GridOptInBetaSourceStateV1 {
  readonly schemaVersion: "1";
  readonly repositoryName: string;
  readonly sourceCommit: string;
  readonly globalSimulatorVersion: "0.2.0";
  readonly globalRulesetVersion: "0.2.0";
  readonly catalogueVersion: "1";
  readonly gridRuntimeIdentity: {
    readonly simulatorVersion: "0.3.0";
    readonly positioningModel: "grid-3x3-v1";
    readonly rulesetVersion: "0.2.0";
    readonly catalogueVersion: "1";
  };
  readonly normalRuntimeIdentity: {
    readonly simulatorVersion: "0.2.0";
    readonly positioningModel: "legacy-five-zone-v1";
    readonly rulesetVersion: "0.2.0";
    readonly catalogueVersion: "1";
  };
  readonly legacyDefaultStaticPreflight: GridOptInBetaStaticPreflight;
  readonly canaryIsolationStatus: GridOptInBetaCanaryIsolationStatus;
  readonly policyContractId: "grid-opt-in-beta-contract-v1";
  readonly policyContractChecksum: string;
  readonly governanceInputs: GridOptInBetaGovernanceInputs;
}

const GOVERNANCE_SOURCE_FILES: readonly string[] = Object.freeze([
  "src/readiness/grid-opt-in-beta-contract.ts",
  "src/readiness/grid-opt-in-beta-governance.ts",
  "src/readiness/grid-opt-in-beta-governance-bundle.ts",
  "src/readiness/grid-opt-in-beta-report.ts",
  "src/app/grid-opt-in-beta-governance.ts",
  "src/app/run-grid-opt-in-beta-governance.ts",
]);

const NORMAL_APP_COMMAND_FILES: readonly string[] = Object.freeze([
  "src/app/run-match.ts",
  "src/app/run-series.ts",
  "src/app/run-benchmark.ts",
  "src/app/run-lifecycle-benchmark.ts",
  "src/app/run-grid-canary-match.ts",
  "src/app/run-grid-series-canary.ts",
  "src/app/run-grid-activation-readiness.ts",
  "src/app/run-grid-grapple-coverage-supplement.ts",
]);

const FORBIDDEN_GOVERNANCE_IMPORT_PATTERNS: readonly RegExp[] = Object.freeze([
  /from\s+["'][^"']*bench\//,
  /from\s+["'][^"']*deepseek/,
  /from\s+["'][^"']*arena-agent/,
  /\brunBenchmark\s*\(/,
]);

function readSource(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf-8");
}

/**
 * Read-only static isolation preflight (Phase 5). All checks are source-level
 * and never execute, simulate or invoke anything. A failing check is an
 * explicit governance input that forces `rejected`.
 */
export function runGridOptInBetaStaticPreflight(): GridOptInBetaStaticPreflight {
  const runMatchSource = readSource("src/app/run-match.ts");
  const runSeriesSource = readSource("src/app/run-series.ts");
  const gridRuntimeSource = readSource("src/simulator/grid-runtime.ts");
  const converterSource = readSource("src/persistence/match-converter.ts");
  const replayPositioningSource = readSource("src/replay/positioning-model.ts");

  const normalMatchPathsCallLegacyRunMatch =
    /runMatch\s*\(/.test(runMatchSource) &&
    !/runGridMatch\s*\(/.test(runMatchSource) &&
    /runMatch\s*\(/.test(runSeriesSource) &&
    !/runGridMatch\s*\(/.test(runSeriesSource);

  const gridOnlyEnteredThroughExplicitRunGridMatch =
    /export function runGridMatch\s*\(/.test(gridRuntimeSource) &&
    !/runGridMatch\s*\(/.test(runMatchSource) &&
    !/runGridMatch\s*\(/.test(runSeriesSource);

  const noNormalCommandImportsOrInvokesGovernanceService = NORMAL_APP_COMMAND_FILES.every(
    (file) => !readSource(file).includes("grid-opt-in-beta-governance"),
  );

  const globalConstantsStill020020 =
    SIMULATOR_VERSION === "0.2.0" && RULESET_VERSION === "0.2.0";

  const catalogueStill1 = CATALOGUE_V1.version === "1";

  const gridIdentityFrozenSeparately =
    GRID_RUNTIME_IDENTITY.simulatorVersion === "0.3.0" &&
    GRID_RUNTIME_IDENTITY.positioningModel === "grid-3x3-v1" &&
    LEGACY_RUNTIME_IDENTITY.simulatorVersion === "0.2.0";

  const schemaV3ConverterAndReplaySupportPresent =
    /positioningModel === "grid-3x3-v1"/.test(converterSource) &&
    /schemaVersion: "3"/.test(converterSource) &&
    /isGridReplayPositioningModel/.test(replayPositioningSource) &&
    /grid-3x3-v1/.test(replayPositioningSource);

  const schemaV2LegacyPersistenceUnchanged =
    /matchResultToRecord/.test(converterSource) && !/runGridMatch/.test(converterSource);

  const bothCanaryChecksUnchanged =
    /runGridMatch\s*\(/.test(readSource("src/app/grid-match-canary.ts")) &&
    /runGridMatch\s*\(/.test(readSource("src/canary/grid-series-canary-core.ts"));

  const noBenchmarkOrProviderDependencyInGovernanceModule = GOVERNANCE_SOURCE_FILES.every(
    (file) =>
      !FORBIDDEN_GOVERNANCE_IMPORT_PATTERNS.some((pattern) =>
        pattern.test(readSource(file)),
      ),
  );

  return {
    normalMatchPathsCallLegacyRunMatch,
    gridOnlyEnteredThroughExplicitRunGridMatch,
    noNormalCommandImportsOrInvokesGovernanceService,
    globalConstantsStill020020,
    catalogueStill1,
    gridIdentityFrozenSeparately,
    schemaV3ConverterAndReplaySupportPresent,
    schemaV2LegacyPersistenceUnchanged,
    bothCanaryChecksUnchanged,
    noBenchmarkOrProviderDependencyInGovernanceModule,
  };
}

/** Frozen component-qualification checksums (C1/C2/AB2) — a frozen constraint. */
export function checkFrozenComponentQualificationChecksums(): boolean {
  const c1 = getComponentQualificationConfig("component-impact-c1");
  const c2 = getComponentQualificationConfig("component-impact-c2");
  const ab2 = getComponentQualificationConfig("component-impact-ab2");
  return (
    getComponentQualificationConfigChecksum(c1) === "2a40a56f97062ca3" &&
    getComponentQualificationConfigChecksum(c2) === "13548462df34a183" &&
    getComponentQualificationConfigChecksum(ab2) === "6b9f70450d3f10b8" &&
    DEFAULT_COMPONENT_QUALIFICATION_ID === "component-impact-c2"
  );
}

export interface BuildGridOptInBetaSourceStateInput {
  readonly sourceCommit: string;
  readonly policyContractId: "grid-opt-in-beta-contract-v1";
  readonly policyContractChecksum: string;
  /** Reviewed source facts derived from the exact committed snapshot. */
  readonly facts: GridOptInBetaReviewedSourceFactsV1;
}

/**
 * Builds the source state from the exact reviewed Git commit snapshot facts
 * (Milestone 0.2C Phase 3F.1, Phase 7). The source state is never derived
 * from uncommitted working-tree bytes and never hard-codes canary isolation:
 * the reviewed source facts (derived from the exact committed bytes and the
 * frozen canary file hashes) are the only source of truth, and they must be
 * the frozen canonical reviewed source facts.
 */
export function buildGridOptInBetaSourceState(
  input: BuildGridOptInBetaSourceStateInput,
): GridOptInBetaSourceStateV1 {
  if (input.sourceCommit !== input.facts.sourceCommit) {
    throw new Error(
      `Grid opt-in beta governance source commit ${input.sourceCommit} does not match the reviewed facts source commit ${input.facts.sourceCommit}`,
    );
  }
  const factsFailures = gridOptInBetaReviewedSourceFactsFailures(input.facts);
  if (factsFailures.length > 0) {
    throw new Error(
      `Grid opt-in beta governance source state requires the canonical reviewed source facts: ${factsFailures.join("; ")}`,
    );
  }
  return sourceStateFromFacts(
    input.facts,
    input.policyContractId,
    input.policyContractChecksum,
  );
}

export function serializeGridOptInBetaSourceState(
  state: GridOptInBetaSourceStateV1,
): string {
  return JSON.stringify(state, null, 2);
}

export function deserializeGridOptInBetaSourceState(
  json: string,
): { ok: true; state: GridOptInBetaSourceStateV1 } | { ok: false; errors: string } {
  try {
    const parsed = JSON.parse(json) as GridOptInBetaSourceStateV1;
    if (parsed.schemaVersion !== "1") {
      return {
        ok: false,
        errors: `unsupported source-state schemaVersion ${parsed.schemaVersion}`,
      };
    }
    return { ok: true, state: parsed };
  } catch (e) {
    return { ok: false, errors: e instanceof Error ? e.message : String(e) };
  }
}

// ── Evidence references from the official directories ───────────────────────

/**
 * Validates and anchors the nine official v3 artifacts and returns the frozen
 * evidence reference. Never modifies the evidence.
 */
export function buildGridOptInBetaBaseV3EvidenceReference(
  baseContents: Record<string, string>,
): GridOptInBetaBaseV3EvidenceReference {
  const reference = anchorGridGrappleCoverageBaseV3(
    baseContents,
    GRID_GRAPPLE_COVERAGE_BASE_V3_IDENTITY,
  );
  return {
    evaluationId: reference.evaluationId,
    suiteId: reference.suiteId,
    suiteChecksum: reference.suiteChecksum,
    seedRegistryChecksum: reference.seedRegistryChecksum,
    scenarioRegistryChecksum: reference.scenarioRegistryChecksum,
    classification: reference.classification,
    nonPassGates: [...reference.nonPassGates],
    manifestChecksum: reference.manifestChecksum,
    decisionChecksum: reference.decisionChecksum,
    metricsChecksum: reference.metricsChecksum,
  };
}

function grappleCoverageFromMetrics(
  metricsText: string,
): GridOptInBetaSupplementEvidenceReference["grappleCoverage"] {
  const metrics = JSON.parse(metricsText) as {
    grapple: {
      validGrappleRepositionEvents: number;
      fighterAAttackerRepositionCount: number;
      fighterBAttackerRepositionCount: number;
      distinctSeedsProducingFighterAAttackerReposition: number;
      distinctSeedsProducingFighterBAttackerReposition: number;
    };
  };
  return {
    validGrappleRepositionEvents: metrics.grapple.validGrappleRepositionEvents,
    fighterAAttackerRepositionCount: metrics.grapple.fighterAAttackerRepositionCount,
    fighterBAttackerRepositionCount: metrics.grapple.fighterBAttackerRepositionCount,
    distinctSeedsProducingFighterAAttackerReposition:
      metrics.grapple.distinctSeedsProducingFighterAAttackerReposition,
    distinctSeedsProducingFighterBAttackerReposition:
      metrics.grapple.distinctSeedsProducingFighterBAttackerReposition,
  };
}

/**
 * Validates and anchors the ten official supplemental artifacts and returns
 * the frozen evidence reference (including the grapple-coverage counts from
 * the official metrics). Never modifies the evidence.
 */
export function buildGridOptInBetaSupplementEvidenceReference(
  supplementContents: Record<string, string>,
): GridOptInBetaSupplementEvidenceReference {
  const identity = anchorOfficialGridGrappleCoverageSupplement(supplementContents);
  return {
    supplementId: identity.supplementId,
    suiteId: identity.suiteId,
    scenarioRegistryChecksum: identity.scenarioRegistryChecksum,
    planChecksum: identity.planChecksum,
    decision: identity.decision,
    combinedReadinessClassification: identity.combinedReadinessClassification,
    manifestChecksum: identity.manifestChecksum,
    baseReferenceChecksum: identity.baseReferenceChecksum,
    metricsChecksum: identity.metricsChecksum,
    decisionChecksum: identity.decisionChecksum,
    reportChecksum: identity.reportChecksum,
    grappleCoverage: grappleCoverageFromMetrics(
      supplementContents[GRID_GRAPPLE_SUPPLEMENT_METRICS_ARTIFACT]!,
    ),
  };
}

export function serializeGridOptInBetaEvidenceReference(
  reference:
    GridOptInBetaBaseV3EvidenceReference | GridOptInBetaSupplementEvidenceReference,
): string {
  return JSON.stringify(reference, null, 2);
}

// ── Governance manifest v1 ──────────────────────────────────────────────────

export const gridOptInBetaGovernanceManifestV1Schema = z.object({
  schemaVersion: z.literal("1"),
  decisionKind: z.literal("grid-opt-in-beta-governance"),
  decisionId: z.string().uuid(),
  createdAt: z.string().datetime(),
  sourceCommit: z.literal(GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT),
  repositoryName: z.literal(GRID_OPT_IN_BETA_GOVERNANCE_REPOSITORY_NAME),
  outcome: z.enum([
    "approved_for_bounded_opt_in_beta_implementation",
    "deferred",
    "rejected",
  ]),
  validationStatus: z.literal("validated"),
  contractId: z.literal(GRID_OPT_IN_BETA_CONTRACT_ID),
  contractChecksum: z.string().regex(/^[0-9a-f]{64}$/),
  decisionChecksum: z.string().regex(/^[0-9a-f]{64}$/),
  reportChecksum: z.string().regex(/^[0-9a-f]{64}$/),
  artifacts: z.object({
    manifest: z.literal(GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE),
    sourceState: z.literal(GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT),
    baseEvidenceReference: z.literal(
      GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT,
    ),
    supplementEvidenceReference: z.literal(
      GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT,
    ),
    betaContract: z.literal(GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT),
    decision: z.literal(GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT),
    report: z.literal(GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT),
  }),
  digests: z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/)),
  evidenceUnchanged: z.literal(true),
});

export type GridOptInBetaGovernanceManifestV1 = z.infer<
  typeof gridOptInBetaGovernanceManifestV1Schema
>;

export interface BuildGridOptInBetaGovernanceManifestInput {
  readonly decisionId: string;
  readonly createdAt: string;
  readonly sourceCommit: typeof GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT;
  readonly outcome: GridOptInBetaGovernanceOutcome;
  readonly contractId: "grid-opt-in-beta-contract-v1";
  readonly contractChecksum: string;
  readonly decisionChecksum: string;
  readonly reportChecksum: string;
  readonly digests: Record<string, string>;
}

export function buildGridOptInBetaGovernanceManifest(
  input: BuildGridOptInBetaGovernanceManifestInput,
): GridOptInBetaGovernanceManifestV1 {
  const manifest: GridOptInBetaGovernanceManifestV1 = {
    schemaVersion: "1",
    decisionKind: "grid-opt-in-beta-governance",
    decisionId: input.decisionId,
    createdAt: input.createdAt,
    sourceCommit: input.sourceCommit,
    repositoryName: GRID_OPT_IN_BETA_GOVERNANCE_REPOSITORY_NAME,
    outcome: input.outcome,
    validationStatus: "validated",
    contractId: input.contractId,
    contractChecksum: input.contractChecksum,
    decisionChecksum: input.decisionChecksum,
    reportChecksum: input.reportChecksum,
    artifacts: {
      manifest: GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE,
      sourceState: GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT,
      baseEvidenceReference: GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT,
      supplementEvidenceReference:
        GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT,
      betaContract: GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT,
      decision: GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT,
      report: GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT,
    },
    digests: { ...input.digests },
    evidenceUnchanged: true,
  };
  const parsed = gridOptInBetaGovernanceManifestV1Schema.safeParse(manifest);
  if (!parsed.success) {
    throw new Error(
      `Grid opt-in beta governance manifest failed its authoritative schema: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export function serializeGridOptInBetaGovernanceManifest(
  manifest: GridOptInBetaGovernanceManifestV1,
): string {
  return JSON.stringify(manifest, null, 2);
}

export function deserializeGridOptInBetaGovernanceManifest(
  json: string,
):
  | { ok: true; manifest: GridOptInBetaGovernanceManifestV1 }
  | { ok: false; errors: string } {
  try {
    const result = gridOptInBetaGovernanceManifestV1Schema.safeParse(JSON.parse(json));
    if (!result.success) return { ok: false, errors: result.error.message };
    return { ok: true, manifest: result.data };
  } catch (e) {
    return { ok: false, errors: e instanceof Error ? e.message : String(e) };
  }
}

// ── Decision reconstruction from artifacts ──────────────────────────────────

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function baseReferenceMatchesFrozen(
  reference: GridOptInBetaBaseV3EvidenceReference,
): boolean {
  return sameJson(reference, GRID_OPT_IN_BETA_OFFICIAL_BASE_V3_REFERENCE);
}

function supplementReferenceMatchesFrozen(
  reference: GridOptInBetaSupplementEvidenceReference,
): boolean {
  return sameJson(reference, GRID_OPT_IN_BETA_OFFICIAL_SUPPLEMENT_REFERENCE);
}

/**
 * Reconstructs the pure governance derivation input from the persisted bundle
 * artifacts (frozen evidence references, source state, contract) so the
 * persisted decision can be compared to an independent rebuild.
 */
export function reconstructGovernanceDerivation(
  baseReference: GridOptInBetaBaseV3EvidenceReference,
  supplementReference: GridOptInBetaSupplementEvidenceReference,
  sourceState: GridOptInBetaSourceStateV1,
  contract: GridOptInBetaContract,
): GridOptInBetaGovernanceDerivationInput {
  const baseFrozen = baseReferenceMatchesFrozen(baseReference);
  const supplementFrozen = supplementReferenceMatchesFrozen(supplementReference);
  const coverage = supplementReference.grappleCoverage;
  const contractComplete = isGridOptInBetaContractComplete(contract);
  const safeguardsComplete =
    contractComplete &&
    sourceState.legacyDefaultStaticPreflight.gridOnlyEnteredThroughExplicitRunGridMatch &&
    sourceState.legacyDefaultStaticPreflight.schemaV3ConverterAndReplaySupportPresent;
  return {
    baseV3ValidAndAnchored: baseFrozen,
    supplementValidAndAnchored: supplementFrozen,
    hardReadinessGatesPassed: baseFrozen,
    soleNonPassGateIsC04:
      baseFrozen &&
      baseReference.nonPassGates.length === 1 &&
      baseReference.nonPassGates[0] === "C04",
    supplementDecision: supplementReference.decision,
    combinedClassification: supplementReference.combinedReadinessClassification,
    bothAttackerSlotsProducedReposition:
      coverage.fighterAAttackerRepositionCount >= 1 &&
      coverage.fighterBAttackerRepositionCount >= 1,
    distinctSeedsProducedReposition:
      coverage.distinctSeedsProducingFighterAAttackerReposition >= 1 &&
      coverage.distinctSeedsProducingFighterBAttackerReposition >= 1,
    legacyIsActiveDefault: sourceState.governanceInputs.legacyIsActiveDefault,
    schemaV3PersistenceAndReplayAvailable:
      sourceState.governanceInputs.schemaV3PersistenceAndReplayAvailable,
    deterministicRollbackPossible:
      sourceState.governanceInputs.deterministicRollbackPossible,
    contractComplete,
    safeguardsComplete,
    requestedScopeIncludesDefaultOrPublicActivation: false,
    requestedScopeIncludesForbiddenClaims: false,
    frozenConstraintsUnchanged: sourceState.governanceInputs.frozenConstraintsUnchanged,
    unresolvedRiskBlocksApproval: false,
  };
}

export interface GridOptInBetaGovernanceBundleValidationResult {
  readonly decisionId: string;
  readonly outcome: GridOptInBetaGovernanceOutcome;
  readonly validationStatus: "validated";
}

export class GridOptInBetaGovernanceBundleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridOptInBetaGovernanceBundleError";
  }
}

/**
 * Complete cross-agreement validation of the seven-file governance bundle
 * (Phase 6). Requires the exact authorised source commit, frozen evidence
 * references, the frozen policy contract, an independent full decision
 * rebuild equal to the persisted decision, byte-for-byte report regeneration
 * and coherent digests.
 */
export function validateGridOptInBetaGovernanceBundle(
  contents: Record<string, string>,
  requiredSourceCommit: string = GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT,
): GridOptInBetaGovernanceBundleValidationResult {
  const failures: string[] = [];
  const check = (ok: boolean, message: string): void => {
    if (!ok) failures.push(message);
  };

  for (const name of GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES) {
    check(
      typeof contents[name] === "string",
      `governance bundle is missing artifact ${name}`,
    );
  }

  const manifestParsed = contents[GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE]
    ? deserializeGridOptInBetaGovernanceManifest(
        contents[GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE]!,
      )
    : { ok: false as const, errors: "missing manifest" };
  const sourceStateParsed = contents[GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT]
    ? deserializeGridOptInBetaSourceState(
        contents[GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT]!,
      )
    : { ok: false as const, errors: "missing source-state" };
  const decisionParsed = contents[GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT]
    ? deserializeGridOptInBetaGovernanceDecision(
        contents[GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT]!,
      )
    : { ok: false as const, errors: "missing decision" };
  const contractParsed = contents[GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT]
    ? deserializeGridOptInBetaContract(
        contents[GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT]!,
      )
    : { ok: false as const, errors: "missing contract" };
  const baseRefParsed = contents[
    GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT
  ]
    ? deserializeGridOptInBetaBaseEvidenceReference(
        contents[GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT]!,
      )
    : { ok: false as const, errors: "missing base evidence reference" };
  const supplementRefParsed = contents[
    GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT
  ]
    ? deserializeGridOptInBetaSupplementEvidenceReference(
        contents[GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT]!,
      )
    : { ok: false as const, errors: "missing supplement evidence reference" };

  if (!manifestParsed.ok) check(false, `invalid manifest: ${manifestParsed.errors}`);
  if (!sourceStateParsed.ok)
    check(false, `invalid source-state: ${sourceStateParsed.errors}`);
  if (!decisionParsed.ok) check(false, `invalid decision: ${decisionParsed.errors}`);
  if (!contractParsed.ok) check(false, `invalid contract: ${contractParsed.errors}`);
  if (!baseRefParsed.ok)
    check(false, `invalid base evidence reference: ${baseRefParsed.errors}`);
  if (!supplementRefParsed.ok)
    check(false, `invalid supplement evidence reference: ${supplementRefParsed.errors}`);

  if (
    failures.length > 0 ||
    !manifestParsed.ok ||
    !sourceStateParsed.ok ||
    !decisionParsed.ok ||
    !contractParsed.ok ||
    !baseRefParsed.ok ||
    !supplementRefParsed.ok
  ) {
    throw new GridOptInBetaGovernanceBundleError(
      `Grid opt-in beta governance bundle is invalid: ${failures.join("; ")}`,
    );
  }

  const manifest = manifestParsed.manifest;
  const sourceState = sourceStateParsed.state;
  const decision = decisionParsed.decision;
  const contract = contractParsed.contract;
  const baseReference = baseRefParsed.reference;
  const supplementReference = supplementRefParsed.reference;

  // 1. Exact authorised source commit binding.
  check(
    sourceState.sourceCommit === requiredSourceCommit,
    `source-state source commit does not equal the authorised commit ${requiredSourceCommit}`,
  );
  check(
    manifest.sourceCommit === requiredSourceCommit &&
      decision.sourceCommit === requiredSourceCommit,
    "manifest/decision source commit does not equal the authorised commit",
  );

  // 1b. Canonical reviewed source-state provenance (Phase 3F.1 Phase 5): the
  //     persisted source-state must be exactly the canonical reviewed source
  //     state. A coherent rewrite of arbitrary source-state booleans can no
  //     longer validate.
  for (const failure of gridOptInBetaSourceStateProvenanceFailures(sourceState)) {
    check(false, failure);
  }

  // 2. Manifest identity binding.
  check(
    manifest.decisionId === decision.decisionId &&
      manifest.createdAt === decision.createdAt &&
      manifest.outcome === decision.outcome &&
      manifest.repositoryName === decision.repositoryName,
    "manifest identity does not agree with the persisted decision",
  );
  check(
    manifest.validationStatus === "validated" &&
      decision.evidence.validationStatus === "validated",
    "evidence validation status must be validated",
  );

  // 3. Policy contract binding.
  const contractSerialized = serializeGridOptInBetaContract(contract);
  check(
    contract.contractId === GRID_OPT_IN_BETA_CONTRACT_ID &&
      manifest.contractId === GRID_OPT_IN_BETA_CONTRACT_ID &&
      sourceState.policyContractId === GRID_OPT_IN_BETA_CONTRACT_ID,
    "policy contract ID does not equal the frozen contract ID",
  );
  const contractChecksum = gridOptInBetaContractChecksum(contract);
  check(
    contractChecksum === manifest.contractChecksum &&
      contractChecksum === sourceState.policyContractChecksum &&
      contractChecksum === GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
    "policy contract checksum does not equal the frozen contract checksum",
  );

  // 4. Frozen evidence references.
  check(
    baseReferenceMatchesFrozen(baseReference),
    "base evidence reference does not match the frozen official v3 identity",
  );
  check(
    supplementReferenceMatchesFrozen(supplementReference),
    "supplement evidence reference does not match the frozen official supplement identity",
  );

  // 5. Complete decision reconstruction.
  const reconstruction = reconstructGovernanceDerivation(
    baseReference,
    supplementReference,
    sourceState,
    contract,
  );
  const evidence: GridOptInBetaGovernanceEvidence = {
    baseV3: baseReference,
    supplement: supplementReference,
    validationStatus: "validated",
  };
  const rebuiltDecision = buildGridOptInBetaGovernanceDecision({
    decisionId: manifest.decisionId,
    createdAt: manifest.createdAt,
    sourceCommit: manifest.sourceCommit,
    evidence,
    derivation: reconstruction,
  });
  check(
    sameJson(rebuiltDecision, decision),
    "persisted decision does not equal the complete reconstructed decision",
  );
  check(
    gridOptInBetaGovernanceDecisionChecksum(decision) === manifest.decisionChecksum,
    "decision checksum does not match the manifest",
  );

  // 6. Byte-for-byte report regeneration.
  const rebuiltReport = buildGridOptInBetaGovernanceReport({
    decisionId: decision.decisionId,
    createdAt: decision.createdAt,
    sourceCommit: decision.sourceCommit,
    baseV3: decision.evidence.baseV3,
    supplement: decision.evidence.supplement,
    contractId: contract.contractId,
    contractChecksum: manifest.contractChecksum,
    criteria: decision.criteria,
    outcome: decision.outcome,
    authorisedScope: decision.authorisedScope,
    forbiddenScope: decision.forbiddenScope,
    requiredSafeguards: decision.requiredSafeguards,
    rollbackAndSuspensionTriggers: decision.rollbackAndSuspensionTriggers,
    unresolvedRisks: decision.unresolvedRisks,
    disclaimer: decision.disclaimer,
  });
  check(
    rebuiltReport === contents[GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT],
    "report.txt does not byte-for-byte match the regenerated report",
  );
  check(
    sha256Hex(contents[GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT]!) ===
      manifest.reportChecksum,
    "report checksum does not match the manifest",
  );

  // 7. Every non-manifest digest.
  const digests: Record<string, string> = {};
  for (const name of GRID_OPT_IN_BETA_GOVERNANCE_NON_MANIFEST_ARTIFACTS) {
    digests[name] = sha256Hex(contents[name]!);
  }
  check(
    sameJson(digests, manifest.digests),
    "artifact digests do not match the manifest",
  );
  check(
    digests[GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT] === manifest.decisionChecksum,
    "decision artifact digest does not equal the manifest decision checksum",
  );
  check(
    digests[GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT] === manifest.reportChecksum,
    "report artifact digest does not equal the manifest report checksum",
  );
  // Contract artifact digest must equal the frozen contract checksum.
  check(
    digests[GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT] ===
      GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
    "beta-contract artifact digest does not equal the frozen contract checksum",
  );
  void contractSerialized;

  if (failures.length > 0) {
    throw new GridOptInBetaGovernanceBundleError(
      `Grid opt-in beta governance bundle cross-agreement failed: ${failures.join("; ")}`,
    );
  }

  return {
    decisionId: manifest.decisionId,
    outcome: manifest.outcome,
    validationStatus: "validated",
  };
}

// ── Contract / evidence reference deserialization helpers ───────────────────

export function deserializeGridOptInBetaContract(
  json: string,
): { ok: true; contract: GridOptInBetaContract } | { ok: false; errors: string } {
  try {
    const parsed = JSON.parse(json) as GridOptInBetaContract;
    if (parsed.contractId !== GRID_OPT_IN_BETA_CONTRACT_ID) {
      return { ok: false, errors: `unsupported contractId ${parsed.contractId}` };
    }
    return { ok: true, contract: parsed };
  } catch (e) {
    return { ok: false, errors: e instanceof Error ? e.message : String(e) };
  }
}

export function deserializeGridOptInBetaBaseEvidenceReference(
  json: string,
):
  | { ok: true; reference: GridOptInBetaBaseV3EvidenceReference }
  | { ok: false; errors: string } {
  try {
    const parsed = JSON.parse(json) as GridOptInBetaBaseV3EvidenceReference;
    if (parsed.suiteId !== "grid-activation-readiness-v3") {
      return { ok: false, errors: `unsupported base suiteId ${parsed.suiteId}` };
    }
    return { ok: true, reference: parsed };
  } catch (e) {
    return { ok: false, errors: e instanceof Error ? e.message : String(e) };
  }
}

export function deserializeGridOptInBetaSupplementEvidenceReference(
  json: string,
):
  | { ok: true; reference: GridOptInBetaSupplementEvidenceReference }
  | { ok: false; errors: string } {
  try {
    const parsed = JSON.parse(json) as GridOptInBetaSupplementEvidenceReference;
    if (parsed.suiteId !== "grid-grapple-coverage-supplement-v1") {
      return { ok: false, errors: `unsupported supplement suiteId ${parsed.suiteId}` };
    }
    return { ok: true, reference: parsed };
  } catch (e) {
    return { ok: false, errors: e instanceof Error ? e.message : String(e) };
  }
}
