import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readFileSync as readPackage } from "node:fs";

/**
 * Milestone 0.2D Phase 4 — opponent-suite source boundaries.
 *
 * The new runner/CLI are LEGACY RUNTIME ONLY: they use the unchanged legacy
 * `runMatch`, never grid/beta/series/AI/benchmark/readiness/held-out paths,
 * and the runner performs no filesystem writes. No package.json change was
 * made for this phase.
 */

const ROOT = join(__dirname, "..", "..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf-8");
}

const RUNNER_FILES = [
  "src/opponents/opponent-suite-v1.ts",
  "src/opponents/opponent-suite-runner.ts",
  "src/app/run-opponent-suite.ts",
];

const FORBIDDEN = [
  "runGridMatch",
  "runGridBetaMatch",
  "executeGridBetaMatch",
  "runSeries",
  "DeepSeek",
  "deepseek",
  "benchmark",
  "readiness:grid",
  "readiness",
  "held-out",
  "grid-beta-match",
  "grid-beta-execution-core",
  "arena-agent",
];

describe("opponent suite source boundaries (0.2D Phase 4)", () => {
  it("never contains or imports grid/beta/series/AI/benchmark/readiness/held-out paths", () => {
    for (const file of RUNNER_FILES) {
      const source = read(file);
      for (const needle of FORBIDDEN) {
        expect(source.includes(needle), `${file} must not contain ${needle}`).toBe(false);
      }
    }
  });

  it("uses the unchanged legacy runMatch from the simulator", () => {
    const runnerSource = read("src/opponents/opponent-suite-runner.ts");
    expect(
      /import\s*\{[^}]*runMatch[^}]*\}\s*from\s*["'][^"']*simulator\/simulator/.test(
        runnerSource,
      ),
    ).toBe(true);
    // Exactly two runMatch call sites inside the plan loop: primary + repeat.
    const calls = runnerSource.match(/runMatch\(/g);
    expect(calls).not.toBeNull();
    expect(calls!.length).toBe(2);
    // Both calls construct independent fresh MatchConfig graphs.
    expect(runnerSource.includes("buildConfig(fixtureA, fixtureB, input.seed)")).toBe(
      true,
    );
  });

  it("requires an explicit runtime and never exposes grid as a runner type", () => {
    const runnerSource = read("src/opponents/opponent-suite-runner.ts");
    expect(runnerSource.includes('export type OpponentSuiteRuntimeV1 = "legacy"')).toBe(
      true,
    );
    // The runtime constant maps only to the legacy runtime.
    expect(
      /if \(runtime === OPPONENT_SUITE_LEGACY_RUNTIME\) return;/.test(runnerSource),
    ).toBe(true);
    // The runner itself never lists "grid" as an accepted runtime literal.
    expect(/OpponentSuiteRuntimeV1\s*=\s*"legacy"\s*\|\s*"grid"/.test(runnerSource)).toBe(
      false,
    );
  });

  it("performs no filesystem write API in runner source", () => {
    const runnerSource = read("src/opponents/opponent-suite-runner.ts");
    for (const needle of [
      "writeFile",
      "writeFileExclusive",
      "mkdir",
      "appendFile",
      "createWriteStream",
      "rm(",
      "rename(",
    ]) {
      expect(runnerSource.includes(needle), needle).toBe(false);
    }
  });

  it("does not alter package.json", () => {
    const packageJson = readPackage(join(ROOT, "package.json"), "utf-8");
    // No opponent-suite script was added.
    expect(packageJson.includes("opponent-suite")).toBe(false);
    expect(packageJson.includes("run-opponent-suite")).toBe(false);
  });

  it("keeps the suite identity module data-only (no simulator import)", () => {
    const suiteSource = read("src/opponents/opponent-suite-v1.ts");
    expect(suiteSource.includes("simulator/simulator")).toBe(false);
    expect(suiteSource.includes("runMatch")).toBe(false);
    expect(suiteSource.includes("loadOpponentFixture")).toBe(false);
  });

  it("contains no aggregate/interpretation vocabulary in the runner result surface", () => {
    const runnerSource = read("src/opponents/opponent-suite-runner.ts");
    for (const word of [
      "standings",
      "leaderboard",
      "rank",
      "tier",
      "strength",
      "power",
      "difficulty",
      "balanceScore",
      "winRate",
      "recommended",
      "meta",
      "optimal",
    ]) {
      // "rank" as a substring is avoided by searching word-boundary usage.
      expect(
        new RegExp(`\\b${word}\\b`).test(runnerSource),
        `runner must not use ${word}`,
      ).toBe(false);
    }
  });
});
