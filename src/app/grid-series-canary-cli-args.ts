import { GRID_SERIES_CANARY_MAX_BASE_SEED } from "../canary/grid-series-canary-seed-plan.js";

/**
 * Grid series canary CLI argument parsing (Milestone 0.2C Phase 3D2B).
 *
 * Pure and side-effect free so it can be unit-tested without executing the
 * command. Rejects missing seed, negative seed, non-integer seed, unsafe
 * seed, an overflowing base seed (which would push the three sequential seeds
 * beyond the safe-integer range), duplicate seed arguments, unknown
 * arguments, `--target-wins` / `--maximum-matches` overrides, runtime
 * selectors, `--ai`, `--review`, provider arguments and API-key arguments.
 * No random default seed is ever generated.
 */
export interface GridSeriesCanaryCliArgs {
  baseSeed: number;
}

const SEED_ARG = "--seed" as const;

const FORBIDDEN_OVERRIDE_ARGS: ReadonlySet<string> = new Set([
  "--target-wins",
  "--targetwins",
  "--maximum-matches",
  "--maximummatches",
  "--max-matches",
  "--maxmatches",
]);

const FORBIDDEN_RUNTIME_ARGS: ReadonlySet<string> = new Set([
  "--runtime",
  "--simulator",
  "--model",
  "--positioning",
]);

const FORBIDDEN_AGENT_ARGS: ReadonlySet<string> = new Set([
  "--ai",
  "--review",
  "--provider",
  "--api-key",
  "--apikey",
  "--model-provider",
]);

export function parseGridSeriesCanaryCliArgs(
  args: readonly string[],
): GridSeriesCanaryCliArgs {
  const seeds: number[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === SEED_ARG) {
      const raw = args[i + 1];
      if (raw === undefined) {
        throw new Error("Missing value for --seed");
      }
      if (!/^-?\d+$/.test(raw)) {
        throw new Error(`--seed must be an integer; received ${raw}`);
      }
      const value = Number(raw);
      if (!Number.isSafeInteger(value)) {
        throw new Error(`--seed must be a safe integer; received ${raw}`);
      }
      seeds.push(value);
      i += 1;
      continue;
    }

    if (FORBIDDEN_OVERRIDE_ARGS.has(arg)) {
      throw new Error(
        `Unsupported argument: ${arg} (the series canary freezes targetWins=3 and maximumMatches=3 and accepts no overrides)`,
      );
    }
    if (FORBIDDEN_RUNTIME_ARGS.has(arg)) {
      throw new Error(
        `Unsupported argument: ${arg} (the series canary freezes the grid runtime and accepts no runtime selection)`,
      );
    }
    if (FORBIDDEN_AGENT_ARGS.has(arg)) {
      throw new Error(
        `Unsupported argument: ${arg} (the series canary never uses an AI provider)`,
      );
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unsupported argument: ${arg}`);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (seeds.length === 0) {
    throw new Error("Missing required --seed argument");
  }
  if (seeds.length > 1) {
    throw new Error("Duplicate --seed argument");
  }

  const baseSeed = seeds[0]!;
  if (baseSeed < 0) {
    throw new Error(`--seed must be a non-negative integer; received ${baseSeed}`);
  }
  if (baseSeed > GRID_SERIES_CANARY_MAX_BASE_SEED) {
    throw new Error(
      `--seed must be at most ${GRID_SERIES_CANARY_MAX_BASE_SEED} so the three sequential seeds stay within the safe-integer range; received ${baseSeed}`,
    );
  }
  return { baseSeed };
}
