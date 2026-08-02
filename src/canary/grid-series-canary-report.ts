import type { SeriesRecordV2 } from "../schemas/series.schema.js";

/**
 * Grid adaptive-series canary report renderer (Milestone 0.2C Phase 3D2B).
 *
 * A self-contained, human-readable, deterministic report for one series canary
 * run. It identifies the grid runtime (`simulator 0.3.0 (grid-3x3-v1)`),
 * states that it is a canary and non-benchmark, and reports the raw three-match
 * score with no win rates, percentages, comparative performance, promotion or
 * balance terminology.
 */
export function buildGridSeriesCanaryReport(series: SeriesRecordV2): string {
  const lines: string[] = [];
  const separator = "═".repeat(50);

  lines.push(separator);
  lines.push("FORGE ARENA — GRID ADAPTIVE-SERIES CANARY REPORT");
  lines.push("GRID SERIES CANARY / NON-BENCHMARK / LOCAL-ONLY");
  lines.push(
    `Runtime: simulator ${series.simulatorVersion} (${series.positioningModel})`,
  );
  lines.push(
    `Record: ${series.competitor.displayName} ${series.score.aiWins} — The Bulwark ${series.score.bulwarkWins} (${series.score.draws} draw${series.score.draws !== 1 ? "s" : ""})`,
  );
  lines.push(`${series.entries.length} matches completed`);
  lines.push(separator);
  lines.push("");

  lines.push("PERFORMANCE:");
  for (const entry of series.entries) {
    const winner = entry.match.winner;
    const result = winner === "fighter_a" ? "W" : winner === "fighter_b" ? "L" : "D";
    const integrityA = entry.factualReport.finalStates.fighterA.integrity;
    const maxA = entry.factualReport.finalStates.fighterA.maxIntegrity;
    const integrityB = entry.factualReport.finalStates.fighterB.integrity;
    const maxB = entry.factualReport.finalStates.fighterB.maxIntegrity;
    lines.push(
      `  Match ${entry.matchNumber}: [${result}] ${entry.match.resultMethod} (R${entry.match.rounds}) — AI integrity ${integrityA}/${maxA} | Bulwark integrity ${integrityB}/${maxB}`,
    );
  }
  lines.push("");

  lines.push("POLICY ADAPTATIONS:");
  for (const entry of series.entries) {
    if (entry.nextPolicy) {
      lines.push(
        `  After match ${entry.matchNumber}: aggression ${entry.policyBeforeMatch.aggression} -> ${entry.nextPolicy.aggression}, opening ${entry.policyBeforeMatch.opening} -> ${entry.nextPolicy.opening}`,
      );
    }
  }
  lines.push("");

  return lines.join("\n");
}
