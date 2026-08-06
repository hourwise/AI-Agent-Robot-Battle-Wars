import { z } from "zod";
import { sha256Hex } from "../canary/grid-canary-digest.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import { buildReviewUserPrompt } from "../prompts/review-prompt.v1.js";
import { GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT } from "../readiness/grid-opt-in-beta-source-snapshot.js";
import { validateBuild } from "../validation/build-validator.js";
import type { ValidatedBuild } from "../validation/validation.types.js";
import {
  getComponentQualificationConfig,
  getComponentQualificationMetadata,
} from "../simulator/component-qualification-registry.js";
import {
  assertGridReadinessRecordReportFinalAgreement,
  gridRecordToGridResult,
  inspectGridReadinessRecordEvidence,
} from "../readiness/record-evidence.js";
import { renderAsciiReplay } from "../replay/ascii/ascii-replay-renderer.js";
import { renderTextReplay } from "../replay/text-replay-renderer.js";
import {
  deserializeFactualMatchReport,
  isFactualReportV2,
  validateFactualMatchReport,
  type FactualMatchReportV2,
} from "../schemas/factual-report.schema.js";
import {
  deserializeMatchRecord,
  isV3Record,
  validateMatchRecord,
  type MatchRecordV3,
} from "../schemas/match-record.schema.js";
import { POSITIONING_MODEL_GRID } from "../schemas/positioning.schema.js";
import {
  GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
  GRID_OPT_IN_BETA_CONTRACT_ID,
} from "../readiness/grid-opt-in-beta-contract.js";
import {
  GRID_OPT_IN_BETA_COMPONENT_QUALIFICATION_ID,
  GRID_OPT_IN_BETA_DISCLAIMER,
  GRID_OPT_IN_BETA_GOVERNANCE_ARTIFACT_HASHES,
  GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ID,
  GRID_OPT_IN_BETA_GOVERNANCE_OUTCOME,
  GRID_OPT_IN_BETA_MATCH_COMMAND,
  GRID_OPT_IN_BETA_MATCH_IMPLEMENTATION_ID,
  GRID_OPT_IN_BETA_RUNTIME_IDENTITY,
} from "./grid-beta-identity.js";
import {
  GRID_BETA_FIGHTER_ID_PATTERN,
  parseGridBetaFighterSpec,
  serializeGridBetaFighterSpec,
  type GridBetaFighterSpecV1,
} from "./grid-beta-fighter-spec.js";
import {
  assertCanonicalGridBetaPreflightPass,
  type GridBetaLegacyIsolationPreflightV1,
} from "./grid-beta-legacy-preflight.js";
import { gridBetaMatchResultChecksum } from "./grid-beta-execution-core.js";
import {
  isGridBetaSuspensionTrigger,
  type GridBetaSuspensionTrigger,
} from "./grid-beta-suspension.js";

/**
 * Immutable grid beta match bundle (Milestone 0.2C Phase 3G, Phases 9 and 10).
 *
 * Each beta match publishes exactly ten regular files under
 * `data/beta/grid-matches/<matchId>/`: `manifest.json`, `selection.json`,
 * `fighter-a.json`, `fighter-b.json`, `execution-attestation.json`,
 * `match.json`, `factual-report.json`, `text-replay.txt`, `ascii-replay.txt`
 * and `review-prompt.txt`. The manifest is written last. The complete
 * cross-agreement validator independently requires the exact inventory,
 * digests, identities, explicit selection/acknowledgement, frozen governance
 * hashes, strict fighter specs, schema-v3 record, schema-v2 report,
 * record/report and replay agreement, exact fighter/config/seed/C2/runtime
 * binding, empty agent usage, canonical event chronology and byte-for-byte
 * regeneration of every derived artifact.
 */

export const GRID_BETA_MATCH_MANIFEST_FILE = "manifest.json" as const;
export const GRID_BETA_MATCH_SELECTION_ARTIFACT = "selection.json" as const;
export const GRID_BETA_MATCH_FIGHTER_A_ARTIFACT = "fighter-a.json" as const;
export const GRID_BETA_MATCH_FIGHTER_B_ARTIFACT = "fighter-b.json" as const;
export const GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT =
  "execution-attestation.json" as const;
export const GRID_BETA_MATCH_RECORD_ARTIFACT = "match.json" as const;
export const GRID_BETA_MATCH_FACTUAL_REPORT_ARTIFACT = "factual-report.json" as const;
export const GRID_BETA_MATCH_TEXT_REPLAY_ARTIFACT = "text-replay.txt" as const;
export const GRID_BETA_MATCH_ASCII_REPLAY_ARTIFACT = "ascii-replay.txt" as const;
export const GRID_BETA_MATCH_REVIEW_PROMPT_ARTIFACT = "review-prompt.txt" as const;

export const GRID_BETA_MATCH_BUNDLE_ENTRIES: readonly string[] = Object.freeze([
  GRID_BETA_MATCH_MANIFEST_FILE,
  GRID_BETA_MATCH_SELECTION_ARTIFACT,
  GRID_BETA_MATCH_FIGHTER_A_ARTIFACT,
  GRID_BETA_MATCH_FIGHTER_B_ARTIFACT,
  GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT,
  GRID_BETA_MATCH_RECORD_ARTIFACT,
  GRID_BETA_MATCH_FACTUAL_REPORT_ARTIFACT,
  GRID_BETA_MATCH_TEXT_REPLAY_ARTIFACT,
  GRID_BETA_MATCH_ASCII_REPLAY_ARTIFACT,
  GRID_BETA_MATCH_REVIEW_PROMPT_ARTIFACT,
]);

