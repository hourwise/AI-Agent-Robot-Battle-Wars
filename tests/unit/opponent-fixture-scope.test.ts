import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { RULESET_VERSION } from "../../src/simulator/constants.js";
import {
  GRID_RUNTIME_IDENTITY,
  LEGACY_RUNTIME_IDENTITY,
} from "../../src/simulator/runtime-identity.js";
import { OPPONENT_FIXTURE_SCHEMA_VERSION } from "../../src/opponents/opponent-fixture.js";
import { OPPONENT_FIXTURE_ROOT } from "../../src/opponents/opponent-fixture-loader.js";

/**
 * Milestone 0.2D Phase 1 Phase 15 + Phase 2 inventory — static scope
 * regressions.
 *
 * Proves the opponent-fixture module scope boundaries: exactly the six
 * canonical suite v1 fixtures exist under `data/opponents/` (Phase 2 exact
 * inventory), the development-only legacy opponent-suite runner exists as of
 * Phase 4 (invoked directly with tsx, with no package script), no match
 * execution, no tournament/ranking code, no provider/benchmark/held-out/
 * grid-beta imports in `src/opponents/`, and no production loader API that
 * accepts a caller-controlled fixture-location root.
 */

const ROOT = join(__dirname, "..", "..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf-8");
}

/** Recursively lists every TypeScript source path under `src/`. */
function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listSourceFiles(full));
    else if (entry.name.endsWith(".ts")) files.push(full);
  }
  return files;
}

const OPPONENT_SOURCE_FILES = [
  "src/opponents/opponent-fixture.ts",
  "src/opponents/opponent-fixture-loader.ts",
];

/** Exact Phase 2 canonical inventory contract (sorted). */
const CANONICAL_OPPONENT_FILES = [
  "bulwark.v1.json",
  "controller.v1.json",
  "crusher.v1.json",
  "generalist.v1.json",
  "skirmisher.v1.json",
  "spinner.v1.json",
];

