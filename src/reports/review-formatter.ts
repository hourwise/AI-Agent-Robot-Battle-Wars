import type { FactualMatchReport } from "../schemas/factual-report.schema.js";

export function formatFactualReportForPrompt(report: FactualMatchReport): string {
  const lines: string[] = [];

  lines.push("=== MATCH RESULT ===");
  lines.push(`Seed: ${report.seed}`);
  lines.push(`Rounds: ${report.rounds}`);
  lines.push(`Winner: ${report.winner ?? "Draw"} by ${report.resultMethod}`);
  lines.push("");

  lines.push("=== FIGHTER A ===");
  lines.push(formatFighterSummary(report.fighterA));
  lines.push("");

  lines.push("=== FIGHTER B ===");
  lines.push(formatFighterSummary(report.fighterB));
  lines.push("");

  if (report.firstHit) {
    lines.push(
      `First hit (round ${report.firstHit.round}): ${report.firstHit.description}`,
    );
    lines.push("");
  }

  if (report.criticalHits.length > 0) {
    lines.push(`Critical hits (${report.criticalHits.length}):`);
    for (const hit of report.criticalHits.slice(0, 5)) {
      lines.push(`  Round ${hit.round}: ${hit.description}`);
    }
    lines.push("");
  }

  if (report.componentFailures.length > 0) {
    lines.push(`Component failures (${report.componentFailures.length}):`);
    for (const f of report.componentFailures) {
      lines.push(`  Round ${f.round}: ${f.description}`);
    }
    lines.push("");
  }

  if (report.overturns.length > 0) {
    lines.push(`Overturns (${report.overturns.length}):`);
    for (const o of report.overturns) {
      lines.push(`  Round ${o.round}: ${o.description}`);
    }
    lines.push("");
  }

  lines.push("=== FINAL STATES ===");
  lines.push(formatFinalState("A", report.finalStates.fighterA));
  lines.push(formatFinalState("B", report.finalStates.fighterB));

  return lines.join("\n");
}

function formatFighterSummary(fighter: FactualMatchReport["fighterA"]): string {
  const lines: string[] = [];
  lines.push(`  Name: ${fighter.machineName}`);
  lines.push(
    `  Build: ${fighter.chassisId} chassis, ${fighter.mobilityId} mobility, ${fighter.weaponId} weapon, ${fighter.utilityId} utility`,
  );
  lines.push(
    `  Armour: F${fighter.armour.front} L${fighter.armour.left} R${fighter.armour.right} Ra${fighter.armour.rear} T${fighter.armour.top}`,
  );
  lines.push(`  Total cost: ${fighter.totalCost}`);
  lines.push(
    `  Policy: ${fighter.opening} opening, ${fighter.preferredRange} range, ${fighter.aggression}% aggression`,
  );
  lines.push(
    `  Targets: primary=${fighter.primaryTarget}, secondary=${fighter.secondaryTarget}`,
  );
  return lines.join("\n");
}

function formatComponentLine(state: FactualMatchReport["finalStates"]["fighterA"]): string {
  const parts: string[] = [];
  if (state.mobilityDisabled) parts.push("mobility=DISABLED");
  else if (state.mobilityDamaged) parts.push("mobility=DAMAGED");
  else parts.push("mobility=OK");
  if (state.weaponDisabled) parts.push("weapon=DISABLED");
  else if (state.weaponDamaged) parts.push("weapon=DAMAGED");
  else parts.push("weapon=OK");
  if (state.utilityDisabled) parts.push("utility=DISABLED");
  else if (state.utilityDamaged) parts.push("utility=DAMAGED");
  else parts.push("utility=OK");
  return `  Components: ${parts.join(", ")}`;
}

function formatFinalState(
  label: string,
  state: FactualMatchReport["finalStates"]["fighterA"],
): string {
  const lines: string[] = [];
  const integrityPct =
    state.maxIntegrity > 0 ? Math.round((state.integrity / state.maxIntegrity) * 100) : 0;
  lines.push(`  Fighter ${label}: ${state.machineName}`);
  lines.push(`  Integrity: ${state.integrity}/${state.maxIntegrity} (${integrityPct}%)`);
  lines.push(`  Energy: ${state.energy}, Heat: ${state.heat}`);
  lines.push(`  Zone: ${state.zone}, Facing: ${state.facing}`);
  lines.push(formatComponentLine(state));
  if (state.conditions.length > 0) {
    lines.push(`  Conditions: ${state.conditions.join(", ")}`);
  }
  return lines.join("\n");
}

export function formatReviewContextForPrompt(
  report: FactualMatchReport,
  reviewSummary: string,
  suggestedChanges: readonly {
    target: string;
    action: string;
    rationale: string;
    priority: string;
  }[],
): string {
  const lines: string[] = [];

  lines.push("=== PREVIOUS MATCH REPORT ===");
  lines.push(formatFactualReportForPrompt(report));
  lines.push("");

  lines.push("=== AI REVIEW SUMMARY ===");
  lines.push(reviewSummary);
  lines.push("");

  if (suggestedChanges.length > 0) {
    lines.push("=== SUGGESTED CHANGES ===");
    for (const change of suggestedChanges) {
      lines.push(`  [${change.priority}] ${change.target}: ${change.action}`);
      lines.push(`    Rationale: ${change.rationale}`);
    }
  }

  return lines.join("\n");
}
