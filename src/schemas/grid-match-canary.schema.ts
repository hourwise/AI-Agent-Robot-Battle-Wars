import { z } from "zod";
import { GRID_CANARY_SCENARIO_VERSION } from "../canary/grid-canary-scenario.js";

/**
 * Grid match canary manifest schema v1 (Milestone 0.2C Phase 3D2A).
 *
 * The manifest is the single signed summary of one isolated canary run. It
 * freezes the canary identity, the runtime identity of the executed match, the
 * observed evidence, and the fixed artifact names of the published bundle. It
 * deliberately contains no win rates, comparative performance, balance
 * metrics or benchmark terminology, and it never claims the grid runtime is
 * accepted or promoted.
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

export type GridMatchCanaryManifestEvidence = GridMatchCanaryManifestV1["evidence"];

export function validateGridMatchCanaryManifest(
  data: unknown,
): { ok: true; manifest: GridMatchCanaryManifestV1 } | { ok: false; errors: string } {
  const result = GridMatchCanaryManifestV1Schema.safeParse(data);
  if (result.success) {
    return { ok: true, manifest: result.data };
  }
  return { ok: false, errors: result.error.message };
}

export function serializeGridMatchCanaryManifest(
  manifest: GridMatchCanaryManifestV1,
): string {
  return JSON.stringify(manifest, null, 2);
}

export function deserializeGridMatchCanaryManifest(
  json: string,
): { ok: true; manifest: GridMatchCanaryManifestV1 } | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json);
    return validateGridMatchCanaryManifest(data);
  } catch (e) {
    return {
      ok: false,
      errors: e instanceof SyntaxError ? e.message : String(e),
    };
  }
}
