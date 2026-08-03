import { z } from "zod";
import { sha256Hex } from "../canary/grid-canary-digest.js";
import { machineBuildProposalSchema } from "../schemas/build.schema.js";
import { actionPolicySchema } from "../schemas/policy.schema.js";
import {
  loadGridReadinessSeedRegistry,
  gridReadinessSeedRegistryChecksum,
  GRID_READINESS_CANONICAL_SEED_REGISTRY_CHECKSUM,
  type GridReadinessSeedRegistry,
} from "./seed-registry.js";
import {
  gridGrappleCoverageScenarioRegistryChecksum,
  GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM,
  type GridGrappleCoverageScenarioRegistry,
} from "./grid-grapple-scenarios.js";
import {
  buildGridGrappleCoverageRunPlan,
  gridGrappleCoveragePlanChecksum,
  GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
  GRID_GRAPPLE_COVERAGE_SUPPLEMENT_SUITE_ID,
  type GridGrappleCoverageRun,
  type GridGrappleCoverageRunPlan,
} from "./grid-grapple-run-plan.js";
import {
  deserializeGridActivationReadinessManifest,
  validateGridActivationReadinessBundle,
  GRID_READINESS_MANIFEST_FILE,
  GRID_READINESS_DECISION_ARTIFACT,
  GRID_READINESS_METRICS_ARTIFACT,
  type GridActivationReadinessManifestV3,
} from "./readiness-bundle.js";
import { deserializeGridActivationReadinessDecision } from "./decision.js";
import { deserializeGridActivationReadinessMetrics } from "./metrics.js";
import { MatchRecordV3Schema } from "../schemas/match-record.schema.js";
import { FactualMatchReportV2Schema } from "../schemas/factual-report.schema.js";
import {
  assertGridReadinessRecordReportFinalAgreement,
  inspectGridReadinessRecordEvidence,
  recomputeGridActivationReadinessRunChecksums,
} from "./record-evidence.js";
import {
  extractGridGrappleRunEvidence,
  type GridGrappleRunEvidence,
} from "./grid-grapple-evidence.js";
import {
  computeGridGrappleCoverageMetrics,
  type GridGrappleCoverageMetrics,
} from "./grid-grapple-metrics.js";
import {
  buildGridGrappleCoverageDecision,
  buildGridActivationReadinessAddendum,
  deserializeGridGrappleCoverageDecision,
  gridActivationReadinessAddendumV1Schema,
  type GridGrappleCoverageDecisionV1,
  type GridActivationReadinessAddendumV1,
  type GridGrappleCoverageHardChecks,
} from "./grid-grapple-decision.js";
import { grappleAttackerSlotForRun } from "./grid-grapple-execution-core.js";
import type { GridGrappleCoverageScenarioFamily } from "./grid-grapple-scenarios.js";
import { buildGridGrappleCoverageReport } from "./grid-grapple-report.js";

// ── Frozen official base v3 identity ────────────────────────────────────────

/** The official v3 evaluation the supplement is anchored to. */
export const GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID =
  "0d8487a8-939d-4f9a-a16a-544b71eaa869" as const;

export const GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_ID =
  "grid-activation-readiness-v3" as const;

export const GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM =
  "c3b8a16d407891d0a92966fb9d6ed20fe5e11776bf545624fb3dbcadb4e2503c" as const;

export const GRID_GRAPPLE_COVERAGE_BASE_V3_SEED_REGISTRY_CHECKSUM =
  GRID_READINESS_CANONICAL_SEED_REGISTRY_CHECKSUM;

export const GRID_GRAPPLE_COVERAGE_BASE_V3_SCENARIO_REGISTRY_CHECKSUM =
  "b07270171f6e38efac2d1992f051d7bd881e323c00cee92b9caa9490ddb85b67" as const;

export const GRID_GRAPPLE_COVERAGE_BASE_V3_KNOCKBACK_EVENTS = 36 as const;
export const GRID_GRAPPLE_COVERAGE_BASE_V3_OVERTURN_EVENTS = 8 as const;
export const GRID_GRAPPLE_COVERAGE_BASE_V3_GRAPPLE_REPOSITION_EVENTS = 0 as const;

/**
 * Frozen SHA-256 checksums of the official v3 base artifacts (Phase 3E2.1).
 * Computed over the exact persisted bytes of the official bundle at
 * `data/readiness/grid/0d8487a8-.../`. These pin the official base evidence
 * so the supplement read-back never trusts self-declared hashes.
 */
export const GRID_GRAPPLE_COVERAGE_BASE_V3_MANIFEST_CHECKSUM =
  "46b1b888dd66021fc811451c1db8f22f21c912621fc85a90a4cc52980ff06f85" as const;

export const GRID_GRAPPLE_COVERAGE_BASE_V3_DECISION_CHECKSUM =
  "d4bf61e1e5c74bbb9181f95d22889fdae263e1520e58e8720e2bfe8cfeb07b9a" as const;

export const GRID_GRAPPLE_COVERAGE_BASE_V3_METRICS_CHECKSUM =
  "113bfa2cc66e364eab637f3d7c00b8f05602c355133fe21eb2aae6d79467eee4" as const;

/** The only non-pass gate of the official v3 evaluation. */
export const GRID_GRAPPLE_COVERAGE_BASE_V3_NON_PASS_GATES: readonly string[] =
  Object.freeze(["C04"]);

/**
 * The frozen official base-v3 identity used by the production supplement
 * service. Tests may inject an equivalent validated fixture identity (same
 * suite checksum, canonical registry checksums, classification, gates and
 * counts, different evaluation ID and fixture artifact hashes).
 */
export interface GridGrappleCoverageBaseV3Identity {
  readonly evaluationId: string;
  readonly suiteId: "grid-activation-readiness-v3";
  readonly suiteChecksum: string;
  readonly seedRegistryId: string;
  readonly seedRegistryChecksum: string;
  readonly scenarioRegistryId: string;
  readonly scenarioRegistryChecksum: string;
  readonly classification: "inconclusive";
  readonly nonPassGates: readonly string[];
  readonly knockbackEvents: number;
  readonly overturnEvents: number;
  readonly grappleRepositionEvents: number;
  readonly manifestChecksum: string;
  readonly decisionChecksum: string;
  readonly metricsChecksum: string;
}

export const GRID_GRAPPLE_COVERAGE_BASE_V3_IDENTITY: GridGrappleCoverageBaseV3Identity =
  Object.freeze({
    evaluationId: GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
    suiteId: "grid-activation-readiness-v3" as const,
    suiteChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
    seedRegistryId: "grid-readiness-development-v1" as const,
    seedRegistryChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_SEED_REGISTRY_CHECKSUM,
    scenarioRegistryId: "grid-readiness-scenarios-v1" as const,
    scenarioRegistryChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_SCENARIO_REGISTRY_CHECKSUM,
    classification: "inconclusive" as const,
    nonPassGates: GRID_GRAPPLE_COVERAGE_BASE_V3_NON_PASS_GATES,
    knockbackEvents: GRID_GRAPPLE_COVERAGE_BASE_V3_KNOCKBACK_EVENTS,
    overturnEvents: GRID_GRAPPLE_COVERAGE_BASE_V3_OVERTURN_EVENTS,
    grappleRepositionEvents: GRID_GRAPPLE_COVERAGE_BASE_V3_GRAPPLE_REPOSITION_EVENTS,
    manifestChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_MANIFEST_CHECKSUM,
    decisionChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_DECISION_CHECKSUM,
    metricsChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_METRICS_CHECKSUM,
  });

/**
 * Anchored reference to the official v3 base evaluation, captured before any
 * supplemental match executes and retained for the addendum and the
 * base-readiness-reference artifact.
 */
export interface GridGrappleCoverageBaseV3Reference {
  readonly evaluationId: string;
  readonly suiteId: "grid-activation-readiness-v3";
  readonly suiteChecksum: string;
  readonly seedRegistryId: string;
  readonly seedRegistryChecksum: string;
  readonly scenarioRegistryId: string;
  readonly scenarioRegistryChecksum: string;
  readonly classification: "inconclusive";
  readonly nonPassGates: readonly string[];
  readonly knockbackEvents: number;
  readonly overturnEvents: number;
  readonly grappleRepositionEvents: number;
  readonly manifestChecksum: string;
  readonly decisionChecksum: string;
  readonly metricsChecksum: string;
}

export class GridGrappleCoverageBaseAnchorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridGrappleCoverageBaseAnchorError";
  }
}

/**
 * Pure base anchoring (Phase 2). Reads the nine official v3 artifacts from the
 * supplied contents map, validates them with the strong bundle validator, and
 * requires the exact official identity, suite checksum, canonical registry
 * checksums, `inconclusive` classification, C04-only non-pass gate and the
 * exact base reposition counts (knockback 36 / overturn 8 / grapple 0). Also
 * computes and retains the SHA-256 checksums of the base manifest, decision
 * and metrics artifacts. Throws without running any match on any mismatch.
 */
