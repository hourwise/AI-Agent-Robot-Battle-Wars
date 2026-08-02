import {
  GRID_SERIES_CANARY_DEFAULT_ROOT,
  runGridSeriesCanary,
} from "./grid-series-canary.js";
import {
  parseGridSeriesCanaryCliArgs,
  type GridSeriesCanaryCliArgs,
} from "./grid-series-canary-cli-args.js";

/**
 * Explicit grid adaptive-series canary command (Milestone 0.2C Phase 3D2B).
 *
 * Local-only, deterministic, requires an explicit base seed and never touches
 * the normal `match` or `series` commands, normal match/series storage, an AI
 * provider or benchmark code.
 */

async function main(): Promise<void> {
  let args: GridSeriesCanaryCliArgs;
  try {
    args = parseGridSeriesCanaryCliArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    console.error(
      "Usage: tsx src/app/run-grid-series-canary.ts --seed <non-negative integer>",
    );
    process.exit(1);
  }

  console.log("=".repeat(50));
  console.log("FORGE ARENA — GRID ADAPTIVE-SERIES CANARY");
  console.log("NON-DEFAULT / NON-BENCHMARK / LOCAL-ONLY");
  console.log("=".repeat(50));
  console.log("");

  try {
    const outcome = await runGridSeriesCanary({
      baseSeed: args.baseSeed,
      outputRoot: GRID_SERIES_CANARY_DEFAULT_ROOT,
    });

    console.log(`Canary ID: ${outcome.canaryId}`);
    console.log(`Scenario version: ${outcome.scenarioVersion}`);
    console.log(`Series ID: ${outcome.seriesId}`);
    console.log(`Seed plan: base ${outcome.baseSeed} -> ${outcome.seeds.join(", ")}`);
    console.log(
      `Runtime identity: ${outcome.simulatorVersion} (${outcome.positioningModel})`,
    );
    console.log("");
    console.log("MATCHES:");
    for (const match of outcome.matches) {
      console.log(
        `  Match ${match.matchNumber}: ${match.matchId} (seed ${match.seed}) — ${match.rounds} round(s) — ${match.winner ?? "Draw"} by ${match.resultMethod}`,
      );
    }
    console.log("");
    console.log(
      `Final raw score: ${outcome.score.aiWins} — ${outcome.score.bulwarkWins} (${outcome.score.draws} draws); series winner: ${outcome.winner ?? "none"}`,
    );
    console.log("");
    console.log("POLICY ADAPTATIONS:");
    for (const adaptation of outcome.adaptations) {
      console.log(
        `  After match ${adaptation.sourceMatchNumber}: aggression ${adaptation.aggressionBefore} -> ${adaptation.aggressionAfter}, opening ${adaptation.openingBefore} -> ${adaptation.openingAfter} (${adaptation.integrityComparison} / ${adaptation.openingReason})`,
      );
    }
    console.log("");
    console.log(`Artifact directory: ${outcome.artifactDirectory}`);
    console.log("");
    console.log("Normal 'match' and 'series' commands remain legacy.");
    console.log("Grid adaptive-series canary completed successfully.");
  } catch (e) {
    console.error(
      "Grid adaptive-series canary failed:",
      e instanceof Error ? e.message : String(e),
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