export const GRID_BETA_MATCH_NON_MANIFEST_ARTIFACTS: readonly string[] = Object.freeze(
  GRID_BETA_MATCH_BUNDLE_ENTRIES.filter((name) => name !== GRID_BETA_MATCH_MANIFEST_FILE),
);

// ── Selection v1 ────────────────────────────────────────────────────────────

export const gridBetaLegacyIsolationPreflightSchema = z
  .object({
    status: z.enum(["pass", "fail"]),
    trigger: z.custom<GridBetaSuspensionTrigger | null>(
      (value) => value === null || isGridBetaSuspensionTrigger(value),
    ),
    failures: z.array(z.string()),
    protectedFilesEqualReviewedSnapshot: z.boolean(),
    normalMatchCallsLegacyRunMatch: z.boolean(),
    normalSeriesCallsLegacyRunMatch: z.boolean(),
    neitherNormalPathInvokesGridOrBeta: z.boolean(),
    globalVersions020020: z.boolean(),
    catalogueStill1: z.boolean(),
    qualificationFrozen: z.boolean(),
    gridIdentitySeparate: z.boolean(),
    bothCanarySourcesFrozen: z.boolean(),
    schemaV2LegacyConversionPresent: z.boolean(),
    schemaV3GridConversionAndReplayPresent: z.boolean(),
  })
  .strict();

