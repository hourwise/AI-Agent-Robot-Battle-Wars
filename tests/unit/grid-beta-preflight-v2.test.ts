import { describe, expect, it } from "vitest";
import { sep } from "node:path";
import {
  defaultCanaryFs,
  type CanaryFileSystem,
} from "../../src/canary/immutable-canary-bundle.js";
import {
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_CHECKSUM,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT,
} from "../../src/beta/grid-beta-legacy-isolation-reviewed-source-v2.js";
import {
  assertCanonicalGridBetaPreflightV2Pass,
  gridBetaLegacyIsolationPreflightV2Schema,
  runGridBetaLegacyIsolationPreflightV2,
} from "../../src/beta/grid-beta-legacy-preflight-v2.js";
import {
  buildDualCommitInMemorySourceReader,
  buildDualUnavailableCommitReader,
} from "../helpers/grid-beta-successor-builder.js";

/**
 * Milestone 0.2D Phase 3C (Commit G) — successor preflight V2. The clean
 * Commit G checkout must PASS V2 (all 23 protected files remain exactly M);
 * each protected-path mutation fails closed. The historical V1 preflight
 * remains valid and is expected to reject the evolved normal-path bytes.
 */

function mutatingFs(overrides: Record<string, string>): CanaryFileSystem {
  return {
    ...defaultCanaryFs,
    readFile: async (path, encoding) => {
      const rel = path.replace(process.cwd() + sep, "").replace(/\\/g, "/");
      if (overrides[rel] !== undefined) return overrides[rel];
      return defaultCanaryFs.readFile(path, encoding);
    },
  };
}

