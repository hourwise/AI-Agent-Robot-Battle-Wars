import { z } from "zod";
import { machineBuildProposalSchema } from "./build.schema.js";
import { actionPolicySchema } from "./policy.schema.js";
import {
  FactualMatchReportV1Schema,
  FactualMatchReportV2Schema,
} from "./factual-report.schema.js";
import { MatchReviewSchema } from "./review.schema.js";
import { POSITIONING_MODEL_GRID } from "./positioning.schema.js";

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

/** v2 match summary additionally proves the referenced match is a grid v3 match. */
const matchRecordSummaryV2Schema = matchRecordSummarySchema.extend({
  matchRecordSchemaVersion: z.literal("3"),
  simulatorVersion: z.literal("0.3.0"),
  positioningModel: z.literal(POSITIONING_MODEL_GRID),
});

const reviewFailureSchema = z.object({
  category: z.string(),
  message: z.string(),
});

/** v1 series entry: embeds a legacy factual-report v1. */
const seriesMatchEntryV1Schema = z.object({
  matchNumber: z.number().int().positive(),
  seed: z.number().int().nonnegative(),
  matchId: z.string().uuid().optional(),
  match: matchRecordSummarySchema,
  factualReport: FactualMatchReportV1Schema,
  review: MatchReviewSchema.nullable(),
  reviewFailure: reviewFailureSchema.optional(),
  designBeforeMatch: machineBuildProposalSchema,
  policyBeforeMatch: actionPolicySchema,
  nextDesign: machineBuildProposalSchema.optional(),
  nextPolicy: actionPolicySchema.optional(),
  usage: z.array(agentUsageRecordSchema),
});

/**
 * v2 series entry: reserved for a future grid series. Requires a grid
 * factual-report v2 and a match summary carrying the grid runtime identity.
 */
const seriesMatchEntryV2Schema = z.object({
  matchNumber: z.number().int().positive(),
  seed: z.number().int().nonnegative(),
  matchId: z.string().uuid(),
  match: matchRecordSummaryV2Schema,
  factualReport: FactualMatchReportV2Schema,
  review: MatchReviewSchema.nullable(),
  reviewFailure: reviewFailureSchema.optional(),
  designBeforeMatch: machineBuildProposalSchema,
  policyBeforeMatch: actionPolicySchema,
  nextDesign: machineBuildProposalSchema.optional(),
  nextPolicy: actionPolicySchema.optional(),
  usage: z.array(agentUsageRecordSchema),
});

/**
 * v2 series cross-field contract (Milestone 0.2C Phase 3D1). Each entry must
 * agree with the series runtime and with itself; match IDs and match numbers
 * are unique; and series scores can never exceed the entry count.
 */
function validateSeriesV2Contract(
  record: z.infer<typeof SeriesRecordV2Schema>,
  ctx: z.RefinementCtx,
): void {
  const seenMatchIds = new Set<string>();
  const seenMatchNumbers = new Set<number>();
  for (const entry of record.entries) {
    if (entry.seed !== entry.match.seed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `series v2 entry ${entry.matchNumber} seed ${entry.seed} disagrees with match summary seed ${entry.match.seed}`,
      });
    }
    if (entry.seed !== entry.factualReport.seed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `series v2 entry ${entry.matchNumber} seed ${entry.seed} disagrees with factual report seed ${entry.factualReport.seed}`,
      });
    }
    if (entry.factualReport.schemaVersion !== "2") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `series v2 entry ${entry.matchNumber} requires a factual-report v2`,
      });
    }
    if (entry.factualReport.simulatorVersion !== record.simulatorVersion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `series v2 entry ${entry.matchNumber} factual-report simulator ${entry.factualReport.simulatorVersion} disagrees with series simulator ${record.simulatorVersion}`,
      });
    }
    if (entry.factualReport.positioningModel !== record.positioningModel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `series v2 entry ${entry.matchNumber} factual-report model ${entry.factualReport.positioningModel} disagrees with series model ${record.positioningModel}`,
      });
    }
    if (entry.match.simulatorVersion !== record.simulatorVersion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `series v2 entry ${entry.matchNumber} match summary simulator ${entry.match.simulatorVersion} disagrees with series simulator ${record.simulatorVersion}`,
      });
    }
    if (entry.match.positioningModel !== record.positioningModel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `series v2 entry ${entry.matchNumber} match summary model ${entry.match.positioningModel} disagrees with series model ${record.positioningModel}`,
      });
    }
    if (entry.match.matchRecordSchemaVersion !== "3") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `series v2 entry ${entry.matchNumber} requires match-record schema v3`,
      });
    }
    if (entry.matchId !== entry.match.matchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `series v2 entry ${entry.matchNumber} matchId ${entry.matchId} disagrees with match summary ${entry.match.matchId}`,
      });
    }
    if (seenMatchIds.has(entry.matchId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `series v2 duplicate matchId ${entry.matchId}`,
      });
    }
    seenMatchIds.add(entry.matchId);
    if (seenMatchNumbers.has(entry.matchNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `series v2 duplicate match number ${entry.matchNumber}`,
      });
    }
    seenMatchNumbers.add(entry.matchNumber);
  }

  const totalScore = record.score.aiWins + record.score.bulwarkWins + record.score.draws;
  if (totalScore > record.entries.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `series v2 score ${totalScore} exceeds entry count ${record.entries.length}`,
    });
  }
}

