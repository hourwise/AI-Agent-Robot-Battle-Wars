import { z } from "zod";
import { GRID_SERIES_CANARY_SCENARIO_VERSION } from "../canary/grid-series-canary-scenario.js";

/**
 * Grid series canary manifest schema v1 (Milestone 0.2C Phase 3D2B).
 *
 * The manifest is the single signed summary of one isolated grid adaptive
 * series canary run. It freezes the canary and series identities, the runtime
 * identity, the three sequential seeds, the observed evidence (including the
 * two deterministic policy adaptations), the fixed artifact names and the
 * SHA-256 digests of every non-manifest artifact of the published bundle. It
 * deliberately contains no win rates, percentages, comparative performance,
 * promotion, balance or benchmark terminology, and it never claims the grid
 * runtime is accepted or promoted.
 */
export const sha256HexSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "must be a lowercase SHA-256 hex string");

function validateSeriesCanaryManifestContract(
  manifest: z.infer<typeof GridSeriesCanaryManifestV1Schema>,
  ctx: z.RefinementCtx,
): void {
  if (manifest.seeds[0] !== manifest.baseSeed) {
    ctx.addIssue({
      code: "custom",
      message: `manifest seeds[0] ${manifest.seeds[0]} must equal baseSeed ${manifest.baseSeed}`,
    });
  }
  if (manifest.seeds[1] !== manifest.baseSeed + 1) {
    ctx.addIssue({
      code: "custom",
      message: `manifest seeds[1] ${manifest.seeds[1]} must equal baseSeed + 1`,
    });
  }
  if (manifest.seeds[2] !== manifest.baseSeed + 2) {
    ctx.addIssue({
      code: "custom",
      message: `manifest seeds[2] ${manifest.seeds[2]} must equal baseSeed + 2`,
    });
  }
}

export const GridSeriesCanaryManifestV1Schema = z
  .object({
    schemaVersion: z.literal("1"),
    canaryKind: z.literal("grid-series"),
    scenarioVersion: z.literal(GRID_SERIES_CANARY_SCENARIO_VERSION),
    status: z.literal("passed"),

    canaryId: z.string().uuid(),
    seriesId: z.string().uuid(),
    createdAt: z.string().datetime(),
    baseSeed: z.number().int().nonnegative(),
    seeds: z.tuple([
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
    ]),

    simulatorVersion: z.literal("0.3.0"),
    positioningModel: z.literal("grid-3x3-v1"),
    rulesetVersion: z.literal("0.2.0"),
    catalogueVersion: z.literal("1"),
    seriesRecordSchemaVersion: z.literal("2"),
    matchRecordSchemaVersion: z.literal("3"),
    factualReportSchemaVersion: z.literal("2"),
    matchCount: z.literal(3),

    evidence: z.object({
      allMatchesTerminated: z.literal(true),
      allMatchRecordsV3: z.literal(true),
      allFactualReportsV2: z.literal(true),
      allReportsBoundToRecords: z.literal(true),
      allFallbackReviewsValid: z.literal(true),
      allReplayFinalStatesAgree: z.literal(true),
      allMovementZonesCanonical: z.literal(true),
      translatedGridMovementObserved: z.literal(true),
      combatAttemptObserved: z.literal(true),
      policyAdaptationCount: z.literal(2),
      adaptationFactsAgree: z.literal(true),
      seriesRoundTripPassed: z.literal(true),
      adaptationTraceRoundTripPassed: z.literal(true),
      deterministicReexecutionPassed: z.literal(true),
      allArtifactsReadBack: z.literal(true),
      bundleCrossAgreementPassed: z.literal(true),
    }),

    artifacts: z.object({
      series: z.literal("series.json"),
      matches: z.literal("matches.json"),
      factualReports: z.literal("factual-reports.json"),
      fallbackReviews: z.literal("fallback-reviews.json"),
      matchArtifacts: z.literal("match-artifacts.json"),
      adaptationTrace: z.literal("adaptation-trace.json"),
      seriesReport: z.literal("series-report.txt"),
      manifest: z.literal("manifest.json"),
    }),

    digests: z.object({
      series: sha256HexSchema,
      matches: sha256HexSchema,
      factualReports: sha256HexSchema,
      fallbackReviews: sha256HexSchema,
      matchArtifacts: sha256HexSchema,
      adaptationTrace: sha256HexSchema,
      seriesReport: sha256HexSchema,
    }),
  })
  .superRefine(validateSeriesCanaryManifestContract);

export type GridSeriesCanaryManifestV1 = z.infer<typeof GridSeriesCanaryManifestV1Schema>;

export function isGridSeriesCanaryManifestV1(
  value: unknown,
): value is GridSeriesCanaryManifestV1 {
  return GridSeriesCanaryManifestV1Schema.safeParse(value).success;
}

export function validateGridSeriesCanaryManifestV1(
  value: unknown,
): { ok: true; manifest: GridSeriesCanaryManifestV1 } | { ok: false; errors: string } {
  const result = GridSeriesCanaryManifestV1Schema.safeParse(value);
  if (result.success) return { ok: true, manifest: result.data };
  return { ok: false, errors: result.error.message };
}

export function serializeGridSeriesCanaryManifest(
  manifest: GridSeriesCanaryManifestV1,
): string {
  return JSON.stringify(manifest, null, 2);
}

export function deserializeGridSeriesCanaryManifestV1(
  json: string,
): { ok: true; manifest: GridSeriesCanaryManifestV1 } | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json);
    return validateGridSeriesCanaryManifestV1(data);
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
  }
}
