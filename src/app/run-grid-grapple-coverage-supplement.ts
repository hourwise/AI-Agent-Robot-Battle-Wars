import {
  GRID_GRAPPLE_COVERAGE_DEFAULT_ROOT,
  runGridGrappleCoverageSupplement,
} from "./grid-grapple-coverage-supplement.js";

/**
 * Explicit grid grapple-coverage supplemental command (Milestone 0.2C Phase
 * 3E2).
 *
 * Development-only, additive, non-benchmark, non-activating. Accepts no
 * arguments. A completed `coverage_confirmed`, `inconclusive` or `not_ready`
 * evidence result exits zero; it exits nonzero only for an operational failure
 * that prevents producing a validated supplement bundle.
 */
export function rejectGrappleSupplementArguments(args: readonly string[]): void {
  if (args.length > 0) {
    throw new Error(
      `The grid grapple-coverage supplement command accepts no arguments. Rejected: ${args.join(", ")}`,
    );
  }
}

async function main(): Promise<void> {
  let args: readonly string[];
  try {
    args = process.argv.slice(2);
    rejectGrappleSupplementArguments(args);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    console.error(
      "Usage: tsx src/app/run-grid-grapple-coverage-supplement.ts (no arguments accepted)",
    );
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("FORGE ARENA — GRID GRAPPLE COVERAGE SUPPLEMENT");
  console.log("DEVELOPMENT-ONLY / ADDITIVE / NON-ACTIVATING");
  console.log("=".repeat(60));
  console.log("");

  try {
    const outcome = await runGridGrappleCoverageSupplement({
      outputRoot: GRID_GRAPPLE_COVERAGE_DEFAULT_ROOT,
    });

    console.log(`Base v3 evaluation ID: ${outcome.baseV3EvaluationId}`);
    console.log(`Base v3 suite checksum: ${outcome.baseV3SuiteChecksum}`);
    console.log(`Supplement ID: ${outcome.supplementId}`);
    console.log(
      `Counts: ${outcome.seedCount} seeds / ${outcome.scenarioCount} scenarios / ${outcome.assignmentCount} assignments / ${outcome.runCount} runs`,
    );
    console.log(
      `Seed registry: ${outcome.seedRegistryId} (${outcome.seedRegistryChecksum})`,
    );
    console.log(
      `Scenario registry: ${outcome.scenarioRegistryId} (${outcome.scenarioRegistryChecksum})`,
    );
    console.log(`Plan checksum: ${outcome.planChecksum}`);
    console.log(
      `Runtime identity: simulator ${outcome.simulatorVersion} (${outcome.positioningModel}) / ruleset 0.2.0 / catalogue 1`,
    );
    console.log("");
    const g = outcome.metrics.grapple;
    console.log(
      `Grappler attempts: ${g.totalGrapplerAttackAttempts} | hits: ${g.totalGrapplerHits} | misses: ${g.totalGrapplerMisses}`,
    );
    console.log(`Valid grapple-reposition events: ${g.validGrappleRepositionEvents}`);
    console.log(
      `Fighter-A attacker reposition: ${g.fighterAAttackerRepositionCount} (distinct seeds ${g.distinctSeedsProducingFighterAAttackerReposition})`,
    );
    console.log(
      `Fighter-B attacker reposition: ${g.fighterBAttackerRepositionCount} (distinct seeds ${g.distinctSeedsProducingFighterBAttackerReposition})`,
    );
    console.log(
      `Same-cell Grappler hits without reposition: ${g.sameCellGrapplerHitsWithoutReposition}`,
    );
    console.log("");
    console.log(`SUPPLEMENTAL COVERAGE DECISION: ${outcome.decision}`);
    console.log(
      `COMBINED READINESS CLASSIFICATION: ${outcome.combinedReadinessClassification}`,
    );
    console.log("");
    console.log(`Artifact directory: ${outcome.artifactDirectory}`);
    console.log("");
    console.log(
      "No official v3 artifact was modified and no activation decision occurred.",
    );
    console.log(
      "This additive evidence does not qualify combat balance, does not perform the opt-in beta decision and does not activate the grid runtime.",
    );
    console.log("Grid grapple coverage supplement completed successfully.");
  } catch (e) {
    console.error(
      "Grid grapple coverage supplement failed:",
      e instanceof Error ? e.message : String(e),
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
