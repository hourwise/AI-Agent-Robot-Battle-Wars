import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GRID_OPT_IN_BETA_BANNER,
  GRID_OPT_IN_BETA_DISCLAIMER,
  GRID_OPT_IN_BETA_MATCH_OUTPUT_ROOT,
  GRID_OPT_IN_BETA_REPLAY_COMMAND,
} from "../beta/grid-beta-identity.js";
import {
  GRID_BETA_MATCH_ASCII_REPLAY_ARTIFACT,
  GRID_BETA_MATCH_TEXT_REPLAY_ARTIFACT,
} from "../beta/grid-beta-match-bundle.js";
import { loadValidatedGridBetaReplayBundle } from "../beta/grid-beta-replay.js";

/**
 * Read-only grid beta replay command (Milestone 0.2C Phase 3G, Phase 11).
 *
 * `replay:grid:beta` reads from the fixed root `data/beta/grid-matches`,
 * validates the complete beta bundle before displaying anything, displays the
 * beta banner and disclaimer, and shows the stored text replay (default) or
 * additionally the stored validated ASCII replay (`--ascii`). It performs no
 * simulation, calls no provider, ignores the suspension marker so existing v3
 * replays remain available while suspended, does not modify the normal
 * `replay` command and does not read normal match storage.
 */

export interface GridBetaReplayCliArgs {
  readonly matchId: string;
  readonly ascii: boolean;
}

export class GridBetaReplayCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridBetaReplayCliError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function gridBetaReplayUsage(): string {
  return [
    `Usage: npm run ${GRID_OPT_IN_BETA_REPLAY_COMMAND} -- --match <uuid> [--ascii]`,
    "",
    "Options:",
    "  --match <uuid>   Beta match bundle ID to replay (required)",
    "  --ascii          Additionally display the stored validated ASCII replay",
    "  --help           Show this help",
  ].join("\n");
}

export function parseGridBetaReplayArgs(args: readonly string[]): GridBetaReplayCliArgs {
  if (args.length === 0) {
    throw new GridBetaReplayCliError("no arguments provided");
  }
  let matchId: string | null = null;
  let ascii = false;
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (seen.has(arg)) {
      throw new GridBetaReplayCliError(`duplicate argument: ${arg}`);
    }
    seen.add(arg);
    if (arg === "--match") {
      const value = args[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new GridBetaReplayCliError("--match requires a match UUID");
      }
      matchId = value;
      i += 1;
    } else if (arg === "--ascii") {
      ascii = true;
    } else if (arg === "--help") {
      throw new GridBetaReplayCliError("--help is handled by the command before parsing");
    } else {
      throw new GridBetaReplayCliError(`unknown argument: ${arg}`);
    }
  }
  if (matchId === null) {
    throw new GridBetaReplayCliError("--match is required");
  }
  if (!UUID_RE.test(matchId)) {
    throw new GridBetaReplayCliError(`--match must be a valid UUID; received ${matchId}`);
  }
  return { matchId, ascii };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(gridBetaReplayUsage());
    process.exit(0);
  }

  let parsed: GridBetaReplayCliArgs;
  try {
    parsed = parseGridBetaReplayArgs(args);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    console.error("");
    console.error(gridBetaReplayUsage());
    process.exit(1);
  }

  try {
    const { contents, validation } = await loadValidatedGridBetaReplayBundle(
      GRID_OPT_IN_BETA_MATCH_OUTPUT_ROOT,
      parsed.matchId,
    );
    console.log("=".repeat(60));
    console.log(GRID_OPT_IN_BETA_BANNER);
    console.log("=".repeat(60));
    console.log(GRID_OPT_IN_BETA_DISCLAIMER);
    console.log("");
    console.log(`Validated beta match bundle: ${validation.matchId}`);
    console.log("");
    console.log(contents[GRID_BETA_MATCH_TEXT_REPLAY_ARTIFACT]);
    if (parsed.ascii) {
      console.log("");
      console.log(contents[GRID_BETA_MATCH_ASCII_REPLAY_ARTIFACT]);
    }
  } catch (e) {
    console.error("Grid beta replay failed:", e instanceof Error ? e.message : String(e));
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
