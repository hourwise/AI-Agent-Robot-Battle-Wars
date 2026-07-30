import type { BenchmarkReport } from "./benchmark.types.js";

export function renderTextReport(report: BenchmarkReport): string {
  const m = report.metrics;
  const slot = m.slotOutcomes;
  const ci = slot.wilsonCI;

  const lines: string[] = [];

  lines.push("FORGE ARENA BENCHMARK");
  lines.push("");
  lines.push(`Pairing: ${report.fighterX.machineName} vs ${report.fighterY.machineName}`);
  lines.push(`Seed bank: ${report.seedBankId}`);
  lines.push(`Partition: ${report.partition}`);
  lines.push(`Seeds: ${m.seedCount}`);
  lines.push(`Role assignments: ${m.roleAssignmentsPerSeed} per seed`);
  lines.push(`Total simulations: ${m.totalSimulations}`);
  lines.push(`Component qualification: ${report.componentQualificationId}`);
  lines.push(`Qualification checksum: ${report.componentQualification.configChecksum}`);
  lines.push(`Qualification model: ${report.componentQualification.model}`);
  lines.push(
    `Qualification constants: armour ${report.qualificationConstants.armourFactor}, min ${report.qualificationConstants.minimumImpact}, critical ${report.qualificationConstants.criticalThreshold}, high ${report.qualificationConstants.highImpactThreshold}`,
  );
  lines.push(`Role-swapped: ${report.roleSwapped ? "yes" : "no"}`);
  lines.push("");

  lines.push("SLOT OUTCOMES (fighter_a vs fighter_b)");
  lines.push(`Fighter A wins: ${slot.fighterAWins}`);
  lines.push(`Fighter B wins: ${slot.fighterBWins}`);
  lines.push(`Draws: ${slot.draws}`);
  lines.push(
    `Fighter A win rate: ${(slot.winRateA * 100).toFixed(1)}% [95% CI: ${(ci.lower * 100).toFixed(1)}%–${(ci.upper * 100).toFixed(1)}%]`,
  );
  lines.push(`Fighter B win rate: ${(slot.winRateB * 100).toFixed(1)}%`);
  lines.push(
    `First-slot advantage: ${slot.firstSlotAdvantage >= 0 ? "+" : ""}${(slot.firstSlotAdvantage * 100).toFixed(1)} pp`,
  );
  lines.push("");

  if (m.competitorOutcomes && report.roleSwapped) {
    const co = m.competitorOutcomes;
    lines.push("COMPETITOR OUTCOMES (design X vs design Y)");
    lines.push(`Design X wins: ${co.xWins}`);
    lines.push(`Design Y wins: ${co.yWins}`);
    lines.push(`Draws: ${co.draws}`);
    lines.push(`X win rate: ${(co.winRateX * 100).toFixed(1)}%`);
    lines.push(`Y win rate: ${(co.winRateY * 100).toFixed(1)}%`);
    lines.push("");
  }

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

  lines.push("COMPONENT TRANSITIONS (v2)");
  lines.push(`Damaged transitions: ${m.totalDamagedTransitions}`);
  lines.push(`  — Mobility: ${m.mobilityDamagedTransitions}`);
  lines.push(`  — Weapon: ${m.weaponDamagedTransitions}`);
  lines.push(`  — Utility: ${m.utilityDamagedTransitions}`);
  lines.push(`Disabled transitions: ${m.totalDisabledTransitions}`);
  lines.push(`  — Mobility: ${m.mobilityDisabledTransitions}`);
  lines.push(`  — Weapon: ${m.weaponDisabledTransitions}`);
  lines.push(`  — Utility: ${m.utilityDisabledTransitions}`);
  lines.push(`Resisted transitions: ${m.totalResistedTransitions}`);
  lines.push(`Guards spent: ${m.totalGuardsSpent}, lost: ${m.totalGuardsLost}`);
  lines.push(
    `Matches with any transition: ${(m.matchesWithAnyComponentTransition * 100).toFixed(1)}%`,
  );
  lines.push(
    `Matches with any damaged component: ${(m.matchesWithAnyDamagedComponent * 100).toFixed(1)}%`,
  );
  lines.push("");

  lines.push("COMPONENT DISABLES (terminal)");
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
  lines.push(
    `Qualifying hits: ${m.totalQualifyingHits} (${(m.qualificationRate * 100).toFixed(1)}% of hits)`,
  );
  lines.push(`Critical-qualified: ${m.totalCriticalQualifiedHits}`);
  lines.push(`High-impact-qualified: ${m.totalHighImpactQualifiedHits}`);
  lines.push(`Non-qualifying successful hits: ${m.totalNonQualifyingSuccessfulHits}`);
  lines.push(
    `Matches with 1+/2+/3+ qualifying hits: ${m.matchesWithAtLeastOneQualifyingHit}/${m.matchesWithAtLeastTwoQualifyingHits}/${m.matchesWithAtLeastThreeQualifyingHits}`,
  );
  lines.push("");

  lines.push(`Outcomes checksum: ${report.outcomesChecksum}`);
  lines.push(`Report checksum: ${report.reportChecksum}`);

  return lines.join("\n");
}
