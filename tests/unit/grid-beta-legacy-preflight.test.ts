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

describe("grid beta legacy-isolation preflight (Phase 3G Phase 6)", () => {
  it("passes against the clean current checkout", async () => {
    const preflight = await runGridBetaLegacyIsolationPreflight(defaultCanaryFs);
    expect(preflight.status).toBe("pass");
    expect(preflight.trigger).toBeNull();
    expect(preflight.failures).toEqual([]);
    expect(preflight.protectedFilesEqualReviewedSnapshot).toBe(true);
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