export function anchorGridGrappleCoverageBaseV3(
  contents: Record<string, string>,
  expectedBaseV3: GridGrappleCoverageBaseV3Identity = GRID_GRAPPLE_COVERAGE_BASE_V3_IDENTITY,
): GridGrappleCoverageBaseV3Reference {
  // The strong validator must accept the official base bundle as current v3
  // evidence (this also enforces the base bundle's own digests and
  // cross-agreement, including complete report/final-state agreement).
  validateGridActivationReadinessBundle(contents);

  const manifestText = contents[GRID_READINESS_MANIFEST_FILE];
  const decisionText = contents[GRID_READINESS_DECISION_ARTIFACT];
  const metricsText = contents[GRID_READINESS_METRICS_ARTIFACT];
  if (!manifestText || !decisionText || !metricsText) {
    throw new GridGrappleCoverageBaseAnchorError(
      "Official v3 base bundle is missing the manifest, decision or metrics artifact",
    );
  }

  const manifestParsed = deserializeGridActivationReadinessManifest(manifestText);
  if (!manifestParsed.ok || manifestParsed.schemaVersion !== "3") {
    throw new GridGrappleCoverageBaseAnchorError(
      `Official v3 base manifest did not parse as v3: ${manifestParsed.ok ? "not v3" : manifestParsed.errors}`,
    );
  }
  const manifest = manifestParsed.manifest as GridActivationReadinessManifestV3;

  if (manifest.evaluationId !== expectedBaseV3.evaluationId) {
    throw new GridGrappleCoverageBaseAnchorError(
      `Official base evaluation ID mismatch: expected ${expectedBaseV3.evaluationId}, received ${manifest.evaluationId}`,
    );
  }
  if (manifest.suiteId !== expectedBaseV3.suiteId) {
    throw new GridGrappleCoverageBaseAnchorError(
      `Official base suite ID mismatch: expected ${expectedBaseV3.suiteId}, received ${manifest.suiteId}`,
    );
  }
  if (manifest.suiteChecksum !== expectedBaseV3.suiteChecksum) {
    throw new GridGrappleCoverageBaseAnchorError(
      `Official base suite checksum mismatch: expected ${expectedBaseV3.suiteChecksum}, received ${manifest.suiteChecksum}`,
    );
  }
  if (manifest.seedRegistryId !== expectedBaseV3.seedRegistryId) {
    throw new GridGrappleCoverageBaseAnchorError(
      `Official base seed-registry ID mismatch: expected ${expectedBaseV3.seedRegistryId}, received ${manifest.seedRegistryId}`,
    );
  }
  if (manifest.seedRegistryChecksum !== expectedBaseV3.seedRegistryChecksum) {
    throw new GridGrappleCoverageBaseAnchorError(
      `Official base seed-registry checksum mismatch: expected ${expectedBaseV3.seedRegistryChecksum}, received ${manifest.seedRegistryChecksum}`,
    );
  }
  if (manifest.scenarioRegistryId !== expectedBaseV3.scenarioRegistryId) {
    throw new GridGrappleCoverageBaseAnchorError(
      `Official base scenario-registry ID mismatch: expected ${expectedBaseV3.scenarioRegistryId}, received ${manifest.scenarioRegistryId}`,
    );
  }
  if (manifest.scenarioRegistryChecksum !== expectedBaseV3.scenarioRegistryChecksum) {
    throw new GridGrappleCoverageBaseAnchorError(
      `Official base scenario-registry checksum mismatch: expected ${expectedBaseV3.scenarioRegistryChecksum}, received ${manifest.scenarioRegistryChecksum}`,
    );
  }
  if (manifest.decision !== expectedBaseV3.classification) {
    throw new GridGrappleCoverageBaseAnchorError(
      `Official base classification mismatch: expected ${expectedBaseV3.classification}, received ${manifest.decision}`,
    );
  }

  const decisionParsed = deserializeGridActivationReadinessDecision(decisionText);
  if (!decisionParsed.ok || decisionParsed.decision.decision !== "inconclusive") {
    throw new GridGrappleCoverageBaseAnchorError(
      "Official base decision artifact is not the frozen inconclusive v3 decision",
    );
  }
  const decision = decisionParsed.decision;
  const nonPass = decision.gates.filter((g) => g.outcome !== "pass").map((g) => g.gateId);
  if (
    nonPass.length !== expectedBaseV3.nonPassGates.length ||
    nonPass.some((id, index) => id !== expectedBaseV3.nonPassGates[index])
  ) {
    throw new GridGrappleCoverageBaseAnchorError(
      `Official base evaluation must have exactly ${expectedBaseV3.nonPassGates.join(", ") || "no"} non-pass gates; received ${nonPass.join(", ") || "none"}`,
    );
  }

  const metricsParsed = deserializeGridActivationReadinessMetrics(metricsText);
  if (!metricsParsed.ok || metricsParsed.schemaVersion !== "3") {
    throw new GridGrappleCoverageBaseAnchorError(
      `Official base metrics did not parse as v3: ${metricsParsed.ok ? "not v3" : metricsParsed.errors}`,
    );
  }
  const combat = metricsParsed.metrics.combat;
  if (combat.knockbackEvents !== expectedBaseV3.knockbackEvents) {
    throw new GridGrappleCoverageBaseAnchorError(
      `Official base knockback events must be ${expectedBaseV3.knockbackEvents}; received ${combat.knockbackEvents}`,
    );
  }
  if (combat.overturnEvents !== expectedBaseV3.overturnEvents) {
    throw new GridGrappleCoverageBaseAnchorError(
      `Official base overturn events must be ${expectedBaseV3.overturnEvents}; received ${combat.overturnEvents}`,
    );
  }
  if (combat.grappleRepositionEvents !== expectedBaseV3.grappleRepositionEvents) {
    throw new GridGrappleCoverageBaseAnchorError(
      `Official base grapple reposition events must be ${expectedBaseV3.grappleRepositionEvents}; received ${combat.grappleRepositionEvents}`,
    );
  }

  // Pinned artifact hashes over the exact persisted bytes (never self-declared).
  const manifestChecksum = sha256Hex(manifestText);
  const decisionChecksum = sha256Hex(decisionText);
  const metricsChecksum = sha256Hex(metricsText);
  if (manifestChecksum !== expectedBaseV3.manifestChecksum) {
    throw new GridGrappleCoverageBaseAnchorError(
      `Official base manifest checksum mismatch: expected ${expectedBaseV3.manifestChecksum}, received ${manifestChecksum}`,
    );
  }
  if (decisionChecksum !== expectedBaseV3.decisionChecksum) {
    throw new GridGrappleCoverageBaseAnchorError(
      `Official base decision checksum mismatch: expected ${expectedBaseV3.decisionChecksum}, received ${decisionChecksum}`,
    );
  }
  if (metricsChecksum !== expectedBaseV3.metricsChecksum) {
    throw new GridGrappleCoverageBaseAnchorError(
      `Official base metrics checksum mismatch: expected ${expectedBaseV3.metricsChecksum}, received ${metricsChecksum}`,
    );
  }

  const reference: GridGrappleCoverageBaseV3Reference = {
    evaluationId: manifest.evaluationId,
    suiteId: "grid-activation-readiness-v3",
    suiteChecksum: manifest.suiteChecksum,
    seedRegistryId: manifest.seedRegistryId,
    seedRegistryChecksum: manifest.seedRegistryChecksum,
    scenarioRegistryId: manifest.scenarioRegistryId,
    scenarioRegistryChecksum: manifest.scenarioRegistryChecksum,
    classification: "inconclusive",
    nonPassGates: [...nonPass],
    knockbackEvents: combat.knockbackEvents,
    overturnEvents: combat.overturnEvents,
    grappleRepositionEvents: combat.grappleRepositionEvents,
    manifestChecksum,
    decisionChecksum,
    metricsChecksum,
  };
  return reference;
}

// ── Frozen official supplement identity and anchor (Phase 3E2.1) ───────────

/** The official Phase 3E2 grapple-coverage supplement. */
export const GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_ID =
  "4eca43e2-cc3d-41ee-bfad-73e18238ff61" as const;

export const GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_DECISION =
  "coverage_confirmed" as const;

export const GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_COMBINED =
  "ready_for_opt_in_beta_review" as const;

/**
 * Frozen SHA-256 checksums of the official Phase 3E2 supplement artifacts,
 * computed over the exact persisted bytes at
 * `data/readiness/grid-supplements/4eca43e2-.../`.
 */
export const GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_MANIFEST_CHECKSUM =
  "a9220d5242aed168c4d5928e96ac31fd4a9b758280fbc7168af94cf059bf0a0c" as const;

export const GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_BASE_REFERENCE_CHECKSUM =
  "c28301140d0a2aaba6682f0abb33943ce4b1baa967d91da1983ebdde8d1bec0e" as const;

export const GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_METRICS_CHECKSUM =
  "76d1290fdc7f7972057d28fa4188318556fff1f86e3138c6415cec6887f50320" as const;

export const GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_DECISION_CHECKSUM =
  "7da3d619e519ce13538edd5173078b9fb605e367007f1a3f89b235a9a4cb93b3" as const;

export const GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_REPORT_CHECKSUM =
  "5569aecba51109df0ee141ba8b1e1d77e2fbe544e9d1854d0ae10176336de1f4" as const;

export const GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_PLAN_CHECKSUM =
  "e30dda08253c3cdaba771a5c4af810fcb17cd7a7669a1efcc2b86e5d9df01a26" as const;

export interface GridGrappleCoverageOfficialSupplementIdentity {
  readonly supplementId: string;
  readonly suiteId: "grid-grapple-coverage-supplement-v1";
  readonly scenarioRegistryChecksum: string;
  readonly planChecksum: string;
  readonly decision: "coverage_confirmed";
  readonly combinedReadinessClassification: "ready_for_opt_in_beta_review";
  readonly manifestChecksum: string;
  readonly baseReferenceChecksum: string;
  readonly metricsChecksum: string;
  readonly decisionChecksum: string;
  readonly reportChecksum: string;
}

export const GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_IDENTITY: GridGrappleCoverageOfficialSupplementIdentity =
  Object.freeze({
    supplementId: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_ID,
    suiteId: "grid-grapple-coverage-supplement-v1" as const,
    scenarioRegistryChecksum: GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM,
    planChecksum: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_PLAN_CHECKSUM,
    decision: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_DECISION,
    combinedReadinessClassification: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_COMBINED,
    manifestChecksum: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_MANIFEST_CHECKSUM,
    baseReferenceChecksum:
      GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_BASE_REFERENCE_CHECKSUM,
    metricsChecksum: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_METRICS_CHECKSUM,
    decisionChecksum: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_DECISION_CHECKSUM,
    reportChecksum: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_REPORT_CHECKSUM,
  });

export class GridGrappleCoverageOfficialSupplementAnchorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridGrappleCoverageOfficialSupplementAnchorError";
  }
}

/**
 * Pure anchor for the official Phase 3E2 supplement (Phase 3E2.1). Runs the
 * complete strengthened generic supplement validator, then requires the
 * frozen official supplement identity: the exact supplement ID, the frozen
 * scenario-registry and plan checksums, `coverage_confirmed`,
 * `ready_for_opt_in_beta_review` and all frozen official artifact hashes.
 *
 * This anchor is evidence preparation for a later governance decision; it
 * must not itself perform that decision.
 */
