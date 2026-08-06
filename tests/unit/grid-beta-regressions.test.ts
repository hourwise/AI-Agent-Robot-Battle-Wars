import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { RULESET_VERSION, SIMULATOR_VERSION } from "../../src/simulator/constants.js";
import { checkFrozenComponentQualificationChecksums } from "../../src/readiness/grid-opt-in-beta-governance-bundle.js";
import { GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES } from "../../src/readiness/grid-opt-in-beta-source-snapshot.js";
import { GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_IDENTITY } from "../../src/readiness/grid-opt-in-beta-official-identity.js";
import { GRID_OPT_IN_BETA_DISCLAIMER } from "../../src/beta/grid-beta-identity.js";
import { GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_DIR } from "../../src/app/grid-beta-match.js";
import { GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES } from "../../src/readiness/grid-opt-in-beta-governance-bundle.js";
import { officialGovernanceBundleAvailable } from "../helpers/grid-beta-builder.js";

const ROOT = join(__dirname, "..", "..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf-8");
}

const BETA_SOURCE_FILES = [
  "src/beta/grid-beta-identity.ts",
  "src/beta/grid-beta-fighter-spec.ts",
  "src/beta/grid-beta-suspension.ts",
  "src/beta/grid-beta-legacy-preflight.ts",
  "src/beta/grid-beta-execution-core.ts",
  "src/beta/grid-beta-match-bundle.ts",
  "src/beta/grid-beta-replay.ts",
  "src/app/grid-beta-match.ts",
  "src/app/run-grid-beta-match.ts",
  "src/app/replay-grid-beta-match.ts",
];

describe("grid beta regressions (Phase 3G Phase 13)", () => {
  it("keeps global versions, catalogue and component qualifications frozen", () => {
    expect(SIMULATOR_VERSION).toBe("0.2.0");
    expect(RULESET_VERSION).toBe("0.2.0");
    expect(CATALOGUE_V1.version).toBe("1");
    expect(checkFrozenComponentQualificationChecksums()).toBe(true);
  });

  it("never imports a benchmark, provider or ArenaAgent from beta source", () => {
    for (const file of BETA_SOURCE_FILES) {
      const source = read(file);
      expect(
        source.includes('"../bench/') || source.includes("'../bench/"),
        `${file} must not import bench`,
      ).toBe(false);
      expect(
        /from\s+["'][^"']*deepseek/.test(source),
        `${file} must not import a provider`,
      ).toBe(false);
      expect(
        /from\s+["'][^"']*arena-agent/.test(source),
        `${file} must not import ArenaAgent`,
      ).toBe(false);
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

  it("never invokes the legacy simulator or a benchmark from beta source except the pure execution core", () => {
    for (const file of BETA_SOURCE_FILES) {
      if (file === "src/beta/grid-beta-execution-core.ts") continue;
      const source = read(file);
      expect(
        /from\s+["'][^"']*simulator\/(simulator|grid-runtime)/.test(source),
        `${file} must not import the simulator`,
      ).toBe(false);
      expect(
        /\brunMatch\s*\(/.test(source),
        `${file} must not invoke legacy runMatch`,
      ).toBe(false);
      expect(/\brunSeries\s*\(/.test(source), `${file} must not invoke runSeries`).toBe(
        false,
      );
      expect(
        /\brunBenchmark\s*\(/.test(source),
        `${file} must not invoke a benchmark`,
      ).toBe(false);
    }
    // The execution core may call only runGridMatch (hard-coded in the
    // production entry point; only the test seam accepts an injected runner).
    const core = read("src/beta/grid-beta-execution-core.ts");
    expect(/from\s+["'][^"']*simulator\/grid-runtime/.test(core)).toBe(true);
    expect(core.includes("runGridMatch")).toBe(true);
    expect(core.includes("executeGridBetaMatchWithRunner")).toBe(true);
  });

  it("does not modify normal match/series and leaves them on legacy", () => {
    const runMatch = read("src/app/run-match.ts");
    const runSeries = read("src/app/run-series.ts");
    expect(
      /import\s*\{[^}]*runMatch[^}]*\}\s*from\s*["'][^"']*simulator\/simulator/.test(
        runMatch,
      ),
    ).toBe(true);
    expect(runMatch.includes("grid-beta-match")).toBe(false);
    expect(runSeries.includes("grid-beta-match")).toBe(false);
    expect(runMatch.includes("runGridMatch")).toBe(false);
    expect(runSeries.includes("runGridMatch")).toBe(false);
  });

  it("keeps both canary source files equal to the reviewed snapshot", () => {
    for (const path of [
      "src/app/grid-match-canary.ts",
      "src/canary/grid-series-canary-core.ts",
    ]) {
      const frozen = GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES.find((f) => f.path === path);
      expect(frozen, path).toBeDefined();
      // Normalise CRLF checkout line endings to the committed LF form.
      const current = read(path).replace(/\r\n/g, "\n");
      const hash = createHash("sha256").update(current, "utf-8").digest("hex");
      expect(hash, `${path} must equal the reviewed snapshot`).toBe(
        frozen!.contentSha256,
      );
    }
  });

  it("adds no series-beta command and no tournament/ranked/prize scope", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["match:grid:beta"]).toBe("tsx src/app/run-grid-beta-match.ts");
    expect(pkg.scripts["replay:grid:beta"]).toBe("tsx src/app/replay-grid-beta-match.ts");
    expect(Object.keys(pkg.scripts).some((k) => k.includes("series:grid:beta"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "src", "app", "run-grid-beta-series.ts"))).toBe(false);
    for (const file of BETA_SOURCE_FILES) {
      // Strip block comments and the mandatory disclaimer before checking for
      // functional ranked/tournament/prize scope (the disclaimer legitimately
      // states that ranked or public play is not authorised).
      const source = read(file)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(GRID_OPT_IN_BETA_DISCLAIMER, "");
      expect(source.includes("tournament"), file).toBe(false);
      expect(source.includes("ranked"), file).toBe(false);
      expect(source.includes("prize"), file).toBe(false);
    }
  });

  it("keeps the official governance bundle bytes unchanged and anchored when present", async () => {
    if (!officialGovernanceBundleAvailable()) return;
    const dir = GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_DIR;
    const { readFile } = await import("node:fs/promises");
    for (const name of GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES) {
      const text = await readFile(join(dir, name), "utf-8");
      const hash = createHash("sha256").update(text, "utf-8").digest("hex");
      expect(hash, name).toBe(
        GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_IDENTITY.artifactHashes[name],
      );
    }
    // The strengthened anchor passes against the unchanged official bundle.
    const { buildInMemoryReviewedSourceReader } =
      await import("../helpers/grid-opt-in-beta-governance-builder.js");
    const { anchorOfficialGridOptInBetaGovernanceDecision } =
      await import("../../src/readiness/grid-opt-in-beta-official-identity.js");
    const reader = await buildInMemoryReviewedSourceReader();
    const contents: Record<string, string> = {};
    for (const name of GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES) {
      contents[name] = await readFile(join(dir, name), "utf-8");
    }
    const identity = await anchorOfficialGridOptInBetaGovernanceDecision(contents, {
      sourceCommitReader: reader,
    });
    expect(identity.outcome).toBe("approved_for_bounded_opt_in_beta_implementation");
  }, 120_000);
});
