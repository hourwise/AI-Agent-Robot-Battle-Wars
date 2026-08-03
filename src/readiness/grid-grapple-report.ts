import type { GridGrappleCoverageMetrics } from "./grid-grapple-metrics.js";
import type {
  GridActivationReadinessAddendumV1,
  GridGrappleCoverageDecision,
} from "./grid-grapple-decision.js";
import { GRID_ACTIVATION_READINESS_ADDENDUM_DISCLAIMER } from "./grid-grapple-decision.js";
import { GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT } from "./grid-grapple-run-plan.js";

/**
 * Grid grapple-coverage supplemental human-readable report (Milestone 0.2C
 * Phase 3E2, Phases 11/13).
 *
 * A deterministic, self-contained development-only additive evidence report.
 * It may contain diagnostic counts but never recommends tuning, never calls
 * the supplement a benchmark, never qualifies combat balance, never performs
 * the opt-in beta decision and never activates the grid runtime.
 */
export interface BuildGridGrappleCoverageReportInput {
  supplementId: string;
  createdAt: string;
  baseV3EvaluationId: string;
  baseV3SuiteChecksum: string;
  baseV3ManifestChecksum: string;
  baseV3DecisionChecksum: string;
  baseV3MetricsChecksum: string;
  baseV3Classification: string;
  baseV3NonPassGates: readonly string[];
  seedRegistryId: string;
  seedRegistryChecksum: string;
  scenarioRegistryId: string;
  scenarioRegistryChecksum: string;
  planChecksum: string;
  metrics: GridGrappleCoverageMetrics;
  decision: GridGrappleCoverageDecision;
  combinedReadinessClassification: string;
  addendum: GridActivationReadinessAddendumV1;
}

function formatZoneCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  if (entries.length === 0) return "none";
  return entries.map(([zone, count]) => `${zone} ${count}`).join(", ");
}

export function buildGridGrappleCoverageReport(
  input: BuildGridGrappleCoverageReportInput,
): string {
  const separator = "═".repeat(50);
  const lines: string[] = [];

  lines.push(separator);
  lines.push("FORGE ARENA — GRID GRAPPLE COVERAGE SUPPLEMENT REPORT");
  lines.push("DEVELOPMENT-ONLY / ADDITIVE / NON-ACTIVATING");
  lines.push(separator);
  lines.push("");
  lines.push(`Supplement ID: ${input.supplementId}`);
  lines.push(`Created: ${input.createdAt}`);
  lines.push(
    `Runtime identity: simulator ${"0.3.0"} (${"grid-3x3-v1"}) / ruleset ${"0.2.0"} / catalogue ${"1"}`,
  );
  lines.push("");
  lines.push("ANCHORED OFFICIAL v3 BASE EVALUATION:");
  lines.push(`  Evaluation ID: ${input.baseV3EvaluationId}`);
  lines.push(`  Suite checksum: ${input.baseV3SuiteChecksum}`);
  lines.push(`  Manifest checksum: ${input.baseV3ManifestChecksum}`);
  lines.push(`  Decision checksum: ${input.baseV3DecisionChecksum}`);
  lines.push(`  Metrics checksum: ${input.baseV3MetricsChecksum}`);
  lines.push(
    `  Classification: ${input.baseV3Classification} (non-pass gates: ${input.baseV3NonPassGates.join(", ") || "none"})`,
  );
  lines.push("");
  lines.push("SUPPLEMENT REGISTRIES:");
  lines.push(`  Seed registry: ${input.seedRegistryId} (${input.seedRegistryChecksum})`);
  lines.push(
    `  Scenario registry: ${input.scenarioRegistryId} (${input.scenarioRegistryChecksum})`,
  );
  lines.push(`  Plan checksum: ${input.planChecksum}`);
  lines.push("");
  lines.push(
    `Runs: ${input.metrics.execution.totalPlannedRuns} planned / ${input.metrics.execution.totalCompletedRuns} completed (24 seeds × 2 assignments)`,
  );
  lines.push(
    `Determinism: ${input.metrics.execution.deterministicRuns}/${GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT} deterministic runs`,
  );
  lines.push(
    `Valid records: ${input.metrics.execution.schemaValidRecords} | valid reports: ${input.metrics.execution.schemaValidReports} | final-state agreements: ${input.metrics.execution.finalStateAgreements}`,
  );
  lines.push("");

  const g = input.metrics.grapple;
  lines.push("GRAPPLE FEATURE EVIDENCE:");
  lines.push(
    `  Grappler attacks attempted: ${g.totalGrapplerAttackAttempts} | hits: ${g.totalGrapplerHits} | misses: ${g.totalGrapplerMisses}`,
  );
  lines.push(`  Valid grapple-reposition events: ${g.validGrappleRepositionEvents}`);
  lines.push(
    `  Same-cell Grappler hits without reposition: ${g.sameCellGrapplerHitsWithoutReposition}`,
  );
  lines.push(
    `  Distinct seeds producing reposition: ${g.distinctSeedsProducingReposition}`,
  );
  lines.push(
    `  Fighter-A attacker reposition count: ${g.fighterAAttackerRepositionCount} (distinct seeds ${g.distinctSeedsProducingFighterAAttackerReposition})`,
  );
  lines.push(
    `  Fighter-B attacker reposition count: ${g.fighterBAttackerRepositionCount} (distinct seeds ${g.distinctSeedsProducingFighterBAttackerReposition})`,
  );
  lines.push(`  Grapple source zones: ${formatZoneCounts(g.grappleSourceZoneCounts)}`);
  lines.push(
    `  Grapple destination zones: ${formatZoneCounts(g.grappleDestinationZoneCounts)}`,
  );
  lines.push(
    `  Grapple rounds — min ${g.grappleRoundMin ?? "n/a"} / max ${g.grappleRoundMax ?? "n/a"} / median ${g.grappleRoundMedian ?? "n/a"}`,
  );
  lines.push("");

  const iso = input.metrics.isolation;
  lines.push("ISOLATION DIAGNOSTICS:");
  lines.push(
    `  Non-grapple knockback events: ${iso.nonGrappleKnockbackEvents} | overturn events: ${iso.overturnEvents}`,
  );
  lines.push(
    `  Grapple events attributed to wrong fighter: ${iso.grappleEventsAttributedToWrongFighter}`,
  );
  lines.push(
    `  Malformed or resolver-disagreeing grapple events: ${iso.malformedOrResolverDisagreeingGrappleEvents}`,
  );
  lines.push("");
  lines.push(`SUPPLEMENTAL COVERAGE DECISION: ${input.decision}`);
  lines.push(
    `COMBINED READINESS CLASSIFICATION: ${input.combinedReadinessClassification}`,
  );
  lines.push("");
  lines.push(GRID_ACTIVATION_READINESS_ADDENDUM_DISCLAIMER);
  lines.push("No official v3 artifact was modified and no activation decision occurred.");
  lines.push(
    "This additive evidence does not authorise the separately performed opt-in beta decision or default activation.",
  );
  lines.push("Grid grapple coverage supplement completed successfully.");
  return lines.join("\n");
}
