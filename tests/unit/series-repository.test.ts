import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonSeriesRepository } from "../../src/persistence/series-repository.js";
import type { SeriesRecord } from "../../src/schemas/series.schema.js";

function makeMinimalSeries(overrides: Partial<SeriesRecord> = {}): SeriesRecord {
  return {
    schemaVersion: "1",
    seriesId: "550e8400-e29b-41d4-a716-446655440000",
    createdAt: "2026-07-26T12:00:00.000Z",
    updatedAt: "2026-07-26T12:00:00.000Z",
    status: "in_progress",
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
    ...overrides,
  };
}

describe("JsonSeriesRepository", () => {
  let tempDir: string;
  let repo: JsonSeriesRepository;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "forge-series-test-"));
    repo = new JsonSeriesRepository(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("saves and retrieves a series", async () => {
    const series = makeMinimalSeries();
    await repo.saveSeries(series);
    const loaded = await repo.getSeries(series.seriesId);
    expect(loaded).not.toBeNull();
    expect(loaded!.seriesId).toBe(series.seriesId);
    expect(loaded!.status).toBe("in_progress");
  });

  it("returns null for nonexistent series", async () => {
    const result = await repo.getSeries("00000000-0000-0000-0000-000000000000");
    expect(result).toBeNull();
  });

  it("returns null for invalid UUID", async () => {
    const result = await repo.getSeries("not-a-uuid");
    expect(result).toBeNull();
  });

  it("lists series sorted by creation date", async () => {
    const s1 = makeMinimalSeries({
      seriesId: "550e8400-e29b-41d4-a716-446655440001",
      createdAt: "2026-07-26T10:00:00.000Z",
    });
    const s2 = makeMinimalSeries({
      seriesId: "550e8400-e29b-41d4-a716-446655440002",
      createdAt: "2026-07-26T12:00:00.000Z",
    });
    await repo.saveSeries(s1);
    await repo.saveSeries(s2);
    const list = await repo.listSeries();
    expect(list).toHaveLength(2);
    expect(list[0]!.seriesId).toBe(s2.seriesId);
    expect(list[1]!.seriesId).toBe(s1.seriesId);
  });

  it("overwrites existing series (update semantics)", async () => {
    const series = makeMinimalSeries();
    await repo.saveSeries(series);
    const updated = { ...series, status: "completed" as const };
    await repo.saveSeries(updated);
    const loaded = await repo.getSeries(series.seriesId);
    expect(loaded!.status).toBe("completed");
  });
});
