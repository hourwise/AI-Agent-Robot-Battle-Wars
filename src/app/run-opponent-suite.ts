import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  assertOpponentSuiteRuntime,
  formatOpponentSuiteRunV1,
  runOpponentSuite,
  type OpponentSuiteRunInputV1,
} from "../opponents/opponent-suite-runner.js";

/**
 * Development-only opponent-suite CLI (Milestone 0.2D Phase 4).
 *
 * Invocation (no package script; direct tsx):
 *
 *   npx tsx src/app/run-opponent-suite.ts --runtime legacy --seed <N>
 *
 * `--runtime` is required and only `legacy` is authorised; `--runtime grid`
 * is recognised and rejected with a clear separate-authorisation message.
 * `--seed` is required and must be a non-negative safe integer. Duplicate
 * arguments, unknown arguments and positional arguments fail. No provider
 * option, no output directory, no fixture-version override, no root/path
 * override, no positional opponent IDs.
 *
 * On success the CLI prints deterministic JSON only: no timestamp, no
 * machine-specific paths, no random IDs. The same repository bytes and seed
 * produce identical JSON bytes.
 */

export interface OpponentSuiteCliParsedV1 {
  readonly runtime: "legacy";
  readonly seed: number;
}

export type OpponentSuiteCliResultV1 =
  | { readonly ok: true; readonly args: OpponentSuiteCliParsedV1 }
  | { readonly ok: false; readonly error: string };

function isFlag(token: string): boolean {
  return token.startsWith("--");
}

/**
 * Pure CLI argument parser. Never spawns a provider or executes a match.
 */
export function parseOpponentSuiteCliArgs(
  args: readonly string[],
): OpponentSuiteCliResultV1 {
  let runtime: string | undefined;
  let seed: string | undefined;
  let sawRuntime = false;
  let sawSeed = false;

  for (let i = 0; i < args.length; i++) {
    const token = args[i]!;
    if (token === "--runtime") {
      if (sawRuntime) return { ok: false, error: "duplicate --runtime argument" };
      const value = args[i + 1];
      if (value === undefined || isFlag(value)) {
        return { ok: false, error: "--runtime requires a value" };
      }
      runtime = value;
      sawRuntime = true;
      i++;
    } else if (token === "--seed") {
      if (sawSeed) return { ok: false, error: "duplicate --seed argument" };
      const value = args[i + 1];
      if (value === undefined || isFlag(value)) {
        return { ok: false, error: "--seed requires a value" };
      }
      seed = value;
      sawSeed = true;
      i++;
    } else if (isFlag(token)) {
      return { ok: false, error: `unknown argument ${JSON.stringify(token)}` };
    } else {
      return {
        ok: false,
        error: `unexpected positional argument ${JSON.stringify(token)}`,
      };
    }
  }

  if (runtime === undefined) {
    return { ok: false, error: "missing required --runtime argument" };
  }
  if (seed === undefined) {
    return { ok: false, error: "missing required --seed argument" };
  }

  try {
    assertOpponentSuiteRuntime(runtime);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  if (!/^[0-9]+$/.test(seed)) {
    return {
      ok: false,
      error: `seed must be a non-negative safe integer; received ${JSON.stringify(seed)}`,
    };
  }
  const parsedSeed = Number(seed);
  if (!Number.isSafeInteger(parsedSeed)) {
    return {
      ok: false,
      error: `seed must be a non-negative safe integer; received ${JSON.stringify(seed)}`,
    };
  }

  return { ok: true, args: { runtime: "legacy", seed: parsedSeed } };
}

export async function runOpponentSuiteCli(
  input: OpponentSuiteRunInputV1,
): Promise<string> {
  const run = await runOpponentSuite(input);
  return formatOpponentSuiteRunV1(run);
}

async function main(): Promise<void> {
  const parsed = parseOpponentSuiteCliArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(`error: ${parsed.error}`);
    process.exitCode = 1;
    return;
  }
  const output = await runOpponentSuiteCli(parsed.args);
  process.stdout.write(`${output}\n`);
}

const isMain =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((e) => {
    console.error("fatal error:", e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  });
}
