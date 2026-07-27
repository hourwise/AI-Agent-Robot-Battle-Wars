import type { BenchmarkReport } from "./benchmark.types.js";

export function renderTextReport(report: BenchmarkReport): string {
  const m = report.metrics;
  const ci = m.wilsonCI;

  const lines: string[] = [];

  lines.push("FORGE ARENA BENCHMARK");
  lines.push("");
  lines.push(`Pairing: ${report.fighterA.machineName} vs ${report.fighterB.machineName}`);
  lines.push(`Seed bank: ${report.seedBankId}`);
  lines.push(`Partition: ${report.partition}`);
  lines.push(`Seeds: ${report.totalSimulations / (report.roleSwapped ? 2 : 1)}`);
  lines.push(`Simulations: ${report.totalSimulations}`);
  lines.push(`Role-swapped: ${report.roleSwapped ? "yes" : "no"}`);
  lines.push("");

  lines.push("RESULTS");
  lines.push(`Fighter A wins: ${m.fighterAWins}`);
  lines.push(`Fighter B wins: ${m.fighterBWins}`);
  lines.push(`Draws: ${m.draws}`);
  lines.push("");

  lines.push("WIN RATES");
  lines.push(
    `Fighter A: ${(m.winRateA * 100).toFixed(1)}% [95% CI: ${(ci.lower * 100).toFixed(1)}%–${(ci.upper * 100).toFixed(1)}%]`,
  );
  lines.push(`Fighter B: ${(m.winRateB * 100).toFixed(1)}%`);
  lines.push("");

  lines.push("FINISHES");
  lines.push(`Destruction: ${(m.destructionRate * 100).toFixed(1)}%`);
  lines.push(`Immobilisation: ${(m.immobilisationRate * 100).toFixed(1)}%`);
  lines.push(`Judges: ${(m.judgesRate * 100).toFixed(1)}%`);
  lines.push(`First-round finish: ${(m.firstRoundFinishRate * 100).toFixed(1)}%`);
  lines.push(
    `First-round immobilisation: ${(m.firstRoundImmobilisationRate * 100).toFixed(1)}%`,
  );
  lines.push("");

  lines.push("DURATION");
  lines.push(`Average rounds: ${m.avgRounds.toFixed(1)}`);
  lines.push(`Median rounds: ${m.medianRounds}`);
  lines.push(`Min rounds: ${m.minRounds}`);
  lines.push(`Max rounds: ${m.maxRounds}`);
  lines.push("");

  lines.push("INTEGRITY");
  lines.push(`Average Fighter A: ${m.avgIntegrityA.toFixed(1)}`);
  lines.push(`Average Fighter B: ${m.avgIntegrityB.toFixed(1)}`);
  lines.push(`Average differential (A–B): ${m.avgIntegrityDiff.toFixed(1)}`);
  lines.push("");

  lines.push("COMPONENT DISABLES");
  lines.push(`Matches with any disable: ${(m.matchesWithAnyDisable * 100).toFixed(1)}%`);
  lines.push(`Mobility disables: ${m.mobilityDisables}`);
  lines.push(`Weapon disables: ${m.weaponDisables}`);
  lines.push(`Utility disables: ${m.utilityDisables}`);
  lines.push("");

  lines.push("ATTACKS");
  lines.push(`Total attacks: ${m.totalAttacks}`);
  lines.push(`Total hits: ${m.totalHits}`);
  lines.push(`Hit rate: ${(m.hitRate * 100).toFixed(1)}%`);
  lines.push(`Critical hits: ${m.totalCriticalHits}`);
  lines.push("");

  lines.push(`Checksum: ${report.checksum}`);

  return lines.join("\n");
}
