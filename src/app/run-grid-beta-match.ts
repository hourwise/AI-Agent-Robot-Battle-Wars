import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GRID_OPT_IN_BETA_BANNER,
  GRID_OPT_IN_BETA_DISCLAIMER,
  GRID_OPT_IN_BETA_MATCH_COMMAND,
} from "../beta/grid-beta-identity.js";
import { runGridBetaMatch } from "./grid-beta-match.js";

/**
 * Explicit grid beta match command (Milestone 0.2C Phase 3G, Phase 4).
 *
 * The only beta match command: `match:grid:beta`. All match arguments are
 * required except `--help`; there is no `--runtime` argument, no alternate
 * output root and no provider/model argument. Missing acknowledgement fails
 * before fighter loading, ID generation, simulation or writes; invalid
 * selection fails closed; no environment, stored preference, previous record
 * or fallback may select grid; no grid failure retries through legacy and no
 * legacy failure retries through grid. The banner and disclaimer are printed
 * before results.
 */

export interface GridBetaMatchCliArgs {
  readonly seed: number;
  readonly fighterA: string;
  readonly fighterB: string;
  readonly acknowledgement: true;
}

export class GridBetaCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridBetaCliError";
  }
}

export function gridBetaMatchUsage(): string {
  return [
    `Usage: npm run ${GRID_OPT_IN_BETA_MATCH_COMMAND} -- \\`,
    "  --seed <non-negative integer> \\",
    "  --fighter-a <fighterId> \\",
    "  --fighter-b <fighterId> \\",
    "  --acknowledge-grid-beta",
    "",
    "Options:",
    "  --seed <n>                Non-negative integer match seed (required)",
    "  --fighter-a <fighterId>   Local scripted fighter identifier (required)",
    "  --fighter-b <fighterId>   Local scripted fighter identifier (required)",
    "  --acknowledge-grid-beta   Explicit acknowledgement that this is an",
    "                            opt-in, experimental, not-balance-qualified",
    "                            internal grid beta match (required)",
    "  --help                    Show this help",
    "",
    "There is no --runtime argument, no alternate output root and no",
    "provider/model argument. The grid runtime is selected only by this",
    "explicit command.",
  ].join("\n");
}

export function parseGridBetaMatchArgs(args: readonly string[]): GridBetaMatchCliArgs {
  if (args.length === 0) {
    throw new GridBetaCliError("no arguments provided");
  }
  let seed: number | null = null;
  let fighterA: string | null = null;
  let fighterB: string | null = null;
  let acknowledgement = false;
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (seen.has(arg)) {
      throw new GridBetaCliError(`duplicate argument: ${arg}`);
    }
    seen.add(arg);
    if (arg === "--seed") {
      const value = args[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new GridBetaCliError("--seed requires a non-negative integer value");
      }
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed) || parsed < 0) {
        throw new GridBetaCliError(
          `--seed must be a non-negative integer; received ${value}`,
        );
      }
      seed = parsed;
      i += 1;
    } else if (arg === "--fighter-a") {
      const value = args[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new GridBetaCliError("--fighter-a requires a fighter identifier");
      }
      fighterA = value;
      i += 1;
    } else if (arg === "--fighter-b") {
      const value = args[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new GridBetaCliError("--fighter-b requires a fighter identifier");
      }
      fighterB = value;
      i += 1;
    } else if (arg === "--acknowledge-grid-beta") {
      acknowledgement = true;
    } else if (arg === "--runtime") {
      throw new GridBetaCliError(
        "the grid beta command has no --runtime argument; the grid runtime is selected only by this explicit command",
      );
    } else if (arg === "--help") {
      throw new GridBetaCliError("--help is handled by the command before parsing");
    } else {
      throw new GridBetaCliError(`unknown argument: ${arg}`);
    }
  }
  if (seed === null) {
    throw new GridBetaCliError("--seed is required");
  }
  if (fighterA === null) {
    throw new GridBetaCliError("--fighter-a is required");
  }
  if (fighterB === null) {
    throw new GridBetaCliError("--fighter-b is required");
  }
  if (!acknowledgement) {
    throw new GridBetaCliError(
      "--acknowledge-grid-beta is required: the grid beta is explicitly selected, experimental and not balance-qualified",
    );
  }
  return { seed, fighterA, fighterB, acknowledgement: true };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(gridBetaMatchUsage());
    process.exit(0);
  }

  let parsed: GridBetaMatchCliArgs;
  try {
    parsed = parseGridBetaMatchArgs(args);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    console.error("");
    console.error(gridBetaMatchUsage());
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log(GRID_OPT_IN_BETA_BANNER);
  console.log("=".repeat(60));
  console.log(GRID_OPT_IN_BETA_DISCLAIMER);
  console.log("");

  try {
    const result = await runGridBetaMatch({
      seed: parsed.seed,
      fighterA: parsed.fighterA,
      fighterB: parsed.fighterB,
      acknowledgement: true,
    });
    console.log(`Match ID: ${result.matchId}`);
    console.log(`Seed: ${parsed.seed}`);
    console.log(`Fighters: ${parsed.fighterA} vs ${parsed.fighterB}`);
    console.log(`Winner: ${result.winner ?? "draw"}`);
    console.log(`Method: ${result.method} in ${result.rounds} round(s)`);
    console.log(`Artifact directory: ${result.artifactDirectory}`);
    console.log("");
    console.log(
      "This beta match result is not a balance conclusion, not a readiness result and not an adaptation or held-out evaluation. Legacy remains the default.",
    );
  } catch (e) {
    console.error("Grid beta match failed:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

function isCliEntry(): boolean {
  const arg1 = process.argv[1];
  if (typeof arg1 !== "string" || arg1.length === 0) return false;
  try {
    const norm = (p: string): string =>
      process.platform === "win32" ? p.toLowerCase() : p;
    return norm(resolve(arg1)) === norm(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isCliEntry()) {
  main().catch((e) => {
    console.error("Fatal error:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
