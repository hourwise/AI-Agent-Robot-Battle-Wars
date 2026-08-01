/**
 * Grid canary CLI argument parsing (Milestone 0.2C Phase 3D2A).
 *
 * Pure and side-effect free so it can be unit-tested without executing the
 * command. Rejects missing seed, negative seed, non-integer seed, duplicate
 * seed arguments, unknown arguments, `--ai`, `--review`, runtime-selection
 * flags and provider arguments. No random default seed is ever generated.
 */

export interface GridCanaryCliArgs {
  seed: number;
}

const SEED_ARG = "--seed" as const;

export function parseGridCanaryCliArgs(args: readonly string[]): GridCanaryCliArgs {
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

  const seed = seeds[0]!;
  if (seed < 0) {
    throw new Error(`--seed must be a non-negative integer; received ${seed}`);
  }
  return { seed };
}
