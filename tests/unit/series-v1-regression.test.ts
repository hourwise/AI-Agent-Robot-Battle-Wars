import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { runMatch } from "../../src/simulator/simulator.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import {
  buildFactualReport,
  enrichMatchSummariesWithPolicy,
} from "../../src/reports/factual-match-report.js";
import {
  isSeriesRecordV1,
  validateSeriesRecord,
  serializeSeriesRecord,
  deserializeSeriesRecord,
} from "../../src/schemas/series.schema.js";
import {
  buildComparativeReportModel,
  renderSeriesReport,
} from "../../src/reports/series-report.js";
import { V3_FIXTURE_BUILD } from "../fixtures/v3-match-record.js";
import type { SeriesRecordV1 } from "../../src/schemas/series.schema.js";

function legacyReport(seed: number) {
  const result = runMatch({
    seed,
    fighterA: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
    fighterB: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
    rulesetVersion: "0.1.0",
    catalogueVersion: CATALOGUE_V1.version,
  });
  return enrichMatchSummariesWithPolicy(
    buildFactualReport(result),
    BULWARK_POLICY,
    BULWARK_POLICY,
  );
}

function makeV1Series(seed: number): SeriesRecordV1 {
  const report = legacyReport(seed);
  const matchId = randomUUID();
  return {
    schemaVersion: "1",
    seriesId: "3e86ec22-c16b-4d3b-8970-26bd8c547d5d",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    status: "completed",
    competitor: { id: "test-agent", displayName: "Test AI", provider: "test" },
    targetWins: 1,
    maximumMatches: 2,
    score: { aiWins: 1, bulwarkWins: 0, draws: 0 },
    entries: [
      {
        matchNumber: 1,
        seed,
        matchId,
        match: {
          matchId,
          createdAt: "2025-01-01T00:00:00.000Z",
          seed,
          rounds: report.rounds,
          winner: report.winner,
          resultMethod: report.resultMethod,
        },
        factualReport: report,
        review: null,
        designBeforeMatch: {
          machineName: "Fixture",
          chassisId: V3_FIXTURE_BUILD.proposal.chassisId,
          mobilityId: V3_FIXTURE_BUILD.proposal.mobilityId,
          weaponId: V3_FIXTURE_BUILD.proposal.weaponId,
          utilityId: V3_FIXTURE_BUILD.proposal.utilityId,
          armour: { ...V3_FIXTURE_BUILD.proposal.armour },
          designSummary: "fixture",
          designRationale: "fixture",
        },
        policyBeforeMatch: { ...BULWARK_POLICY },
        usage: [],
      },
    ],
    totalUsage: {
      totalCostUsd: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCachedTokens: 0,
      costIsEstimated: false,
      recordCount: 0,
    },
    winner: "ai",
  };
}

describe("series v1 regression (Phase 3D1)", () => {
  it("keeps a canonical v1 series valid and v1-only", () => {
    const record = makeV1Series(42);
    expect(isSeriesRecordV1(record)).toBe(true);
    const validation = validateSeriesRecord(record);
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.record.schemaVersion).toBe("1");
      expect(validation.record.entries[0]!.factualReport.schemaVersion).toBe("1");
    }
  });

  it("round-trips a v1 series unchanged", () => {
    const record = makeV1Series(7);
    const restored = deserializeSeriesRecord(serializeSeriesRecord(record));
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.record).toEqual(record);
      expect(isSeriesRecordV1(restored.record)).toBe(true);
    }
  });

  it("rejects a v1 series when declared as v2", () => {
    const record = makeV1Series(9);
    const asV2 = { ...record, schemaVersion: "2" };
    const validation = validateSeriesRecord(asV2);
    expect(validation.ok).toBe(false);
  });

  it("renders the v1 comparative report without a runtime line", () => {
    const record = makeV1Series(3);
    const model = buildComparativeReportModel(record);
    expect(model.simulatorVersion).toBeUndefined();
    expect(model.positioningModel).toBeUndefined();
    const text = renderSeriesReport(model);
    expect(text).not.toContain("Runtime:");
    expect(text).toContain("SERIES REPORT: 1 match");
  });
});
