import { describe, expect, it } from "vitest";
import { runMatch } from "../../src/simulator/simulator.js";
import { runGridMatch } from "../../src/simulator/grid-runtime.js";
import { resolveMatchResultPositioningModel } from "../../src/replay/positioning-model.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";

const build = createBulwarkBuild();

function legacyConfig() {
  return {
    seed: 42,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: "0.2.0",
    catalogueVersion: CATALOGUE_V1.version,
  };
}

function gridConfig() {
  return {
    seed: 42,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: "0.3.0",
    catalogueVersion: CATALOGUE_V1.version,
  };
}

describe("explicit in-memory runtime identity", () => {
  it("reports the legacy identity for runMatch", () => {
    const result = runMatch(legacyConfig());
    expect(result.runtime).toEqual({
      simulatorVersion: "0.2.0",
      positioningModel: "legacy-five-zone-v1",
    });
    expect(result.initialState.fighterA.zone).toBe("south_edge");
    expect(result.initialState.fighterB.zone).toBe("north_edge");
  });

  it("reports the grid identity for runGridMatch", () => {
    const result = runGridMatch(gridConfig());
    expect(result.runtime).toEqual({
      simulatorVersion: "0.3.0",
      positioningModel: "grid-3x3-v1",
    });
    expect(result.initialState.fighterA.zone).toBe("south");
    expect(result.initialState.fighterB.zone).toBe("north");
  });

  it("resolves raw-result replay dispatch from explicit identity, never zone strings", () => {
    const legacy = runMatch(legacyConfig());
    const grid = runGridMatch(gridConfig());
    expect(resolveMatchResultPositioningModel(legacy)).toBe("legacy-five-zone-v1");
    expect(resolveMatchResultPositioningModel(grid)).toBe("grid-3x3-v1");
  });

  it("does not guess the model from the shared center zone", () => {
    // Force a grid match to occupy center on both sides; the identity must
    // still be grid even though "center" exists in both models.
    const grid = runGridMatch({ ...gridConfig(), seed: 7 });
    const gridModel = resolveMatchResultPositioningModel(grid);
    expect(gridModel).toBe("grid-3x3-v1");

    const legacy = runMatch(legacyConfig());
    const legacyModel = resolveMatchResultPositioningModel(legacy);
    expect(legacyModel).toBe("legacy-five-zone-v1");
  });
});