describe("opponent fixture scope regressions (0.2D Phase 1 Phase 15, Phase 2 inventory)", () => {
  it("contains exactly the six canonical suite v1 fixtures and nothing else", () => {
    const root = join(ROOT, "data", "opponents");
    expect(existsSync(root)).toBe(true);
    // Exact sorted inventory.
    const names = readdirSync(root, { withFileTypes: true })
      .map((e) => e.name)
      .sort();
    expect(names).toEqual(CANONICAL_OPPONENT_FILES);
    // Reject dotfiles, subdirectories, symlinks and non-regular files.
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      expect(entry.name.startsWith("."), entry.name).toBe(false);
      expect(entry.isDirectory(), entry.name).toBe(false);
      expect(entry.isSymbolicLink(), entry.name).toBe(false);
      expect(entry.isFile(), entry.name).toBe(true);
    }
    // No v2 fixtures exist.
    expect(names.some((n) => n.includes(".v2."))).toBe(false);
    // No fixture JSON anywhere outside this canonical inventory.
    expect(resolveDataOpponents()).toBe(root);
  });

  it("keeps the frozen canonical versions and identities unchanged", () => {
    expect(OPPONENT_FIXTURE_SCHEMA_VERSION).toBe("1");
    expect(RULESET_VERSION).toBe("0.2.0");
    expect(CATALOGUE_V1.version).toBe("1");
    expect(LEGACY_RUNTIME_IDENTITY.simulatorVersion).toBe("0.2.0");
    expect(LEGACY_RUNTIME_IDENTITY.positioningModel).toBe("legacy-five-zone-v1");
    expect(GRID_RUNTIME_IDENTITY.simulatorVersion).toBe("0.3.0");
    expect(GRID_RUNTIME_IDENTITY.positioningModel).toBe("grid-3x3-v1");
    // The fixed logical root is exactly data/opponents.
    expect(resolveDataOpponents()).toBe(OPPONENT_FIXTURE_ROOT);
  });

  it("adds the development-only legacy opponent-suite runner with no package script", () => {
    // Phase 4 legitimately adds the dev-only runner (invoked directly with
    // tsx). It must NOT add a package script for it.
    expect(existsSync(join(ROOT, "src", "app", "run-opponent-suite.ts"))).toBe(true);
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(
      Object.keys(pkg.scripts).some((k) => k.toLowerCase().includes("opponent")),
    ).toBe(false);
  });

  it("introduces no opponent match execution, tournament or ranking code", () => {
    for (const file of OPPONENT_SOURCE_FILES) {
      // Strip block and line comments before checking functional scope.
      const source = read(file)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(source.includes("runOpponentMatch"), file).toBe(false);
      expect(source.includes("runMatch("), file).toBe(false);
      expect(source.includes("runSeries("), file).toBe(false);
      expect(source.includes("runGridMatch("), file).toBe(false);
      expect(source.includes("executeMatch"), file).toBe(false);
      expect(source.includes("tournament"), file).toBe(false);
      expect(source.includes("ranking"), file).toBe(false);
      expect(source.includes("ranked"), file).toBe(false);
      expect(source.includes("prize"), file).toBe(false);
      expect(source.includes("matchmaking"), file).toBe(false);
    }
  });

  it("keeps src/opponents free of provider, benchmark, held-out, seed-bank and grid-beta imports", () => {
    for (const file of OPPONENT_SOURCE_FILES) {
      const source = read(file);
      expect(/from\s+["'][^"']*deepseek/.test(source), file).toBe(false);
      expect(/from\s+["'][^"']*arena-agent/.test(source), file).toBe(false);
      expect(source.includes("bench/"), file).toBe(false);
      expect(source.includes("held-out"), file).toBe(false);
      expect(source.includes("seed-bank"), file).toBe(false);
      expect(source.includes("benchmark-100-v1.json"), file).toBe(false);
      expect(source.includes("grid-beta"), file).toBe(false);
      expect(source.includes("--partition"), file).toBe(false);
    }
  });

  it("exposes no caller-controlled fixture-location root in the production loader API", () => {
    const loader = read("src/opponents/opponent-fixture-loader.ts");
    // loadOpponentFixture must not accept root/outputRoot/fixtureRoot/
    // opponentRoot/path as caller-controlled fixture-location inputs.
    expect(
      /loadOpponentFixture\([^)]*(?:root|outputRoot|fixtureRoot|opponentRoot|path)/i.test(
        loader,
      ),
    ).toBe(false);
    // The only exported loader function is loadOpponentFixture.
    expect(/export\s+(?:async\s+)?function\s+loadOpponentFixture/.test(loader)).toBe(
      true,
    );
    // No exported alternate-root loader exists anywhere in src/.
    for (const file of listSourceFiles("src")) {
      const source = read(file);
      expect(
        /export\s+(?:async\s+)?function\s+[A-Za-z0-9_]*(?:Opponent|opponent)[A-Za-z0-9_]*\([^)]*(?:outputRoot|fixtureRoot|opponentRoot)/.test(
          source,
        ),
        file,
      ).toBe(false);
    }
  });

  it("keeps the test-only path remapping structurally separate from src/", () => {
    expect(
      existsSync(join(ROOT, "tests", "helpers", "opponent-fixture-mapped-fs.ts")),
    ).toBe(true);
    for (const file of listSourceFiles("src")) {
      expect(read(file).includes("opponent-fixture-mapped-fs"), file).toBe(false);
    }
    // No src/ module may expose an alternate opponent root for tests.
    expect(read("src/opponents/opponent-fixture-loader.ts")).not.toContain(
      "WithTestEnvironment",
    );
    expect(read("src/opponents/opponent-fixture.ts")).not.toContain(
      "WithTestEnvironment",
    );
  });

  it("never reads grid-beta results or readiness evidence for fixture selection", () => {
    for (const file of OPPONENT_SOURCE_FILES) {
      const source = read(file);
      expect(source.includes("grid-beta"), file).toBe(false);
      expect(source.includes("readiness"), file).toBe(false);
      expect(source.includes("governance"), file).toBe(false);
      expect(source.includes("GRID_BETA"), file).toBe(false);
    }
  });
});

function resolveDataOpponents(): string {
  return join(ROOT, "data", "opponents");
}
