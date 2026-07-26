import { z } from "zod";
import { machineBuildProposalSchema } from "./build.schema.js";
import { actionPolicySchema } from "./policy.schema.js";
import { FactualMatchReportSchema } from "./factual-report.schema.js";
import { MatchReviewSchema } from "./review.schema.js";

const agentUsageSummarySchema = z.object({
  totalCostUsd: z.number().nonnegative().nullable(),
  totalInputTokens: z.number().int().nonnegative(),
  totalOutputTokens: z.number().int().nonnegative(),
  totalCachedTokens: z.number().int().nonnegative(),
  costIsEstimated: z.boolean(),
  recordCount: z.number().int().nonnegative(),
});

const seriesCompetitorSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  provider: z.string(),
});

const agentUsageRecordSchema = z.object({
  phase: z.enum(["design", "policy", "review", "rebuild"]),
  agentId: z.string(),
  provider: z.string(),
  model: z.string(),
  providerRequestId: z.string().nullable(),
  promptVersion: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cachedTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative().nullable(),
  costIsEstimated: z.boolean(),
  pricingVersion: z.string().nullable(),
  latencyMs: z.number().nonnegative(),
  attempts: z.number().int().positive(),
  fallbackUsed: z.boolean(),
  errorCategory: z.enum([
    "none",
    "timeout",
    "rate_limit",
    "provider_error",
    "invalid_json",
    "schema_violation",
    "semantic_violation",
    "authentication",
  ]),
});

const matchRecordSummarySchema = z.object({
  matchId: z.string().uuid(),
  createdAt: z.string().datetime(),
  seed: z.number().int().nonnegative(),
  rounds: z.number().int().nonnegative(),
  winner: z.string().nullable(),
  resultMethod: z.string(),
});

const reviewFailureSchema = z.object({
  category: z.string(),
  message: z.string(),
});

export const seriesMatchEntrySchema = z.object({
  matchNumber: z.number().int().positive(),
  seed: z.number().int().nonnegative(),
  matchId: z.string().uuid().optional(),
  match: matchRecordSummarySchema,
  factualReport: FactualMatchReportSchema,
  review: MatchReviewSchema.nullable(),
  reviewFailure: reviewFailureSchema.optional(),
  designBeforeMatch: machineBuildProposalSchema,
  policyBeforeMatch: actionPolicySchema,
  nextDesign: machineBuildProposalSchema.optional(),
  nextPolicy: actionPolicySchema.optional(),
  usage: z.array(agentUsageRecordSchema),
});

export const SeriesRecordSchema = z.object({
  schemaVersion: z.literal("1"),
  seriesId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: z.enum(["in_progress", "completed", "aborted"]),
  competitor: seriesCompetitorSchema,
  targetWins: z.number().int().positive(),
  maximumMatches: z.number().int().positive(),
  score: z.object({
    aiWins: z.number().int().nonnegative(),
    bulwarkWins: z.number().int().nonnegative(),
    draws: z.number().int().nonnegative(),
  }),
  entries: z.array(seriesMatchEntrySchema),
  totalUsage: agentUsageSummarySchema,
  winner: z.enum(["ai", "bulwark"]).nullable(),
});

export type AgentUsageSummary = z.infer<typeof agentUsageSummarySchema>;
export type SeriesCompetitor = z.infer<typeof seriesCompetitorSchema>;
export type AgentUsageRecordEntry = z.infer<typeof agentUsageRecordSchema>;
export type SeriesMatchEntry = z.infer<typeof seriesMatchEntrySchema>;
export type SeriesRecord = z.infer<typeof SeriesRecordSchema>;

export function validateSeriesRecord(
  data: unknown,
): { ok: true; record: SeriesRecord } | { ok: false; errors: z.ZodError } {
  const result = SeriesRecordSchema.safeParse(data);
  if (result.success) {
    return { ok: true, record: result.data };
  }
  return { ok: false, errors: result.error };
}

export function serializeSeriesRecord(record: SeriesRecord): string {
  return JSON.stringify(record, null, 2);
}

export function deserializeSeriesRecord(
  json: string,
): { ok: true; record: SeriesRecord } | { ok: false; errors: z.ZodError | SyntaxError } {
  try {
    const data = JSON.parse(json);
    const result = SeriesRecordSchema.safeParse(data);
    if (result.success) {
      return { ok: true, record: result.data };
    }
    return { ok: false, errors: result.error };
  } catch (e) {
    return { ok: false, errors: e as SyntaxError };
  }
}

export function buildUsageSummary(
  usage: readonly AgentUsageRecordEntry[],
): AgentUsageSummary {
  let totalCostUsd: number | null = null;
  let costIsEstimated = false;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCachedTokens = 0;

  for (const record of usage) {
    totalInputTokens += record.inputTokens;
    totalOutputTokens += record.outputTokens;
    totalCachedTokens += record.cachedTokens;

    if (record.costUsd !== null) {
      totalCostUsd = (totalCostUsd ?? 0) + record.costUsd;
      costIsEstimated = costIsEstimated || record.costIsEstimated;
    } else {
      totalCostUsd = null;
    }
  }

  return {
    totalCostUsd,
    totalInputTokens,
    totalOutputTokens,
    totalCachedTokens,
    costIsEstimated,
    recordCount: usage.length,
  };
}
