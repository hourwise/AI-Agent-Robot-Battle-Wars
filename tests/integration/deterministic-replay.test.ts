import { describe, it, expect } from "vitest";
import { runMatch } from "../../src/simulator/simulator.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { validateBuild } from "../../src/validation/build-validator.js";
import type { ActionPolicy, ValidatedBuild } from "../../src/simulator/types.js";

function getBuild(proposal: Parameters<typeof validateBuild>[0]): ValidatedBuild {
  const result = validateBuild(proposal, CATALOGUE_V1);
  if (!result.ok) throw new Error("Invalid test build");
  return result.build;
}

const LIGHT_FLANKER_BUILD = getBuild({
  machineName: "Swift Blade",
  chassisId: "light",
  mobilityId: "wheels",
  weaponId: "grappler",
  utilityId: "none",
  armour: { front: 5, left: 5, right: 5, rear: 5, top: 5 },
  designSummary: "A fast flanker.",
  designRationale: "Circle and attack the rear.",
});

const LIGHT_FLANKER_POLICY: ActionPolicy = {
  opening: "flank",
  preferredRange: "close",
  aggression: 70,
  primaryTarget: "rear",
  secondaryTarget: "left",
  retreatThreshold: 20,
  heatThreshold: 80,
  fallback: "retreat",
};

const HEAVY_TANK_BUILD = getBuild({
  machineName: "Iron Wall",
  chassisId: "heavy",
  mobilityId: "tracks",
  weaponId: "hammer",
  utilityId: "cooling",
  armour: { front: 40, left: 10, right: 10, rear: 0, top: 0 },
  designSummary: "A heavy hitter.",
  designRationale: "Absorb and crush.",
});

const HEAVY_TANK_POLICY: ActionPolicy = {
  opening: "rush",
  preferredRange: "close",
  aggression: 80,
  primaryTarget: "front",
  secondaryTarget: "top",
  retreatThreshold: 15,
  heatThreshold: 85,
  fallback: "defend",
};

describe("deterministic replay", () => {
  it("same config + seed produces identical events", () => {
    const bulwark = createBulwarkBuild();
    const config = {
      seed: 42,
      fighterA: { build: LIGHT_FLANKER_BUILD, policy: LIGHT_FLANKER_POLICY },
      fighterB: { build: bulwark, policy: BULWARK_POLICY },
      rulesetVersion: "1",
      catalogueVersion: "1",
    };

    const result1 = runMatch(config);
    const result2 = runMatch(config);

    expect(result1.events.length).toBe(result2.events.length);
    expect(result1.result).toEqual(result2.result);
    expect(result1.rounds).toBe(result2.rounds);

    for (let i = 0; i < result1.events.length; i++) {
      expect(result1.events[i]!.type).toBe(result2.events[i]!.type);
      expect(result1.events[i]!.actorId).toBe(result2.events[i]!.actorId);
      expect(result1.events[i]!.data).toEqual(result2.events[i]!.data);
    }
  });
});

describe("bulwark vs light flanker", () => {
  it("match completes without crash", () => {
    const bulwark = createBulwarkBuild();
    const config = {
      seed: 1,
      fighterA: { build: LIGHT_FLANKER_BUILD, policy: LIGHT_FLANKER_POLICY },
      fighterB: { build: bulwark, policy: BULWARK_POLICY },
      rulesetVersion: "1",
      catalogueVersion: "1",
    };
    const result = runMatch(config);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.rounds).toBeGreaterThan(0);
    expect(result.rounds).toBeLessThanOrEqual(20);
  });
});

describe("heavy vs heavy", () => {
  it("match completes", () => {
    const bulwark = createBulwarkBuild();
    const config = {
      seed: 7,
      fighterA: { build: HEAVY_TANK_BUILD, policy: HEAVY_TANK_POLICY },
      fighterB: { build: bulwark, policy: BULWARK_POLICY },
      rulesetVersion: "1",
      catalogueVersion: "1",
    };
    const result = runMatch(config);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.rounds).toBeGreaterThan(0);
  });
});

describe("edge cases", () => {
  it("different seeds produce different results", () => {
    const bulwark = createBulwarkBuild();
    const config1 = {
      seed: 1,
      fighterA: { build: LIGHT_FLANKER_BUILD, policy: LIGHT_FLANKER_POLICY },
      fighterB: { build: bulwark, policy: BULWARK_POLICY },
      rulesetVersion: "1",
      catalogueVersion: "1",
    };
    const config2 = { ...config1, seed: 2 };
    const r1 = runMatch(config1);
    const r2 = runMatch(config2);
    // Different seeds should produce different outcomes or event sequences
    const sameWinner = r1.result.winner === r2.result.winner;
    const sameRounds = r1.rounds === r2.rounds;
    const sameMethod = r1.result.method === r2.result.method;
    // At least one dimension should differ (not all identical)
    const allSame = sameWinner && sameRounds && sameMethod;
    expect(allSame).toBe(false);
  });
});
