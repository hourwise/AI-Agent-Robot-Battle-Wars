import { describe, expect, it } from "vitest";
import { executeGridSeriesCanary } from "../../src/canary/grid-series-canary-core.js";
import {
  buildGridSeriesCanarySeriesRecord,
  GRID_SERIES_CANARY_REVIEW_FAILURE,
} from "../../src/canary/grid-series-canary-series.js";
import {
  validateSeriesRecord,
  isSeriesRecordV2,
} from "../../src/schemas/series.schema.js";

const IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];
const SERIES_ID = "44444444-4444-4444-8444-444444444444";
const CREATED_AT = "2024-06-01T00:00:00.000Z";

function buildSeries(baseSeed = 5) {
  const outcome = executeGridSeriesCanary({
    baseSeed,
    seriesId: SERIES_ID,
    matchIdentities: IDS.map((matchId) => ({
      matchId,
      createdAt: CREATED_AT,
    })),
  });
  return buildGridSeriesCanarySeriesRecord({
    seriesId: SERIES_ID,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    matches: outcome.matches,
  });
}

describe("grid series canary series-record v2 (Phase 3D2B)", () => {
  it("builds a valid series-record v2", () => {
    const series = buildSeries();
    const validated = validateSeriesRecord(series);
    expect(validated.ok).toBe(true);
    expect(isSeriesRecordV2(series)).toBe(true);
  });

  it("freezes the grid runtime and series contract", () => {
    const series = buildSeries();
    expect(series.schemaVersion).toBe("2");
    expect(series.simulatorVersion).toBe("0.3.0");
    expect(series.positioningModel).toBe("grid-3x3-v1");
    expect(series.rulesetVersion).toBe("0.2.0");
    expect(series.catalogueVersion).toBe("1");
    expect(series.matchRecordSchemaVersion).toBe("3");
    expect(series.factualReportSchemaVersion).toBe("2");
    expect(series.status).toBe("completed");
    expect(series.targetWins).toBe(3);
    expect(series.maximumMatches).toBe(3);
    expect(series.entries).toHaveLength(3);
    expect(series.competitor.id).toBe("grid-canary-competitor");
    expect(series.competitor.provider).toBe("deterministic-local");
  });

  it("derives score and winner from the actual outcomes", () => {
    const series = buildSeries(5);
    const outcomes = series.entries.map((entry) => entry.match.winner);
    const aiWins = outcomes.filter((w) => w === "fighter_a").length;
    const bulwarkWins = outcomes.filter((w) => w === "fighter_b").length;
    const draws = outcomes.filter((w) => w === null).length;
    expect(series.score).toEqual({ aiWins, bulwarkWins, draws });
    expect(series.winner).toBe(
      aiWins > bulwarkWins ? "ai" : bulwarkWins > aiWins ? "bulwark" : null,
    );
  });

  it("records zero usage everywhere", () => {
    const series = buildSeries();
    expect(series.totalUsage).toEqual({
      totalCostUsd: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCachedTokens: 0,
      costIsEstimated: false,
      recordCount: 0,
    });
    for (const entry of series.entries) {
      expect(entry.usage).toEqual([]);
    }
  });

  it("binds each entry to its match, report and review", () => {
    const series = buildSeries();
    for (const [index, entry] of series.entries.entries()) {
      expect(entry.matchNumber).toBe(index + 1);
      expect(entry.matchId).toBe(IDS[index]);
      expect(entry.match.matchId).toBe(IDS[index]);
      expect(entry.factualReport.matchId).toBe(IDS[index]);
      expect(entry.factualReport.schemaVersion).toBe("2");
      expect(entry.match.matchRecordSchemaVersion).toBe("3");
      expect(entry.review?.observedOutcome.winnerId).toBe(entry.match.winner);
      expect(entry.reviewFailure).toEqual(GRID_SERIES_CANARY_REVIEW_FAILURE);
      expect(entry.nextDesign).toBeUndefined();
    }
  });

  it("wires next policies for matches 1 and 2 only", () => {
    const series = buildSeries();
    expect(series.entries[0].nextPolicy).toBeDefined();
    expect(series.entries[1].nextPolicy).toBeDefined();
    expect(series.entries[2].nextPolicy).toBeUndefined();
    // Policy chaining: entry 2 policyBefore == entry 1 nextPolicy.
    expect(series.entries[1].policyBeforeMatch).toEqual(series.entries[0].nextPolicy);
    expect(series.entries[2].policyBeforeMatch).toEqual(series.entries[1].nextPolicy);
  });

  it("keeps the build proposal constant across the series", () => {
    const series = buildSeries();
    const first = JSON.stringify(series.entries[0].designBeforeMatch);
    for (const entry of series.entries) {
      expect(JSON.stringify(entry.designBeforeMatch)).toBe(first);
      expect(entry.designBeforeMatch.machineName).toBe("The Bulwark");
    }
  });
});
