import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readFileSync as readPackage } from "node:fs";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { RULESET_VERSION } from "../../src/simulator/constants.js";
import { DEFAULT_COMPONENT_QUALIFICATION_ID } from "../../src/simulator/component-qualification-registry.js";
import { loadOpponentFixture } from "../../src/opponents/opponent-fixture-loader.js";
import { CANONICAL_OPPONENT_SUITE_V1 } from "../../src/opponents/opponent-suite-v1.js";
import { buildOpponentSuiteMatchConfig } from "../../src/opponents/opponent-suite-runner.js";

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
    // Both calls build independent fresh MatchConfig graphs through the
    // pure execution-graph builder (never the canonical references).
    expect(
      runnerSource.includes(
        "buildOpponentSuiteMatchConfig(fixtureA, fixtureB, input.seed)",
      ),
    ).toBe(true);
  });

  it("provides genuine semantic evidence that primary/repeat execution graphs are reference-distinct and value-identical", async () => {
    // Source text alone is not sufficient evidence for nested graph
    // isolation; prove it semantically through the pure builder.
    const suiteById = new Map(CANONICAL_OPPONENT_SUITE_V1.map((e) => [e.opponentId, e]));
    const bulwark = await loadOpponentFixture(
      suiteById.get("bulwark")!.opponentId,
      suiteById.get("bulwark")!.fixtureVersion,
    );
    const crusher = await loadOpponentFixture(
      suiteById.get("crusher")!.opponentId,
      suiteById.get("crusher")!.fixtureVersion,
    );
    const primary = buildOpponentSuiteMatchConfig(bulwark, crusher, 44001);
    const repeat = buildOpponentSuiteMatchConfig(bulwark, crusher, 44001);

    // Fresh outer config and fighter objects.
    expect(primary).not.toBe(repeat);
    expect(primary.fighterA).not.toBe(repeat.fighterA);
    expect(primary.fighterB).not.toBe(repeat.fighterB);

    // Fresh nested build graphs (build, proposal, armour).
    expect(primary.fighterA.build).not.toBe(repeat.fighterA.build);
    expect(primary.fighterB.build).not.toBe(repeat.fighterB.build);
    expect(primary.fighterA.build.proposal).not.toBe(repeat.fighterA.build.proposal);
    expect(primary.fighterB.build.proposal).not.toBe(repeat.fighterB.build.proposal);
    expect(primary.fighterA.build.proposal.armour).not.toBe(
      repeat.fighterA.build.proposal.armour,
    );
    expect(primary.fighterB.build.proposal.armour).not.toBe(
      repeat.fighterB.build.proposal.armour,
    );

    // Fresh policy objects.
    expect(primary.fighterA.policy).not.toBe(repeat.fighterA.policy);
    expect(primary.fighterB.policy).not.toBe(repeat.fighterB.policy);

    // Execution graphs are reference-distinct from canonical fixture graphs.
    expect(primary.fighterA.build).not.toBe(bulwark.validatedBuild);
    expect(primary.fighterA.build.proposal).not.toBe(bulwark.validatedBuild.proposal);
    expect(primary.fighterA.build.proposal.armour).not.toBe(
      bulwark.validatedBuild.proposal.armour,
    );
    expect(primary.fighterA.policy).not.toBe(bulwark.policy);
    expect(repeat.fighterA.build).not.toBe(bulwark.validatedBuild);
    expect(repeat.fighterA.policy).not.toBe(bulwark.policy);

    // Values deep-equal exactly, and authoritative config values are unchanged.
    expect(primary.fighterA.build).toEqual(bulwark.validatedBuild);
    expect(primary.fighterA.policy).toEqual(bulwark.policy);
    expect(primary.fighterB.build).toEqual(crusher.validatedBuild);
    expect(primary.fighterB.policy).toEqual(crusher.policy);
    expect(repeat).toEqual(primary);
    expect(primary.rulesetVersion).toBe(RULESET_VERSION);
    expect(primary.catalogueVersion).toBe(CATALOGUE_V1.version);
    expect(primary.componentQualificationId).toBe(DEFAULT_COMPONENT_QUALIFICATION_ID);
    expect(primary.seed).toBe(44001);
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
