import { describe, expect, it } from "vitest";
import {
  defaultCanaryFs,
  type CanaryFileSystem,
} from "../../src/canary/immutable-canary-bundle.js";
import { runGridBetaLegacyIsolationPreflight } from "../../src/beta/grid-beta-legacy-preflight.js";

function mutatingFs(pathSuffix: string, tampered: string): CanaryFileSystem {
  return {
    ...defaultCanaryFs,
    readFile: async (path, encoding) => {
      const text = await defaultCanaryFs.readFile(path, encoding);
      return path.replaceAll("\\", "/").endsWith(pathSuffix) ? tampered : text;
    },
  };
}

describe("grid beta legacy-isolation preflight (Phase 3G Phase 6, v1)", () => {
  it("rejects the evolved current checkout as expected against the historical v1 snapshot (Commit M/G)", async () => {
    // The v1 preflight is historical and compares the CURRENT checkout bytes
    // against the frozen v1 reviewed source. After the governed 0.2D Phase 3
    // migration (Commit M/G), the normal match/series paths intentionally
    // differ from v1, so the v1 preflight correctly fails closed with
    // `legacy_default_regression`. This is expected transition evidence, not
    // a regression: the active current-source baseline is now v2.
    const preflight = await runGridBetaLegacyIsolationPreflight(defaultCanaryFs);
    expect(preflight.status).toBe("fail");
    expect(preflight.trigger).toBe("legacy_default_regression");
    expect(preflight.protectedFilesEqualReviewedSnapshot).toBe(false);
    // The evolved normal paths still call legacy runMatch and never grid/beta.
    expect(preflight.normalMatchCallsLegacyRunMatch).toBe(true);
    expect(preflight.normalSeriesCallsLegacyRunMatch).toBe(true);
    expect(preflight.neitherNormalPathInvokesGridOrBeta).toBe(true);
    expect(preflight.globalVersions020020).toBe(true);
    expect(preflight.catalogueStill1).toBe(true);
    expect(preflight.qualificationFrozen).toBe(true);
    expect(preflight.gridIdentitySeparate).toBe(true);
    expect(preflight.bothCanarySourcesFrozen).toBe(true);
    expect(preflight.schemaV2LegacyConversionPresent).toBe(true);
    expect(preflight.schemaV3GridConversionAndReplayPresent).toBe(true);
    // The failure is specifically the v1 protected-file mismatch for the two
    // evolved normal-path files.
    expect(preflight.failures.join("; ")).toContain("src/app/run-match.ts");
    expect(preflight.failures.join("; ")).toContain("src/app/run-series.ts");
  });

  it("detects a changed normal match source as legacy_default_regression", async () => {
    const fs = mutatingFs("src/app/run-match.ts", "export function runGridMatch() {}\n");
    const preflight = await runGridBetaLegacyIsolationPreflight(fs);
    expect(preflight.status).toBe("fail");
    expect(preflight.trigger).toBe("legacy_default_regression");
    expect(preflight.protectedFilesEqualReviewedSnapshot).toBe(false);
  });

  it("detects a changed normal series source as legacy_default_regression", async () => {
    const fs = mutatingFs(
      "src/app/run-series.ts",
      "import { runGridMatch } from '../simulator/grid-runtime.js';\n",
    );
    const preflight = await runGridBetaLegacyIsolationPreflight(fs);
    expect(preflight.status).toBe("fail");
    expect(preflight.trigger).toBe("legacy_default_regression");
  });

  it("detects a changed canary source as canary_regression", async () => {
    const fs = mutatingFs("src/app/grid-match-canary.ts", "// tampered canary\n");
    const preflight = await runGridBetaLegacyIsolationPreflight(fs);
    expect(preflight.status).toBe("fail");
    expect(preflight.trigger).toBe("canary_regression");
    expect(preflight.bothCanarySourcesFrozen).toBe(false);
  });

  it("detects a changed constants source as legacy_default_regression", async () => {
    const fs = mutatingFs(
      "src/simulator/constants.ts",
      'export const SIMULATOR_VERSION = "0.3.0" as const;\n',
    );
    const preflight = await runGridBetaLegacyIsolationPreflight(fs);
    expect(preflight.status).toBe("fail");
    expect(preflight.trigger).toBe("legacy_default_regression");
  });

  it("computes the result from current bytes, never from mutable persisted booleans alone", async () => {
    // A mutating fs only for the runtime-identity source forces a fail even
    // though no persisted boolean exists anywhere in the beta.
    const fs = mutatingFs(
      "src/simulator/runtime-identity.ts",
      "export const GRID_RUNTIME_IDENTITY = Object.freeze({ simulatorVersion: '9.9.9', positioningModel: 'grid-3x3-v1' });\n",
    );
    const preflight = await runGridBetaLegacyIsolationPreflight(fs);
    expect(preflight.status).toBe("fail");
  });
});
