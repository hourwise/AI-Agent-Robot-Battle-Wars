import { describe, it, expect } from "vitest";
import {
  computeMatchStatistics,
  formatMatchStatistics,
} from "../../src/replay/statistics.js";
import { runMatch } from "../../src/simulator/simulator.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { validateBuild } from "../../src/validation/build-validator.js";
import type { MatchResult } from "../../src/simulator/types.js";

function makeTestMatch(seed: number): MatchResult {
  const buildResult = validateBuild(
    {
      machineName: "Iron Cicada",
      chassisId: "light",
      mobilityId: "wheels",
      weaponId: "grappler",
      utilityId: "none",
      armour: { front: 5, left: 5, right: 5, rear: 5, top: 5 },
      designSummary: "A fast flanker.",
      designRationale: "Circle and attack the rear.",
    },
    CATALOGUE_V1,
  );

  if (!buildResult.ok) throw new Error("Invalid test build");

  return runMatch({
    seed,
    fighterA: {
      build: buildResult.build,
      policy: {
        opening: "flank",
        preferredRange: "close",
        aggression: 70,
        primaryTarget: "rear",
        secondaryTarget: "left",
        retreatThreshold: 20,
        heatThreshold: 80,
        fallback: "retreat",
      },
    },
    fighterB: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
    rulesetVersion: "1",
    catalogueVersion: "1",
  });
}

describe("computeMatchStatistics", () => {
  it("computes statistics for a match", () => {
    const match = makeTestMatch(42);
    const stats = computeMatchStatistics(match);
    expect(stats.totalRounds).toBeGreaterThan(0);
    expect(stats.totalEvents).toBeGreaterThan(0);
    expect(stats.fighterA.name).toBe("Iron Cicada");
    expect(stats.fighterB.name).toBe("The Bulwark");
  });

  it("tracks attacks", () => {
    const match = makeTestMatch(42);
    const stats = computeMatchStatistics(match);
    expect(stats.fighterA.attacksAttempted).toBeGreaterThanOrEqual(0);
    expect(stats.fighterA.attacksHit).toBeGreaterThanOrEqual(0);
    expect(stats.fighterA.attacksMissed).toBeGreaterThanOrEqual(0);
  });

  it("tracks damage", () => {
    const match = makeTestMatch(42);
    const stats = computeMatchStatistics(match);
    expect(stats.fighterA.damageInflicted).toBeGreaterThanOrEqual(0);
    expect(stats.fighterA.damageReceived).toBeGreaterThanOrEqual(0);
  });

  it("records first blood", () => {
    const match = makeTestMatch(42);
    const stats = computeMatchStatistics(match);
    if (stats.firstBlood) {
      expect(stats.firstBlood.round).toBeGreaterThan(0);
      expect(stats.firstBlood.attacker).toBeDefined();
    }
  });
});

describe("formatMatchStatistics", () => {
  it("formats statistics as readable text", () => {
    const match = makeTestMatch(42);
    const stats = computeMatchStatistics(match);
    const formatted = formatMatchStatistics(stats);
    expect(formatted).toContain("MATCH STATISTICS");
    expect(formatted).toContain("Iron Cicada");
    expect(formatted).toContain("The Bulwark");
    expect(formatted).toContain("Attacks:");
    expect(formatted).toContain("Damage Inflicted:");
  });
});