export const gridBetaSelectionV1Schema = z
  .object({
    schemaVersion: z.literal("1"),
    kind: z.literal("grid-beta-selection"),
    implementationId: z.literal(GRID_OPT_IN_BETA_MATCH_IMPLEMENTATION_ID),
    contractId: z.literal(GRID_OPT_IN_BETA_CONTRACT_ID),
    contractChecksum: z.literal(GRID_OPT_IN_BETA_CONTRACT_CHECKSUM),
    governanceDecisionId: z.literal(GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ID),
    governanceOutcome: z.literal(GRID_OPT_IN_BETA_GOVERNANCE_OUTCOME),
    governanceArtifactHashes: z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/)),
    command: z.literal(GRID_OPT_IN_BETA_MATCH_COMMAND),
    acknowledgement: z.literal(true),
    seed: z.number().int().nonnegative(),
    fighterA: z
      .object({
        fighterId: z.string().regex(GRID_BETA_FIGHTER_ID_PATTERN),
        checksum: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .strict(),
    fighterB: z
      .object({
        fighterId: z.string().regex(GRID_BETA_FIGHTER_ID_PATTERN),
        checksum: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .strict(),
    runtimeIdentity: z
      .object({
        simulatorVersion: z.literal(GRID_OPT_IN_BETA_RUNTIME_IDENTITY.simulatorVersion),
        positioningModel: z.literal(GRID_OPT_IN_BETA_RUNTIME_IDENTITY.positioningModel),
        rulesetVersion: z.literal(GRID_OPT_IN_BETA_RUNTIME_IDENTITY.rulesetVersion),
        catalogueVersion: z.literal(GRID_OPT_IN_BETA_RUNTIME_IDENTITY.catalogueVersion),
      })
      .strict(),
    componentQualificationId: z.literal(GRID_OPT_IN_BETA_COMPONENT_QUALIFICATION_ID),
    componentQualificationChecksum: z.literal("13548462df34a183"),
    protectedSourcePreflight: gridBetaLegacyIsolationPreflightSchema,
    disclaimer: z.literal(GRID_OPT_IN_BETA_DISCLAIMER),
  })
  .strict();

export interface GridBetaSelectionV1 {
  readonly schemaVersion: "1";
  readonly kind: "grid-beta-selection";
  readonly implementationId: "grid-opt-in-beta-match-v1";
  readonly contractId: "grid-opt-in-beta-contract-v1";
  readonly contractChecksum: string;
  readonly governanceDecisionId: string;
  readonly governanceOutcome: "approved_for_bounded_opt_in_beta_implementation";
  readonly governanceArtifactHashes: Readonly<Record<string, string>>;
  readonly command: "match:grid:beta";
  readonly acknowledgement: true;
  readonly seed: number;
  readonly fighterA: { readonly fighterId: string; readonly checksum: string };
  readonly fighterB: { readonly fighterId: string; readonly checksum: string };
  readonly runtimeIdentity: {
    readonly simulatorVersion: "0.3.0";
    readonly positioningModel: "grid-3x3-v1";
    readonly rulesetVersion: "0.2.0";
    readonly catalogueVersion: "1";
  };
  readonly componentQualificationId: "component-impact-c2";
  readonly componentQualificationChecksum: string;
  readonly protectedSourcePreflight: GridBetaLegacyIsolationPreflightV1;
  readonly disclaimer: string;
}

export interface BuildGridBetaSelectionInput {
  readonly seed: number;
  readonly fighterA: { fighterId: string; checksum: string };
  readonly fighterB: { fighterId: string; checksum: string };
  readonly protectedSourcePreflight: GridBetaLegacyIsolationPreflightV1;
}

export function buildGridBetaSelection(
  input: BuildGridBetaSelectionInput,
): GridBetaSelectionV1 {
  // The persisted preflight must be the exact canonical pass (Phase 3G.1
  // Phase 8): `status: pass`, `trigger: null`, `failures: []` and every
  // detailed boolean exactly `true`.
  assertCanonicalGridBetaPreflightPass(input.protectedSourcePreflight);
  const selection: GridBetaSelectionV1 = {
    schemaVersion: "1",
    kind: "grid-beta-selection",
    implementationId: GRID_OPT_IN_BETA_MATCH_IMPLEMENTATION_ID,
    contractId: GRID_OPT_IN_BETA_CONTRACT_ID,
    contractChecksum: GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
    governanceDecisionId: GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ID,
    governanceOutcome: GRID_OPT_IN_BETA_GOVERNANCE_OUTCOME,
    governanceArtifactHashes: { ...GRID_OPT_IN_BETA_GOVERNANCE_ARTIFACT_HASHES },
    command: GRID_OPT_IN_BETA_MATCH_COMMAND,
    acknowledgement: true,
    seed: input.seed,
    fighterA: input.fighterA,
    fighterB: input.fighterB,
    runtimeIdentity: { ...GRID_OPT_IN_BETA_RUNTIME_IDENTITY },
    componentQualificationId: GRID_OPT_IN_BETA_COMPONENT_QUALIFICATION_ID,
    componentQualificationChecksum: "13548462df34a183",
    protectedSourcePreflight: input.protectedSourcePreflight,
    disclaimer: GRID_OPT_IN_BETA_DISCLAIMER,
  };
  const parsed = gridBetaSelectionV1Schema.safeParse(selection);
  if (!parsed.success) {
    throw new Error(
      `Grid beta selection failed its authoritative schema: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export function serializeGridBetaSelection(selection: GridBetaSelectionV1): string {
  return JSON.stringify(selection, null, 2);
}

export function deserializeGridBetaSelection(
  json: string,
): { ok: true; selection: GridBetaSelectionV1 } | { ok: false; errors: string } {
  try {
    const result = gridBetaSelectionV1Schema.safeParse(JSON.parse(json));
    if (!result.success) return { ok: false, errors: result.error.message };
    return { ok: true, selection: result.data };
  } catch (e) {
    return { ok: false, errors: e instanceof Error ? e.message : String(e) };
  }
}

// ── Execution attestation v1 ────────────────────────────────────────────────

export const gridBetaExecutionAttestationV1Schema = z
  .object({
    schemaVersion: z.literal("1"),
    kind: z.literal("grid-beta-execution-attestation"),
    matchId: z.string().uuid(),
    primaryResultChecksum: z.string().regex(/^[0-9a-f]{64}$/),
    repeatResultChecksum: z.string().regex(/^[0-9a-f]{64}$/),
    deterministicEquality: z.literal(true),
    noLegacyFallback: z.literal(true),
    emptyAgentUsage: z.literal(true),
    governanceBytesUnchangedBeforeSimulation: z.literal(true),
    governanceBytesUnchangedBeforePublication: z.literal(true),
    suspensionMarkerAbsentBeforeGovernanceAnchor: z.literal(true),
    suspensionMarkerAbsentBeforeSimulation: z.literal(true),
    suspensionMarkerAbsentBeforePublication: z.literal(true),
    recordReportAgreement: z.literal(true),
    replayReconstructionAgreement: z.literal(true),
    bundleValidationStatus: z.literal("validated"),
  })
  .strict();

export interface GridBetaExecutionAttestationV1 {
  readonly schemaVersion: "1";
  readonly kind: "grid-beta-execution-attestation";
  readonly matchId: string;
  readonly primaryResultChecksum: string;
  readonly repeatResultChecksum: string;
  readonly deterministicEquality: true;
  readonly noLegacyFallback: true;
  readonly emptyAgentUsage: true;
  readonly governanceBytesUnchangedBeforeSimulation: true;
  readonly governanceBytesUnchangedBeforePublication: true;
  readonly suspensionMarkerAbsentBeforeGovernanceAnchor: true;
  readonly suspensionMarkerAbsentBeforeSimulation: true;
  readonly suspensionMarkerAbsentBeforePublication: true;
  readonly recordReportAgreement: true;
  readonly replayReconstructionAgreement: true;
  readonly bundleValidationStatus: "validated";
}

export interface BuildGridBetaExecutionAttestationInput {
  readonly matchId: string;
  readonly primaryResultChecksum: string;
  readonly repeatResultChecksum: string;
  /** Confirmed outcome supplied by the service; the builder fails if false. */
  readonly governanceBytesUnchangedBeforeSimulation: boolean;
  readonly governanceBytesUnchangedBeforePublication: boolean;
  readonly suspensionMarkerAbsentBeforeGovernanceAnchor: boolean;
  readonly suspensionMarkerAbsentBeforeSimulation: boolean;
  readonly suspensionMarkerAbsentBeforePublication: boolean;
  readonly protectedSourcePreflightPass: boolean;
  readonly deterministicEquality: boolean;
  readonly noLegacyFallback: boolean;
  readonly emptyAgentUsage: boolean;
  readonly recordReportAgreement: boolean;
  readonly replayReconstructionAgreement: boolean;
  readonly temporaryBundleValidation: boolean;
}

export function buildGridBetaExecutionAttestation(
  input: BuildGridBetaExecutionAttestationInput,
): GridBetaExecutionAttestationV1 {
  const confirmations: ReadonlyArray<[string, boolean]> = [
    [
      "governance bytes unchanged before simulation",
      input.governanceBytesUnchangedBeforeSimulation,
    ],
    [
      "governance bytes unchanged before publication",
      input.governanceBytesUnchangedBeforePublication,
    ],
    [
      "suspension marker absent before governance anchor",
      input.suspensionMarkerAbsentBeforeGovernanceAnchor,
    ],
    [
      "suspension marker absent before simulation",
      input.suspensionMarkerAbsentBeforeSimulation,
    ],
    [
      "suspension marker absent before publication",
      input.suspensionMarkerAbsentBeforePublication,
    ],
    ["protected-source preflight pass", input.protectedSourcePreflightPass],
    ["deterministic equality", input.deterministicEquality],
    ["no legacy fallback", input.noLegacyFallback],
    ["empty agent usage", input.emptyAgentUsage],
    ["record/report agreement", input.recordReportAgreement],
    ["replay reconstruction agreement", input.replayReconstructionAgreement],
    ["temporary bundle validation", input.temporaryBundleValidation],
  ];
  const unconfirmed = confirmations
    .filter(([, confirmed]) => confirmed !== true)
    .map(([label]) => label);
  if (unconfirmed.length > 0) {
    throw new Error(
      `Grid beta execution attestation cannot be built: unconfirmed safety outcomes: ${unconfirmed.join(", ")}`,
    );
  }
  const attestation: GridBetaExecutionAttestationV1 = {
    schemaVersion: "1",
    kind: "grid-beta-execution-attestation",
    matchId: input.matchId,
    primaryResultChecksum: input.primaryResultChecksum,
    repeatResultChecksum: input.repeatResultChecksum,
    deterministicEquality: true,
    noLegacyFallback: true,
    emptyAgentUsage: true,
    governanceBytesUnchangedBeforeSimulation: true,
    governanceBytesUnchangedBeforePublication: true,
    suspensionMarkerAbsentBeforeGovernanceAnchor: true,
    suspensionMarkerAbsentBeforeSimulation: true,
    suspensionMarkerAbsentBeforePublication: true,
    recordReportAgreement: true,
    replayReconstructionAgreement: true,
    bundleValidationStatus: "validated",
  };
  const parsed = gridBetaExecutionAttestationV1Schema.safeParse(attestation);
  if (!parsed.success) {
    throw new Error(
      `Grid beta execution attestation failed its authoritative schema: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export function serializeGridBetaExecutionAttestation(
  attestation: GridBetaExecutionAttestationV1,
): string {
  return JSON.stringify(attestation, null, 2);
}

export function deserializeGridBetaExecutionAttestation(
  json: string,
):
  | { ok: true; attestation: GridBetaExecutionAttestationV1 }
  | { ok: false; errors: string } {
  try {
    const result = gridBetaExecutionAttestationV1Schema.safeParse(JSON.parse(json));
    if (!result.success) return { ok: false, errors: result.error.message };
    return { ok: true, attestation: result.data };
  } catch (e) {
    return { ok: false, errors: e instanceof Error ? e.message : String(e) };
  }
}

// ── Manifest v1 ─────────────────────────────────────────────────────────────

export const gridBetaMatchManifestV1Schema = z
  .object({
    schemaVersion: z.literal("1"),
    kind: z.literal("grid-beta-match-manifest"),
    matchId: z.string().uuid(),
    createdAt: z.string().datetime(),
    implementationId: z.literal(GRID_OPT_IN_BETA_MATCH_IMPLEMENTATION_ID),
    contractId: z.literal(GRID_OPT_IN_BETA_CONTRACT_ID),
    contractChecksum: z.literal(GRID_OPT_IN_BETA_CONTRACT_CHECKSUM),
    governanceDecisionId: z.literal(GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ID),
    governanceOutcome: z.literal(GRID_OPT_IN_BETA_GOVERNANCE_OUTCOME),
    reviewedSourceCommit: z.literal(GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT),
    runtimeIdentity: z
      .object({
        simulatorVersion: z.literal(GRID_OPT_IN_BETA_RUNTIME_IDENTITY.simulatorVersion),
        positioningModel: z.literal(GRID_OPT_IN_BETA_RUNTIME_IDENTITY.positioningModel),
        rulesetVersion: z.literal(GRID_OPT_IN_BETA_RUNTIME_IDENTITY.rulesetVersion),
        catalogueVersion: z.literal(GRID_OPT_IN_BETA_RUNTIME_IDENTITY.catalogueVersion),
      })
      .strict(),
    schemaVersions: z
      .object({
        record: z.literal("3"),
        report: z.literal("2"),
      })
      .strict(),
    result: z
      .object({
        winner: z.string().nullable(),
        method: z.string(),
        rounds: z.number().int().nonnegative(),
      })
      .strict(),
    artifacts: z
      .object({
        manifest: z.literal(GRID_BETA_MATCH_MANIFEST_FILE),
        selection: z.literal(GRID_BETA_MATCH_SELECTION_ARTIFACT),
        fighterA: z.literal(GRID_BETA_MATCH_FIGHTER_A_ARTIFACT),
        fighterB: z.literal(GRID_BETA_MATCH_FIGHTER_B_ARTIFACT),
        executionAttestation: z.literal(GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT),
        match: z.literal(GRID_BETA_MATCH_RECORD_ARTIFACT),
        factualReport: z.literal(GRID_BETA_MATCH_FACTUAL_REPORT_ARTIFACT),
        textReplay: z.literal(GRID_BETA_MATCH_TEXT_REPLAY_ARTIFACT),
        asciiReplay: z.literal(GRID_BETA_MATCH_ASCII_REPLAY_ARTIFACT),
        reviewPrompt: z.literal(GRID_BETA_MATCH_REVIEW_PROMPT_ARTIFACT),
      })
      .strict(),
    digests: z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/)),
    fighterChecksums: z
      .object({
        fighterA: z.string().regex(/^[0-9a-f]{64}$/),
        fighterB: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .strict(),
    safety: z
      .object({
        protectedSourcePreflightStatus: z.enum(["pass", "fail"]),
        suspensionStatus: z.enum(["active", "clear"]),
      })
      .strict(),
    disclaimer: z.literal(GRID_OPT_IN_BETA_DISCLAIMER),
  })
  .strict();

export type GridBetaMatchManifestV1 = z.infer<typeof gridBetaMatchManifestV1Schema>;

export interface BuildGridBetaMatchManifestInput {
  readonly matchId: string;
  readonly createdAt: string;
  readonly result: { winner: string | null; method: string; rounds: number };
  readonly fighterChecksums: { fighterA: string; fighterB: string };
  readonly protectedSourcePreflightStatus: "pass" | "fail";
  readonly suspensionStatus: "active" | "clear";
  readonly digests: Record<string, string>;
}

export function buildGridBetaMatchManifest(
  input: BuildGridBetaMatchManifestInput,
): GridBetaMatchManifestV1 {
  const manifest: GridBetaMatchManifestV1 = {
    schemaVersion: "1",
    kind: "grid-beta-match-manifest",
    matchId: input.matchId,
    createdAt: input.createdAt,
    implementationId: GRID_OPT_IN_BETA_MATCH_IMPLEMENTATION_ID,
    contractId: GRID_OPT_IN_BETA_CONTRACT_ID,
    contractChecksum: GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
    governanceDecisionId: GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ID,
    governanceOutcome: GRID_OPT_IN_BETA_GOVERNANCE_OUTCOME,
    reviewedSourceCommit: GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT,
    runtimeIdentity: { ...GRID_OPT_IN_BETA_RUNTIME_IDENTITY },
    schemaVersions: { record: "3", report: "2" },
    result: {
      winner: input.result.winner,
      method: input.result.method,
      rounds: input.result.rounds,
    },
    artifacts: {
      manifest: GRID_BETA_MATCH_MANIFEST_FILE,
      selection: GRID_BETA_MATCH_SELECTION_ARTIFACT,
      fighterA: GRID_BETA_MATCH_FIGHTER_A_ARTIFACT,
      fighterB: GRID_BETA_MATCH_FIGHTER_B_ARTIFACT,
      executionAttestation: GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT,
      match: GRID_BETA_MATCH_RECORD_ARTIFACT,
      factualReport: GRID_BETA_MATCH_FACTUAL_REPORT_ARTIFACT,
      textReplay: GRID_BETA_MATCH_TEXT_REPLAY_ARTIFACT,
      asciiReplay: GRID_BETA_MATCH_ASCII_REPLAY_ARTIFACT,
      reviewPrompt: GRID_BETA_MATCH_REVIEW_PROMPT_ARTIFACT,
    },
    digests: { ...input.digests },
    fighterChecksums: {
      fighterA: input.fighterChecksums.fighterA,
      fighterB: input.fighterChecksums.fighterB,
    },
    safety: {
      protectedSourcePreflightStatus: input.protectedSourcePreflightStatus,
      suspensionStatus: input.suspensionStatus,
    },
    disclaimer: GRID_OPT_IN_BETA_DISCLAIMER,
  };
  const parsed = gridBetaMatchManifestV1Schema.safeParse(manifest);
  if (!parsed.success) {
    throw new Error(
      `Grid beta match manifest failed its authoritative schema: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export function serializeGridBetaMatchManifest(
  manifest: GridBetaMatchManifestV1,
): string {
  return JSON.stringify(manifest, null, 2);
}

export function deserializeGridBetaMatchManifest(
  json: string,
): { ok: true; manifest: GridBetaMatchManifestV1 } | { ok: false; errors: string } {
  try {
    const result = gridBetaMatchManifestV1Schema.safeParse(JSON.parse(json));
    if (!result.success) return { ok: false, errors: result.error.message };
    return { ok: true, manifest: result.data };
  } catch (e) {
    return { ok: false, errors: e instanceof Error ? e.message : String(e) };
  }
}

// ── Complete bundle validator ───────────────────────────────────────────────

export class GridBetaMatchBundleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridBetaMatchBundleError";
  }
}

export interface GridBetaMatchBundleValidationResult {
  readonly matchId: string;
  readonly validationStatus: "validated";
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Complete cross-agreement validation of the ten-file beta match bundle.
 * Independently requires the exact inventory, digests, implementation/
 * contract/governance identities, explicit selection and acknowledgement,
 * frozen governance hashes, strict fighter-spec schemas/checksums,
 * catalogue-valid builds and valid policies, schema-v3 record, schema-v2
 * report, record/report identity and final-state agreement, record config and
 * initial-state binding to the fighter artifacts, exact seed and C2
 * qualification, exact runtime identity, empty agent usage, canonical event
 * chronology, byte-for-byte regeneration of text replay, ASCII replay and
 * review prompt, result-summary agreement, the mandatory disclaimer and the
 * no-legacy/fallback attestation.
 */
export function validateGridBetaMatchBundle(
  contents: Record<string, string>,
): GridBetaMatchBundleValidationResult {
  const failures: string[] = [];
  const check = (ok: boolean, message: string): void => {
    if (!ok) failures.push(message);
  };

  // 1. Exact inventory.
  for (const name of GRID_BETA_MATCH_BUNDLE_ENTRIES) {
    check(typeof contents[name] === "string", `beta bundle is missing artifact ${name}`);
  }
  for (const name of Object.keys(contents)) {
    if (!(GRID_BETA_MATCH_BUNDLE_ENTRIES as readonly string[]).includes(name)) {
      check(false, `beta bundle contains unexpected artifact ${name}`);
    }
  }

  const manifestParsed = contents[GRID_BETA_MATCH_MANIFEST_FILE]
    ? deserializeGridBetaMatchManifest(contents[GRID_BETA_MATCH_MANIFEST_FILE]!)
    : { ok: false as const, errors: "missing manifest" };
  const selectionParsed = contents[GRID_BETA_MATCH_SELECTION_ARTIFACT]
    ? deserializeGridBetaSelection(contents[GRID_BETA_MATCH_SELECTION_ARTIFACT]!)
    : { ok: false as const, errors: "missing selection" };
  const attestationParsed = contents[GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT]
    ? deserializeGridBetaExecutionAttestation(
        contents[GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT]!,
      )
    : { ok: false as const, errors: "missing attestation" };
  if (!manifestParsed.ok) check(false, `invalid manifest: ${manifestParsed.errors}`);
  if (!selectionParsed.ok) check(false, `invalid selection: ${selectionParsed.errors}`);
  if (!attestationParsed.ok)
    check(false, `invalid attestation: ${attestationParsed.errors}`);

  if (
    failures.length > 0 ||
    !manifestParsed.ok ||
    !selectionParsed.ok ||
    !attestationParsed.ok
  ) {
    throw new GridBetaMatchBundleError(
      `Grid beta match bundle is invalid: ${failures.join("; ")}`,
    );
  }

  const manifest = manifestParsed.manifest;
  const selection = selectionParsed.selection;
  const attestation = attestationParsed.attestation;

  // 2. All non-manifest digests.
  const digests: Record<string, string> = {};
  for (const name of GRID_BETA_MATCH_NON_MANIFEST_ARTIFACTS) {
    digests[name] = sha256Hex(contents[name]!);
  }
  check(
    sameJson(digests, manifest.digests),
    "beta bundle digests do not match the manifest",
  );

  // 3. Fighter artifacts: parsed through the same authoritative path used by
  //    live loading (`parseGridBetaFighterSpec`), so strict fighter schema,
  //    identifier agreement, display-name sanitisation, display-name/machine-
  //    name agreement, catalogue-v1 build validation, policy validation,
  //    canonical byte serialization and the deterministic checksum are all
  //    enforced here. The authoritative reconstructed build is retained for
  //    the complete build binding below.
  const fighterA = parseFighterArtifact(
    contents[GRID_BETA_MATCH_FIGHTER_A_ARTIFACT],
    selection.fighterA.fighterId,
    check,
    "fighter-a",
  );
  const fighterB = parseFighterArtifact(
    contents[GRID_BETA_MATCH_FIGHTER_B_ARTIFACT],
    selection.fighterB.fighterId,
    check,
    "fighter-b",
  );
  if (fighterA) {
    check(
      fighterA.checksum === selection.fighterA.checksum,
      "fighter-a checksum does not match the selection",
    );
  }
  if (fighterB) {
    check(
      fighterB.checksum === selection.fighterB.checksum,
      "fighter-b checksum does not match the selection",
    );
  }
  check(
    manifest.fighterChecksums.fighterA === selection.fighterA.checksum &&
      manifest.fighterChecksums.fighterB === selection.fighterB.checksum,
    "manifest fighter checksums do not match the selection",
  );

  // 4. Record: schema v3.
  const recordParsed = deserializeMatchRecord(contents[GRID_BETA_MATCH_RECORD_ARTIFACT]!);
  if (!recordParsed.ok) {
    check(false, `invalid match record: ${recordParsed.errors}`);
  } else if (!isV3Record(recordParsed.record)) {
    check(false, "match record must be schema v3");
  }
  const record: MatchRecordV3 | null =
    recordParsed.ok && isV3Record(recordParsed.record) ? recordParsed.record : null;
  if (record) {
    const recordValidation = validateMatchRecord(record);
    check(recordValidation.ok, "match record failed authoritative schema validation");
  }

  // 5. Report: schema v2.
  const reportParsed = deserializeFactualMatchReport(
    contents[GRID_BETA_MATCH_FACTUAL_REPORT_ARTIFACT]!,
  );
  if (!reportParsed.ok) {
    check(false, `invalid factual report: ${reportParsed.errors}`);
  } else if (!isFactualReportV2(reportParsed.report)) {
    check(false, "factual report must be schema v2");
  }
  const report: FactualMatchReportV2 | null =
    reportParsed.ok && isFactualReportV2(reportParsed.report)
      ? reportParsed.report
      : null;
  if (report) {
    const reportValidation = validateFactualMatchReport(report);
    check(reportValidation.ok, "factual report failed authoritative schema validation");
  }

  if (record && report) {
    // 6. Record/report identity and final-state agreement.
    check(record.matchId === report.matchId, "record and report match IDs disagree");
    try {
      assertGridReadinessRecordReportFinalAgreement(record, report);
    } catch (e) {
      check(false, e instanceof Error ? e.message : String(e));
    }
    // 7. Canonical event chronology + readiness evidence inspection.
    try {
      inspectGridReadinessRecordEvidence(record);
    } catch (e) {
      check(false, e instanceof Error ? e.message : String(e));
    }
    // 8. Empty agent usage.
    check(record.agentUsage.length === 0, "record agent usage must be empty");
  }

  // 9. Exact seed and complete C2 metadata binding (Phase 3G.1 Phase 7). The
  //    canonical C2 metadata is derived from the authoritative registry and
  //    must agree exactly across the selection, the record and the record
  //    config: `id` component-impact-c2, `model` linear-component-impact,
  //    `configChecksum` 13548462df34a183. A record that retains the C2 ID while
  //    changing the model or checksum is rejected.
  const c2Config = getComponentQualificationConfig("component-impact-c2");
  const c2Metadata = getComponentQualificationMetadata(c2Config);
  check(selection.seed === record?.seed, "selection seed disagrees with the record");
  check(
    selection.componentQualificationId === c2Metadata.id &&
      selection.componentQualificationChecksum === c2Metadata.configChecksum,
    "selection C2 component qualification metadata is not the complete canonical C2 metadata",
  );
  check(
    record?.componentQualificationId === c2Metadata.id &&
      record.componentQualification !== undefined &&
      sameJson(record.componentQualification, c2Metadata) &&
      record?.config.componentQualificationId === c2Metadata.id &&
      record.config.componentQualification !== undefined &&
      sameJson(record.config.componentQualification, c2Metadata),
    "record C2 component qualification metadata is not the complete canonical C2 metadata",
  );

  // 10. Exact runtime identity.
  check(
    record?.simulatorVersion === "0.3.0" &&
      record?.positioningModel === "grid-3x3-v1" &&
      record?.rulesetVersion === "0.2.0" &&
      record?.catalogueVersion === "1",
    "record does not carry the exact frozen grid runtime identity",
  );

  // 11. Complete validated-build binding (Phase 3G.1 Phase 6): the complete
  //     authoritative reconstructed build must equal the record config and
  //     initial-state builds across every field (proposal, total cost, armour
  //     cost, total armour points, catalogue version). Record config and
  //     initial-state builds must match one another completely, not only
  //     through their proposals. Policies must match exactly.
  if (record && fighterA && fighterB) {
    check(
      sameJson(fighterA.build, record.config.fighterA.build) &&
        sameJson(fighterA.build, record.initialState.fighterA.build) &&
        sameJson(fighterB.build, record.config.fighterB.build) &&
        sameJson(fighterB.build, record.initialState.fighterB.build) &&
        sameJson(record.config.fighterA.build, record.initialState.fighterA.build) &&
        sameJson(record.config.fighterB.build, record.initialState.fighterB.build),
      "record config/initial-state builds do not match the authoritative reconstructed builds",
    );
    check(
      sameJson(fighterA.spec.policy, record.config.fighterA.policy) &&
        sameJson(fighterB.spec.policy, record.config.fighterB.policy),
      "record config policies do not match the fighter artifact policies",
    );
  }

  // 12. Byte-for-byte regeneration of derived artifacts.
  if (record && report) {
    const reconstructed = gridRecordToGridResult(record);
    check(
      contents[GRID_BETA_MATCH_TEXT_REPLAY_ARTIFACT] === renderTextReplay(reconstructed),
      "text-replay.txt does not byte-for-byte match the regenerated text replay",
    );
    check(
      contents[GRID_BETA_MATCH_ASCII_REPLAY_ARTIFACT] ===
        renderAsciiReplay(reconstructed, { mode: "ascii" }, POSITIONING_MODEL_GRID),
      "ascii-replay.txt does not byte-for-byte match the regenerated ASCII replay",
    );
    check(
      contents[GRID_BETA_MATCH_REVIEW_PROMPT_ARTIFACT] === buildReviewUserPrompt(report),
      "review-prompt.txt does not byte-for-byte match the regenerated review prompt",
    );
  }

  // 13. Manifest identity, result summary, safety, disclaimer, attestation,
  //     primary execution checksum binding and exact match-identity agreement.
  check(
    manifest.matchId === record?.matchId && manifest.matchId === attestation.matchId,
    "manifest/attestation match ID does not agree with the record",
  );
  check(
    manifest.createdAt === record?.createdAt,
    "manifest createdAt does not agree with the record createdAt",
  );
  check(
    manifest.result.winner === record?.result.winner &&
      manifest.result.method === record?.result.method &&
      manifest.result.rounds === record?.rounds,
    "manifest result summary does not agree with the record",
  );
  // Canonical successful preflight (Phase 8): status pass, trigger null,
  // failures empty and every detailed boolean exactly true. A `status: pass`
  // with contradictory detailed values is rejected.
  let canonicalPreflight = true;
  try {
    assertCanonicalGridBetaPreflightPass(selection.protectedSourcePreflight);
  } catch {
    canonicalPreflight = false;
  }
  check(
    canonicalPreflight,
    "selection protected-source preflight is not the canonical pass",
  );
  check(
    manifest.safety.protectedSourcePreflightStatus === "pass" &&
      manifest.safety.suspensionStatus === "clear",
    "manifest safety must be protected-source preflight pass with a clear suspension status",
  );
  check(
    manifest.disclaimer === GRID_OPT_IN_BETA_DISCLAIMER &&
      selection.disclaimer === GRID_OPT_IN_BETA_DISCLAIMER,
    "beta disclaimer is missing from the manifest or selection",
  );
  check(
    attestation.deterministicEquality === true &&
      attestation.noLegacyFallback === true &&
      attestation.emptyAgentUsage === true &&
      attestation.recordReportAgreement === true &&
      attestation.replayReconstructionAgreement === true &&
      attestation.bundleValidationStatus === "validated",
    "execution attestation claims are not all confirmed",
  );
  check(
    attestation.primaryResultChecksum === attestation.repeatResultChecksum,
    "execution attestation primary/repeat checksums must be equal (deterministic)",
  );
  // Primary execution checksum binding (Phase 9): the attestation primary
  // checksum must equal the deterministic checksum of the grid match result
  // reconstructed from the persisted record (match.json). The repeat event
  // stream is intentionally not persisted, so the repeat checksum equals the
  // primary checksum as an execution attestation.
  if (record) {
    check(
      attestation.primaryResultChecksum ===
        gridBetaMatchResultChecksum(gridRecordToGridResult(record)),
      "execution attestation primary checksum does not bind to the persisted record reconstruction",
    );
  }
  check(
    attestation.governanceBytesUnchangedBeforeSimulation === true &&
      attestation.governanceBytesUnchangedBeforePublication === true,
    "governance byte-unchanged attestations are not confirmed",
  );
  check(
    attestation.suspensionMarkerAbsentBeforeGovernanceAnchor === true &&
      attestation.suspensionMarkerAbsentBeforeSimulation === true &&
      attestation.suspensionMarkerAbsentBeforePublication === true,
    "suspension marker absence attestations are not all confirmed",
  );

  // 14. Frozen governance hashes inside the selection.
  const frozenHashes = GRID_OPT_IN_BETA_GOVERNANCE_ARTIFACT_HASHES;
  const selectionHashes = selection.governanceArtifactHashes;
  const hashNames = Object.keys(frozenHashes);
  check(
    hashNames.length === Object.keys(selectionHashes).length &&
      hashNames.every((name) => selectionHashes[name] === frozenHashes[name]),
    "selection governance artifact hashes do not match the frozen official hashes",
  );

  if (failures.length > 0) {
    throw new GridBetaMatchBundleError(
      `Grid beta match bundle cross-agreement failed: ${failures.join("; ")}`,
    );
  }

  return {
    matchId: manifest.matchId,
    validationStatus: "validated",
  };
}

function parseFighterArtifact(
  json: string | undefined,
  expectedFighterId: string,
  check: (ok: boolean, message: string) => void,
  label: string,
): { spec: GridBetaFighterSpecV1; checksum: string; build: ValidatedBuild } | null {
  if (typeof json !== "string") {
    check(false, `${label} artifact is missing`);
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    check(false, `${label} artifact is not valid JSON`);
    return null;
  }
  let parsed: { spec: GridBetaFighterSpecV1; checksum: string };
  try {
    parsed = parseGridBetaFighterSpec(raw, expectedFighterId);
  } catch (e) {
    check(
      false,
      `${label} failed authoritative fighter validation: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
  // Canonical byte serialization: the artifact bytes must be exactly the
  // canonical fighter serialization of the parsed spec.
  check(
    json === serializeGridBetaFighterSpec(parsed.spec),
    `${label} artifact bytes are not the canonical fighter serialization`,
  );
  // Reconstruct the authoritative ValidatedBuild with the existing catalogue
  // validator (never duplicating budget calculations) for the complete build
  // binding.
  const buildResult = validateBuild(parsed.spec.buildProposal, CATALOGUE_V1);
  if (!buildResult.ok) {
    check(false, `${label} build failed the authoritative catalogue-v1 validator`);
    return null;
  }
  return { spec: parsed.spec, checksum: parsed.checksum, build: buildResult.build };
}
