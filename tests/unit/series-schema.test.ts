import { describe, it, expect } from "vitest";
import {
  SeriesRecordSchema,
  serializeSeriesRecord,
  deserializeSeriesRecord,
  buildUsageSummary,
} from "../../src/schemas/series.schema.js";

function makeUsageEntry(overrides: Record<string, unknown> = {}) {
  return {
    phase: "design" as const,
    agentId: "deepseek",
    provider: "deepseek",
    model: "deepseek-v4-flash",
    providerRequestId: "chatcmpl-test",
    promptVersion: "design-v2",
    inputTokens: 500,
    outputTokens: 200,
    cachedTokens: 50,
    costUsd: 0.0003,
    costIsEstimated: true,
    pricingVersion: "2025-01",
    latencyMs: 1500,
    attempts: 1,
    fallbackUsed: false,
    errorCategory: "none" as const,
    ...overrides,
  };
}

function makeMinimalSeries() {
  return {
    schemaVersion: "1" as const,
    seriesId: "550e8400-e29b-41d4-a716-446655440000",
    createdAt: "2026-07-26T12:00:00.000Z",
    updatedAt: "2026-07-26T12:00:00.000Z",
    status: "in_progress" as const,
    competitor: { id: "deepseek", displayName: "DeepSeek AI", provider: "deepseek" },
    targetWins: 3,
    maximumMatches: 5,
    score: { aiWins: 0, bulwarkWins: 0, draws: 0 },
    entries: [],
    totalUsage: {
      totalCostUsd: null,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCachedTokens: 0,
      costIsEstimated: false,
      recordCount: 0,
    },
    winner: null,
  };
}

describe("series schema", () => {
  it("validates a minimal series record", () => {
    const result = SeriesRecordSchema.safeParse(makeMinimalSeries());
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = SeriesRecordSchema.safeParse({
      ...makeMinimalSeries(),
      status: "pending",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid winner value", () => {
    const result = SeriesRecordSchema.safeParse({
      ...makeMinimalSeries(),
      winner: "draw",
    });
    expect(result.success).toBe(false);
  });

  it("accepts null winner", () => {
    const result = SeriesRecordSchema.safeParse({
      ...makeMinimalSeries(),
      winner: null,
    });
    expect(result.success).toBe(true);
  });

  it("serializes and deserializes correctly", () => {
    const series = makeMinimalSeries();
    const json = serializeSeriesRecord(series as never);
    const loaded = deserializeSeriesRecord(json);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.record.schemaVersion).toBe("1");
      expect(loaded.record.seriesId).toBe(series.seriesId);
    }
  });

  it("rejects invalid JSON", () => {
    const result = deserializeSeriesRecord("not json");
    expect(result.ok).toBe(false);
  });
});

describe("buildUsageSummary", () => {
  it("returns null cost when any record has null costUsd", () => {
    const usage = [makeUsageEntry({ costUsd: 0.001 }), makeUsageEntry({ costUsd: null })];
    const summary = buildUsageSummary(usage);
    expect(summary.totalCostUsd).toBeNull();
    expect(summary.recordCount).toBe(2);
  });

  it("sums costs when all records have known costUsd", () => {
    const usage = [
      makeUsageEntry({ costUsd: 0.001 }),
      makeUsageEntry({ costUsd: 0.002 }),
    ];
    const summary = buildUsageSummary(usage);
    expect(summary.totalCostUsd).toBeCloseTo(0.003, 6);
    expect(summary.costIsEstimated).toBe(true);
  });

  it("aggregates token counts", () => {
    const usage = [
      makeUsageEntry({ inputTokens: 100, outputTokens: 50, cachedTokens: 10 }),
      makeUsageEntry({ inputTokens: 200, outputTokens: 80, cachedTokens: 0 }),
    ];
    const summary = buildUsageSummary(usage);
    expect(summary.totalInputTokens).toBe(300);
    expect(summary.totalOutputTokens).toBe(130);
    expect(summary.totalCachedTokens).toBe(10);
  });

  it("returns empty summary for no records", () => {
    const summary = buildUsageSummary([]);
    expect(summary.totalCostUsd).toBeNull();
    expect(summary.recordCount).toBe(0);
  });
});
