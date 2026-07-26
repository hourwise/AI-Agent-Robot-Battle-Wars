import { describe, it, expect } from "vitest";
import {
  buildDesignDiff,
  hasChanges,
  formatDesignDiff,
} from "../../src/reports/design-diff.js";
import type { MachineBuildProposal } from "../../src/validation/validation.types.js";
import type { ActionPolicy } from "../../src/simulator/types.js";

const baseDesign: MachineBuildProposal = {
  machineName: "TestBot",
  chassisId: "medium",
  mobilityId: "wheels",
  weaponId: "ram",
  utilityId: "none",
  armour: { front: 20, left: 10, right: 10, rear: 0, top: 0 },
  designSummary: "test",
  designRationale: "test",
};

const basePolicy: ActionPolicy = {
  opening: "flank",
  preferredRange: "close",
  aggression: 70,
  primaryTarget: "rear",
  secondaryTarget: "left",
  retreatThreshold: 30,
  heatThreshold: 80,
  fallback: "retreat",
};

describe("design diff", () => {
  it("detects component changes", () => {
    const from: MachineBuildProposal = { ...baseDesign };
    const to: MachineBuildProposal = { ...baseDesign, weaponId: "hammer" };
    const diff = buildDesignDiff(from, to, basePolicy, basePolicy, 1, 2);
    expect(diff.componentChanges).toHaveLength(1);
    expect(diff.componentChanges[0]!.component).toBe("weapon");
    expect(diff.componentChanges[0]!.from).toBe("ram");
    expect(diff.componentChanges[0]!.to).toBe("hammer");
  });

  it("detects armour changes", () => {
    const from: MachineBuildProposal = { ...baseDesign };
    const to: MachineBuildProposal = {
      ...baseDesign,
      armour: { front: 20, left: 10, right: 10, rear: 15, top: 0 },
    };
    const diff = buildDesignDiff(from, to, basePolicy, basePolicy, 1, 2);
    expect(diff.armourChanges).toHaveLength(1);
    expect(diff.armourChanges[0]!.zone).toBe("rear");
    expect(diff.armourChanges[0]!.from).toBe(0);
    expect(diff.armourChanges[0]!.to).toBe(15);
    expect(diff.armourChanges[0]!.delta).toBe(15);
  });

  it("detects policy changes", () => {
    const toPolicy: ActionPolicy = { ...basePolicy, aggression: 90 };
    const diff = buildDesignDiff(baseDesign, baseDesign, basePolicy, toPolicy, 1, 2);
    expect(diff.policyChanges).toHaveLength(1);
    expect(diff.policyChanges[0]!.field).toBe("aggression");
    expect(diff.policyChanges[0]!.from).toBe(70);
    expect(diff.policyChanges[0]!.to).toBe(90);
  });

  it("detects no changes for identical designs", () => {
    const diff = buildDesignDiff(baseDesign, baseDesign, basePolicy, basePolicy, 1, 2);
    expect(hasChanges(diff)).toBe(false);
    expect(diff.componentChanges).toHaveLength(0);
    expect(diff.armourChanges).toHaveLength(0);
    expect(diff.policyChanges).toHaveLength(0);
  });

  it("detects multiple simultaneous changes", () => {
    const to: MachineBuildProposal = {
      ...baseDesign,
      weaponId: "flipper",
      armour: { front: 30, left: 10, right: 10, rear: 0, top: 0 },
    };
    const toPolicy: ActionPolicy = { ...basePolicy, preferredRange: "medium" };
    const diff = buildDesignDiff(baseDesign, to, basePolicy, toPolicy, 1, 2);
    expect(diff.componentChanges).toHaveLength(1);
    expect(diff.armourChanges).toHaveLength(1);
    expect(diff.policyChanges).toHaveLength(1);
    expect(hasChanges(diff)).toBe(true);
  });

  it("formats diff as human-readable text", () => {
    const to: MachineBuildProposal = { ...baseDesign, weaponId: "hammer" };
    const diff = buildDesignDiff(baseDesign, to, basePolicy, basePolicy, 1, 2);
    const text = formatDesignDiff(diff);
    expect(text).toContain("Match 1 → 2");
    expect(text).toContain("weapon: ram → hammer");
  });

  it("formats no-changes diff correctly", () => {
    const diff = buildDesignDiff(baseDesign, baseDesign, basePolicy, basePolicy, 1, 2);
    const text = formatDesignDiff(diff);
    expect(text).toContain("(no changes)");
  });
});
