import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import {
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT,
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES,
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_ID,
} from "../../src/readiness/grid-opt-in-beta-source-snapshot.js";

/**
 * Milestone 0.2D Phase 3 (Commit M) — normal-path migration boundaries,
 * provider/persistence ordering, and the intentional M transition state.
 *
 * Source-level regressions scoped to the two normal application files
 * (`src/app/run-match.ts`, `src/app/run-series.ts`). Historical Bulwark
 * constants remain freely available to tests/benchmark/canary/readiness
 * modules; only normal application combat configuration is migrated.
 */

const ROOT = join(__dirname, "..", "..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf-8");
}

const NORMAL_FILES = ["src/app/run-match.ts", "src/app/run-series.ts"];

describe("canonical bulwark migration boundaries (0.2D Phase 3 Commit M)", () => {
  it("uses no historical Bulwark constants as normal-path combat configuration", () => {
    for (const file of NORMAL_FILES) {
      const source = read(file);
      expect(source.includes("createBulwarkBuild"), file).toBe(false);
      expect(source.includes("BULWARK_POLICY"), file).toBe(false);
      expect(source.includes("BULWARK_BUILD_PROPOSAL"), file).toBe(false);
      // The canonical fixture path is used instead.
      expect(source.includes("loadLegacyBulwark"), file).toBe(true);
    }
  });

  it("keeps the normal match/series paths on legacy runMatch with no grid or beta path", () => {
    for (const file of NORMAL_FILES) {
      const source = read(file);
      expect(
        /import\s*\{[^}]*runMatch[^}]*\}\s*from\s*["'][^"']*simulator\/simulator/.test(
          source,
        ),
        file,
      ).toBe(true);
      expect(source.includes("runGridMatch"), file).toBe(false);
      expect(source.includes("grid-beta-match"), file).toBe(false);
      expect(source.includes("grid-opt-in-beta"), file).toBe(false);
      expect(source.includes("runGridMatch("), file).toBe(false);
    }
  });

  it("loads canonical Bulwark before any provider request in run-match", () => {
    const source = read("src/app/run-match.ts");
    const bulwarkLoad = source.indexOf("await loadBulwarkFighter()");
    const aiLoad = source.indexOf("await loadAiFighter(");
    expect(bulwarkLoad, "bulwark load site").toBeGreaterThanOrEqual(0);
    expect(aiLoad, "provider call site").toBeGreaterThanOrEqual(0);
    expect(bulwarkLoad).toBeLessThan(aiLoad);
  });

  it("loads canonical Bulwark before any series persistence or provider call in run-series", () => {
    const source = read("src/app/run-series.ts");
    const bulwarkLoad = source.indexOf("await loadLegacyBulwark()");
    expect(bulwarkLoad, "bulwark load site").toBeGreaterThanOrEqual(0);
    for (const needle of [
      "seriesRepository.saveSeries",
      "agent.designMachine",
      "agent.choosePolicy",
      "agent.reviewMatch",
    ]) {
      const at = source.indexOf(needle);
      expect(at, needle).toBeGreaterThanOrEqual(0);
      expect(bulwarkLoad, `loadLegacyBulwark must precede ${needle}`).toBeLessThan(at);
    }
    // No alternate-runtime selection in the series path.
    expect(source.includes("runGridMatch"), "run-series").toBe(false);
  });

  it("documents the intentional Commit M transition state (source-level only)", () => {
    // v1 snapshot identity is unchanged (not replaced by a successor).
    expect(GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_ID).toBe(
      "grid-opt-in-beta-reviewed-source-v1",
    );
    expect(GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT).toBe(
      "5173fd0f287465e1181969dbad2f37cee10fd47e",
    );

    for (const file of NORMAL_FILES) {
      const frozen = GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES.find((f) => f.path === file);
      expect(frozen, `${file} must still be in the v1 snapshot`).toBeDefined();
      // Current bytes (CRLF-normalised like the preflight) intentionally
      // differ from the frozen v1 reviewed bytes: the active beta preflight
      // must fail closed with legacy_default_regression. This is expected
      // transition evidence, not a migration defect.
      const currentHash = sha256Hex(read(file).replace(/\r\n/g, "\n"));
      expect(currentHash).not.toBe(frozen!.contentSha256);
    }
  });

  it("leaves the v1 governance snapshot module and preflight untouched", () => {
    // These files must be byte-identical to the pre-migration state. The
    // source-level proxy for "untouched" is that they still declare the v1
    // snapshot identity and frozen source commit above; a structural absence
    // check guards against a half-built successor snapshot module.
    expect(
      existsSync(
        join(ROOT, "src", "readiness", "grid-opt-in-beta-source-snapshot-v2.ts"),
      ),
    ).toBe(false);
    expect(
      existsSync(join(ROOT, "src", "beta", "grid-beta-legacy-isolation-preflight-v2.ts")),
    ).toBe(false);
  });
});
