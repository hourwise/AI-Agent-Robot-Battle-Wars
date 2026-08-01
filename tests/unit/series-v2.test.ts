import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { runGridMatch } from "../../src/simulator/grid-runtime.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import {
  buildGridFactualReport,
  enrichMatchSummariesWithPolicy,
} from "../../src/reports/factual-match-report.js";
import {
  isSeriesRecordV2,
  validateSeriesRecord,
  serializeSeriesRecord,
  deserializeSeriesRecord,
  SeriesRecordV2Schema,
} from "../../src/schemas/series.schema.js";
import {
  buildComparativeReportModel,
  renderSeriesReport,
} from "../../src/reports/series-report.js";
import { V3_FIXTURE_BUILD } from "../fixtures/v3-match-record.js";
import type {
  SeriesMatchEntryV2,
  SeriesRecordV2,
} from "../../src/schemas/series.schema.js";

const build = createBulwarkBuild();

function gridReport(seed: number) {
  const result = runGridMatch({
    seed,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: "0.2.0",
    catalogueVersion: CATALOGUE_V1.version,
  });
  return enrichMatchSummariesWithPolicy(
    buildGridFactualReport(result),
    BULWARK_POLICY,
    BULWARK_POLICY,
  );
}

function makeGridEntry(seed: number, matchNumber: number): SeriesMatchEntryV2 {
  const report = gridReport(seed);
  const matchId = randomUUID();
  return {
    matchNumber,
    seed,
    matchId,
    match: {
      matchId,
      createdAt: "2025-01-01T00:00:00.000Z",
      seed,
      rounds: report.rounds,
      winner: report.winner,
      resultMethod: report.resultMethod,
      matchRecordSchemaVersion: "3",
      simulatorVersion: "0.3.0",
      positioningModel: "grid-3x3-v1",
    },
    factualReport: { ...report, matchId },
    review: null,
    designBeforeMatch: { ...V3_FIXTURE_BUILD.proposal },
    policyBeforeMatch: { ...BULWARK_POLICY },
    usage: [],
  };
}

function makeGridSeries(entries: SeriesMatchEntryV2[]): SeriesRecordV2 {
  const aiWins = entries.filter((e) => e.match.winner === "fighter_a").length;
  const bulwarkWins = entries.filter((e) => e.match.winner === "fighter_b").length;
  const draws = entries.length - aiWins - bulwarkWins;
  return {
    schemaVersion: "2",
    simulatorVersion: "0.3.0",
    positioningModel: "grid-3x3-v1",
    rulesetVersion: "0.2.0",
    catalogueVersion: "1",
    matchRecordSchemaVersion: "3",
    factualReportSchemaVersion: "2",
    seriesId: "16eae0af-9ca5-4c63-acb1-aee54f41ee58",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    status: "completed",
    competitor: { id: "test-agent", displayName: "Test AI", provider: "test" },
    targetWins: 1,
    maximumMatches: entries.length,
    score: { aiWins, bulwarkWins, draws },
    entries,
    totalUsage: {
      totalCostUsd: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCachedTokens: 0,
      costIsEstimated: false,
      recordCount: 0,
    },
    winner: aiWins > bulwarkWins ? "ai" : bulwarkWins > aiWins ? "bulwark" : null,
  };
}

