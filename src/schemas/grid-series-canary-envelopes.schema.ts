import { z } from "zod";
import { MatchRecordV3Schema } from "./match-record.schema.js";
import { FactualMatchReportV2Schema } from "./factual-report.schema.js";
import { MatchReviewSchema } from "./review.schema.js";

/**
 * Grid adaptive-series canary envelope schemas (Milestone 0.2C Phase 3D2B).
 *
 * The series canary publishes four JSON envelopes in addition to the series
 * record and the adaptation trace:
 *
 *   - `matches.json` — exactly three match-record v3 artifacts, in series
 *     order, sharing one series UUID, with unique match IDs;
 *   - `factual-reports.json` — exactly three factual-report v2 artifacts, in
 *     series order, with unique (never `"pending"`) match IDs;
 *   - `fallback-reviews.json` — exactly three entries keyed by match number
 *     1, 2, 3 with unique bound match IDs;
 *   - `match-artifacts.json` — exactly three entries carrying the text replay,
 *     ASCII replay and review prompt for each match (non-empty, no NUL).
 *
 * Order and uniqueness are part of the contract: index 0 is match 1, index 1
 * is match 2 and index 2 is match 3.
 */
export const GRID_SERIES_CANARY_MATCHES_FILE = "matches.json" as const;
export const GRID_SERIES_CANARY_FACTUAL_REPORTS_FILE = "factual-reports.json" as const;
export const GRID_SERIES_CANARY_FALLBACK_REVIEWS_FILE = "fallback-reviews.json" as const;
export const GRID_SERIES_CANARY_MATCH_ARTIFACTS_FILE = "match-artifacts.json" as const;
export const GRID_SERIES_CANARY_ADAPTATION_TRACE_FILE = "adaptation-trace.json" as const;
export const GRID_SERIES_CANARY_SERIES_FILE = "series.json" as const;
export const GRID_SERIES_CANARY_SERIES_REPORT_FILE = "series-report.txt" as const;
export const GRID_SERIES_CANARY_MANIFEST_FILE = "manifest.json" as const;

const matchNumberSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

function assertNoNul(failures: string[], label: string, value: string): void {
  if (value.length === 0) {
    failures.push(`${label} must be non-empty`);
  }
  if (value.includes("\u0000")) {
    failures.push(`${label} must not contain NUL characters`);
  }
}

// ── matches envelope ──

function validateMatchesEnvelope(
  envelope: z.infer<typeof GridSeriesCanaryMatchesEnvelopeSchema>,
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const [index, record] of envelope.items.entries()) {
    if (seen.has(record.matchId)) {
      ctx.addIssue({
        code: "custom",
        message: `matches envelope duplicate matchId ${record.matchId} at index ${index}`,
      });
    }
    seen.add(record.matchId);
  }
}

export const GridSeriesCanaryMatchesEnvelopeSchema = z
  .object({
    schemaVersion: z.literal("1"),
    seriesId: z.string().uuid(),
    items: z.tuple([MatchRecordV3Schema, MatchRecordV3Schema, MatchRecordV3Schema]),
  })
  .superRefine(validateMatchesEnvelope);

export type GridSeriesCanaryMatchesEnvelope = z.infer<
  typeof GridSeriesCanaryMatchesEnvelopeSchema
>;

// ── factual reports envelope ──

function validateFactualReportsEnvelope(
  envelope: z.infer<typeof GridSeriesCanaryFactualReportsEnvelopeSchema>,
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const [index, report] of envelope.items.entries()) {
    if (report.matchId === "pending") {
      ctx.addIssue({
        code: "custom",
        message: `factual-reports envelope index ${index} still uses matchId "pending"`,
      });
    }
    if (seen.has(report.matchId)) {
      ctx.addIssue({
        code: "custom",
        message: `factual-reports envelope duplicate matchId ${report.matchId} at index ${index}`,
      });
    }
    seen.add(report.matchId);
  }
}

export const GridSeriesCanaryFactualReportsEnvelopeSchema = z
  .object({
    schemaVersion: z.literal("1"),
    seriesId: z.string().uuid(),
    items: z.tuple([
      FactualMatchReportV2Schema,
      FactualMatchReportV2Schema,
      FactualMatchReportV2Schema,
    ]),
  })
  .superRefine(validateFactualReportsEnvelope);

export type GridSeriesCanaryFactualReportsEnvelope = z.infer<
  typeof GridSeriesCanaryFactualReportsEnvelopeSchema
>;

// ── fallback reviews envelope ──

const gridSeriesCanaryFallbackReviewEntrySchema = z.object({
  matchNumber: matchNumberSchema,
  matchId: z.string().uuid(),
  review: MatchReviewSchema,
});

function validateFallbackReviewsEnvelope(
  envelope: z.infer<typeof GridSeriesCanaryFallbackReviewsEnvelopeSchema>,
  ctx: z.RefinementCtx,
): void {
  const seenIds = new Set<string>();
  const seenNumbers = new Set<number>();
  for (const [index, entry] of envelope.items.entries()) {
    const expectedNumber = index + 1;
    if (entry.matchNumber !== expectedNumber) {
      ctx.addIssue({
        code: "custom",
        message: `fallback-reviews envelope index ${index} must carry matchNumber ${expectedNumber}; received ${entry.matchNumber}`,
      });
    }
    if (seenIds.has(entry.matchId)) {
      ctx.addIssue({
        code: "custom",
        message: `fallback-reviews envelope duplicate matchId ${entry.matchId} at index ${index}`,
      });
    }
    seenIds.add(entry.matchId);
    seenNumbers.add(entry.matchNumber);
  }
}

