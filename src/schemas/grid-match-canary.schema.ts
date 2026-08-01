import { z } from "zod";
import { GRID_CANARY_SCENARIO_VERSION } from "../canary/grid-canary-scenario.js";

/**
 * Grid match canary manifest schemas (Milestone 0.2C Phase 3D2A / 3D2A.1).
 *
 * The manifest is the single signed summary of one isolated canary run. It
 * freezes the canary identity, the runtime identity of the executed match, the
 * observed evidence, the SHA-256 artifact digests and the fixed artifact names
 * of the published bundle. It deliberately contains no win rates, comparative
 * performance, balance metrics or benchmark terminology, and it never claims
 * the grid runtime is accepted or promoted.
 *
 * Manifest v1 (Phase 3D2A) reported `rearExposureObserved: true` from a
 * corner-adjacency proxy. That proxy was not proof of rear exposure, so v1 is
 * retained only for historical inspection and is **never** accepted as current
 * passing canary evidence. Manifest v2 (Phase 3D2A.1) supersedes it: exposure
 * is derived only through the canonical bearing functions, the evidence block
 * reports `lateralFlankObserved` / `observedFlankBearings` /
 * `strictRearExposureObserved`, and a SHA-256 digest block covers every
 * non-manifest artifact.
 */

/** Canonical flank bearings: any defender-relative bearing exposing a flank. */
export const GRID_CANARY_FLANK_BEARINGS = [
  "left",
  "right",
  "rear_left",
  "rear_right",
  "rear",
] as const;

export type GridCanaryFlankBearing = (typeof GRID_CANARY_FLANK_BEARINGS)[number];

/**
 * Grid match canary manifest schema v1 (Phase 3D2A) — historical only.
 *
 * Its `rearExposureObserved: true` field was produced from a corner-adjacency
 * proxy and is not proof of rear exposure. A v1 artifact is superseded and
 * must not be treated as current canary proof by the current canary service.
 */
export const GridMatchCanaryManifestV1Schema = z.object({
  schemaVersion: z.literal("1"),
  canaryKind: z.literal("grid-match"),
  scenarioVersion: z.literal(GRID_CANARY_SCENARIO_VERSION),
  status: z.literal("passed"),

  canaryId: z.string().uuid(),
  createdAt: z.string().datetime(),
  seed: z.number().int().nonnegative(),

  simulatorVersion: z.literal("0.3.0"),
  positioningModel: z.literal("grid-3x3-v1"),
  rulesetVersion: z.literal("0.2.0"),
  catalogueVersion: z.literal("1"),

  matchId: z.string().uuid(),
  matchRecordSchemaVersion: z.literal("3"),
  factualReportSchemaVersion: z.literal("2"),

  rounds: z.number().int().nonnegative(),
  winner: z.string().nullable(),
  resultMethod: z.string(),
  eventCount: z.number().int().nonnegative(),

  evidence: z.object({
    translatedCircleEvents: z.number().int().positive(),
    cornerZonesVisited: z.number().int().positive(),
    rearExposureObserved: z.literal(true),
    allMovementZonesCanonical: z.literal(true),
    recordRoundTripPassed: z.literal(true),
    reportRoundTripPassed: z.literal(true),
    replayFinalStateAgreement: z.literal(true),
    fallbackReviewGenerated: z.literal(true),
  }),

  artifacts: z.object({
    match: z.literal("match.json"),
    factualReport: z.literal("factual-report.json"),
    textReplay: z.literal("text-replay.txt"),
    asciiReplay: z.literal("ascii-replay.txt"),
    reviewPrompt: z.literal("review-prompt.txt"),
    fallbackReview: z.literal("fallback-review.json"),
    manifest: z.literal("manifest.json"),
  }),
});

export type GridMatchCanaryManifestV1 = z.infer<typeof GridMatchCanaryManifestV1Schema>;

const sha256HexSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "must be a lowercase SHA-256 hex string");

/**
 * Grid match canary manifest schema v2 (Phase 3D2A.1) — the current passing
 * canary evidence contract.
 *
 * Exposure evidence is derived only through the canonical
 * `getRelativeBearing` / `getPlanarExposedArmourZones` functions. The evidence
 * block requires a canonical lateral flank (`left`, `right`, `rear_left`,
 * `rear_right` or `rear`), reports the actual observed flank bearings and
 * reports `strictRearExposureObserved` truthfully (it may be `false`). A
 * SHA-256 digest block covers every non-manifest artifact. `manifest.json` is
 * intentionally not digested inside itself.
 */
