import { describe, expect, it } from "vitest";
import {
  createGridCanaryScenario,
  GRID_CANARY_SCENARIO_VERSION,
} from "../../src/canary/grid-canary-scenario.js";
import { parseActionPolicy } from "../../src/schemas/policy.schema.js";
import { validateBuild } from "../../src/validation/build-validator.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";

describe("grid canary scenario factory (Phase 3D2A)", () => {
  it("exposes a stable scenario-version constant", () => {
    expect(GRID_CANARY_SCENARIO_VERSION).toBe("grid-canary-flank-v1");
  });

  it("returns a scenario with both fighters using the Bulwark build", () => {
    const scenario = createGridCanaryScenario();
    expect(scenario.fighterA.build.proposal.machineName).toBe("The Bulwark");
    expect(scenario.fighterB.build.proposal.machineName).toBe("The Bulwark");
  });

  it("returns fresh non-shared build and policy values per call", () => {
    const first = createGridCanaryScenario();
    const second = createGridCanaryScenario();

    expect(first.fighterA.build).not.toBe(second.fighterA.build);
    expect(first.fighterB.build).not.toBe(second.fighterB.build);
    expect(first.fighterA.policy).not.toBe(second.fighterA.policy);
    expect(first.fighterB.policy).not.toBe(second.fighterB.policy);
    expect(first.fighterA.policy).not.toBe(first.fighterB.policy);

    // Mutating a returned policy or build must not affect later calls.
    (first.fighterA.policy as { aggression: number }).aggression = 99;
    (first.fighterB.build.proposal as { machineName: string }).machineName = "Hacked";
    const third = createGridCanaryScenario();
    expect(third.fighterA.policy.aggression).toBe(0);
    expect(third.fighterB.build.proposal.machineName).toBe("The Bulwark");
    expect(third.fighterA.policy).not.toBe(first.fighterA.policy);
  });

  it("freezes the documented Fighter A flank policy", () => {
    const scenario = createGridCanaryScenario();
    expect(scenario.fighterA.policy).toEqual({
      opening: "flank",
      preferredRange: "medium",
      aggression: 0,
      primaryTarget: "rear",
      secondaryTarget: "rear",
      retreatThreshold: 0,
      heatThreshold: 100,
      fallback: "defend",
    });
  });

  it("freezes the documented Fighter B hold policy", () => {
    const scenario = createGridCanaryScenario();
    expect(scenario.fighterB.policy).toEqual({
      opening: "hold",
      preferredRange: "medium",
      aggression: 0,
      primaryTarget: "front",
      secondaryTarget: "front",
      retreatThreshold: 0,
      heatThreshold: 100,
      fallback: "defend",
    });
  });

  it("validates both policies against the unchanged policy schema", () => {
    const scenario = createGridCanaryScenario();
    for (const policy of [scenario.fighterA.policy, scenario.fighterB.policy]) {
      const parsed = parseActionPolicy(policy);
      expect(parsed.success).toBe(true);
    }
  });

  it("validates both builds against the unchanged catalogue", () => {
    const scenario = createGridCanaryScenario();
    for (const build of [scenario.fighterA.build, scenario.fighterB.build]) {
      const result = validateBuild(build.proposal, CATALOGUE_V1);
      expect(result.ok).toBe(true);
    }
  });
});