export function anchorOfficialGridGrappleCoverageSupplement(
  contents: Record<string, string>,
): GridGrappleCoverageOfficialSupplementIdentity {
  // 1. Complete strengthened generic supplement validation (including the
  // pinned official base identity).
  const result = validateGridGrappleCoverageSupplementBundle(
    contents,
    GRID_GRAPPLE_COVERAGE_BASE_V3_IDENTITY,
  );

  const manifestParsed = deserializeGridGrappleCoverageSupplementManifest(
    contents[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!,
  );
  if (!manifestParsed.ok) {
    throw new GridGrappleCoverageOfficialSupplementAnchorError(
      `Official supplement manifest did not parse: ${manifestParsed.errors}`,
    );
  }
  const manifest = manifestParsed.manifest;

  if (manifest.supplementId !== GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_ID) {
    throw new GridGrappleCoverageOfficialSupplementAnchorError(
      `Official supplement ID mismatch: expected ${GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_ID}, received ${manifest.supplementId}`,
    );
  }
  if (
    manifest.scenarioRegistryChecksum !==
    GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM
  ) {
    throw new GridGrappleCoverageOfficialSupplementAnchorError(
      "Official supplement scenario-registry checksum does not match the frozen value",
    );
  }
  if (
    manifest.planChecksum !==
    GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_IDENTITY.planChecksum
  ) {
    throw new GridGrappleCoverageOfficialSupplementAnchorError(
      "Official supplement plan checksum does not match the frozen value",
    );
  }
  if (manifest.supplementDecision !== "coverage_confirmed") {
    throw new GridGrappleCoverageOfficialSupplementAnchorError(
      `Official supplement decision must be coverage_confirmed; received ${manifest.supplementDecision}`,
    );
  }
  if (manifest.combinedReadinessClassification !== "ready_for_opt_in_beta_review") {
    throw new GridGrappleCoverageOfficialSupplementAnchorError(
      `Official combined readiness classification must be ready_for_opt_in_beta_review; received ${manifest.combinedReadinessClassification}`,
    );
  }

  const hashes: Record<string, string> = {
    manifest: sha256Hex(contents[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!),
    baseReference: sha256Hex(contents[GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT]!),
    metrics: sha256Hex(contents[GRID_GRAPPLE_SUPPLEMENT_METRICS_ARTIFACT]!),
    decision: sha256Hex(contents[GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT]!),
    report: sha256Hex(contents[GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT]!),
  };
  const expected: Record<string, string> = {
    manifest: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_MANIFEST_CHECKSUM,
    baseReference: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_BASE_REFERENCE_CHECKSUM,
    metrics: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_METRICS_CHECKSUM,
    decision: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_DECISION_CHECKSUM,
    report: GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_REPORT_CHECKSUM,
  };
  for (const name of Object.keys(expected)) {
    if (hashes[name] !== expected[name]) {
      throw new GridGrappleCoverageOfficialSupplementAnchorError(
        `Official supplement ${name} checksum mismatch: expected ${expected[name]}, received ${hashes[name]}`,
      );
    }
  }

  void result;
  return GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_IDENTITY;
}

// ── Supplement bundle inventory ─────────────────────────────────────────────

export const GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE = "manifest.json" as const;
export const GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT =
  "base-readiness-reference.json" as const;
export const GRID_GRAPPLE_SUPPLEMENT_SEED_REGISTRY_ARTIFACT =
  "seed-registry.json" as const;
export const GRID_GRAPPLE_SUPPLEMENT_SCENARIO_REGISTRY_ARTIFACT =
  "scenario-registry.json" as const;
export const GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT = "run-index.json" as const;
export const GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT =
  "match-records.json" as const;
export const GRID_GRAPPLE_SUPPLEMENT_FACTUAL_REPORTS_ARTIFACT =
  "factual-reports.json" as const;
export const GRID_GRAPPLE_SUPPLEMENT_METRICS_ARTIFACT = "metrics.json" as const;
export const GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT = "decision.json" as const;
export const GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT = "report.txt" as const;

/** Exact ten-entry supplement bundle inventory (regular files only). */
export const GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES: readonly string[] = Object.freeze([
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
]);

export const GRID_GRAPPLE_SUPPLEMENT_NON_MANIFEST_ARTIFACTS: readonly string[] =
  Object.freeze(
    GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES.filter(
      (name) => name !== GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE,
    ),
  );

// ── Run-index entry and envelopes ──────────────────────────────────────────

export const gridGrappleCoverageRunIndexEntrySchema = z
  .object({
    runNumber: z.number().int().min(1),
    scenarioId: z.literal("grid-grapple-coverage"),
    assignmentId: z.string().min(1),
    seed: z.number().int().positive(),
    fighterACompetitor: z.enum(["x", "y"]),
    fighterBCompetitor: z.enum(["x", "y"]),
    roleSwapped: z.boolean(),
    attackerSlot: z.enum(["fighter_a", "fighter_b"]),
    matchId: z.string().uuid(),
    recordIndex: z.number().int().nonnegative(),
    reportIndex: z.number().int().nonnegative(),
    winner: z.string().nullable(),
    resultMethod: z.enum(["destruction", "immobilisation", "judges", "draw"]),
    rounds: z.number().int().min(1),
    eventCount: z.number().int().nonnegative(),
    grapplerAttackAttempts: z.number().int().nonnegative(),
    grapplerHits: z.number().int().nonnegative(),
    grapplerMisses: z.number().int().nonnegative(),
    grappleRepositionEvents: z.number().int().nonnegative(),
    sameCellGrapplerHitsWithoutReposition: z.number().int().nonnegative(),
    grappleSourceZones: z.record(z.string(), z.number().int().nonnegative()),
    grappleDestinationZones: z.record(z.string(), z.number().int().nonnegative()),
    grappleRounds: z.array(z.number().int().nonnegative()),
    nonGrappleKnockbackEvents: z.number().int().nonnegative(),
    overturnEvents: z.number().int().nonnegative(),
    grappleEventsAttributedToWrongFighter: z.number().int().nonnegative(),
    malformedOrResolverDisagreeingGrappleEvents: z.number().int().nonnegative(),
    recordChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    reportChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    textReplayChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    asciiReplayChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    reviewPromptChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type GridGrappleCoverageRunIndexEntry = z.infer<
  typeof gridGrappleCoverageRunIndexEntrySchema
>;

function validateRunIndexEnvelope(
  envelope: z.infer<typeof GridGrappleCoverageRunIndexEnvelopeSchema>,
  ctx: z.RefinementCtx,
): void {
  if (envelope.items.length !== GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT) {
    ctx.addIssue({
      code: "custom",
      message: `supplement run-index must contain exactly ${GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT} items; found ${envelope.items.length}`,
    });
    return;
  }
  const seen = new Set<string>();
  const seenTuples = new Set<string>();
  for (const [index, entry] of envelope.items.entries()) {
    if (seen.has(entry.matchId)) {
      ctx.addIssue({
        code: "custom",
        message: `supplement run-index duplicate matchId ${entry.matchId} at index ${index}`,
      });
    }
    seen.add(entry.matchId);
    const tuple = `${entry.assignmentId}|${entry.seed}`;
    if (seenTuples.has(tuple)) {
      ctx.addIssue({
        code: "custom",
        message: `supplement run-index duplicate (assignmentId, seed) tuple ${tuple} at index ${index}`,
      });
    }
    seenTuples.add(tuple);
    if (entry.runNumber !== index + 1) {
      ctx.addIssue({
        code: "custom",
        message: `supplement run-index runNumber ${entry.runNumber} at index ${index} must be ${index + 1}`,
      });
    }
  }
}

export const GridGrappleCoverageRunIndexEnvelopeSchema = z
  .object({
    schemaVersion: z.literal("1"),
    supplementId: z.string().uuid(),
    items: z.array(gridGrappleCoverageRunIndexEntrySchema),
  })
  .superRefine(validateRunIndexEnvelope);

export type GridGrappleCoverageRunIndexEnvelope = z.infer<
  typeof GridGrappleCoverageRunIndexEnvelopeSchema
>;

function validateMatchRecordsEnvelope(
  envelope: z.infer<typeof GridGrappleCoverageMatchRecordsEnvelopeSchema>,
  ctx: z.RefinementCtx,
): void {
  if (envelope.items.length !== GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT) {
    ctx.addIssue({
      code: "custom",
      message: `supplement match-records must contain exactly ${GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT} items; found ${envelope.items.length}`,
    });
    return;
  }
  const seen = new Set<string>();
  for (const [index, record] of envelope.items.entries()) {
    if (seen.has(record.matchId)) {
      ctx.addIssue({
        code: "custom",
        message: `supplement match-records duplicate matchId ${record.matchId} at index ${index}`,
      });
    }
    seen.add(record.matchId);
  }
}

export const GridGrappleCoverageMatchRecordsEnvelopeSchema = z
  .object({
    schemaVersion: z.literal("1"),
    supplementId: z.string().uuid(),
    items: z.array(MatchRecordV3Schema),
  })
  .superRefine(validateMatchRecordsEnvelope);

export type GridGrappleCoverageMatchRecordsEnvelope = z.infer<
  typeof GridGrappleCoverageMatchRecordsEnvelopeSchema
>;

function validateFactualReportsEnvelope(
  envelope: z.infer<typeof GridGrappleCoverageFactualReportsEnvelopeSchema>,
  ctx: z.RefinementCtx,
): void {
  if (envelope.items.length !== GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT) {
    ctx.addIssue({
      code: "custom",
      message: `supplement factual-reports must contain exactly ${GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT} items; found ${envelope.items.length}`,
    });
    return;
  }
  const seen = new Set<string>();
  for (const [index, report] of envelope.items.entries()) {
    if (report.matchId === "pending") {
      ctx.addIssue({
        code: "custom",
        message: `supplement factual-reports index ${index} still uses matchId "pending"`,
      });
    }
    if (seen.has(report.matchId)) {
      ctx.addIssue({
        code: "custom",
        message: `supplement factual-reports duplicate matchId ${report.matchId} at index ${index}`,
      });
    }
    seen.add(report.matchId);
  }
}

export const GridGrappleCoverageFactualReportsEnvelopeSchema = z
  .object({
    schemaVersion: z.literal("1"),
    supplementId: z.string().uuid(),
    items: z.array(FactualMatchReportV2Schema),
  })
  .superRefine(validateFactualReportsEnvelope);

export type GridGrappleCoverageFactualReportsEnvelope = z.infer<
  typeof GridGrappleCoverageFactualReportsEnvelopeSchema
>;

export function deserializeGridGrappleCoverageRunIndex(
  json: string,
):
  | { ok: true; envelope: GridGrappleCoverageRunIndexEnvelope }
  | { ok: false; errors: string } {
  try {
    const result = GridGrappleCoverageRunIndexEnvelopeSchema.safeParse(JSON.parse(json));
    if (!result.success) return { ok: false, errors: result.error.message };
    return { ok: true, envelope: result.data };
  } catch (e) {
    return { ok: false, errors: e instanceof Error ? e.message : String(e) };
  }
}

export function deserializeGridGrappleCoverageMatchRecords(
  json: string,
):
  | { ok: true; envelope: GridGrappleCoverageMatchRecordsEnvelope }
  | { ok: false; errors: string } {
  try {
    const result = GridGrappleCoverageMatchRecordsEnvelopeSchema.safeParse(
      JSON.parse(json),
    );
    if (!result.success) return { ok: false, errors: result.error.message };
    return { ok: true, envelope: result.data };
  } catch (e) {
    return { ok: false, errors: e instanceof Error ? e.message : String(e) };
  }
}

export function deserializeGridGrappleCoverageFactualReports(
  json: string,
):
  | { ok: true; envelope: GridGrappleCoverageFactualReportsEnvelope }
  | { ok: false; errors: string } {
  try {
    const result = GridGrappleCoverageFactualReportsEnvelopeSchema.safeParse(
      JSON.parse(json),
    );
    if (!result.success) return { ok: false, errors: result.error.message };
    return { ok: true, envelope: result.data };
  } catch (e) {
    return { ok: false, errors: e instanceof Error ? e.message : String(e) };
  }
}

// ── Base reference artifact ────────────────────────────────────────────────

export const gridGrappleCoverageBaseReferenceSchema = z
  .object({
    schemaVersion: z.literal("1"),
    evaluationKind: z.literal("grid-readiness-base-reference"),
    baseV3: z.object({
      evaluationId: z.string().uuid(),
      suiteId: z.literal("grid-activation-readiness-v3"),
      suiteChecksum: z.string().regex(/^[a-f0-9]{64}$/),
      seedRegistryId: z.string().min(1),
      seedRegistryChecksum: z.string().regex(/^[a-f0-9]{64}$/),
      scenarioRegistryId: z.string().min(1),
      scenarioRegistryChecksum: z.string().regex(/^[a-f0-9]{64}$/),
      classification: z.literal("inconclusive"),
      nonPassGates: z.array(z.string().min(1)),
      knockbackEvents: z.number().int().nonnegative(),
      overturnEvents: z.number().int().nonnegative(),
      grappleRepositionEvents: z.number().int().nonnegative(),
      manifestChecksum: z.string().regex(/^[a-f0-9]{64}$/),
      decisionChecksum: z.string().regex(/^[a-f0-9]{64}$/),
      metricsChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  })
  .strict();

export type GridGrappleCoverageBaseReferenceArtifact = z.infer<
  typeof gridGrappleCoverageBaseReferenceSchema
>;

export function serializeGridGrappleCoverageBaseReference(
  reference: GridGrappleCoverageBaseV3Reference,
): string {
  const artifact: GridGrappleCoverageBaseReferenceArtifact = {
    schemaVersion: "1",
    evaluationKind: "grid-readiness-base-reference",
    baseV3: {
      evaluationId: reference.evaluationId,
      suiteId: "grid-activation-readiness-v3",
      suiteChecksum: reference.suiteChecksum,
      seedRegistryId: reference.seedRegistryId,
      seedRegistryChecksum: reference.seedRegistryChecksum,
      scenarioRegistryId: reference.scenarioRegistryId,
      scenarioRegistryChecksum: reference.scenarioRegistryChecksum,
      classification: reference.classification,
      nonPassGates: [...reference.nonPassGates],
      knockbackEvents: reference.knockbackEvents,
      overturnEvents: reference.overturnEvents,
      grappleRepositionEvents: reference.grappleRepositionEvents,
      manifestChecksum: reference.manifestChecksum,
      decisionChecksum: reference.decisionChecksum,
      metricsChecksum: reference.metricsChecksum,
    },
  };
  const parsed = gridGrappleCoverageBaseReferenceSchema.safeParse(artifact);
  if (!parsed.success) {
    throw new GridGrappleCoverageBaseAnchorError(
      `Grid grapple coverage base reference failed its authoritative schema: ${parsed.error.message}`,
    );
  }
  return JSON.stringify(parsed.data, null, 2);
}

export function deserializeGridGrappleCoverageBaseReference(
  json: string,
):
  | { ok: true; reference: GridGrappleCoverageBaseReferenceArtifact }
  | { ok: false; errors: string } {
  try {
    const result = gridGrappleCoverageBaseReferenceSchema.safeParse(JSON.parse(json));
    if (!result.success) return { ok: false, errors: result.error.message };
    return { ok: true, reference: result.data };
  } catch (e) {
    return { ok: false, errors: e instanceof Error ? e.message : String(e) };
  }
}

// ── Supplement manifest ────────────────────────────────────────────────────

export const gridGrappleCoverageSupplementManifestV1Schema = z
  .object({
    schemaVersion: z.literal("1"),
    evaluationKind: z.literal("grid-grapple-coverage-supplement"),
    supplementId: z.string().uuid(),
    createdAt: z.string().min(1),
    simulatorVersion: z.literal("0.3.0"),
    positioningModel: z.literal("grid-3x3-v1"),
    rulesetVersion: z.literal("0.2.0"),
    catalogueVersion: z.literal("1"),
    seedCount: z.literal(24),
    scenarioCount: z.literal(1),
    assignmentCount: z.literal(2),
    runCount: z.literal(GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT),
    seedRegistryId: z.literal("grid-readiness-development-v1"),
    seedRegistryChecksum: z.literal(GRID_READINESS_CANONICAL_SEED_REGISTRY_CHECKSUM),
    scenarioRegistryId: z.literal("grid-grapple-coverage-scenarios-v1"),
    scenarioRegistryChecksum: z.literal(
      GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM,
    ),
    planChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    supplementDecision: z.enum(["coverage_confirmed", "inconclusive", "not_ready"]),
    combinedReadinessClassification: z.enum([
      "ready_for_opt_in_beta_review",
      "inconclusive",
      "not_ready",
    ]),
    decisionChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    reportChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    artifacts: z.object({
      manifest: z.literal(GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE),
      baseReference: z.literal(GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT),
      seedRegistry: z.literal(GRID_GRAPPLE_SUPPLEMENT_SEED_REGISTRY_ARTIFACT),
      scenarioRegistry: z.literal(GRID_GRAPPLE_SUPPLEMENT_SCENARIO_REGISTRY_ARTIFACT),
      runIndex: z.literal(GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT),
      matchRecords: z.literal(GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT),
      factualReports: z.literal(GRID_GRAPPLE_SUPPLEMENT_FACTUAL_REPORTS_ARTIFACT),
      metrics: z.literal(GRID_GRAPPLE_SUPPLEMENT_METRICS_ARTIFACT),
      decision: z.literal(GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT),
      report: z.literal(GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT),
    }),
    digests: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
    evidence: z.object({
      deterministicReexecutionPassed: z.literal(true),
      inputsUnmodified: z.literal(true),
      fullBundleReadBackPassed: z.literal(true),
      legacyIsolationRegressionPassed: z.literal(true),
      baseV3Unmodified: z.literal(true),
    }),
    addendum: gridActivationReadinessAddendumV1Schema,
  })
  .strict();

export type GridGrappleCoverageSupplementManifestV1 = z.infer<
  typeof gridGrappleCoverageSupplementManifestV1Schema
>;

export class GridGrappleCoverageSupplementBundleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridGrappleCoverageSupplementBundleError";
  }
}

export interface BuildGridGrappleCoverageSupplementManifestInput {
  supplementId: string;
  createdAt: string;
  seedRegistry: GridReadinessSeedRegistry;
  scenarioRegistry: GridGrappleCoverageScenarioRegistry;
  planChecksum: string;
  decision: GridGrappleCoverageDecisionV1;
  combinedReadinessClassification: GridGrappleCoverageSupplementManifestV1["combinedReadinessClassification"];
  addendum: GridActivationReadinessAddendumV1;
  /** SHA-256 digest of every non-manifest artifact, keyed by artifact name. */
  digests: Record<string, string>;
  decisionChecksum: string;
  reportChecksum: string;
}

export function buildGridGrappleCoverageSupplementManifest(
  input: BuildGridGrappleCoverageSupplementManifestInput,
): GridGrappleCoverageSupplementManifestV1 {
  const manifest: GridGrappleCoverageSupplementManifestV1 = {
    schemaVersion: "1",
    evaluationKind: "grid-grapple-coverage-supplement",
    supplementId: input.supplementId,
    createdAt: input.createdAt,
    simulatorVersion: "0.3.0",
    positioningModel: "grid-3x3-v1",
    rulesetVersion: "0.2.0",
    catalogueVersion: "1",
    seedCount: input.seedRegistry.seeds.length as 24,
    scenarioCount: input.scenarioRegistry.scenarios.length as 1,
    assignmentCount: input.scenarioRegistry.assignments.length as 2,
    runCount: GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
    seedRegistryId: input.seedRegistry.registryId,
    seedRegistryChecksum:
      GRID_READINESS_CANONICAL_SEED_REGISTRY_CHECKSUM as GridGrappleCoverageSupplementManifestV1["seedRegistryChecksum"],
    scenarioRegistryId: input.scenarioRegistry.registryId,
    scenarioRegistryChecksum:
      GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM as GridGrappleCoverageSupplementManifestV1["scenarioRegistryChecksum"],
    planChecksum: input.planChecksum,
    supplementDecision: input.decision.decision,
    combinedReadinessClassification: input.combinedReadinessClassification,
    decisionChecksum: input.decisionChecksum,
    reportChecksum: input.reportChecksum,
    artifacts: {
      manifest: GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE,
      baseReference: GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT,
      seedRegistry: GRID_GRAPPLE_SUPPLEMENT_SEED_REGISTRY_ARTIFACT,
      scenarioRegistry: GRID_GRAPPLE_SUPPLEMENT_SCENARIO_REGISTRY_ARTIFACT,
      runIndex: GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT,
      matchRecords: GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT,
      factualReports: GRID_GRAPPLE_SUPPLEMENT_FACTUAL_REPORTS_ARTIFACT,
      metrics: GRID_GRAPPLE_SUPPLEMENT_METRICS_ARTIFACT,
      decision: GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT,
      report: GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT,
    },
    digests: { ...input.digests },
    evidence: {
      deterministicReexecutionPassed: true,
      inputsUnmodified: true,
      fullBundleReadBackPassed: true,
      legacyIsolationRegressionPassed: true,
      baseV3Unmodified: true,
    },
    addendum: input.addendum,
  };
  const parsed = gridGrappleCoverageSupplementManifestV1Schema.safeParse(manifest);
  if (!parsed.success) {
    throw new GridGrappleCoverageSupplementBundleError(
      `Grid grapple coverage supplement manifest failed its authoritative schema: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export function serializeGridGrappleCoverageSupplementManifest(
  manifest: GridGrappleCoverageSupplementManifestV1,
): string {
  return JSON.stringify(manifest, null, 2);
}

export function deserializeGridGrappleCoverageSupplementManifest(
  json: string,
):
  | { ok: true; manifest: GridGrappleCoverageSupplementManifestV1 }
  | { ok: false; errors: string } {
  try {
    const result = gridGrappleCoverageSupplementManifestV1Schema.safeParse(
      JSON.parse(json),
    );
    if (!result.success) return { ok: false, errors: result.error.message };
    return { ok: true, manifest: result.data };
  } catch (e) {
    return { ok: false, errors: e instanceof Error ? e.message : String(e) };
  }
}

// ── Metrics artifact deserialization ───────────────────────────────────────

const gridGrappleCoverageMetricsArtifactSchema = z.object({
  schemaVersion: z.literal("1"),
  evaluationKind: z.literal("grid-grapple-coverage"),
  supplementId: z.string().uuid(),
  execution: z.object({
    totalPlannedRuns: z.number().int().nonnegative(),
    totalCompletedRuns: z.number().int().nonnegative(),
    deterministicRuns: z.number().int().nonnegative(),
    schemaValidRecords: z.number().int().nonnegative(),
    schemaValidReports: z.number().int().nonnegative(),
    finalStateAgreements: z.number().int().nonnegative(),
    invalidEventCount: z.number().int().nonnegative(),
    mutationFailures: z.number().int().nonnegative(),
  }),
  grapple: z.object({
    totalGrapplerAttackAttempts: z.number().int().nonnegative(),
    totalGrapplerHits: z.number().int().nonnegative(),
    totalGrapplerMisses: z.number().int().nonnegative(),
    validGrappleRepositionEvents: z.number().int().nonnegative(),
    sameCellGrapplerHitsWithoutReposition: z.number().int().nonnegative(),
    distinctSeedsProducingReposition: z.number().int().nonnegative(),
    fighterAAttackerRepositionCount: z.number().int().nonnegative(),
    fighterBAttackerRepositionCount: z.number().int().nonnegative(),
    distinctSeedsProducingFighterAAttackerReposition: z.number().int().nonnegative(),
    distinctSeedsProducingFighterBAttackerReposition: z.number().int().nonnegative(),
    grappleSourceZoneCounts: z.record(z.string(), z.number().int().nonnegative()),
    grappleDestinationZoneCounts: z.record(z.string(), z.number().int().nonnegative()),
    grappleRoundMin: z.number().int().nullable(),
    grappleRoundMax: z.number().int().nullable(),
    grappleRoundMedian: z.number().nullable(),
  }),
  isolation: z.object({
    nonGrappleKnockbackEvents: z.number().int().nonnegative(),
    overturnEvents: z.number().int().nonnegative(),
    grappleEventsAttributedToWrongFighter: z.number().int().nonnegative(),
    malformedOrResolverDisagreeingGrappleEvents: z.number().int().nonnegative(),
  }),
  timing: z.object({
    totalElapsedMs: z.number().nonnegative(),
    meanMsPerMatch: z.number().nonnegative(),
    medianMsPerMatch: z.number().nonnegative(),
    p95MsPerMatch: z.number().nonnegative(),
  }),
});

export type GridGrappleCoverageMetricsArtifact = z.infer<
  typeof gridGrappleCoverageMetricsArtifactSchema
>;

export function serializeGridGrappleCoverageMetrics(
  metrics: GridGrappleCoverageMetrics,
  supplementId: string,
): string {
  const artifact: GridGrappleCoverageMetricsArtifact = {
    schemaVersion: "1",
    evaluationKind: "grid-grapple-coverage",
    supplementId,
    execution: {
      totalPlannedRuns: metrics.execution.totalPlannedRuns,
      totalCompletedRuns: metrics.execution.totalCompletedRuns,
      deterministicRuns: metrics.execution.deterministicRuns,
      schemaValidRecords: metrics.execution.schemaValidRecords,
      schemaValidReports: metrics.execution.schemaValidReports,
      finalStateAgreements: metrics.execution.finalStateAgreements,
      invalidEventCount: metrics.execution.invalidEventCount,
      mutationFailures: metrics.execution.mutationFailures,
    },
    grapple: {
      totalGrapplerAttackAttempts: metrics.grapple.totalGrapplerAttackAttempts,
      totalGrapplerHits: metrics.grapple.totalGrapplerHits,
      totalGrapplerMisses: metrics.grapple.totalGrapplerMisses,
      validGrappleRepositionEvents: metrics.grapple.validGrappleRepositionEvents,
      sameCellGrapplerHitsWithoutReposition:
        metrics.grapple.sameCellGrapplerHitsWithoutReposition,
      distinctSeedsProducingReposition: metrics.grapple.distinctSeedsProducingReposition,
      fighterAAttackerRepositionCount: metrics.grapple.fighterAAttackerRepositionCount,
      fighterBAttackerRepositionCount: metrics.grapple.fighterBAttackerRepositionCount,
      distinctSeedsProducingFighterAAttackerReposition:
        metrics.grapple.distinctSeedsProducingFighterAAttackerReposition,
      distinctSeedsProducingFighterBAttackerReposition:
        metrics.grapple.distinctSeedsProducingFighterBAttackerReposition,
      grappleSourceZoneCounts: { ...metrics.grapple.grappleSourceZoneCounts },
      grappleDestinationZoneCounts: {
        ...metrics.grapple.grappleDestinationZoneCounts,
      },
      grappleRoundMin: metrics.grapple.grappleRoundMin,
      grappleRoundMax: metrics.grapple.grappleRoundMax,
      grappleRoundMedian: metrics.grapple.grappleRoundMedian,
    },
    isolation: {
      nonGrappleKnockbackEvents: metrics.isolation.nonGrappleKnockbackEvents,
      overturnEvents: metrics.isolation.overturnEvents,
      grappleEventsAttributedToWrongFighter:
        metrics.isolation.grappleEventsAttributedToWrongFighter,
      malformedOrResolverDisagreeingGrappleEvents:
        metrics.isolation.malformedOrResolverDisagreeingGrappleEvents,
    },
    timing: {
      totalElapsedMs: metrics.timing.totalElapsedMs,
      meanMsPerMatch: metrics.timing.meanMsPerMatch,
      medianMsPerMatch: metrics.timing.medianMsPerMatch,
      p95MsPerMatch: metrics.timing.p95MsPerMatch,
    },
  };
  const parsed = gridGrappleCoverageMetricsArtifactSchema.safeParse(artifact);
  if (!parsed.success) {
    throw new GridGrappleCoverageSupplementBundleError(
      `Grid grapple coverage metrics artifact failed its authoritative schema: ${parsed.error.message}`,
    );
  }
  return JSON.stringify(parsed.data, null, 2);
}

export function deserializeGridGrappleCoverageMetrics(
  json: string,
):
  | { ok: true; metrics: GridGrappleCoverageMetricsArtifact }
  | { ok: false; errors: string } {
  try {
    const result = gridGrappleCoverageMetricsArtifactSchema.safeParse(JSON.parse(json));
    if (!result.success) return { ok: false, errors: result.error.message };
    return { ok: true, metrics: result.data };
  } catch (e) {
    return { ok: false, errors: e instanceof Error ? e.message : String(e) };
  }
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Recomputation of the supplemental metrics from the persisted artifacts
 * (Phase 3E2.1). Uses the canonical plan entries, plan-derived attacker slots,
 * the authoritative record result/rounds/event-count, the strengthened causal
 * grapple extractor and complete report/final-state agreement. Operational
 * values are bound to the manifest attestations. The persisted metrics
 * artifact is always the value being checked, never the source for non-timing
 * facts.
 */
export function recomputeGridGrappleCoverageMetricsFromArtifacts(input: {
  runIndex: GridGrappleCoverageRunIndexEnvelope;
  records: GridGrappleCoverageMatchRecordsEnvelope;
  reports: GridGrappleCoverageFactualReportsEnvelope;
  plan: GridGrappleCoverageRunPlan;
  scenarioRegistry: GridGrappleCoverageScenarioRegistry;
  manifestEvidence: {
    deterministicReexecutionPassed: boolean;
    inputsUnmodified: boolean;
  };
  persistedTiming: {
    totalElapsedMs: number;
    meanMsPerMatch: number;
    medianMsPerMatch: number;
    p95MsPerMatch: number;
  };
}): GridGrappleCoverageMetrics {
  const {
    runIndex,
    records,
    reports,
    plan,
    scenarioRegistry,
    manifestEvidence,
    persistedTiming,
  } = input;
  if (
    runIndex.items.length !== GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT ||
    records.items.length !== GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT ||
    reports.items.length !== GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT ||
    plan.runs.length !== GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT
  ) {
    throw new Error(
      "Grid grapple coverage metrics recomputation requires exactly 48 run-index, record, report and plan items",
    );
  }
  const scenario = scenarioRegistry.scenarios[0]!;
  const runs = plan.runs.map((planRun, index) => {
    const entry = runIndex.items[index]!;
    const record = records.items[index]!;
    const report = reports.items[index]!;
    const attackerSlot = grappleAttackerSlotForRun(planRun);
    if (
      record.matchId !== entry.matchId ||
      report.matchId !== entry.matchId ||
      entry.attackerSlot !== attackerSlot ||
      entry.runNumber !== planRun.runNumber ||
      entry.scenarioId !== planRun.scenarioId ||
      entry.assignmentId !== planRun.assignmentId ||
      entry.seed !== planRun.seed ||
      entry.roleSwapped !== planRun.roleSwapped ||
      entry.fighterACompetitor !== planRun.fighterACompetitor ||
      entry.fighterBCompetitor !== planRun.fighterBCompetitor ||
      entry.recordIndex !== index ||
      entry.reportIndex !== index
    ) {
      throw new Error(
        `Grid grapple coverage metrics recomputation: run ${planRun.runNumber} does not equal the canonical plan`,
      );
    }
    // The authoritative record is the source for result facts after the
    // run-index/record agreement is established.
    if (
      record.seed !== entry.seed ||
      record.rounds !== entry.rounds ||
      record.result.winner !== entry.winner ||
      record.result.method !== entry.resultMethod ||
      record.events.length !== entry.eventCount ||
      !recordConfigMatchesCanonical(record, scenario, planRun)
    ) {
      throw new Error(
        `Grid grapple coverage metrics recomputation: run ${planRun.runNumber} record does not agree with the run index or canonical scenario`,
      );
    }
    // Throws on any malformed/chronologically invalid/duplicate/impossible
    // event fact: any inspector failure invalidates the supplement.
    inspectGridReadinessRecordEvidence(record);
    assertGridReadinessRecordReportFinalAgreement(record, report);
    const evidence = extractGridGrappleRunEvidence(record, attackerSlot);
    return {
      runNumber: planRun.runNumber,
      seed: planRun.seed,
      attackerSlot,
      winner: record.result.winner,
      resultMethod: record.result.method,
      rounds: record.rounds,
      eventCount: record.events.length,
      evidence,
    };
  });
  const metrics = computeGridGrappleCoverageMetrics({
    runs,
    execution: {
      deterministicRuns: manifestEvidence.deterministicReexecutionPassed
        ? GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT
        : 0,
      schemaValidRecords: records.items.length,
      schemaValidReports: reports.items.length,
      finalStateAgreements: records.items.length,
      invalidEventCount: 0,
      mutationFailures: manifestEvidence.inputsUnmodified ? 0 : 1,
    },
    timing: {
      totalElapsedMs: persistedTiming.totalElapsedMs,
      perMatchMs: [],
    },
  });
  return {
    ...metrics,
    timing: {
      totalElapsedMs: persistedTiming.totalElapsedMs,
      meanMsPerMatch: persistedTiming.meanMsPerMatch,
      medianMsPerMatch: persistedTiming.medianMsPerMatch,
      p95MsPerMatch: persistedTiming.p95MsPerMatch,
    },
  };
}

function hardChecksFromEvidence(evidenceList: readonly GridGrappleRunEvidence[]): {
  malformedGrappleEventsAbsent: boolean;
  resolverDisagreementsAbsent: boolean;
  wrongFighterAbsent: boolean;
} {
  let malformed = 0;
  let wrongFighter = 0;
  for (const e of evidenceList) {
    malformed += e.malformedOrResolverDisagreeingGrappleEvents;
    wrongFighter += e.grappleEventsAttributedToWrongFighter;
  }
  return {
    malformedGrappleEventsAbsent: malformed === 0 && wrongFighter === 0,
    resolverDisagreementsAbsent: malformed === 0,
    wrongFighterAbsent: wrongFighter === 0,
  };
}

function buildProposalMatches(recordBuild: unknown, expectedProposal: unknown): boolean {
  const record = recordBuild as { proposal?: unknown };
  return sameJson(record?.proposal, expectedProposal);
}

function policyMatches(recordPolicy: unknown, expectedPolicy: unknown): boolean {
  return sameJson(recordPolicy, expectedPolicy);
}

/**
 * Phase 3E2.1: exact supplemental scenario binding. Requires the record's
 * complete fighter configurations (machine name, chassis, mobility, weapon,
 * utility, all five armour values and the complete action policy) and the
 * ruleset/catalogue versions to match the canonical scenario and assignment,
 * with the attacker configuration carrying weapon `grappler` and the target
 * configuration carrying weapon `hammer`.
 */
function recordConfigMatchesCanonical(
  record: GridGrappleCoverageMatchRecordsEnvelope["items"][number],
  scenario: GridGrappleCoverageScenarioFamily,
  run: GridGrappleCoverageRun,
): boolean {
  const configA = run.fighterACompetitor === "x" ? scenario.fighterX : scenario.fighterY;
  const configB = run.fighterBCompetitor === "x" ? scenario.fighterX : scenario.fighterY;
  const attackerProposal =
    run.fighterACompetitor === "x"
      ? (record.config.fighterA.build as { proposal?: { weaponId?: string } }).proposal
      : (record.config.fighterB.build as { proposal?: { weaponId?: string } }).proposal;
  const targetProposal =
    run.fighterACompetitor === "x"
      ? (record.config.fighterB.build as { proposal?: { weaponId?: string } }).proposal
      : (record.config.fighterA.build as { proposal?: { weaponId?: string } }).proposal;
  return (
    record.config.seed === run.seed &&
    buildProposalMatches(record.config.fighterA.build, configA.buildProposal) &&
    policyMatches(record.config.fighterA.policy, configA.policy) &&
    buildProposalMatches(record.config.fighterB.build, configB.buildProposal) &&
    policyMatches(record.config.fighterB.policy, configB.policy) &&
    record.config.rulesetVersion === "0.2.0" &&
    record.config.catalogueVersion === "1" &&
    attackerProposal?.weaponId === "grappler" &&
    targetProposal?.weaponId === "hammer"
  );
}

/**
 * Pure cross-artifact validation of the complete read-back supplement bundle
 * (Phase 12). Establishes the provenance chain: base reference → seed and
 * scenario registries → exact 48-run plan → each persisted record, report and
 * run-index entry (record/report binding, shared evidence inspector, complete
 * final-state agreement, recomputed run checksums, authoritative grapple
 * evidence) → recomputed metrics → recomputed decision → combined addendum →
 * regenerated report → manifest identity and digests.
 */
export function validateGridGrappleCoverageSupplementBundle(
  contents: Record<string, string>,
  expectedBaseV3: GridGrappleCoverageBaseV3Identity = GRID_GRAPPLE_COVERAGE_BASE_V3_IDENTITY,
): { supplementId: string; decision: string } {
  const failures: string[] = [];
  const check = (cond: boolean, message: string): void => {
    if (!cond) failures.push(message);
  };

  for (const name of GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES) {
    check(
      typeof contents[name] === "string",
      `supplement bundle is missing artifact ${name}`,
    );
  }

  const manifestParsed = contents[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]
    ? deserializeGridGrappleCoverageSupplementManifest(
        contents[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!,
      )
    : { ok: false as const, errors: "missing manifest" };
  const baseParsed = contents[GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT]
    ? deserializeGridGrappleCoverageBaseReference(
        contents[GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT]!,
      )
    : { ok: false as const, errors: "missing base reference" };
  const seedParsed = contents[GRID_GRAPPLE_SUPPLEMENT_SEED_REGISTRY_ARTIFACT]
    ? loadGridReadinessSeedRegistrySafe(
        contents[GRID_GRAPPLE_SUPPLEMENT_SEED_REGISTRY_ARTIFACT]!,
      )
    : null;
  const scenarioParsed = contents[GRID_GRAPPLE_SUPPLEMENT_SCENARIO_REGISTRY_ARTIFACT]
    ? deserializeGridGrappleCoverageScenarioRegistry(
        contents[GRID_GRAPPLE_SUPPLEMENT_SCENARIO_REGISTRY_ARTIFACT]!,
      )
    : null;
  const runIndexParsed = contents[GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT]
    ? deserializeGridGrappleCoverageRunIndex(
        contents[GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT]!,
      )
    : { ok: false as const, errors: "missing run index" };
  const recordsParsed = contents[GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT]
    ? deserializeGridGrappleCoverageMatchRecords(
        contents[GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT]!,
      )
    : { ok: false as const, errors: "missing match records" };
  const reportsParsed = contents[GRID_GRAPPLE_SUPPLEMENT_FACTUAL_REPORTS_ARTIFACT]
    ? deserializeGridGrappleCoverageFactualReports(
        contents[GRID_GRAPPLE_SUPPLEMENT_FACTUAL_REPORTS_ARTIFACT]!,
      )
    : { ok: false as const, errors: "missing factual reports" };
  const metricsParsed = contents[GRID_GRAPPLE_SUPPLEMENT_METRICS_ARTIFACT]
    ? deserializeGridGrappleCoverageMetrics(
        contents[GRID_GRAPPLE_SUPPLEMENT_METRICS_ARTIFACT]!,
      )
    : { ok: false as const, errors: "missing metrics" };
  const decisionParsed = contents[GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT]
    ? deserializeGridGrappleCoverageDecision(
        contents[GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT]!,
      )
    : { ok: false as const, errors: "missing decision" };

  if (!manifestParsed.ok) {
    failures.push(`invalid supplement manifest: ${manifestParsed.errors}`);
  }
  if (!baseParsed.ok) {
    failures.push(`invalid base reference: ${baseParsed.errors}`);
  }
  if (seedParsed === null) {
    failures.push("invalid seed-registry artifact");
  }
  if (scenarioParsed === null) {
    failures.push("invalid scenario-registry artifact");
  }
  if (!runIndexParsed.ok) {
    failures.push(`invalid run-index: ${runIndexParsed.errors}`);
  }
  if (!recordsParsed.ok) {
    failures.push(`invalid match-records: ${recordsParsed.errors}`);
  }
  if (!reportsParsed.ok) {
    failures.push(`invalid factual-reports: ${reportsParsed.errors}`);
  }
  if (!metricsParsed.ok) {
    failures.push(`invalid metrics: ${metricsParsed.errors}`);
  }
  if (!decisionParsed.ok) {
    failures.push(`invalid decision: ${decisionParsed.errors}`);
  }

  if (failures.length > 0) {
    throw new GridGrappleCoverageSupplementBundleError(
      `Grid grapple coverage supplement bundle validation failed: ${failures.join("; ")}`,
    );
  }

  const manifest = manifestParsed.ok ? manifestParsed.manifest : null;
  const baseReference = baseParsed.ok ? baseParsed.reference.baseV3 : null;
  const seedRegistry = seedParsed;
  const scenarioRegistry = scenarioParsed;
  const runIndex = runIndexParsed.ok ? runIndexParsed.envelope : null;
  const records = recordsParsed.ok ? recordsParsed.envelope : null;
  const reports = reportsParsed.ok ? reportsParsed.envelope : null;
  const metrics = metricsParsed.ok ? metricsParsed.metrics : null;
  const decision = decisionParsed.ok ? decisionParsed.decision : null;

  if (
    manifest === null ||
    baseReference === null ||
    seedRegistry === null ||
    scenarioRegistry === null ||
    runIndex === null ||
    records === null ||
    reports === null ||
    metrics === null ||
    decision === null
  ) {
    throw new GridGrappleCoverageSupplementBundleError(
      "Grid grapple coverage supplement bundle validation failed: one or more artifacts did not parse",
    );
  }

  // Digests: every non-manifest artifact must match its manifest digest; the
  // decision/report checksums must match their artifacts.
  for (const name of GRID_GRAPPLE_SUPPLEMENT_NON_MANIFEST_ARTIFACTS) {
    check(
      manifest.digests[name] === sha256Hex(contents[name]!),
      `manifest digest mismatch for ${name}`,
    );
  }
  check(
    manifest.decisionChecksum ===
      sha256Hex(contents[GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT]!),
    "manifest decision checksum mismatch",
  );
  check(
    manifest.reportChecksum ===
      sha256Hex(contents[GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT]!),
    "manifest report checksum mismatch",
  );

  // Base reference must be the frozen official base: every identity field and
  // the pinned artifact hashes (never self-declared).
  check(
    baseReference.evaluationId === expectedBaseV3.evaluationId &&
      baseReference.suiteId === expectedBaseV3.suiteId &&
      baseReference.suiteChecksum === expectedBaseV3.suiteChecksum &&
      baseReference.seedRegistryId === expectedBaseV3.seedRegistryId &&
      baseReference.seedRegistryChecksum === expectedBaseV3.seedRegistryChecksum &&
      baseReference.scenarioRegistryId === expectedBaseV3.scenarioRegistryId &&
      baseReference.scenarioRegistryChecksum ===
        expectedBaseV3.scenarioRegistryChecksum &&
      baseReference.classification === expectedBaseV3.classification &&
      baseReference.nonPassGates.length === expectedBaseV3.nonPassGates.length &&
      baseReference.nonPassGates.every((g, i) => g === expectedBaseV3.nonPassGates[i]) &&
      baseReference.knockbackEvents === expectedBaseV3.knockbackEvents &&
      baseReference.overturnEvents === expectedBaseV3.overturnEvents &&
      baseReference.grappleRepositionEvents === expectedBaseV3.grappleRepositionEvents &&
      baseReference.manifestChecksum === expectedBaseV3.manifestChecksum &&
      baseReference.decisionChecksum === expectedBaseV3.decisionChecksum &&
      baseReference.metricsChecksum === expectedBaseV3.metricsChecksum,
    "base reference does not match the frozen official v3 evaluation",
  );
  check(
    manifest.addendum.baseV3.evaluationId === baseReference.evaluationId &&
      manifest.addendum.baseV3.suiteChecksum === baseReference.suiteChecksum &&
      manifest.addendum.baseV3.manifestChecksum === baseReference.manifestChecksum &&
      manifest.addendum.baseV3.decisionChecksum === baseReference.decisionChecksum &&
      manifest.addendum.baseV3.metricsChecksum === baseReference.metricsChecksum,
    "manifest addendum base-v3 reference does not agree with the base-reference artifact",
  );

  // Seed and scenario registries must be canonical.
  check(
    gridReadinessSeedRegistryChecksum(seedRegistry) ===
      GRID_READINESS_CANONICAL_SEED_REGISTRY_CHECKSUM,
    "seed registry is not the canonical readiness registry",
  );
  check(
    gridGrappleCoverageScenarioRegistryChecksum(scenarioRegistry) ===
      GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM,
    "scenario registry is not the canonical grapple coverage registry",
  );

  // Exact run plan reconstruction and checksum.
  const plan = buildGridGrappleCoverageRunPlan({
    seedRegistry,
    scenarioRegistry,
    baseV3EvaluationId: expectedBaseV3.evaluationId,
    baseV3SuiteChecksum: expectedBaseV3.suiteChecksum,
  });
  check(
    gridGrappleCoveragePlanChecksum(plan) === manifest.planChecksum,
    "manifest plan checksum does not match the recomputed run plan",
  );

  // Phase 3E2.1: one exact supplement ID across every envelope and artifact,
  // and the decision createdAt must equal the manifest createdAt.
  check(
    runIndex.supplementId === manifest.supplementId &&
      records.supplementId === manifest.supplementId &&
      reports.supplementId === manifest.supplementId &&
      metrics.supplementId === manifest.supplementId &&
      decision.supplementId === manifest.supplementId &&
      manifest.addendum.supplement.supplementId === manifest.supplementId,
    "supplement ID is not identical across the manifest, run index, records, reports, metrics, decision and addendum",
  );
  check(
    decision.createdAt === manifest.createdAt,
    "decision createdAt does not equal the manifest createdAt",
  );

  // Core cross-agreement: canonical plan binding, record/report/run-index
  // binding, supplemental scenario/config binding, shared evidence inspector,
  // complete final-state agreement, recomputed run checksums and the
  // strengthened causal grapple evidence per run.
  const scenario = scenarioRegistry.scenarios[0]!;
  const evidenceList: GridGrappleRunEvidence[] = [];
  for (let i = 0; i < plan.runs.length; i++) {
    const planRun = plan.runs[i]!;
    const entry = runIndex.items[i]!;
    const record = records.items[i]!;
    const report = reports.items[i]!;
    const label = `run ${planRun.runNumber} (${planRun.assignmentId}, seed ${planRun.seed})`;

    // Phase 4: every persisted run must equal the canonical plan.
    check(
      entry.runNumber === planRun.runNumber &&
        entry.scenarioId === planRun.scenarioId &&
        entry.assignmentId === planRun.assignmentId &&
        entry.seed === planRun.seed &&
        entry.roleSwapped === planRun.roleSwapped &&
        entry.fighterACompetitor === planRun.fighterACompetitor &&
        entry.fighterBCompetitor === planRun.fighterBCompetitor,
      `${label} persisted run-index entry does not equal the canonical run plan`,
    );
    // The authoritative attacker slot is derived from the canonical plan,
    // never trusted from the persisted entry.
    const attackerSlot = grappleAttackerSlotForRun(planRun);
    check(
      entry.attackerSlot === attackerSlot,
      `${label} persisted attackerSlot does not match the canonical plan`,
    );
    check(
      entry.recordIndex === i && entry.reportIndex === i,
      `${label} record/report index does not match the canonical run order`,
    );
    check(
      record.matchId === entry.matchId &&
        record.seed === entry.seed &&
        record.rounds === entry.rounds &&
        record.result.winner === entry.winner &&
        record.result.method === entry.resultMethod &&
        record.events.length === entry.eventCount,
      `${label} run-index summary does not agree with the authoritative record`,
    );
    check(
      report.matchId === entry.matchId && report.seed === entry.seed,
      `${label} report binding mismatch`,
    );
    check(
      report.rounds === record.rounds &&
        report.winner === record.result.winner &&
        report.resultMethod === record.result.method,
      `${label} record/report result binding mismatch`,
    );
    // Phase 5: exact supplemental scenario/config binding.
    check(
      recordConfigMatchesCanonical(record, scenario, planRun),
      `${label} record configuration does not match the canonical supplemental scenario`,
    );
    // Runtime identity must be exactly grid 0.3.0 / grid-3x3-v1 / 0.2.0 / 1.
    check(
      record.simulatorVersion === "0.3.0" &&
        record.positioningModel === "grid-3x3-v1" &&
        record.rulesetVersion === "0.2.0" &&
        record.catalogueVersion === "1" &&
        report.simulatorVersion === "0.3.0" &&
        report.positioningModel === "grid-3x3-v1" &&
        report.rulesetVersion === "0.2.0" &&
        report.catalogueVersion === "1",
      `${label} record/report runtime identity is not grid 0.3.0 / grid-3x3-v1 / 0.2.0 / 1`,
    );
    // Phase 6: every match record uses the injected supplement timestamp.
    check(
      record.createdAt === manifest.createdAt,
      `${label} record createdAt does not match the injected supplement timestamp`,
    );
    try {
      inspectGridReadinessRecordEvidence(record);
    } catch (e) {
      check(
        false,
        `${label} persisted record failed the record-evidence inspector: ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }
    try {
      assertGridReadinessRecordReportFinalAgreement(record, report);
    } catch (e) {
      check(
        false,
        `${label} report/final-state agreement failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    const recomputedChecksums = recomputeGridActivationReadinessRunChecksums(
      record,
      report,
    );
    check(
      recomputedChecksums.recordChecksum === entry.recordChecksum &&
        recomputedChecksums.reportChecksum === entry.reportChecksum &&
        recomputedChecksums.textReplayChecksum === entry.textReplayChecksum &&
        recomputedChecksums.asciiReplayChecksum === entry.asciiReplayChecksum &&
        recomputedChecksums.reviewPromptChecksum === entry.reviewPromptChecksum,
      `${label} recomputed artifact checksums do not match the persisted run-index entry`,
    );
    let evidence: GridGrappleRunEvidence;
    try {
      evidence = extractGridGrappleRunEvidence(record, attackerSlot);
    } catch (e) {
      check(
        false,
        `${label} grapple evidence extraction failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }
    evidenceList.push(evidence);
    check(
      evidence.grapplerAttackAttempts === entry.grapplerAttackAttempts &&
        evidence.grapplerHits === entry.grapplerHits &&
        evidence.grapplerMisses === entry.grapplerMisses &&
        evidence.grappleRepositionEvents === entry.grappleRepositionEvents &&
        evidence.sameCellGrapplerHitsWithoutReposition ===
          entry.sameCellGrapplerHitsWithoutReposition &&
        sameJson(evidence.grappleSourceZones, entry.grappleSourceZones) &&
        sameJson(evidence.grappleDestinationZones, entry.grappleDestinationZones) &&
        sameJson(evidence.grappleRounds, entry.grappleRounds) &&
        evidence.nonGrappleKnockbackEvents === entry.nonGrappleKnockbackEvents &&
        evidence.overturnEvents === entry.overturnEvents &&
        evidence.grappleEventsAttributedToWrongFighter ===
          entry.grappleEventsAttributedToWrongFighter &&
        evidence.malformedOrResolverDisagreeingGrappleEvents ===
          entry.malformedOrResolverDisagreeingGrappleEvents,
      `${label} recomputed grapple evidence does not match the persisted run-index entry`,
    );
  }

  // Recomputed metrics must equal the persisted metrics (Phase 7: canonical
  // plan facts, plan-derived attacker slots, authoritative records, the
  // strengthened causal extractor and manifest-attestation-bound operational
  // values).
  let recomputedMetrics: GridGrappleCoverageMetrics | null = null;
  try {
    recomputedMetrics = recomputeGridGrappleCoverageMetricsFromArtifacts({
      runIndex,
      records,
      reports,
      plan,
      scenarioRegistry,
      manifestEvidence: {
        deterministicReexecutionPassed: manifest.evidence.deterministicReexecutionPassed,
        inputsUnmodified: manifest.evidence.inputsUnmodified,
      },
      persistedTiming: {
        totalElapsedMs: metrics.timing.totalElapsedMs,
        meanMsPerMatch: metrics.timing.meanMsPerMatch,
        medianMsPerMatch: metrics.timing.medianMsPerMatch,
        p95MsPerMatch: metrics.timing.p95MsPerMatch,
      },
    });
  } catch (e) {
    failures.push(
      `persisted records/reports could not be re-reduced to metrics: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
  if (recomputedMetrics !== null) {
    const persistedShape = {
      execution: metrics.execution,
      grapple: metrics.grapple,
      isolation: metrics.isolation,
    };
    const recomputedShape = {
      execution: recomputedMetrics.execution,
      grapple: recomputedMetrics.grapple,
      isolation: recomputedMetrics.isolation,
    };
    check(
      sameJson(persistedShape, recomputedShape),
      "persisted metrics do not match the metrics recomputed from the persisted records and reports",
    );

    // Phase 8: informational timing validation. Timing is excluded from the
    // decision; a timing-only change must never alter a classification.
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
      failures.push("supplement metrics timing values must be finite and non-negative");
    }
    // Documented numeric tolerance: mean must approximate totalElapsedMs / 48
    // within a relative tolerance of 0.05 plus a small absolute floor.
    const expectedMean =
      timing.totalElapsedMs / GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT;
    const meanTolerance = Math.max(expectedMean, 1) * 0.05 + Number.EPSILON;
    if (Math.abs(timing.meanMsPerMatch - expectedMean) > meanTolerance) {
      failures.push(
        `supplement metrics timing meanMsPerMatch ${timing.meanMsPerMatch} does not approximate totalElapsedMs / 48 (${expectedMean.toFixed(4)})`,
      );
    }
    if (timing.p95MsPerMatch < timing.medianMsPerMatch) {
      failures.push(
        "supplement metrics timing p95MsPerMatch must be at least medianMsPerMatch",
      );
    }
  }

  if (recomputedMetrics === null) {
    throw new GridGrappleCoverageSupplementBundleError(
      `Grid grapple coverage supplement bundle cross-agreement failed: ${failures.join("; ")}`,
    );
  }

  // Phase 9: rebuild the COMPLETE decision artifact from recomputed metrics
  // and hard checks derived from validated facts and manifest attestations.
  // Exact structural equality with the persisted decision is required.
  const grappleHard = hardChecksFromEvidence(evidenceList);
  const recomputedHardChecks: GridGrappleCoverageHardChecks = {
    allMatchesCompleted:
      recomputedMetrics.execution.totalCompletedRuns ===
      GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
    determinismVerified: manifest.evidence.deterministicReexecutionPassed,
    runtimeIdentityMatches: true,
    recordsValid:
      recomputedMetrics.execution.schemaValidRecords ===
      GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
    reportsValid:
      recomputedMetrics.execution.schemaValidReports ===
      GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
    finalStateAgreementsComplete:
      recomputedMetrics.execution.finalStateAgreements ===
      GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
    chronologyValid: true,
    malformedGrappleEventsAbsent: grappleHard.malformedGrappleEventsAbsent,
    resolverDisagreementsAbsent: grappleHard.resolverDisagreementsAbsent,
    inputsUnmodified: manifest.evidence.inputsUnmodified,
    artifactIntegrityVerified: manifest.evidence.fullBundleReadBackPassed,
    baseV3Valid: true,
    baseV3IdentityMatches: true,
    legacyIsolationVerified: manifest.evidence.legacyIsolationRegressionPassed,
  };
  const rebuiltDecision = buildGridGrappleCoverageDecision({
    supplementId: manifest.supplementId,
    createdAt: manifest.createdAt,
    metrics: recomputedMetrics,
    hardChecks: recomputedHardChecks,
  });
  if (!sameJson(decision, rebuiltDecision)) {
    failures.push(
      "persisted decision artifact does not equal the complete decision rebuilt from the persisted records, metrics and manifest attestations",
    );
  }
  check(
    decision.decision === manifest.supplementDecision,
    "persisted decision does not match the manifest supplement decision",
  );

  // Phase 10: rebuild the COMPLETE addendum from the exact frozen base
  // reference, canonical checksums, the rebuilt decision and the recomputed
  // metrics. Exact structural equality with the persisted addendum is
  // required.
  const g = recomputedMetrics.grapple;
  const rebuiltAddendum = buildGridActivationReadinessAddendum({
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
      supplementId: manifest.supplementId,
      planChecksum: manifest.planChecksum,
      scenarioRegistryChecksum: manifest.scenarioRegistryChecksum,
      decision: rebuiltDecision.decision,
      validGrappleRepositionEvents: g.validGrappleRepositionEvents,
      fighterAAttackerRepositionCount: g.fighterAAttackerRepositionCount,
      fighterBAttackerRepositionCount: g.fighterBAttackerRepositionCount,
      distinctSeedsProducingFighterAAttackerReposition:
        g.distinctSeedsProducingFighterAAttackerReposition,
      distinctSeedsProducingFighterBAttackerReposition:
        g.distinctSeedsProducingFighterBAttackerReposition,
    },
  });
  if (!sameJson(manifest.addendum, rebuiltAddendum)) {
    failures.push(
      "persisted addendum does not equal the complete addendum rebuilt from the frozen base reference, canonical checksums, rebuilt decision and recomputed metrics",
    );
  }
  const recomputedCombined = rebuiltAddendum.combinedReadinessClassification;
  check(
    recomputedCombined === manifest.combinedReadinessClassification &&
      recomputedCombined === manifest.addendum.combinedReadinessClassification,
    "persisted combined readiness classification does not match recomputation",
  );

  // Phase 12: the human report must regenerate byte-for-byte from the exact
  // frozen base reference, canonical registries and plan, recomputed metrics,
  // the rebuilt decision and the rebuilt addendum (never from unverified
  // persisted decision/addendum values).
  const regeneratedReport = buildGridGrappleCoverageReport({
    supplementId: manifest.supplementId,
    createdAt: manifest.createdAt,
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
    planChecksum: manifest.planChecksum,
    metrics: recomputedMetrics,
    decision: rebuiltDecision.decision,
    combinedReadinessClassification: recomputedCombined,
    addendum: rebuiltAddendum,
  });
  check(
    contents[GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT] === regeneratedReport,
    "persisted report.txt does not byte-for-byte match the report regenerated from the persisted artifacts",
  );

  if (failures.length > 0) {
    throw new GridGrappleCoverageSupplementBundleError(
      `Grid grapple coverage supplement bundle cross-agreement failed: ${failures.join("; ")}`,
    );
  }

  return {
    supplementId: manifest.supplementId,
    decision: decision.decision,
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

/**
 * Pure deserializer for the supplemental scenario-registry artifact. Returns
 * a deeply frozen registry or `null` when the artifact is not structurally
 * canonical (including its frozen checksum).
 */
export function deserializeGridGrappleCoverageScenarioRegistry(
  json: string,
): GridGrappleCoverageScenarioRegistry | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    const supplementScenarioFighterSchema = z.object({
      displayName: z.string().min(1),
      buildProposal: machineBuildProposalSchema,
      policy: actionPolicySchema,
    });
    const artifactSchema = z
      .object({
        schemaVersion: z.literal("1"),
        registryId: z.literal("grid-grapple-coverage-scenarios-v1"),
        purpose: z.literal("supplemental-grapple-reposition-coverage"),
        simulatorVersion: z.literal("0.3.0"),
        positioningModel: z.literal("grid-3x3-v1"),
        rulesetVersion: z.literal("0.2.0"),
        catalogueVersion: z.literal("1"),
        scenarios: z.array(
          z.object({
            scenarioId: z.literal("grid-grapple-coverage"),
            familyName: z.string().min(1),
            fighterX: supplementScenarioFighterSchema,
            fighterY: supplementScenarioFighterSchema,
          }),
        ),
        assignments: z.array(
          z.object({
            assignmentId: z.string().min(1),
            scenarioId: z.literal("grid-grapple-coverage"),
            fighterACompetitor: z.enum(["x", "y"]),
            fighterBCompetitor: z.enum(["x", "y"]),
            roleSwapped: z.boolean(),
          }),
        ),
      })
      .strict();
    const result = artifactSchema.safeParse(parsed);
    if (!result.success) return null;
    const artifact = result.data;
    const registry: GridGrappleCoverageScenarioRegistry = Object.freeze({
      schemaVersion: "1",
      registryId: artifact.registryId,
      purpose: artifact.purpose,
      simulatorVersion: artifact.simulatorVersion,
      positioningModel: artifact.positioningModel,
      rulesetVersion: artifact.rulesetVersion,
      catalogueVersion: artifact.catalogueVersion,
      scenarios: Object.freeze(
        artifact.scenarios.map((scenario) =>
          Object.freeze({
            scenarioId: scenario.scenarioId,
            familyName: scenario.familyName,
            fighterX: deepFreezeSupplementValue(scenario.fighterX),
            fighterY: deepFreezeSupplementValue(scenario.fighterY),
          }),
        ),
      ),
      assignments: Object.freeze(
        artifact.assignments.map((assignment) => deepFreezeSupplementValue(assignment)),
      ),
    });
    // Structural canonicity through the frozen checksum.
    if (
      gridGrappleCoverageScenarioRegistryChecksum(registry) !==
      GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM
    ) {
      return null;
    }
    return registry;
  } catch {
    return null;
  }
}

function deepFreezeSupplementValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => deepFreezeSupplementValue(item))) as T;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const clone: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
      clone[key] = deepFreezeSupplementValue(record[key]);
    }
    return Object.freeze(clone) as T;
  }
  return value;
}

export type { GridGrappleCoverageRun, GridGrappleCoverageRunPlan };
export { GRID_GRAPPLE_COVERAGE_SUPPLEMENT_SUITE_ID };
