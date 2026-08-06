import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rejectGovernanceArguments } from "../../src/app/run-grid-opt-in-beta-governance.js";
import {
  runGridOptInBetaStaticPreflight,
  checkFrozenComponentQualificationChecksums,
} from "../../src/readiness/grid-opt-in-beta-governance-bundle.js";
import { SIMULATOR_VERSION, RULESET_VERSION } from "../../src/simulator/constants.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";

const ROOT = join(__dirname, "..", "..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf-8");
}

const GOVERNANCE_FILES = [
  "src/readiness/grid-opt-in-beta-contract.ts",
  "src/readiness/grid-opt-in-beta-governance.ts",
  "src/readiness/grid-opt-in-beta-governance-bundle.ts",
  "src/readiness/grid-opt-in-beta-report.ts",
  "src/app/grid-opt-in-beta-governance.ts",
  "src/app/run-grid-opt-in-beta-governance.ts",
];

describe("grid opt-in beta governance CLI and static isolation (Phase 3F Phases 5 and 8)", () => {
  it("accepts no arguments and rejects every argument kind", () => {
    expect(() => rejectGovernanceArguments([])).not.toThrow();
    for (const args of [
      ["--output", "/tmp/x"],
      ["--decision", "x"],
      ["--force"],
      ["--runtime", "grid"],
      ["extra"],
    ]) {
      expect(() => rejectGovernanceArguments(args)).toThrow(/accepts no arguments/);
    }
  });

  it("adds only readiness:grid:governance and leaves the existing scripts unchanged", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["readiness:grid:governance"]).toBe(
      "tsx src/app/run-grid-opt-in-beta-governance.ts",
    );
  });

  it("passes every static isolation preflight check", () => {
    const preflight = runGridOptInBetaStaticPreflight();
    for (const [key, value] of Object.entries(preflight)) {
      expect(value, `static preflight ${key}`).toBe(true);
    }
  });

  it("keeps the global versions, catalogue and grid identity frozen", () => {
    expect(SIMULATOR_VERSION).toBe("0.2.0");
    expect(RULESET_VERSION).toBe("0.2.0");
    expect(CATALOGUE_V1.version).toBe("1");
    expect(checkFrozenComponentQualificationChecksums()).toBe(true);
  });

  it("never imports a benchmark module or opens a seed bank", () => {
    for (const file of GOVERNANCE_FILES) {
      const source = read(file);
      expect(source.includes('"../bench/'), `${file} must not import bench`).toBe(false);
      expect(
        source.includes("benchmark-100-v1.json"),
        `${file} must not open a seed bank`,
      ).toBe(false);
      expect(
        source.includes("--partition"),
        `${file} must not use partition selectors`,
      ).toBe(false);
    }
  });

  it("never invokes an AI provider or ArenaAgent", () => {
    for (const file of GOVERNANCE_FILES) {
      const source = read(file);
      expect(
        /from\s+["'][^"']*arena-agent/.test(source) ||
          /\bArenaAgent\b/.test(source.replace(/\/\*[\s\S]*?\*\//g, "")),
        `${file} must not import ArenaAgent`,
      ).toBe(false);
      expect(
        /from\s+["'][^"']*deepseek/.test(source),
        `${file} must not import a provider`,
      ).toBe(false);
    }
  });

  it("never invokes the simulator or runs a match from governance code", () => {
    for (const file of GOVERNANCE_FILES) {
      const source = read(file);
      expect(
        source.includes("../simulator/simulator.js") ||
          source.includes("../simulator/grid-runtime.js") ||
          /from\s+["'][^"']*simulator\/(simulator|grid-runtime)/.test(source),
        `${file} must not import the simulator`,
      ).toBe(false);
      expect(
        /\brunMatch\s*\(|\bexecuteGrid/.test(source),
        `${file} must not invoke a legacy match or execution core`,
      ).toBe(false);
    }
  });
});
