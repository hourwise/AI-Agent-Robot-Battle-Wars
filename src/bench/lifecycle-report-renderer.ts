import type { LifecycleSuiteReport } from "./lifecycle-suite.types.js";

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function renderLifecycleSuiteReport(report: LifecycleSuiteReport): string {
  const lines: string[] = [
    "FORGE ARENA COMPONENT LIFECYCLE SUITE",
    "",
    `Suite: ${report.suiteId}`,
    `Fixture checksum: ${report.fixtureChecksum}`,
    `Candidate: ${report.componentQualificationId}`,
    `Qualification model: ${report.componentQualification.model}`,
    `Qualification checksum: ${report.componentQualification.configChecksum}`,
    `Seed bank: ${report.seedBankId}`,
    `Partition: ${report.partition}`,
    `Total simulations: ${report.aggregateLifecycleSummary.totalSimulations}`,
    "",
  ];

  for (const fixture of report.fixtureReports) {
    const benchmark = fixture.benchmark;
    const metrics = benchmark.metrics;
    const diagnostics = fixture.diagnostics;
    lines.push(`FIXTURE ${fixture.fixtureId}`);
    lines.push(`Purpose: ${fixture.purpose}`);
    lines.push(`Classification: ${fixture.classification}`);
    lines.push(
      `Fighter X: ${fixture.fighterXCompetitorId} (${benchmark.fighterX.buildFingerprint}/${benchmark.fighterX.policyFingerprint})`,
    );
    lines.push(
      `Fighter Y: ${fixture.fighterYCompetitorId} (${benchmark.fighterY.buildFingerprint}/${benchmark.fighterY.policyFingerprint})`,
    );
    lines.push(
      `Seeds/assignments/simulations: ${benchmark.seedCount}/${benchmark.roleAssignmentsPerSeed}/${benchmark.totalSimulations}`,
    );
    lines.push(`Candidate ID: ${benchmark.componentQualificationId}`);
    lines.push(`Candidate checksum: ${benchmark.componentQualification.configChecksum}`);
    lines.push(
      `Checksums: outcomes ${benchmark.outcomesChecksum}, report ${benchmark.reportChecksum}`,
    );
    lines.push("");
    lines.push("QUALIFICATION");
    lines.push(`Successful hits: ${metrics.totalHits}`);
    lines.push(
      `Qualifying hits: ${metrics.totalQualifyingHits} (${percent(
        metrics.qualificationRate,
      )})`,
    );
    lines.push(`Qualifying hits/match: ${diagnostics.qualifyingHitsPerMatch.toFixed(2)}`);
    lines.push(
      `Matches with any qualification: ${percent(
        diagnostics.matchesWithAnyQualifyingHitRate,
      )}`,
    );
    lines.push(
      `Matches with 1+/2+/3+: ${metrics.matchesWithAtLeastOneQualifyingHit}/${metrics.matchesWithAtLeastTwoQualifyingHits}/${metrics.matchesWithAtLeastThreeQualifyingHits}`,
    );
    lines.push(
      `Critical/high qualified: ${metrics.totalCriticalQualifiedHits}/${metrics.totalHighImpactQualifiedHits}`,
    );
    lines.push("");
    lines.push("LIFECYCLE");
    lines.push(`Resistances: ${metrics.totalResistedTransitions}`);
    lines.push(
      `Resistance rate: ${
        diagnostics.resistanceRate === null
          ? "not applicable"
          : percent(diagnostics.resistanceRate)
      }`,
    );
    lines.push(`Damaged transitions: ${metrics.totalDamagedTransitions}`);
    lines.push(
      `Damaged mix mobility/weapon/utility: ${metrics.mobilityDamagedTransitions}/${metrics.weaponDamagedTransitions}/${metrics.utilityDamagedTransitions}`,
    );
    lines.push(`Disabled transitions: ${metrics.totalDisabledTransitions}`);
    lines.push(
      `Disabled mix mobility/weapon/utility: ${metrics.mobilityDisabledTransitions}/${metrics.weaponDisabledTransitions}/${metrics.utilityDisabledTransitions}`,
    );
    lines.push(`Terminal-disable incidence: ${percent(metrics.matchesWithAnyDisable)}`);
    lines.push(
      `First-round terminal-disable incidence: ${percent(
        diagnostics.firstRoundTerminalDisableRate,
      )}`,
    );
    lines.push(
      `Matches ending damaged: ${percent(
        diagnostics.matchesEndingWithDamagedComponentsRate,
      )}`,
    );
    lines.push("");
    lines.push("OUTCOME DIAGNOSTICS");
    lines.push(
      `Destruction/immobilisation/judges/draws: ${diagnostics.finishMethods.destruction}/${diagnostics.finishMethods.immobilisation}/${diagnostics.finishMethods.judges}/${diagnostics.finishMethods.draws}`,
    );
    lines.push(
      `Average/max rounds: ${metrics.avgRounds.toFixed(2)}/${metrics.maxRounds}`,
    );
    lines.push(`Round-cap incidence: ${percent(diagnostics.roundCapIncidence)}`);
    lines.push(
      `Average integrity A/B: ${metrics.avgIntegrityA.toFixed(
        2,
      )}/${metrics.avgIntegrityB.toFixed(2)}`,
    );
    lines.push(
      `Slot wins A/B/draws: ${metrics.slotOutcomes.fighterAWins}/${metrics.slotOutcomes.fighterBWins}/${metrics.slotOutcomes.draws}`,
    );
    if (benchmark.roleSwapped && metrics.competitorOutcomes) {
      lines.push(
        `Competitor wins X/Y/draws: ${metrics.competitorOutcomes.xWins}/${metrics.competitorOutcomes.yWins}/${metrics.competitorOutcomes.draws}`,
      );
    }
    lines.push("");
    lines.push("GATES");
    for (const gate of fixture.gates) {
      lines.push(
        `${gate.status.toUpperCase()} ${gate.gateId}: ${String(
          gate.observed,
        )} (expected ${gate.expected})`,
      );
    }
    lines.push("");
  }

  lines.push("SUITE GATES");
  for (const gate of report.suiteGates) {
    lines.push(
      `${gate.status.toUpperCase()} ${gate.gateId}: ${String(
        gate.observed,
      )} (expected ${gate.expected})`,
    );
  }
  lines.push("");
  lines.push(`Decision: ${report.decision}`);
  lines.push(`Suite checksum: ${report.suiteChecksum}`);
  return lines.join("\n");
}
