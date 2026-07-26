import { describe, it, expect } from "vitest";
import { runMatch } from "../../src/simulator/simulator.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { validateBuild } from "../../src/validation/build-validator.js";
import type { ActionPolicy, MatchConfig } from "../../src/simulator/types.js";

const TEST_BUILDS: Array<{
  chassisId: "light" | "medium" | "heavy";
  mobilityId: "wheels" | "tracks" | "legs";
  weaponId: "ram" | "hammer" | "horizontal_spinner" | "grappler" | "flipper";
  utilityId: "none" | "cooling" | "traction_boost" | "reinforced_drive";
}> = [
  { chassisId: "light", mobilityId: "wheels", weaponId: "ram", utilityId: "none" },
  { chassisId: "light", mobilityId: "wheels", weaponId: "hammer", utilityId: "cooling" },
  { chassisId: "light", mobilityId: "legs", weaponId: "flipper", utilityId: "none" },
  {
    chassisId: "medium",
    mobilityId: "tracks",
    weaponId: "horizontal_spinner",
    utilityId: "cooling",
  },
  {
    chassisId: "medium",
    mobilityId: "wheels",
    weaponId: "grappler",
    utilityId: "traction_boost",
  },
  {
    chassisId: "heavy",
    mobilityId: "tracks",
    weaponId: "hammer",
    utilityId: "reinforced_drive",
  },
  {
    chassisId: "heavy",
    mobilityId: "tracks",
    weaponId: "horizontal_spinner",
    utilityId: "none",
  },
  { chassisId: "heavy", mobilityId: "tracks", weaponId: "ram", utilityId: "none" },
];

const TEST_POLICIES: ActionPolicy[] = [
  {
    opening: "rush",
    preferredRange: "close",
    aggression: 90,
    primaryTarget: "front",
    secondaryTarget: "front",
    retreatThreshold: 10,
    heatThreshold: 90,
    fallback: "desperate_attack",
  },
  {
    opening: "cautious",
    preferredRange: "medium",
    aggression: 50,
    primaryTarget: "front",
    secondaryTarget: "left",
    retreatThreshold: 30,
    heatThreshold: 70,
    fallback: "defend",
  },
  {
    opening: "flank",
    preferredRange: "close",
    aggression: 70,
    primaryTarget: "rear",
    secondaryTarget: "right",
    retreatThreshold: 20,
    heatThreshold: 80,
    fallback: "retreat",
  },
  {
    opening: "hold",
    preferredRange: "far",
    aggression: 30,
    primaryTarget: "front",
    secondaryTarget: "front",
    retreatThreshold: 40,
    heatThreshold: 60,
    fallback: "defend",
  },
];

function makeConfig(seed: number, buildIndex: number, policyIndex: number): MatchConfig {
  const b = TEST_BUILDS[buildIndex]!;
  const p = TEST_POLICIES[policyIndex]!;
  const result = validateBuild(
    {
      machineName: `Test ${buildIndex}-${policyIndex}`,
      ...b,
      armour: { front: 10, left: 5, right: 5, rear: 5, top: 5 },
      designSummary: "Test build.",
      designRationale: "Test.",
    },
    CATALOGUE_V1,
  );
  if (!result.ok)
    throw new Error(
      `Invalid test build: ${result.errors.map((e) => e.message).join(", ")}`,
    );
  return {
    seed,
    fighterA: { build: result.build, policy: p },
    fighterB: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
    rulesetVersion: "1",
    catalogueVersion: "1",
  };
}

describe("simulation batch", () => {
  it("runs 1000 matches without crash", () => {
    let completed = 0;
    for (let i = 0; i < 1000; i++) {
      const buildIdx = i % TEST_BUILDS.length;
      const policyIdx = i % TEST_POLICIES.length;
      const config = makeConfig(i + 1, buildIdx, policyIdx);
      const result = runMatch(config);
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.rounds).toBeGreaterThan(0);
      expect(result.rounds).toBeLessThanOrEqual(20);
      expect(result.result.winner !== undefined).toBe(true);
      completed++;
    }
    expect(completed).toBe(1000);
  });

  it("no match has zero events", () => {
    for (let i = 0; i < 100; i++) {
      const config = makeConfig(
        i + 1000,
        i % TEST_BUILDS.length,
        i % TEST_POLICIES.length,
      );
      const result = runMatch(config);
      expect(result.events.length).toBeGreaterThan(5);
    }
  });

  it("all matches terminate within 20 rounds", () => {
    for (let i = 0; i < 100; i++) {
      const config = makeConfig(
        i + 2000,
        i % TEST_BUILDS.length,
        i % TEST_POLICIES.length,
      );
      const result = runMatch(config);
      expect(result.rounds).toBeLessThanOrEqual(20);
    }
  });
});
