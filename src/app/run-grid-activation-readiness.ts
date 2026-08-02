import {
  GRID_ACTIVATION_READINESS_DEFAULT_ROOT,
  runGridActivationReadiness,
  type GridActivationReadinessResult,
} from "./grid-activation-readiness.js";

/**
 * Explicit grid activation-readiness command (Milestone 0.2C Phase 3E1).
 *
 * Development-only, non-benchmark, non-activating. Accepts no arguments;
 * every argument (seed/scenario/partition/output/threshold/--force/runtime/
 * provider/API-key) is rejected. A successfully completed evaluation exits
 * zero regardless of whether its decision is ready, inconclusive or not ready;
 * it exits nonzero only for an operational failure that prevents producing a
 * validated decision bundle.
 */
export function rejectReadinessArguments(args: readonly string[]): void {
  if (args.length > 0) {
    throw new Error(
      `The grid activation-readiness command accepts no arguments. Rejected: ${args.join(", ")}`,
    );
  }
}

function gateSummary(
  result: GridActivationReadinessResult,
  category: "hard-correctness" | "coverage" | "slot-order-stability" | "progress",
): string {
  const gates = result.gates.filter((g) => g.category === category);
  const pass = gates.filter((g) => g.outcome === "pass").length;
  const inconclusive = gates.filter((g) => g.outcome === "inconclusive").length;
  const fail = gates.filter((g) => g.outcome === "fail").length;
  return `${pass} pass / ${inconclusive} inconclusive / ${fail} fail`;
}

async function main(): Promise<void> {
  let args: readonly string[];
  try {
    args = process.argv.slice(2);
    rejectReadinessArguments(args);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    console.error(
      "Usage: tsx src/app/run-grid-activation-readiness.ts (no arguments accepted)",
    );
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("FORGE ARENA — GRID ACTIVATION-READINESS EVALUATION");
  console.log("DEVELOPMENT-ONLY / NON-BENCHMARK / NON-ACTIVATING");
  console.log("=".repeat(60));
  console.log("");

  try {
    const outcome = await runGridActivationReadiness({
      outputRoot: GRID_ACTIVATION_READINESS_DEFAULT_ROOT,
    });

    console.log(`Evaluation ID: ${outcome.evaluationId}`);
    console.log(`Suite ID: ${outcome.suiteId}`);
    console.log(
      `Counts: ${outcome.seedCount} seeds / ${outcome.scenarioCount} scenarios / ${outcome.assignmentCount} assignments / ${outcome.runCount} runs`,
    );
    console.log(
      `Seed registry: ${outcome.seedRegistryId} (${outcome.seedRegistryChecksum})`,
    );
    console.log(
      `Scenario registry: ${outcome.scenarioRegistryId} (${outcome.scenarioRegistryChecksum})`,
    );
    console.log(`Suite checksum: ${outcome.suiteChecksum}`);
    console.log(
      `Runtime identity: simulator ${outcome.simulatorVersion} (${outcome.positioningModel}) / ruleset 0.2.0 / catalogue 1`,
    );
    console.log("");
    console.log(`Contract gates (H01-H10): ${gateSummary(outcome, "hard-correctness")}`);
    console.log(`Coverage gates (C01-C06): ${gateSummary(outcome, "coverage")}`);
    console.log(
      `Slot-order gates (S01-S03): ${gateSummary(outcome, "slot-order-stability")}`,
    );
    console.log(`Progress gates (P01-P02): ${gateSummary(outcome, "progress")}`);
    console.log("");
    const timing = outcome.metrics.timing;
    console.log(
      `Timing (informational): ${timing.totalElapsedMs.toFixed(2)} ms total / ${timing.meanMsPerMatch.toFixed(2)} ms mean per match / p95 ${timing.p95MsPerMatch.toFixed(2)} ms`,
    );
    console.log("");
    console.log(`FINAL READINESS CLASSIFICATION: ${outcome.decision}`);
    console.log("");
    console.log(`Artifact directory: ${outcome.artifactDirectory}`);
    console.log("");
    console.log(
      "Normal 'match' and 'series' commands remain legacy. No activation occurred.",
    );
    console.log(
      "This development-only evaluation does not activate the grid runtime, does not qualify combat balance and does not authorise default migration.",
    );
    console.log("Grid activation-readiness evaluation completed successfully.");
  } catch (e) {
    console.error(
      "Grid activation-readiness evaluation failed:",
      e instanceof Error ? e.message : String(e),
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