export const GridMatchCanaryManifestV2Schema = z.object({
  schemaVersion: z.literal("2"),
  canaryKind: z.literal("grid-match"),
  scenarioVersion: z.literal(GRID_CANARY_SCENARIO_VERSION),
  status: z.literal("passed"),

  canaryId: z.string().uuid(),
  createdAt: z.string().datetime(),
  seed: z.number().int().nonnegative(),

  simulatorVersion: z.literal("0.3.0"),
  positioningModel: z.literal("grid-3x3-v1"),
  rulesetVersion: z.literal("0.2.0"),
  catalogueVersion: z.literal("1"),

  matchId: z.string().uuid(),
  matchRecordSchemaVersion: z.literal("3"),
  factualReportSchemaVersion: z.literal("2"),

  rounds: z.number().int().nonnegative(),
  winner: z.string().nullable(),
  resultMethod: z.string(),
  eventCount: z.number().int().nonnegative(),

  evidence: z.object({
    translatedCircleEvents: z.number().int().positive(),
    cornerZonesVisited: z.number().int().positive(),
    lateralFlankObserved: z.literal(true),
    observedFlankBearings: z
      .array(z.enum(GRID_CANARY_FLANK_BEARINGS))
      .min(1)
      .refine(
        (values) => new Set(values).size === values.length,
        "observedFlankBearings must contain unique values",
      ),
    strictRearExposureObserved: z.boolean(),
    stationaryFighterCellUnchanged: z.literal(true),
    allMovementZonesCanonical: z.literal(true),
    recordRoundTripPassed: z.literal(true),
    reportRoundTripPassed: z.literal(true),
    replayFinalStateAgreement: z.literal(true),
    fallbackReviewGenerated: z.literal(true),
    allArtifactsReadBack: z.literal(true),
    bundleCrossAgreementPassed: z.literal(true),
  }),

  digests: z.object({
    match: sha256HexSchema,
    factualReport: sha256HexSchema,
    textReplay: sha256HexSchema,
    asciiReplay: sha256HexSchema,
    reviewPrompt: sha256HexSchema,
    fallbackReview: sha256HexSchema,
  }),

  artifacts: z.object({
    match: z.literal("match.json"),
    factualReport: z.literal("factual-report.json"),
    textReplay: z.literal("text-replay.txt"),
    asciiReplay: z.literal("ascii-replay.txt"),
    reviewPrompt: z.literal("review-prompt.txt"),
    fallbackReview: z.literal("fallback-review.json"),
    manifest: z.literal("manifest.json"),
  }),
});

export type GridMatchCanaryManifestV2 = z.infer<typeof GridMatchCanaryManifestV2Schema>;

export type GridMatchCanaryManifestV2Evidence = GridMatchCanaryManifestV2["evidence"];

export type GridMatchCanaryManifest =
  GridMatchCanaryManifestV1 | GridMatchCanaryManifestV2;

export function isGridMatchCanaryManifestV1(
  data: unknown,
): data is GridMatchCanaryManifestV1 {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>).schemaVersion === "1"
  );
}

export function isGridMatchCanaryManifestV2(
  data: unknown,
): data is GridMatchCanaryManifestV2 {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>).schemaVersion === "2"
  );
}

/** Historical v1 validation, retained for inspection of superseded artifacts. */
export function validateGridMatchCanaryManifestV1(
  data: unknown,
): { ok: true; manifest: GridMatchCanaryManifestV1 } | { ok: false; errors: string } {
  const result = GridMatchCanaryManifestV1Schema.safeParse(data);
  if (result.success) {
    return { ok: true, manifest: result.data };
  }
  return { ok: false, errors: result.error.message };
}

/** Current v2 validation — the only passing canary evidence contract. */
export function validateGridMatchCanaryManifestV2(
  data: unknown,
): { ok: true; manifest: GridMatchCanaryManifestV2 } | { ok: false; errors: string } {
  const result = GridMatchCanaryManifestV2Schema.safeParse(data);
  if (result.success) {
    return { ok: true, manifest: result.data };
  }
  return { ok: false, errors: result.error.message };
}

export function serializeGridMatchCanaryManifest(
  manifest: GridMatchCanaryManifestV1 | GridMatchCanaryManifestV2,
): string {
  return JSON.stringify(manifest, null, 2);
}

/**
 * Deserialization for the current canary service: requires manifest schema
 * v2. A v1 artifact must not be accepted as current passing canary evidence.
 */
export function deserializeGridMatchCanaryManifestV2(
  json: string,
): { ok: true; manifest: GridMatchCanaryManifestV2 } | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json);
    if (!isGridMatchCanaryManifestV2(data)) {
      return {
        ok: false,
        errors: `Expected grid match canary manifest schemaVersion "2"; received ${String((data as Record<string, unknown> | null)?.schemaVersion ?? "non-object")}`,
      };
    }
    return validateGridMatchCanaryManifestV2(data);
  } catch (e) {
    return {
      ok: false,
      errors: e instanceof SyntaxError ? e.message : String(e),
    };
  }
}

/**
 * Version-aware deserialization for historical inspection: may read either
 * manifest version. Current bundle validation must use the v2 entry point.
 */
export function deserializeGridMatchCanaryManifestAny(
  json: string,
):
  | { ok: true; manifest: GridMatchCanaryManifestV1 | GridMatchCanaryManifestV2 }
  | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json);
    if (isGridMatchCanaryManifestV2(data)) {
      const result = validateGridMatchCanaryManifestV2(data);
      if (result.ok) return result;
      return { ok: false, errors: result.errors };
    }
    if (isGridMatchCanaryManifestV1(data)) {
      const result = validateGridMatchCanaryManifestV1(data);
      if (result.ok) return result;
      return { ok: false, errors: result.errors };
    }
    return {
      ok: false,
      errors: `Unsupported grid match canary manifest schemaVersion: ${String((data as Record<string, unknown> | null)?.schemaVersion ?? "non-object")}`,
    };
  } catch (e) {
    return {
      ok: false,
      errors: e instanceof SyntaxError ? e.message : String(e),
    };
  }
}
