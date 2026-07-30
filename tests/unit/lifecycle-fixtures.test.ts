import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  LIFECYCLE_SUITE_PATH,
  loadLifecycleFixtureSuite,
  parseLifecycleFixtureSuite,
} from "../../src/bench/lifecycle-fixture-schema.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";

const suite = loadLifecycleFixtureSuite();

describe("component lifecycle fixture suite", () => {
  it("validates the qualification-independent suite and unique fixture IDs", () => {
    expect(suite.suiteId).toBe("component-lifecycle-v1");
    expect(suite.seedPartition).toBe("development");
    expect(suite.fixtures).toHaveLength(5);
    expect(new Set(suite.fixtures.map((fixture) => fixture.fixtureId)).size).toBe(5);
    const raw = JSON.parse(readFileSync(LIFECYCLE_SUITE_PATH, "utf8"));
    expect(raw).not.toHaveProperty("componentQualificationId");
    expect(suite.fixtureChecksum).toMatch(/^[a-f0-9]{16}$/);
  });

  it("uses valid builds and policies without API-backed agent references", () => {
    for (const competitor of suite.competitors) {
      expect(competitor.build.catalogueVersion).toBe("1");
      expect(competitor.policy.aggression).toBeGreaterThanOrEqual(0);
      expect(competitor.policy.aggression).toBeLessThanOrEqual(100);
    }
    const source = readFileSync(LIFECYCLE_SUITE_PATH, "utf8");
    expect(source).not.toMatch(/agentId|provider|deepseek|api/i);
  });

  it("does not modify the canonical guarded Bulwark", () => {
    const guarded = suite.competitors.find(
      (competitor) => competitor.competitorId === "bulwark-guarded",
    )!;
    expect(guarded.build.proposal).toEqual(createBulwarkBuild().proposal);
    expect(guarded.policy).toEqual(BULWARK_POLICY);
  });

  it("makes unguarded Bulwark differ only in utility", () => {
    const guarded = suite.competitors.find(
      (competitor) => competitor.competitorId === "bulwark-guarded",
    )!;
    const unguarded = suite.competitors.find(
      (competitor) => competitor.competitorId === "bulwark-unguarded",
    )!;
    expect(unguarded.build.proposal).toEqual({
      ...guarded.build.proposal,
      utilityId: "none",
    });
    expect(unguarded.policy).toEqual(guarded.policy);
  });

  it("freezes the existing committed Glass Cannon definition", () => {
    const glass = suite.competitors.find(
      (competitor) => competitor.competitorId === "glass-cannon",
    )!;
    expect(glass.build.proposal).toMatchObject({
      machineName: "Glass Cannon",
      chassisId: "light",
      mobilityId: "wheels",
      weaponId: "ram",
      utilityId: "none",
      armour: { front: 5, left: 0, right: 0, rear: 0, top: 0 },
    });
    expect(glass.policy).toEqual({
      opening: "rush",
      preferredRange: "close",
      aggression: 100,
      primaryTarget: "front",
      secondaryTarget: "front",
      retreatThreshold: 0,
      heatThreshold: 100,
      fallback: "desperate_attack",
    });
    const glassFixture = suite.fixtures.find(
      (fixture) => fixture.fixtureId === "glass-cannon-mirror",
    )!;
    expect(glassFixture.classification).toBe("diagnostic-extreme");
  });

  it("validates a materially distinct representative light hard fixture", () => {
    const representative = suite.competitors.find(
      (competitor) => competitor.competitorId === "representative-light",
    )!;
    const glass = suite.competitors.find(
      (competitor) => competitor.competitorId === "glass-cannon",
    )!;
    expect(representative.build.proposal).toMatchObject({
      machineName: "Light Vanguard",
      chassisId: "light",
      mobilityId: "wheels",
      weaponId: "ram",
      utilityId: "none",
      armour: { front: 20, left: 10, right: 10, rear: 5, top: 5 },
    });
    expect(representative.build.totalArmourPoints).toBe(50);
    expect(representative.policy.aggression).toBe(50);
    expect(representative.build.proposal.armour).not.toEqual(glass.build.proposal.armour);
    expect(representative.policy).not.toEqual(glass.policy);
    const fixture = suite.fixtures.find(
      (candidate) => candidate.fixtureId === "representative-light-mirror",
    )!;
    expect(fixture.classification).toBe("hard");
    expect(fixture.roleSwapped).toBe(false);
  });

  it("uses valid identities and role swapping for the asymmetric fixture", () => {
    const fixture = suite.fixtures.find(
      (candidate) => candidate.fixtureId === "bulwark-vs-glass-cannon",
    )!;
    expect(fixture.fighterX.competitorId).toBe("bulwark-guarded");
    expect(fixture.fighterY.competitorId).toBe("glass-cannon");
    expect(fixture.roleSwapped).toBe(true);
    expect(fixture.classification).toBe("diagnostic");
  });

  it("rejects duplicate fixture IDs", () => {
    const raw = JSON.parse(readFileSync(LIFECYCLE_SUITE_PATH, "utf8"));
    raw.fixtures[1].fixtureId = raw.fixtures[0].fixtureId;
    expect(() => parseLifecycleFixtureSuite(raw)).toThrow("Fixture IDs must be unique");
  });
});
