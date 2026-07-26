import type { SeriesRecord, SeriesMatchEntry } from "../schemas/series.schema.js";
import { buildDesignDiff, formatDesignDiff, type DesignDiff } from "./design-diff.js";

export interface ComparativeReportModel {
  competitorName: string;
  totalMatches: number;
  score: { aiWins: number; bulwarkWins: number; draws: number };
  designDiffs: DesignDiff[];
  performanceHistory: PerformanceEntry[];
  costSummary: CostSummary;
  winner: "ai" | "bulwark" | null;
}

export interface PerformanceEntry {
  matchNumber: number;
  seed: number;
  result: "win" | "loss" | "draw";
  method: string;
  rounds: number;
  integrityRemaining: number;
  maxIntegrity: number;
  aiIntegrity: number;
  aiMaxIntegrity: number;
  bulwarkIntegrity: number;
  bulwarkMaxIntegrity: number;
}

export interface CostSummary {
  totalCostUsd: number | null;
  costIsEstimated: boolean;
  recordCount: number;
}

export function buildComparativeReportModel(
  record: SeriesRecord,
): ComparativeReportModel {
  const designDiffs: DesignDiff[] = [];

  for (let i = 1; i < record.entries.length; i++) {
    const prev = record.entries[i - 1]!;
    const curr = record.entries[i]!;

    if (prev.nextDesign && curr.designBeforeMatch) {
      const diff = buildDesignDiff(
        prev.nextDesign,
        curr.designBeforeMatch,
        prev.nextPolicy ?? prev.policyBeforeMatch,
        curr.policyBeforeMatch,
        prev.matchNumber,
        curr.matchNumber,
      );
      designDiffs.push(diff);
    } else if (
      hasComponentChanges(prev.designBeforeMatch, curr.designBeforeMatch) ||
      hasArmourChanges(prev.designBeforeMatch, curr.designBeforeMatch)
    ) {
      const diff = buildDesignDiff(
        prev.designBeforeMatch,
        curr.designBeforeMatch,
        prev.policyBeforeMatch,
        curr.policyBeforeMatch,
        prev.matchNumber,
        curr.matchNumber,
      );
      designDiffs.push(diff);
    }
  }

  const performanceHistory = record.entries.map((entry) =>
    buildPerformanceEntry(entry, record.competitor.id),
  );

  return {
    competitorName: record.competitor.displayName,
    totalMatches: record.entries.length,
    score: { ...record.score },
    designDiffs,
    performanceHistory,
    costSummary: {
      totalCostUsd: record.totalUsage.totalCostUsd,
      costIsEstimated: record.totalUsage.costIsEstimated,
      recordCount: record.totalUsage.recordCount,
    },
    winner: record.winner,
  };
}

function buildPerformanceEntry(
  entry: SeriesMatchEntry,
  _aiCompetitorId: string,
): PerformanceEntry {
  // Canonical mapping: fighter_a is always the AI competitor, fighter_b is Bulwark.
  const winner = entry.match.winner;

  let result: "win" | "loss" | "draw";
  if (winner === null) {
    result = "draw";
  } else if (winner === "fighter_a") {
    result = "win";
  } else {
    result = "loss";
  }

  const finalA = entry.factualReport.finalStates.fighterA;
  const finalB = entry.factualReport.finalStates.fighterB;
  const aiIntegrity = finalA.integrity;
  const aiMaxIntegrity = finalA.maxIntegrity;
  const bulwarkIntegrity = finalB.integrity;
  const bulwarkMaxIntegrity = finalB.maxIntegrity;

  return {
    matchNumber: entry.matchNumber,
    seed: entry.seed,
    result,
    method: entry.match.resultMethod,
    rounds: entry.match.rounds,
    integrityRemaining: aiIntegrity,
    maxIntegrity: aiMaxIntegrity,
    aiIntegrity,
    aiMaxIntegrity,
    bulwarkIntegrity,
    bulwarkMaxIntegrity,
  };
}

function hasComponentChanges(
  a: { chassisId: string; mobilityId: string; weaponId: string; utilityId: string },
  b: { chassisId: string; mobilityId: string; weaponId: string; utilityId: string },
): boolean {
  return (
    a.chassisId !== b.chassisId ||
    a.mobilityId !== b.mobilityId ||
    a.weaponId !== b.weaponId ||
    a.utilityId !== b.utilityId
  );
}

function hasArmourChanges(
  a: {
    armour: { front: number; left: number; right: number; rear: number; top: number };
  },
  b: {
    armour: { front: number; left: number; right: number; rear: number; top: number };
  },
): boolean {
  return (
    a.armour.front !== b.armour.front ||
    a.armour.left !== b.armour.left ||
    a.armour.right !== b.armour.right ||
    a.armour.rear !== b.armour.rear ||
    a.armour.top !== b.armour.top
  );
}

export function renderSeriesReport(model: ComparativeReportModel): string {
  const lines: string[] = [];

  const separator = "═".repeat(50);
  lines.push(separator);
  lines.push(
    `SERIES REPORT: ${model.totalMatches} match${model.totalMatches !== 1 ? "es" : ""}`,
  );
  lines.push(
    `Record: ${model.competitorName} ${model.score.aiWins} — The Bulwark ${model.score.bulwarkWins} (${model.score.draws} draw${model.score.draws !== 1 ? "s" : ""})`,
  );
  lines.push(separator);
  lines.push("");

  if (model.designDiffs.length > 0) {
    lines.push("DESIGN CHANGES:");
    for (const diff of model.designDiffs) {
      lines.push(formatDesignDiff(diff));
    }
    lines.push("");
  }

  lines.push("PERFORMANCE:");
  for (const perf of model.performanceHistory) {
    const icon = perf.result === "win" ? "W" : perf.result === "loss" ? "L" : "D";
    lines.push(
      `  Match ${perf.matchNumber}: [${icon}] ${perf.method} (R${perf.rounds}) — AI integrity ${perf.aiIntegrity}/${perf.aiMaxIntegrity} | Bulwark integrity ${perf.bulwarkIntegrity}/${perf.bulwarkMaxIntegrity}`,
    );
  }
  lines.push("");

  if (model.costSummary.recordCount > 0) {
    if (model.costSummary.totalCostUsd !== null) {
      lines.push(
        `COST: $${model.costSummary.totalCostUsd.toFixed(4)} across ${model.costSummary.recordCount} API calls${model.costSummary.costIsEstimated ? " (estimated)" : ""}`,
      );
    } else {
      lines.push(
        `COST: unavailable (${model.costSummary.recordCount} API calls with unknown cost)`,
      );
    }
    lines.push("");
  }

  if (model.winner) {
    const winnerName = model.winner === "ai" ? model.competitorName : "The Bulwark";
    lines.push(`SERIES WINNER: ${winnerName}`);
  } else {
    lines.push("SERIES: drawn");
  }

  lines.push(separator);

  return lines.join("\n");
}