export const GridSeriesCanaryFallbackReviewsEnvelopeSchema = z
  .object({
    schemaVersion: z.literal("1"),
    seriesId: z.string().uuid(),
    items: z.tuple([
      gridSeriesCanaryFallbackReviewEntrySchema,
      gridSeriesCanaryFallbackReviewEntrySchema,
      gridSeriesCanaryFallbackReviewEntrySchema,
    ]),
  })
  .superRefine(validateFallbackReviewsEnvelope);

export type GridSeriesCanaryFallbackReviewEntry = z.infer<
  typeof gridSeriesCanaryFallbackReviewEntrySchema
>;
export type GridSeriesCanaryFallbackReviewsEnvelope = z.infer<
  typeof GridSeriesCanaryFallbackReviewsEnvelopeSchema
>;

// ── match artifacts envelope ──

const gridSeriesCanaryMatchArtifactEntrySchema = z.object({
  matchNumber: matchNumberSchema,
  matchId: z.string().uuid(),
  textReplay: z.string(),
  asciiReplay: z.string(),
  reviewPrompt: z.string(),
});

function validateMatchArtifactsEnvelope(
  envelope: z.infer<typeof GridSeriesCanaryMatchArtifactsEnvelopeSchema>,
  ctx: z.RefinementCtx,
): void {
  const seenIds = new Set<string>();
  for (const [index, entry] of envelope.items.entries()) {
    const expectedNumber = index + 1;
    if (entry.matchNumber !== expectedNumber) {
      ctx.addIssue({
        code: "custom",
        message: `match-artifacts envelope index ${index} must carry matchNumber ${expectedNumber}; received ${entry.matchNumber}`,
      });
    }
    if (seenIds.has(entry.matchId)) {
      ctx.addIssue({
        code: "custom",
        message: `match-artifacts envelope duplicate matchId ${entry.matchId} at index ${index}`,
      });
    }
    seenIds.add(entry.matchId);

    const failures: string[] = [];
    assertNoNul(failures, `match ${entry.matchNumber} textReplay`, entry.textReplay);
    assertNoNul(failures, `match ${entry.matchNumber} asciiReplay`, entry.asciiReplay);
    assertNoNul(failures, `match ${entry.matchNumber} reviewPrompt`, entry.reviewPrompt);
    for (const message of failures) {
      ctx.addIssue({ code: "custom", message });
    }
  }
}

export const GridSeriesCanaryMatchArtifactsEnvelopeSchema = z
  .object({
    schemaVersion: z.literal("1"),
    seriesId: z.string().uuid(),
    items: z.tuple([
      gridSeriesCanaryMatchArtifactEntrySchema,
      gridSeriesCanaryMatchArtifactEntrySchema,
      gridSeriesCanaryMatchArtifactEntrySchema,
    ]),
  })
  .superRefine(validateMatchArtifactsEnvelope);

export type GridSeriesCanaryMatchArtifactEntry = z.infer<
  typeof gridSeriesCanaryMatchArtifactEntrySchema
>;
export type GridSeriesCanaryMatchArtifactsEnvelope = z.infer<
  typeof GridSeriesCanaryMatchArtifactsEnvelopeSchema
>;

// ── shared serialize/deserialize helpers ──

export function serializeGridSeriesCanaryEnvelope(envelope: unknown): string {
  return JSON.stringify(envelope, null, 2);
}

export function deserializeGridSeriesCanaryMatchesEnvelope(
  json: string,
):
  | { ok: true; envelope: GridSeriesCanaryMatchesEnvelope }
  | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json);
    const result = GridSeriesCanaryMatchesEnvelopeSchema.safeParse(data);
    if (result.success) return { ok: true, envelope: result.data };
    return { ok: false, errors: result.error.message };
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
  }
}

export function deserializeGridSeriesCanaryFactualReportsEnvelope(
  json: string,
):
  | { ok: true; envelope: GridSeriesCanaryFactualReportsEnvelope }
  | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json);
    const result = GridSeriesCanaryFactualReportsEnvelopeSchema.safeParse(data);
    if (result.success) return { ok: true, envelope: result.data };
    return { ok: false, errors: result.error.message };
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
  }
}

export function deserializeGridSeriesCanaryFallbackReviewsEnvelope(
  json: string,
):
  | { ok: true; envelope: GridSeriesCanaryFallbackReviewsEnvelope }
  | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json);
    const result = GridSeriesCanaryFallbackReviewsEnvelopeSchema.safeParse(data);
    if (result.success) return { ok: true, envelope: result.data };
    return { ok: false, errors: result.error.message };
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
  }
}

export function deserializeGridSeriesCanaryMatchArtifactsEnvelope(
  json: string,
):
  | { ok: true; envelope: GridSeriesCanaryMatchArtifactsEnvelope }
  | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json);
    const result = GridSeriesCanaryMatchArtifactsEnvelopeSchema.safeParse(data);
    if (result.success) return { ok: true, envelope: result.data };
    return { ok: false, errors: result.error.message };
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
  }
}
