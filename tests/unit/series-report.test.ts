import { describe, it, expect } from "vitest";
import {
  buildComparativeReportModel,
  renderSeriesReport,
} from "../../src/reports/series-report.js";
import type { SeriesRecord, SeriesMatchEntry } from "../../src/schemas/series.schema.js";

function makeMatchEntry(overrides: Partial<SeriesMatchEntry> = {}): SeriesMatchEntry {
  return {
    schemaVersion: "1",
    matchNumber: 1,
    seed: 100,
    matchId: "match-1",
    designBeforeMatch: {
      machineName: "Test Bot",
      chassisId: "medium",
      mobilityId: "wheels",
      weaponId: "ram",
      utilityId: "none",
      armour: { front: 20, left: 10, right: 10, rear: 0, top: 0 },
      designSummary: "test",
      designRationale: "test",
    },
    policyBeforeMatch: {
      opening: "flank",
      preferredRange: "close",
      aggression: 70,
      primaryTarget: "rear",
      secondaryTarget: "left",
      retreatThreshold: 30,
      heatThreshold: 80,
      fallback: "retreat",
    },
    match: {
      winner: "fighter_a",
      resultMethod: "destruction",
      rounds: 5,
    },
    factualReport: {
      schemaVersion: "1" as const,
      matchId: "match-1",
      seed: 100,
      rounds: 5,
      winner: "fighter_a",
      resultMethod: "destruction",
      fighterA: {
        fighterId: "fighter_a",
        machineName: "Test Bot",
        chassisId: "medium",
        mobilityId: "wheels",
        weaponId: "ram",
        utilityId: "none",
        armour: { front: 20, left: 10, right: 10, rear: 0, top: 0 },
        totalCost: 50,
        opening: "flank",
        preferredRange: "close",
        aggression: 70,
        primaryTarget: "rear",
        secondaryTarget: "left",
      },
      fighterB: {
        fighterId: "fighter_b",
        machineName: "The Bulwark",
        chassisId: "heavy",
        mobilityId: "tracks",
        weaponId: "ram",
        utilityId: "reinforced_drive",
        armour: { front: 60, left: 15, right: 15, rear: 0, top: 0 },
        totalCost: 94,
        opening: "rush",
        preferredRange: "close",
        aggression: 85,
        primaryTarget: "front",
        secondaryTarget: "front",
      },
      firstHit: undefined,
      criticalHits: [],
      componentFailures: [],
      overturns: [],
      finalStates: {
        fighterA: {
          fighterId: "fighter_a",
          machineName: "Test Bot",
          integrity: 80,
          maxIntegrity: 100,
          energy: 30,
          heat: 40,
          zone: "center" as const,
          facing: "north" as const,
          weaponCooldown: 0,
          utilityCooldown: 0,
          mobilityDisabled: false,
          weaponDisabled: false,
          utilityDisabled: false,
          conditions: [],
        },
        fighterB: {
          fighterId: "fighter_b",
          machineName: "The Bulwark",
          integrity: 0,
          maxIntegrity: 150,
          energy: 0,
          heat: 30,
          zone: "center" as const,
          facing: "south" as const,
          weaponCooldown: 0,
          utilityCooldown: 0,
          mobilityDisabled: false,
          weaponDisabled: false,
          utilityDisabled: false,
          conditions: [],
        },
      },
    },
    nextDesign: undefined,
    nextPolicy: undefined,
    usage: [],
    ...overrides,
  };
}

