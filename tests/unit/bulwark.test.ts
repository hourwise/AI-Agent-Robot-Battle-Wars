import { describe, it, expect } from "vitest";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";

describe("Bulwark", () => {
  it("build is valid", () => {
    const build = createBulwarkBuild();
    expect(build).toBeDefined();
    expect(build.totalCost).toBeLessThanOrEqual(CATALOGUE_V1.budget);
  });

  it("build costs 94", () => {
    const build = createBulwarkBuild();
    expect(build.totalCost).toBe(94);
  });

  it("has heavy chassis", () => {
    const build = createBulwarkBuild();
    expect(build.proposal.chassisId).toBe("heavy");
  });

  it("has tracks mobility", () => {
    const build = createBulwarkBuild();
    expect(build.proposal.mobilityId).toBe("tracks");
  });

  it("has ram weapon", () => {
    const build = createBulwarkBuild();
    expect(build.proposal.weaponId).toBe("ram");
  });

  it("has reinforced_drive utility", () => {
    const build = createBulwarkBuild();
    expect(build.proposal.utilityId).toBe("reinforced_drive");
  });

  it("has 60 front armour", () => {
    const build = createBulwarkBuild();
    expect(build.proposal.armour.front).toBe(60);
  });

  it("has 0 rear armour", () => {
    const build = createBulwarkBuild();
    expect(build.proposal.armour.rear).toBe(0);
  });

  it("policy has rush opening", () => {
    expect(BULWARK_POLICY.opening).toBe("rush");
  });

  it("policy has close preferred range", () => {
    expect(BULWARK_POLICY.preferredRange).toBe("close");
  });

  it("policy has high aggression", () => {
    expect(BULWARK_POLICY.aggression).toBe(85);
  });
});
