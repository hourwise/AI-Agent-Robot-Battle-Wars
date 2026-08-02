import type { GridActivationReadinessMetrics } from "./metrics.js";
import type { ReadinessGateResult } from "./gates.js";
import type { GridActivationReadinessDecision } from "./decision.js";
import { GRID_ACTIVATION_READINESS_DISCLAIMER } from "./decision.js";
import type { GridActivationReadinessRunPlan } from "./run-plan.js";
import { GRID_ACTIVATION_READINESS_SUITE_ID } from "./run-plan.js";

/**
 * Grid activation-readiness human-readable report (Milestone 0.2C Phase 3E1).
 *
 * A deterministic, self-contained development-only evaluation report. It may
 * contain diagnostic counts and ratios, but never recommends component
 * threshold, build or policy tuning, never calls the suite a benchmark, never
 * calls any result a balance pass, never claims production readiness and never
 * states that grid is now default.
 */
export interface BuildGridActivationReadinessReportInput {
  evaluationId: string;
  suiteId: string;
  actionEvidenceModel: string;
  provenanceModel: string;
  createdAt: string;
  seedRegistryId: string;
  seedRegistryChecksum: string;
  scenarioRegistryId: string;
  scenarioRegistryChecksum: string;
  suiteChecksum: string;
  seedCount: number;
  scenarioCount: number;
  assignmentCount: number;
  totalSimulations: number;
  deterministic: boolean;
  metrics: GridActivationReadinessMetrics;
  gates: readonly ReadinessGateResult[];
  decision: GridActivationReadinessDecision;
}

