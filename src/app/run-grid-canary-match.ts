import { GRID_CANARY_DEFAULT_ROOT, runGridMatchCanary } from "./grid-match-canary.js";
import {
  parseGridCanaryCliArgs,
  type GridCanaryCliArgs,
} from "./grid-canary-cli-args.js";

/**
 * Explicit grid match canary command (Milestone 0.2C Phase 3D2A).
 *
 * Local-only, deterministic, requires an explicit seed and never touches the
 * normal `match` or `series` commands, normal match/series storage, an AI
 * provider or benchmark code.
 */

async function main(): Promise<void> {
  let args: GridCanaryCliArgs;
  try {
    args = parseGridCanaryCliArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    console.error(
      "Usage: tsx src/app/run-grid-canary-match.ts --seed <non-negative integer>",
    );
    process.exit(1);
  }

  console.log("=".repeat(50));
  console.log("FORGE ARENA — GRID MATCH CANARY");
  console.log("NON-DEFAULT / NON-BENCHMARK / LOCAL-ONLY");
  console.log("=".repeat(50));
  console.log("");

  try {
    const outcome = await runGridMatchCanary({
      seed: args.seed,
      outputRoot: GRID_CANARY_DEFAULT_ROOT,
    });

    console.log(`Canary ID: ${outcome.canaryId}`);
    console.log(`Scenario version: ${outcome.scenarioVersion}`);
    console.log(`Seed: ${outcome.seed}`);
    console.log(
      `Runtime identity: ${outcome.simulatorVersion} (${outcome.positioningModel})`,
    );
    console.log(`Match ID: ${outcome.matchId}`);
    console.log(
      `Result: ${outcome.rounds} round(s) — ${outcome.winner ?? "Draw"} by ${outcome.resultMethod}`,
    );
    console.log(`Event count: ${outcome.eventCount}`);
    console.log(`Translated circle events: ${outcome.evidence.translatedCircleEvents}`);
    console.log(
      `Corner zones visited: ${outcome.evidence.cornerZonesVisited} (${outcome.evidence.cornerZones.join(", ")})`,
    );
    console.log(
      `Rear exposure observed: ${outcome.evidence.rearExposureObserved ? "yes" : "no"}`,
    );
    console.log(
      `All movement zones canonical: ${outcome.evidence.allMovementZonesCanonical ? "yes" : "no"}`,
    );
    console.log(`Artifact directory: ${outcome.artifactDirectory}`);
    console.log("");
    console.log("Normal 'match' and 'series' commands remain legacy.");
    console.log("Grid match canary completed successfully.");
  } catch (e) {
    console.error("Grid canary failed:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