describe("grid beta successor preflight v2 (0.2D Phase 3C)", () => {
  it("passes against the clean Commit G checkout with the exact canonical V2 identity", async () => {
    const reader = await buildDualCommitInMemorySourceReader();
    const preflight = await runGridBetaLegacyIsolationPreflightV2(
      defaultCanaryFs,
      reader,
    );
    expect(preflight.status).toBe("pass");
    expect(preflight.trigger).toBeNull();
    expect(preflight.failures).toEqual([]);
    expect(preflight.schemaVersion).toBe("2");
    expect(preflight.sourceBaselineId).toBe(
      "grid-beta-legacy-isolation-reviewed-source-v2",
    );
    expect(preflight.sourceBaselineCommit).toBe(
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT,
    );
    expect(preflight.sourceBaselineChecksum).toBe(
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_CHECKSUM,
    );
    expect(preflight.sourceBaselineCommitAnchored).toBe(true);
    expect(preflight.protectedFilesEqualSuccessorSnapshot).toBe(true);
    expect(preflight.canonicalBulwarkFixtureAnchorValid).toBe(true);
    expect(preflight.normalMatchCallsLegacyRunMatch).toBe(true);
    expect(preflight.normalSeriesCallsLegacyRunMatch).toBe(true);
    expect(preflight.normalMatchUsesCanonicalBulwark).toBe(true);
    expect(preflight.normalSeriesUsesCanonicalBulwark).toBe(true);
    expect(preflight.neitherNormalPathInvokesGridOrBeta).toBe(true);
    expect(preflight.packageRoutingPreservesLegacyDefault).toBe(true);
    expect(preflight.globalVersions020020).toBe(true);
    expect(preflight.catalogueStill1).toBe(true);
    expect(preflight.qualificationFrozen).toBe(true);
    expect(preflight.gridIdentitySeparate).toBe(true);
    expect(preflight.bothCanarySourcesFrozen).toBe(true);
    expect(preflight.schemaV2LegacyConversionPresent).toBe(true);
    expect(preflight.schemaV3GridConversionAndReplayPresent).toBe(true);
    // The canonical V2 preflight passes the exact canonical assertion and the
    // strict schema.
    expect(() => assertCanonicalGridBetaPreflightV2Pass(preflight)).not.toThrow();
    expect(gridBetaLegacyIsolationPreflightV2Schema.safeParse(preflight).success).toBe(
      true,
    );
  });

  it("fails closed when the successor commit is unavailable or tampered", async () => {
    const unavailable = await runGridBetaLegacyIsolationPreflightV2(
      defaultCanaryFs,
      buildDualUnavailableCommitReader(),
    );
    expect(unavailable.status).toBe("fail");
    expect(unavailable.trigger).toBe("legacy_default_regression");
    expect(unavailable.sourceBaselineCommitAnchored).toBe(false);

    const tampered = await runGridBetaLegacyIsolationPreflightV2(
      defaultCanaryFs,
      await buildDualCommitInMemorySourceReader({
        v2: { "src/app/run-match.ts": "export function runMatch() {}\n" },
      }),
    );
    expect(tampered.status).toBe("fail");
    expect(tampered.trigger).toBe("legacy_default_regression");
    expect(tampered.sourceBaselineCommitAnchored).toBe(false);
  });

  it("fails closed when a protected source path changes (each of the eight explicit paths)", async () => {
    const reader = await buildDualCommitInMemorySourceReader();
    const mutations: Array<[string, string]> = [
      ["src/app/run-match.ts", "export function runGridMatch() {}\n"],
      ["src/app/run-series.ts", "export function runGridMatch() {}\n"],
      ["package.json", JSON.stringify({ scripts: { match: "other" } }, null, 2)],
      ["src/agents/scripted/bulwark-agent.ts", "export const X = 1;\n"],
      ["src/opponents/opponent-fixture.ts", "export const X = 1;\n"],
      ["src/opponents/opponent-fixture-loader.ts", "export const X = 1;\n"],
      ["src/opponents/opponent-runtime-compatibility.ts", "export const X = 1;\n"],
      ["src/opponents/legacy-bulwark.ts", "export const X = 1;\n"],
    ];
    for (const [path, content] of mutations) {
      const preflight = await runGridBetaLegacyIsolationPreflightV2(
        mutatingFs({ [path]: content }),
        reader,
      );
      expect(preflight.status, path).toBe("fail");
      expect(preflight.trigger, path).toBe("legacy_default_regression");
      expect(preflight.protectedFilesEqualSuccessorSnapshot, path).toBe(false);
    }
  });

  it("fails closed when the canonical Bulwark fixture bytes change", async () => {
    const reader = await buildDualCommitInMemorySourceReader();
    const preflight = await runGridBetaLegacyIsolationPreflightV2(
      mutatingFs({
        "data/opponents/bulwark.v1.json": JSON.stringify(
          { fixtureChecksum: "0".repeat(64) },
          null,
          2,
        ),
      }),
      reader,
    );
    expect(preflight.status).toBe("fail");
    expect(preflight.trigger).toBe("legacy_default_regression");
    expect(preflight.canonicalBulwarkFixtureAnchorValid).toBe(false);
  });

  it("fails closed when the canonical Bulwark JSON declares the wrong fixtureChecksum", async () => {
    const reader = await buildDualCommitInMemorySourceReader();
    // Changing the checksum field necessarily changes the persisted bytes, so
    // the persisted-byte anchor (or, if bytes somehow matched, the internal
    // fixtureChecksum check) fails closed; either way the anchor is invalid.
    const real = await defaultCanaryFs.readFile(
      `${process.cwd()}${sep}data${sep}opponents${sep}bulwark.v1.json`,
      "utf-8",
    );
    const json = JSON.parse(real) as Record<string, unknown>;
    const tampered = JSON.stringify(
      { ...json, fixtureChecksum: "0".repeat(64) },
      null,
      2,
    );
    const preflight = await runGridBetaLegacyIsolationPreflightV2(
      mutatingFs({ "data/opponents/bulwark.v1.json": tampered }),
      reader,
    );
    expect(preflight.status).toBe("fail");
    expect(preflight.trigger).toBe("legacy_default_regression");
    expect(preflight.canonicalBulwarkFixtureAnchorValid).toBe(false);
    expect(
      preflight.failures.join("; ").includes("persisted SHA-256") ||
        preflight.failures.join("; ").includes("fixtureChecksum"),
    ).toBe(true);
  });

  it("retains canary and constants mutation regressions", async () => {
    const reader = await buildDualCommitInMemorySourceReader();
    const canary = await runGridBetaLegacyIsolationPreflightV2(
      mutatingFs({
        "src/canary/grid-series-canary-core.ts": "export const X = 1;\n",
      }),
      reader,
    );
    expect(canary.status).toBe("fail");
    expect(canary.trigger).toBe("canary_regression");

    const constants = await runGridBetaLegacyIsolationPreflightV2(
      mutatingFs({
        "src/simulator/constants.ts":
          'export const SIMULATOR_VERSION = "0.3.0" as const;\nexport const RULESET_VERSION = "0.2.0" as const;\n',
      }),
      reader,
    );
    expect(constants.status).toBe("fail");
    expect(constants.trigger).toBe("legacy_default_regression");
  });

  it("rejects a non-canonical V2 preflight through the canonical assertion", () => {
    const base = {
      schemaVersion: "2" as const,
      sourceBaselineId: "grid-beta-legacy-isolation-reviewed-source-v2" as const,
      sourceBaselineCommit: GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT,
      sourceBaselineChecksum: GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_CHECKSUM,
      sourceBaselineCommitAnchored: true,
      protectedFilesEqualSuccessorSnapshot: true,
      canonicalBulwarkFixtureAnchorValid: true,
      normalMatchCallsLegacyRunMatch: true,
      normalSeriesCallsLegacyRunMatch: true,
      normalMatchUsesCanonicalBulwark: true,
      normalSeriesUsesCanonicalBulwark: true,
      neitherNormalPathInvokesGridOrBeta: true,
      packageRoutingPreservesLegacyDefault: true,
      globalVersions020020: true,
      catalogueStill1: true,
      qualificationFrozen: true,
      gridIdentitySeparate: true,
      bothCanarySourcesFrozen: true,
      schemaV2LegacyConversionPresent: true,
      schemaV3GridConversionAndReplayPresent: true,
      status: "pass" as const,
      trigger: null,
      failures: [],
    };
    expect(() =>
      assertCanonicalGridBetaPreflightV2Pass({ ...base, catalogueStill1: false }),
    ).toThrow(/not the canonical pass/);
    expect(() =>
      assertCanonicalGridBetaPreflightV2Pass({ ...base, status: "fail" }),
    ).toThrow(/not the canonical pass/);
    expect(() =>
      assertCanonicalGridBetaPreflightV2Pass({
        ...base,
        sourceBaselineChecksum: "0".repeat(64),
      }),
    ).toThrow(/not the canonical pass/);
  });
});
