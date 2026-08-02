import {
  isSeriesRecordV2,
  serializeSeriesRecord,
  validateSeriesRecord,
  type SeriesRecordV2,
} from "../schemas/series.schema.js";
import type { GridSeriesCanaryExecutedMatch } from "./grid-series-canary-core.js";
import {
  GRID_SERIES_CANARY_COMPETITOR,
  GRID_SERIES_CANARY_MAXIMUM_MATCHES,
  GRID_SERIES_CANARY_TARGET_WINS,
} from "./grid-series-canary-scenario.js";

/**
 * Series-record v2 construction for the grid adaptive-series canary
 * (Milestone 0.2C Phase 3D2B).
 *
 * Builds the authoritative series-record v2 from the three executed matches:
 *
 *   - immutable grid runtime identity (`0.3.0` / `grid-3x3-v1` / `0.2.0` / `1`
 *     with match-record schema 3 and factual-report schema 2);
 *   - status `completed`, targetWins 3, maximumMatches 3, three entries;
 *   - each entry carries the bound factual-report v2, the deterministic
 *     fallback review with an explicit intentional-local-fallback review
 *     failure marker, the build proposal actually used, the policy used
 *     before the match, the next policy for matches 1 and 2 (none for 3), no
 *     next design and an empty usage array;
 *   - a zero total-usage summary (no provider calls are ever recorded);
 *   - a score derived from the actual match outcomes and a winner derived from
 *     the score (never hard-coded).
 *
 * The completed record is validated against the authoritative series v2
 * schema (including its cross-field contract) before being returned.
 */
export class GridSeriesCanarySeriesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridSeriesCanarySeriesError";
  }
}

export interface GridSeriesCanarySeriesInput {
  seriesId: string;
  createdAt: string;
  updatedAt: string;
  matches: readonly [
    GridSeriesCanaryExecutedMatch,
    GridSeriesCanaryExecutedMatch,
    GridSeriesCanaryExecutedMatch,
  ];
}

/** Frozen review-failure marker explaining the intentional local fallback. */
export const GRID_SERIES_CANARY_REVIEW_FAILURE = {
  category: "local_fallback",
  message:
    "Intentionally deterministic local fallback review: the grid series canary never calls an AI provider.",
} as const;

export function buildGridSeriesCanarySeriesRecord(
  input: GridSeriesCanarySeriesInput,
): SeriesRecordV2 {
  const score = { aiWins: 0, bulwarkWins: 0, draws: 0 };
  for (const match of input.matches) {
    if (match.winner === "fighter_a") score.aiWins += 1;
    else if (match.winner === "fighter_b") score.bulwarkWins += 1;
    else score.draws += 1;
  }
  const winner: "ai" | "bulwark" | null =
    score.aiWins > score.bulwarkWins
      ? "ai"
      : score.bulwarkWins > score.aiWins
        ? "bulwark"
        : null;

  const record: SeriesRecordV2 = {
    schemaVersion: "2",
    simulatorVersion: "0.3.0",
    positioningModel: "grid-3x3-v1",
    rulesetVersion: "0.2.0",
    catalogueVersion: "1",
    matchRecordSchemaVersion: "3",
    factualReportSchemaVersion: "2",
    seriesId: input.seriesId,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    status: "completed",
    competitor: { ...GRID_SERIES_CANARY_COMPETITOR },
    targetWins: GRID_SERIES_CANARY_TARGET_WINS,
    maximumMatches: GRID_SERIES_CANARY_MAXIMUM_MATCHES,
    score,
    entries: input.matches.map((match, index) => ({
      matchNumber: index + 1,
      seed: match.seed,
      matchId: match.matchId,
      match: {
        matchId: match.matchId,
        createdAt: match.record.createdAt,
        seed: match.seed,
        rounds: match.rounds,
        winner: match.winner,
        resultMethod: match.resultMethod,
        matchRecordSchemaVersion: "3",
        simulatorVersion: "0.3.0",
        positioningModel: "grid-3x3-v1",
      },
      factualReport: match.report,
      review: match.fallbackReview,
      reviewFailure: { ...GRID_SERIES_CANARY_REVIEW_FAILURE },
      designBeforeMatch: match.record.config.fighterA.build.proposal,
      policyBeforeMatch: { ...match.policyBefore },
      nextPolicy: match.nextPolicy ? { ...match.nextPolicy } : undefined,
      usage: [],
    })),
    totalUsage: {
      totalCostUsd: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCachedTokens: 0,
      costIsEstimated: false,
      recordCount: 0,
    },
    winner,
  };

  const validated = validateSeriesRecord(record);
  if (!validated.ok || !isSeriesRecordV2(validated.record)) {
    throw new GridSeriesCanarySeriesError(
      `Series-record v2 construction failed its authoritative schema: ${validated.ok ? "not schema v2" : validated.errors}`,
    );
  }
  return validated.record;
}

export function serializeGridSeriesCanarySeriesRecord(record: SeriesRecordV2): string {
  return serializeSeriesRecord(record);
}
