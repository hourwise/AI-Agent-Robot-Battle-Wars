import { describe, expect, it } from "vitest";
import {
  createGridSeriesCanaryScenario,
  GRID_SERIES_CANARY_COMPETITOR,
  GRID_SERIES_CANARY_MAXIMUM_MATCHES,
  GRID_SERIES_CANARY_SCENARIO_VERSION,
  GRID_SERIES_CANARY_TARGET_WINS,
  gridSeriesCanaryInitialPolicy,
} from "../../src/canary/grid-series-canary-scenario.js";
import { BULWARK_POLICY } from "../../src/agents/scripted/bulwark-agent.js";

describe("grid series canary scenario (Phase 3D2B)", () => {
  it("freezes the scenario version, competitor, target wins and maximum matches", () => {
    expect(GRID_SERIES_CANARY_SCENARIO_VERSION).toBe("grid-series-canary-adaptive-v1");
    expect(GRID_SERIES_CANARY_COMPETITOR).toEqual({
      id: "grid-canary-competitor",
      displayName: "Grid Canary Competitor",
      provider: "deterministic-local",
    });
    expect(GRID_SERIES_CANARY_MAXIMUM_MATCHES).toBe(3);
    expect(GRID_SERIES_CANARY_TARGET_WINS).toBe(3);
  });

  it("returns fresh values on every call (no shared mutable state)", () => {
    const a = createGridSeriesCanaryScenario();
    const b = createGridSeriesCanaryScenario();
    expect(a.fighterA.build).not.toBe(b.fighterA.build);
    expect(a.fighterA.policy).not.toBe(b.fighterA.policy);
    expect(a.fighterB.build).not.toBe(b.fighterB.build);
    expect(a.fighterB.policy).not.toBe(b.fighterB.policy);

    // Mutating one scenario never leaks into the other.
    a.fighterA.policy.aggression = 1;
    expect(b.fighterA.policy.aggression).toBe(100);
  });

  it("freezes the initial competitor policy", () => {
    const policy = gridSeriesCanaryInitialPolicy();
    expect(policy).toEqual({
      opening: "flank",
      preferredRange: "medium",
      aggression: 100,
      primaryTarget: "rear",
      secondaryTarget: "rear",
      retreatThreshold: 20,
      heatThreshold: 80,
      fallback: "defend",
    });
    // The returned policy is a fresh clone.
    const again = gridSeriesCanaryInitialPolicy();
    expect(policy).not.toBe(again);
  });

  it("uses the canonical Bulwark policy as the opponent", () => {
    const scenario = createGridSeriesCanaryScenario();
    expect(scenario.fighterB.policy).toEqual(BULWARK_POLICY);
    expect(scenario.fighterB.build.proposal.machineName).toBe("The Bulwark");
  });
});