function makeSeriesRecord(
  entries: SeriesMatchEntry[],
  score: { aiWins: number; bulwarkWins: number; draws: number },
  winner: "ai" | "bulwark" | null,
): SeriesRecord {
  return {
    schemaVersion: "1",
    seriesId: "test-series",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "completed",
    competitor: { id: "test-agent", displayName: "Test AI", provider: "test" },
    targetWins: 3,
    maximumMatches: 5,
    score,
    entries,
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
}

describe("buildComparativeReportModel", () => {
  it("maps fighter_a win to [W]", () => {
    const entry = makeMatchEntry({
      matchNumber: 1,
      match: { winner: "fighter_a", resultMethod: "destruction", rounds: 5 },
    });
    const record = makeSeriesRecord(
      [entry],
      { aiWins: 1, bulwarkWins: 0, draws: 0 },
      "ai",
    );
    const model = buildComparativeReportModel(record);
    expect(model.performanceHistory).toHaveLength(1);
    expect(model.performanceHistory[0]!.result).toBe("win");
    expect(model.performanceHistory[0]!.aiIntegrity).toBe(80);
    expect(model.performanceHistory[0]!.bulwarkIntegrity).toBe(0);
  });

  it("maps fighter_b win to [L]", () => {
    const entry = makeMatchEntry({
      matchNumber: 1,
      match: { winner: "fighter_b", resultMethod: "immobilisation", rounds: 6 },
    });
    const record = makeSeriesRecord(
      [entry],
      { aiWins: 0, bulwarkWins: 1, draws: 0 },
      "bulwark",
    );
    const model = buildComparativeReportModel(record);
    expect(model.performanceHistory[0]!.result).toBe("loss");
  });

  it("maps null winner to [D]", () => {
    const entry = makeMatchEntry({
      matchNumber: 1,
      match: { winner: null, resultMethod: "draw", rounds: 20 },
    });
    const record = makeSeriesRecord(
      [entry],
      { aiWins: 0, bulwarkWins: 0, draws: 1 },
      null,
    );
    const model = buildComparativeReportModel(record);
    expect(model.performanceHistory[0]!.result).toBe("draw");
  });

  it("two-match fixture: fighter_b W then fighter_a W → 1–1", () => {
    const match1 = makeMatchEntry({
      matchNumber: 1,
      matchId: "match-1",
      match: { winner: "fighter_b", resultMethod: "immobilisation", rounds: 5 },
      factualReport: {
        ...makeMatchEntry().factualReport,
        winner: "fighter_b",
        resultMethod: "immobilisation",
        rounds: 5,
        finalStates: {
          fighterA: {
            ...makeMatchEntry().factualReport.finalStates.fighterA,
            integrity: 69,
            mobilityDisabled: true,
          },
          fighterB: {
            ...makeMatchEntry().factualReport.finalStates.fighterB,
            integrity: 150,
          },
        },
      },
    });

    const match2 = makeMatchEntry({
      matchNumber: 2,
      matchId: "match-2",
      match: { winner: "fighter_a", resultMethod: "immobilisation", rounds: 7 },
      factualReport: {
        ...makeMatchEntry().factualReport,
        winner: "fighter_a",
        resultMethod: "immobilisation",
        rounds: 7,
      },
    });

    const record = makeSeriesRecord(
      [match1, match2],
      { aiWins: 1, bulwarkWins: 1, draws: 0 },
      null,
    );
    const model = buildComparativeReportModel(record);

    expect(model.performanceHistory).toHaveLength(2);
    expect(model.performanceHistory[0]!.result).toBe("loss");
    expect(model.performanceHistory[1]!.result).toBe("win");
  });

  it("AI win by immobilisation while AI has lower integrity", () => {
    const entry = makeMatchEntry({
      matchNumber: 1,
      match: { winner: "fighter_a", resultMethod: "immobilisation", rounds: 7 },
      factualReport: {
        ...makeMatchEntry().factualReport,
        winner: "fighter_a",
        resultMethod: "immobilisation",
        rounds: 7,
        finalStates: {
          fighterA: {
            ...makeMatchEntry().factualReport.finalStates.fighterA,
            integrity: 69,
          },
          fighterB: {
            ...makeMatchEntry().factualReport.finalStates.fighterB,
            integrity: 150,
          },
        },
      },
    });
    const record = makeSeriesRecord(
      [entry],
      { aiWins: 1, bulwarkWins: 0, draws: 0 },
      "ai",
    );
    const model = buildComparativeReportModel(record);

    expect(model.performanceHistory[0]!.result).toBe("win");
    expect(model.performanceHistory[0]!.aiIntegrity).toBe(69);
    expect(model.performanceHistory[0]!.bulwarkIntegrity).toBe(150);
  });

  it("AI win by immobilisation while opponent retains full integrity", () => {
    const entry = makeMatchEntry({
      matchNumber: 1,
      match: { winner: "fighter_a", resultMethod: "immobilisation", rounds: 3 },
      factualReport: {
        ...makeMatchEntry().factualReport,
        winner: "fighter_a",
        resultMethod: "immobilisation",
        rounds: 3,
        finalStates: {
          fighterA: {
            ...makeMatchEntry().factualReport.finalStates.fighterA,
            integrity: 120,
          },
          fighterB: {
            ...makeMatchEntry().factualReport.finalStates.fighterB,
            integrity: 150,
          },
        },
      },
    });
    const record = makeSeriesRecord(
      [entry],
      { aiWins: 1, bulwarkWins: 0, draws: 0 },
      "ai",
    );
    const model = buildComparativeReportModel(record);

    expect(model.performanceHistory[0]!.result).toBe("win");
    expect(model.performanceHistory[0]!.aiIntegrity).toBe(120);
    expect(model.performanceHistory[0]!.bulwarkIntegrity).toBe(150);
  });

  it("includes both AI and Bulwark integrity in performance entry", () => {
    const entry = makeMatchEntry();
    const record = makeSeriesRecord(
      [entry],
      { aiWins: 1, bulwarkWins: 0, draws: 0 },
      "ai",
    );
    const model = buildComparativeReportModel(record);
    const perf = model.performanceHistory[0]!;
    expect(perf.aiIntegrity).toBe(80);
    expect(perf.aiMaxIntegrity).toBe(100);
    expect(perf.bulwarkIntegrity).toBe(0);
    expect(perf.bulwarkMaxIntegrity).toBe(150);
  });
});

describe("renderSeriesReport", () => {
  it("renders [W] for AI win and [L] for AI loss", () => {
    const match1 = makeMatchEntry({
      matchNumber: 1,
      match: { winner: "fighter_b", resultMethod: "immobilisation", rounds: 5 },
      factualReport: {
        ...makeMatchEntry().factualReport,
        winner: "fighter_b",
        resultMethod: "immobilisation",
        rounds: 5,
      },
    });
    const match2 = makeMatchEntry({
      matchNumber: 2,
      match: { winner: "fighter_a", resultMethod: "immobilisation", rounds: 7 },
      factualReport: {
        ...makeMatchEntry().factualReport,
        winner: "fighter_a",
        resultMethod: "immobilisation",
        rounds: 7,
      },
    });

    const record = makeSeriesRecord(
      [match1, match2],
      { aiWins: 1, bulwarkWins: 1, draws: 0 },
      null,
    );
    const model = buildComparativeReportModel(record);
    const output = renderSeriesReport(model);

    expect(output).toContain("Match 1: [L]");
    expect(output).toContain("Match 2: [W]");
  });

  it("renders both AI and Bulwark integrity with labels", () => {
    const entry = makeMatchEntry({
      match: { winner: "fighter_b", resultMethod: "immobilisation", rounds: 6 },
      factualReport: {
        ...makeMatchEntry().factualReport,
        winner: "fighter_b",
        resultMethod: "immobilisation",
        rounds: 6,
        finalStates: {
          fighterA: {
            ...makeMatchEntry().factualReport.finalStates.fighterA,
            integrity: 69,
            mobilityDisabled: true,
          },
          fighterB: {
            ...makeMatchEntry().factualReport.finalStates.fighterB,
            integrity: 150,
          },
        },
      },
    });
    const record = makeSeriesRecord(
      [entry],
      { aiWins: 0, bulwarkWins: 1, draws: 0 },
      "bulwark",
    );
    const model = buildComparativeReportModel(record);
    const output = renderSeriesReport(model);

    expect(output).toContain("AI integrity 69/100");
    expect(output).toContain("Bulwark integrity 150/150");
  });

  it("renders [D] for draw", () => {
    const entry = makeMatchEntry({
      match: { winner: null, resultMethod: "draw", rounds: 20 },
    });
    const record = makeSeriesRecord(
      [entry],
      { aiWins: 0, bulwarkWins: 0, draws: 1 },
      null,
    );
    const model = buildComparativeReportModel(record);
    const output = renderSeriesReport(model);

    expect(output).toContain("Match 1: [D]");
  });

  it("does not imply winner from integrity numbers", () => {
    // AI lost but had higher integrity — label must still be [L]
    const entry = makeMatchEntry({
      match: { winner: "fighter_b", resultMethod: "immobilisation", rounds: 4 },
      factualReport: {
        ...makeMatchEntry().factualReport,
        winner: "fighter_b",
        resultMethod: "immobilisation",
        rounds: 4,
        finalStates: {
          fighterA: {
            ...makeMatchEntry().factualReport.finalStates.fighterA,
            integrity: 140,
          },
          fighterB: {
            ...makeMatchEntry().factualReport.finalStates.fighterB,
            integrity: 80,
          },
        },
      },
    });
    const record = makeSeriesRecord(
      [entry],
      { aiWins: 0, bulwarkWins: 1, draws: 0 },
      "bulwark",
    );
    const model = buildComparativeReportModel(record);
    const output = renderSeriesReport(model);

    expect(output).toContain("[L]");
    // Both integrities show — neither is implicitly the "winner's"
    expect(output).toContain("AI integrity 140/100");
    expect(output).toContain("Bulwark integrity 80/150");
  });

  it("renders series score correctly for 1–1 draw", () => {
    const match1 = makeMatchEntry({
      matchNumber: 1,
      match: { winner: "fighter_b", resultMethod: "immobilisation", rounds: 5 },
      factualReport: {
        ...makeMatchEntry().factualReport,
        winner: "fighter_b",
        resultMethod: "immobilisation",
        rounds: 5,
      },
    });
    const match2 = makeMatchEntry({
      matchNumber: 2,
      match: { winner: "fighter_a", resultMethod: "immobilisation", rounds: 7 },
      factualReport: {
        ...makeMatchEntry().factualReport,
        winner: "fighter_a",
        resultMethod: "immobilisation",
        rounds: 7,
      },
    });

    const record = makeSeriesRecord(
      [match1, match2],
      { aiWins: 1, bulwarkWins: 1, draws: 0 },
      null,
    );
    const model = buildComparativeReportModel(record);
    const output = renderSeriesReport(model);

    expect(output).toContain("1 — The Bulwark 1");
    expect(output).toContain("SERIES: drawn");
  });
});