describe("series v2 (Phase 3D1)", () => {
  it("accepts a valid synthetic grid series", () => {
    const record = makeGridSeries([makeGridEntry(1, 1), makeGridEntry(2, 2)]);
    expect(isSeriesRecordV2(record)).toBe(true);
    const validation = validateSeriesRecord(record);
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.record.schemaVersion).toBe("2");
      expect(validation.record.entries[0]!.factualReport.schemaVersion).toBe("2");
    }
  });

  it("round-trips a grid series through serialization unchanged", () => {
    const record = makeGridSeries([makeGridEntry(5, 1)]);
    const restored = deserializeSeriesRecord(serializeSeriesRecord(record));
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.record).toEqual(record);
      expect(isSeriesRecordV2(restored.record)).toBe(true);
    }
  });

  it("rejects a v2 series entry embedding a v1 factual report", () => {
    const record = makeGridSeries([makeGridEntry(1, 1)]);
    const entry = record.entries[0]!;
    const v1Report = {
      ...entry.factualReport,
      schemaVersion: "1",
    } as never;
    const bad = {
      ...record,
      entries: [{ ...entry, factualReport: v1Report }],
    };
    const result = SeriesRecordV2Schema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects a v2 series entry with a mismatched runtime in the match summary", () => {
    const record = makeGridSeries([makeGridEntry(1, 1)]);
    const entry = record.entries[0]!;
    const bad = {
      ...record,
      entries: [
        {
          ...entry,
          match: { ...entry.match, simulatorVersion: "0.2.0" },
        },
      ],
    };
    const result = SeriesRecordV2Schema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects a v2 series entry with a legacy-zone factual report", () => {
    const record = makeGridSeries([makeGridEntry(1, 1)]);
    const entry = record.entries[0]!;
    const report = {
      ...entry.factualReport,
      finalStates: {
        ...entry.factualReport.finalStates,
        fighterA: {
          ...entry.factualReport.finalStates.fighterA,
          zone: "north_edge",
        },
      },
    };
    const bad = { ...record, entries: [{ ...entry, factualReport: report }] };
    const result = SeriesRecordV2Schema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects mismatched seeds between entry and match summary / factual report", () => {
    const record = makeGridSeries([makeGridEntry(1, 1)]);
    const entry = record.entries[0]!;
    const badMatchSeed = {
      ...record,
      entries: [{ ...entry, match: { ...entry.match, seed: 999 } }],
    };
    expect(SeriesRecordV2Schema.safeParse(badMatchSeed).success).toBe(false);

    const badReportSeed = {
      ...record,
      entries: [{ ...entry, factualReport: { ...entry.factualReport, seed: 999 } }],
    };
    expect(SeriesRecordV2Schema.safeParse(badReportSeed).success).toBe(false);
  });

  it("rejects a mismatched matchId between entry and match summary", () => {
    const record = makeGridSeries([makeGridEntry(1, 1)]);
    const entry = record.entries[0]!;
    const bad = {
      ...record,
      entries: [{ ...entry, matchId: randomUUID() }],
    };
    expect(SeriesRecordV2Schema.safeParse(bad).success).toBe(false);
  });

  it("rejects duplicate matchIds", () => {
    const a = makeGridEntry(1, 1);
    const b = makeGridEntry(2, 2);
    const bad = makeGridSeries([
      a,
      { ...b, matchId: a.matchId, match: { ...b.match, matchId: a.matchId } },
    ]);
    expect(SeriesRecordV2Schema.safeParse(bad).success).toBe(false);
  });

  it("rejects duplicate match numbers", () => {
    const a = makeGridEntry(1, 1);
    const b = makeGridEntry(2, 1);
    const bad = makeGridSeries([a, b]);
    expect(SeriesRecordV2Schema.safeParse(bad).success).toBe(false);
  });

  it("rejects a score that exceeds the entry count", () => {
    const record = makeGridSeries([makeGridEntry(1, 1)]);
    const bad = {
      ...record,
      score: { aiWins: 2, bulwarkWins: 0, draws: 0 },
    };
    expect(SeriesRecordV2Schema.safeParse(bad).success).toBe(false);
  });

  it("renders the v2 comparative report with the runtime identity line", () => {
    const record = makeGridSeries([makeGridEntry(11, 1)]);
    const model = buildComparativeReportModel(record);
    expect(model.simulatorVersion).toBe("0.3.0");
    expect(model.positioningModel).toBe("grid-3x3-v1");
    const text = renderSeriesReport(model);
    expect(text).toContain("Runtime: simulator 0.3.0 (grid-3x3-v1)");
    expect(text).toContain("SERIES REPORT: 1 match");
  });

  it("does not alter grid facts while building the series", () => {
    const entry = makeGridEntry(4, 1);
    const snapshot = JSON.stringify(entry);
    const record = makeGridSeries([entry]);
    expect(validateSeriesRecord(record).ok).toBe(true);
    expect(JSON.stringify(entry)).toBe(snapshot);
  });
});