export const SeriesRecordV1Schema = z.object({
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
  entries: z.array(seriesMatchEntryV1Schema),
  totalUsage: agentUsageSummarySchema,
  winner: z.enum(["ai", "bulwark"]).nullable(),
});

/**
 * Series v2 is reserved for a future grid series: it declares one immutable
 * runtime contract for the entire series and is not produced by the current
 * `runSeries` command.
 */
export const SeriesRecordV2Schema = z
  .object({
    schemaVersion: z.literal("2"),
    simulatorVersion: z.literal("0.3.0"),
    positioningModel: z.literal(POSITIONING_MODEL_GRID),
    rulesetVersion: z.literal("0.2.0"),
    catalogueVersion: z.literal("1"),
    matchRecordSchemaVersion: z.literal("3"),
    factualReportSchemaVersion: z.literal("2"),
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
    entries: z.array(seriesMatchEntryV2Schema),
    totalUsage: agentUsageSummarySchema,
    winner: z.enum(["ai", "bulwark"]).nullable(),
  })
  .superRefine(validateSeriesV2Contract);

/**
 * @deprecated Use `SeriesRecordV1Schema` explicitly. Retained for compatibility
 * with existing legacy callers.
 */
export const SeriesRecordSchema = SeriesRecordV1Schema;

/**
 * @deprecated Use `seriesMatchEntryV1Schema` explicitly.
 */
export const seriesMatchEntrySchema = seriesMatchEntryV1Schema;

export type AgentUsageSummary = z.infer<typeof agentUsageSummarySchema>;
export type SeriesCompetitor = z.infer<typeof seriesCompetitorSchema>;
export type AgentUsageRecordEntry = z.infer<typeof agentUsageRecordSchema>;
export type SeriesMatchEntryV1 = z.infer<typeof seriesMatchEntryV1Schema>;
export type SeriesMatchEntryV2 = z.infer<typeof seriesMatchEntryV2Schema>;
export type SeriesRecordV1 = z.infer<typeof SeriesRecordV1Schema>;
export type SeriesRecordV2 = z.infer<typeof SeriesRecordV2Schema>;
export type AnySeriesRecord = SeriesRecordV1 | SeriesRecordV2;
export type AnySeriesMatchEntry = SeriesMatchEntryV1 | SeriesMatchEntryV2;

/**
 * @deprecated Use `SeriesMatchEntryV1` explicitly.
 */
export type SeriesMatchEntry = SeriesMatchEntryV1;

/**
 * @deprecated Use `SeriesRecordV1` explicitly.
 */
export type SeriesRecord = SeriesRecordV1;

export function isSeriesRecordV1(record: AnySeriesRecord): record is SeriesRecordV1 {
  return record.schemaVersion === "1";
}

export function isSeriesRecordV2(record: AnySeriesRecord): record is SeriesRecordV2 {
  return record.schemaVersion === "2";
}

export function validateSeriesRecord(
  data: unknown,
): { ok: true; record: AnySeriesRecord } | { ok: false; errors: string } {
  if (typeof data !== "object" || data === null) {
    return { ok: false, errors: "Expected an object" };
  }
  const version = (data as Record<string, unknown>).schemaVersion;

  if (version === "1") {
    const result = SeriesRecordV1Schema.safeParse(data);
    if (result.success) return { ok: true, record: result.data };
    return { ok: false, errors: result.error.message };
  }

  if (version === "2") {
    const result = SeriesRecordV2Schema.safeParse(data);
    if (result.success) return { ok: true, record: result.data };
    return { ok: false, errors: result.error.message };
  }

  return {
    ok: false,
    errors: `Unsupported series schemaVersion: ${String(version)}`,
  };
}

export function serializeSeriesRecord(record: AnySeriesRecord): string {
  return JSON.stringify(record, null, 2);
}

export function deserializeSeriesRecord(
  json: string,
): { ok: true; record: AnySeriesRecord } | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json);
    return validateSeriesRecord(data);
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
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
