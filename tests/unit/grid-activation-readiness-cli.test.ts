import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rejectReadinessArguments } from "../../src/app/run-grid-activation-readiness.js";

const ROOT = join(__dirname, "..", "..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf-8");
}

const EXPECTED_SCRIPTS: Record<string, string> = {
  match: "tsx src/app/run-match.ts",
  series: "tsx src/app/run-series.ts",
  "match:grid:canary": "tsx src/app/run-grid-canary-match.ts",
  "series:grid:canary": "tsx src/app/run-grid-series-canary.ts",
  "readiness:grid": "tsx src/app/run-grid-activation-readiness.ts",
  benchmark: "tsx src/app/run-benchmark.ts",
  "benchmark:lifecycle": "tsx src/app/run-lifecycle-benchmark.ts",
};

describe("grid activation-readiness CLI (Phase 3E1)", () => {
  it("accepts no arguments and rejects every argument kind", () => {
    expect(() => rejectReadinessArguments([])).not.toThrow();
    for (const args of [
      ["--seed", "1703000011"],
      ["--scenario", "flanker-bulwark"],
      ["--partition", "development"],
      ["--output", "/tmp/x"],
      ["--threshold", "0.5"],
      ["--force"],
      ["--runtime", "legacy"],
      ["--provider", "deepseek"],
      ["--api-key", "secret"],
      ["extra"],
    ]) {
      expect(() => rejectReadinessArguments(args)).toThrow(/accepts no arguments/);
    }
  });

  it("adds only readiness:grid and leaves the existing application scripts unchanged", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts).toMatchObject(EXPECTED_SCRIPTS);
    // Exactly the existing scripts plus the single new readiness script.
    const keys = Object.keys(pkg.scripts).sort();
    expect(keys).toEqual(
      [
        "benchmark",
        "benchmark:lifecycle",
        "check",
        "dev",
        "format",
        "format:check",
        "lint",
        "lint:fix",
        "match",
        "match:grid:canary",
        "readiness:grid",
        "replay",
        "series",
        "series:grid:canary",
        "smoke:design",
        "test",
        "test:watch",
      ].sort(),
    );
  });

  it("leaves the legacy runSeries implementation calling runMatch", () => {
    const source = read("src/app/run-series.ts");
    expect(source).toMatch(/runMatch\s*\(/);
    expect(source).not.toMatch(/runGridMatch\s*\(/);
  });

  it("never imports or reads a benchmark module or seed bank", () => {
    const forbiddenImports = [
      "src/bench/run-benchmark.js",
      "src/bench/seed-bank.js",
      "src/app/run-benchmark.js",
      "src/app/run-lifecycle-benchmark.js",
    ];
    const readinessFiles = [
      "src/readiness/seed-registry.ts",
      "src/readiness/scenario-registry.ts",
      "src/readiness/run-plan.ts",
      "src/readiness/execution-core.ts",
      "src/readiness/metrics.ts",
      "src/readiness/gates.ts",
      "src/readiness/decision.ts",
      "src/readiness/report.ts",
      "src/readiness/envelopes.schema.ts",
      "src/readiness/readiness-bundle.ts",
      "src/app/grid-activation-readiness.ts",
      "src/app/run-grid-activation-readiness.ts",
    ];
    for (const file of readinessFiles) {
      const source = read(file);
      for (const forbidden of forbiddenImports) {
        expect(source.includes(forbidden), `${file} must not import ${forbidden}`).toBe(
          false,
        );
      }
      expect(
        source.includes("benchmark-100-v1.json"),
        `${file} must not reference the benchmark seed bank`,
      ).toBe(false);
      expect(
        source.includes("--partition"),
        `${file} must not use partition selectors`,
      ).toBe(false);
    }
  });

  it("never invokes an AI provider or ArenaAgent", () => {
    const readinessFiles = [
      "src/readiness/execution-core.ts",
      "src/app/grid-activation-readiness.ts",
      "src/app/run-grid-activation-readiness.ts",
    ];
    for (const file of readinessFiles) {
      const source = read(file);
      expect(source.includes("ArenaAgent"), `${file} must not import ArenaAgent`).toBe(
        false,
      );
      expect(source.includes("deepseek"), `${file} must not call a provider`).toBe(false);
    }
  });

  it("keeps the canary and regression surfaces untouched", () => {
    // The readiness command does not modify the existing canary scripts or
    // their output roots.
    const cli = read("src/app/run-grid-activation-readiness.ts");
    expect(cli).not.toMatch(/data\/canary/);
    expect(cli).not.toMatch(/data\/matches/);
    expect(cli).not.toMatch(/data\/series/);
    // No replay or prompt text is persisted in the readiness bundle.
    const bundle = read("src/readiness/readiness-bundle.ts");
    expect(bundle).toContain("run-index.json");
    expect(bundle).not.toContain("replay.txt");
  });
});
