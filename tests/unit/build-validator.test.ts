import { describe, it, expect } from "vitest";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { parseBuildProposal } from "../../src/schemas/build.schema.js";
import { validateBuild, calculateCost } from "../../src/validation/build-validator.js";
import type { MachineBuildProposal } from "../../src/validation/validation.types.js";

const VALID_MINIMAL: MachineBuildProposal = {
  machineName: "Scrappy",
  chassisId: "light",
  mobilityId: "wheels",
  weaponId: "ram",
  utilityId: "none",
  armour: { front: 0, left: 0, right: 0, rear: 0, top: 0 },
  designSummary: "A fast light rammer.",
  designRationale: "Speed beats heavy armour.",
};

const VALID_HEAVY_TANK: MachineBuildProposal = {
  machineName: "Ironwall",
  chassisId: "heavy",
  mobilityId: "tracks",
  weaponId: "hammer",
  utilityId: "reinforced_drive",
  armour: { front: 60, left: 20, right: 20, rear: 10, top: 10 },
  designSummary: "An impenetrable fortress.",
  designRationale: "Absorb damage and crush.",
};

describe("parseBuildProposal", () => {
  it("accepts valid minimal build", () => {
    const result = parseBuildProposal(VALID_MINIMAL);
    expect(result.success).toBe(true);
  });

  it("accepts valid heavy tank build", () => {
    const result = parseBuildProposal(VALID_HEAVY_TANK);
    expect(result.success).toBe(true);
  });

  it("rejects missing machineName", () => {
    const { machineName: _, ...rest } = VALID_MINIMAL;
    const result = parseBuildProposal(rest);
    expect(result.success).toBe(false);
  });

  it("rejects unknown chassis ID", () => {
    const result = parseBuildProposal({ ...VALID_MINIMAL, chassisId: "hover" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown weapon ID", () => {
    const result = parseBuildProposal({ ...VALID_MINIMAL, weaponId: "laser" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown utility ID", () => {
    const result = parseBuildProposal({ ...VALID_MINIMAL, utilityId: "shield" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown mobility ID", () => {
    const result = parseBuildProposal({ ...VALID_MINIMAL, mobilityId: "hover" });
    expect(result.success).toBe(false);
  });

  it("rejects negative armour", () => {
    const result = parseBuildProposal({
      ...VALID_MINIMAL,
      armour: { front: -5, left: 0, right: 0, rear: 0, top: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer armour", () => {
    const result = parseBuildProposal({
      ...VALID_MINIMAL,
      armour: { front: 1.5, left: 0, right: 0, rear: 0, top: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty machine name", () => {
    const result = parseBuildProposal({ ...VALID_MINIMAL, machineName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects machine name over 60 chars", () => {
    const result = parseBuildProposal({
      ...VALID_MINIMAL,
      machineName: "A".repeat(61),
    });
    expect(result.success).toBe(false);
  });

  it("rejects design summary over 500 chars", () => {
    const result = parseBuildProposal({
      ...VALID_MINIMAL,
      designSummary: "A".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("rejects design rationale over 500 chars", () => {
    const result = parseBuildProposal({
      ...VALID_MINIMAL,
      designRationale: "A".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("calculateCost", () => {
  it("computes minimal build cost", () => {
    const cost = calculateCost(VALID_MINIMAL, CATALOGUE_V1);
    expect(cost.chassisCost).toBe(15);
    expect(cost.mobilityCost).toBe(12);
    expect(cost.weaponCost).toBe(10);
    expect(cost.utilityCost).toBe(0);
    expect(cost.armourCost).toBe(0);
    expect(cost.totalCost).toBe(37);
    expect(cost.withinBudget).toBe(true);
  });

  it("computes heavy tank cost", () => {
    const cost = calculateCost(VALID_HEAVY_TANK, CATALOGUE_V1);
    expect(cost.chassisCost).toBe(40);
    expect(cost.mobilityCost).toBe(20);
    expect(cost.weaponCost).toBe(20);
    expect(cost.utilityCost).toBe(15);
    expect(cost.armourCost).toBe(12);
    expect(cost.totalCost).toBe(107);
    expect(cost.withinBudget).toBe(false);
  });

  it("armour cost rounds up per 10 points", () => {
    const base: MachineBuildProposal = {
      ...VALID_MINIMAL,
      armour: { front: 1, left: 0, right: 0, rear: 0, top: 0 },
    };
    expect(calculateCost(base, CATALOGUE_V1).armourCost).toBe(1);
  });

  it("armour cost for 10 points is 1", () => {
    const base: MachineBuildProposal = {
      ...VALID_MINIMAL,
      armour: { front: 10, left: 0, right: 0, rear: 0, top: 0 },
    };
    expect(calculateCost(base, CATALOGUE_V1).armourCost).toBe(1);
  });

  it("armour cost for 11 points is 2", () => {
    const base: MachineBuildProposal = {
      ...VALID_MINIMAL,
      armour: { front: 11, left: 0, right: 0, rear: 0, top: 0 },
    };
    expect(calculateCost(base, CATALOGUE_V1).armourCost).toBe(2);
  });

  it("armour cost for 120 points is 12", () => {
    const base: MachineBuildProposal = {
      ...VALID_MINIMAL,
      armour: { front: 60, left: 30, right: 20, rear: 10, top: 0 },
    };
    expect(calculateCost(base, CATALOGUE_V1).armourCost).toBe(12);
  });
});

describe("validateBuild", () => {
  it("accepts valid minimal build", () => {
    const result = validateBuild(VALID_MINIMAL, CATALOGUE_V1);
    expect(result.ok).toBe(true);
  });

  it("accepts build exactly at budget", () => {
    const atBudget: MachineBuildProposal = {
      machineName: "At Budget",
      chassisId: "heavy",
      mobilityId: "tracks",
      weaponId: "hammer",
      utilityId: "reinforced_drive",
      armour: { front: 41, left: 0, right: 0, rear: 0, top: 0 },
      designSummary: "Exactly at the limit.",
      designRationale: "Spend every point.",
    };
    const cost = calculateCost(atBudget, CATALOGUE_V1);
    expect(cost.totalCost).toBe(100);
    expect(cost.withinBudget).toBe(true);
    const result = validateBuild(atBudget, CATALOGUE_V1);
    expect(result.ok).toBe(true);
  });

  it("rejects build over budget", () => {
    const over: MachineBuildProposal = {
      machineName: "Over Budget",
      chassisId: "heavy",
      mobilityId: "tracks",
      weaponId: "hammer",
      utilityId: "reinforced_drive",
      armour: { front: 51, left: 0, right: 0, rear: 0, top: 0 },
      designSummary: "One point too many.",
      designRationale: "Exceeds the limit.",
    };
    const cost = calculateCost(over, CATALOGUE_V1);
    expect(cost.totalCost).toBe(101);
    const result = validateBuild(over, CATALOGUE_V1);
    expect(result.ok).toBe(false);
  });

  it("permits unspent budget", () => {
    const result = validateBuild(VALID_MINIMAL, CATALOGUE_V1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.build.totalCost).toBeLessThan(CATALOGUE_V1.budget);
    }
  });

  it("rejects armour zone exceeding 60", () => {
    const overZone: MachineBuildProposal = {
      ...VALID_MINIMAL,
      armour: { front: 61, left: 0, right: 0, rear: 0, top: 0 },
    };
    const result = validateBuild(overZone, CATALOGUE_V1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "armour.front")).toBe(true);
    }
  });

  it("rejects total armour exceeding 120", () => {
    const overTotal: MachineBuildProposal = {
      ...VALID_MINIMAL,
      armour: { front: 25, left: 25, right: 25, rear: 25, top: 25 },
    };
    const result = validateBuild(overTotal, CATALOGUE_V1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "armour")).toBe(true);
    }
  });

  it("accepts all-zero armour", () => {
    const result = validateBuild(VALID_MINIMAL, CATALOGUE_V1);
    expect(result.ok).toBe(true);
  });

  it("rejects unknown chassis at semantic layer", () => {
    const bad: MachineBuildProposal = {
      ...VALID_MINIMAL,
      chassisId: "hover" as MachineBuildProposal["chassisId"],
    };
    const result = validateBuild(bad, CATALOGUE_V1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "chassisId")).toBe(true);
    }
  });

  it("rejects unknown weapon at semantic layer", () => {
    const bad: MachineBuildProposal = {
      ...VALID_MINIMAL,
      weaponId: "laser" as MachineBuildProposal["weaponId"],
    };
    const result = validateBuild(bad, CATALOGUE_V1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "weaponId")).toBe(true);
    }
  });

  it("embeds catalogue version in validated build", () => {
    const result = validateBuild(VALID_MINIMAL, CATALOGUE_V1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.build.catalogueVersion).toBe("1");
    }
  });
});

describe("maximum legal build", () => {
  it("heaviest legal build stays within budget", () => {
    const heavy: MachineBuildProposal = {
      machineName: "Maxed Out",
      chassisId: "heavy",
      mobilityId: "tracks",
      weaponId: "horizontal_spinner",
      utilityId: "cooling",
      armour: { front: 0, left: 0, right: 0, rear: 0, top: 0 },
      designSummary: "Everything expensive.",
      designRationale: "Push the budget to the limit.",
    };
    const cost = calculateCost(heavy, CATALOGUE_V1);
    expect(cost.totalCost).toBe(100);
    expect(cost.withinBudget).toBe(true);
    const result = validateBuild(heavy, CATALOGUE_V1);
    expect(result.ok).toBe(true);
  });
});