function formatRatio(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function buildGridActivationReadinessReport(
  input: BuildGridActivationReadinessReportInput,
): string {
  const separator = "═".repeat(50);
  const lines: string[] = [];

  lines.push(separator);
  lines.push("FORGE ARENA — GRID ACTIVATION-READINESS EVALUATION REPORT");
  lines.push("DEVELOPMENT-ONLY / NON-BENCHMARK / NON-ACTIVATING");
  lines.push(separator);
  lines.push("");
  lines.push(`Evaluation ID: ${input.evaluationId}`);
  lines.push(`Suite ID: ${input.suiteId}`);
  lines.push(`Action evidence model: ${input.actionEvidenceModel}`);
  lines.push(`Provenance model: ${input.provenanceModel}`);
  lines.push(`Created: ${input.createdAt}`);
  lines.push(
    `Runtime identity: simulator ${"0.3.0"} (${"grid-3x3-v1"}) / ruleset ${"0.2.0"} / catalogue ${"1"}`,
  );
  lines.push("");
  lines.push("REGISTRIES:");
  lines.push(`  Seed registry: ${input.seedRegistryId} (${input.seedCount} seeds)`);
  lines.push(`  Seed registry checksum: ${input.seedRegistryChecksum}`);
  lines.push(
    `  Scenario registry: ${input.scenarioRegistryId} (${input.scenarioCount} scenarios, ${input.assignmentCount} assignments)`,
  );
  lines.push(`  Scenario registry checksum: ${input.scenarioRegistryChecksum}`);
  lines.push(`  Suite checksum: ${input.suiteChecksum}`);
  lines.push("");
  lines.push(`Total simulations: ${input.totalSimulations}`);
  lines.push(
    `Determinism: ${input.deterministic ? "verified (byte-identical repeat)" : "NOT VERIFIED"}`,
  );
  lines.push("");

  const execution = input.metrics.execution;
  lines.push("CONTRACT RESULTS:");
  lines.push(
    `  Completed: ${execution.totalCompletedRuns}/${execution.totalPlannedRuns} runs`,
  );
  lines.push(
    `  Schema-valid records: ${execution.schemaValidRecords} | schema-valid reports: ${execution.schemaValidReports}`,
  );
  lines.push(`  Replay-agreeing matches: ${execution.replayAgreeingMatches}`);
  lines.push(
    `  Invalid events: ${execution.invalidEventCount} | mutation failures: ${execution.mutationFailures}`,
  );
  lines.push("");

  const movement = input.metrics.movement;
  lines.push("MOVEMENT COVERAGE:");
  lines.push(
    `  Actions: ${Object.entries(movement.actionCounts)
      .map(([a, c]) => `${a} ${c}`)
      .join(", ")}`,
  );
  lines.push(
    `  Translated: ${Object.entries(movement.translatedActionCounts)
      .map(([a, c]) => `${a} ${c}`)
      .join(", ")}`,
  );
  lines.push(
    `  Zone visits: ${Object.entries(movement.zoneVisits)
      .map(([z, c]) => `${z} ${c}`)
      .join(", ")}`,
  );
  lines.push(
    `  Bearing samples: ${Object.entries(movement.bearingCounts)
      .map(([b, c]) => `${b} ${c}`)
      .join(", ")}`,
  );
  lines.push(
    `  Exposed planar zones: ${Object.entries(movement.exposedPlanarArmourZoneCounts)
      .map(([z, c]) => `${z} ${c}`)
      .join(", ")}`,
  );
  lines.push("");

  const combat = input.metrics.combat;
  lines.push("COMBAT COVERAGE:");
  lines.push(
    `  Attacks attempted: ${combat.attacksAttempted} | hits: ${combat.hits} | misses: ${combat.misses} | critical hits: ${combat.criticalHits}`,
  );
  lines.push(
    `  Integrity damage events: ${combat.integrityDamageEvents} | knockback: ${combat.knockbackEvents} | grapple reposition: ${combat.grappleRepositionEvents} | overturns: ${combat.overturnEvents}`,
  );
  lines.push(
    `  Component transitions — damaged: ${combat.componentDamaged} | disabled: ${combat.componentDisabled} | resisted: ${combat.componentDamageResisted}`,
  );
  lines.push("");

  const results = input.metrics.results;
  lines.push("RESULT METHODS:");
  lines.push(
    `  Judges: ${results.judges} | destruction: ${results.destruction} | immobilisation: ${results.immobilisation} | draws: ${results.draws} | round-cap: ${results.roundCapMatches}`,
  );
  lines.push(
    `  Rounds — min ${results.roundsMin} / max ${results.roundsMax} / mean ${results.roundsMean.toFixed(2)} / median ${results.roundsMedian}`,
  );
  lines.push(
    `  Maximum consecutive no-progress rounds: ${results.maximumConsecutiveNoProgressRounds}`,
  );
  lines.push("");

  const slot = input.metrics.slotOrder;
  lines.push("SLOT-ORDER DIAGNOSTICS:");
  lines.push(
    `  Fighter-A wins: ${slot.fighterAWins} | fighter-B wins: ${slot.fighterBWins} | decisive: ${slot.decisiveMatches}`,
  );
  lines.push(`  Absolute first-slot advantage: ${slot.absoluteFirstSlotAdvantage}`);
  lines.push(
    `  Bulwark mirror — decisive: ${slot.bulwarkMirrorDecisiveCount} | slot imbalance: ${slot.bulwarkMirrorSlotImbalance.toFixed(4)}`,
  );
  lines.push(
    `  Paired role-swap — comparisons: ${slot.pairedAsymmetricComparisons} | outcome-stable: ${slot.pairedOutcomeStableComparisons} | slot-sensitive: ${slot.pairedSlotSensitiveComparisons} | sensitivity ratio: ${slot.pairedSlotSensitivityRatio.toFixed(4)}`,
  );
  lines.push("");

  lines.push("PROGRESS DIAGNOSTICS:");
  lines.push(
    `  Attackless rate (non-Sentinel): ${formatRatio(input.metrics.attacklessRate)}`,
  );
  lines.push(`  Round-cap concentration: ${formatRatio(input.metrics.roundCapRate)}`);
  lines.push("");

  const timing = input.metrics.timing;
  lines.push("TIMING DIAGNOSTICS (informational only):");
  lines.push(
    `  Total: ${timing.totalElapsedMs.toFixed(2)} ms | mean ${timing.meanMsPerMatch.toFixed(2)} ms/match | median ${timing.medianMsPerMatch.toFixed(2)} ms/match | p95 ${timing.p95MsPerMatch.toFixed(2)} ms/match`,
  );
  lines.push("");

  lines.push("GATES:");
  for (const gateResult of input.gates) {
    const block = gateResult.blockingReason ? ` — ${gateResult.blockingReason}` : "";
    lines.push(
      `  ${gateResult.gateId} [${gateResult.category}] ${gateResult.outcome.toUpperCase()} (observed: ${gateResult.observedValue}; threshold: ${gateResult.frozenThreshold})${block}`,
    );
  }
  lines.push("");

  const blockers = input.gates
    .filter((g) => g.outcome !== "pass")
    .map((g) => `${g.gateId}: ${g.blockingReason ?? g.evidence}`);
  lines.push(
    `BLOCKERS / MISSING EVIDENCE: ${blockers.length > 0 ? blockers.join(" | ") : "none"}`,
  );
  lines.push("");
  lines.push(`FINAL READINESS CLASSIFICATION: ${input.decision}`);
  lines.push("");
  lines.push(GRID_ACTIVATION_READINESS_DISCLAIMER);
  lines.push("Normal 'match' and 'series' commands remain legacy.");
  lines.push("Grid has not been activated and is not the default runtime.");
  lines.push(separator);

  return lines.join("\n");
}

/** Fixed suite ID helper for report callers. */
export function gridActivationReadinessReportSuiteId(): string {
  return GRID_ACTIVATION_READINESS_SUITE_ID;
}

/** Helper to build a report input skeleton for tests (defaults empty). */
export interface GridActivationReadinessReportPlanSummary {
  plan: GridActivationReadinessRunPlan;
  evaluationId: string;
  createdAt: string;
  suiteChecksum: string;
}
