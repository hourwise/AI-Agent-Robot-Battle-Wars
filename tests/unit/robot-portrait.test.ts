import { describe, it, expect } from "vitest";
import {
  renderPortrait,
  extractPortraitData,
} from "../../src/replay/ascii/robot-portrait-renderer.js";
import type { ValidatedBuild } from "../../src/validation/validation.types.js";

function makeBuild(overrides: Partial<ValidatedBuild["proposal"]> = {}): ValidatedBuild {
  return {
    proposal: {
      machineName: "Test Bot",
      chassisId: "medium",
      mobilityId: "wheels",
      weaponId: "ram",
      utilityId: "none",
      armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
      designSummary: "test",
      designRationale: "test",
      ...overrides,
    },
    totalCost: 52,
    armourCost: 2,
    totalArmourPoints: 20,
    catalogueVersion: "1",
  };
}

describe("extractPortraitData", () => {
  it("extracts data from build", () => {
    const build = makeBuild();
    const data = extractPortraitData(build);
    expect(data.machineName).toBe("Test Bot");
    expect(data.chassisId).toBe("medium");
    expect(data.mobilityId).toBe("wheels");
    expect(data.weaponId).toBe("ram");
  });
});

describe("renderPortrait", () => {
  it("renders light chassis", () => {
    const build = makeBuild({ chassisId: "light" });
    const portrait = renderPortrait(build);
    expect(portrait).toContain("Light chassis");
    expect(portrait).toContain("/");
    expect(portrait).toContain("\\");
  });

  it("renders medium chassis", () => {
    const build = makeBuild({ chassisId: "medium" });
    const portrait = renderPortrait(build);
    expect(portrait).toContain("Medium chassis");
  });

  it("renders heavy chassis", () => {
    const build = makeBuild({ chassisId: "heavy" });
    const portrait = renderPortrait(build);
    expect(portrait).toContain("Heavy chassis");
  });

  it("renders wheels mobility", () => {
    const build = makeBuild({ mobilityId: "wheels" });
    const portrait = renderPortrait(build);
    expect(portrait).toContain("Wheels");
    expect(portrait).toContain("O");
  });

  it("renders tracks mobility", () => {
    const build = makeBuild({ mobilityId: "tracks" });
    const portrait = renderPortrait(build);
    expect(portrait).toContain("Tracks");
    expect(portrait).toContain("[]=");
  });

  it("renders legs mobility", () => {
    const build = makeBuild({ mobilityId: "legs" });
    const portrait = renderPortrait(build);
    expect(portrait).toContain("Legs");
    expect(portrait).toContain("/|");
  });

  it("renders ram weapon", () => {
    const build = makeBuild({ weaponId: "ram" });
    const portrait = renderPortrait(build);
    expect(portrait).toContain("Ram");
    expect(portrait).toContain("--=>");
  });

  it("renders hammer weapon", () => {
    const build = makeBuild({ weaponId: "hammer" });
    const portrait = renderPortrait(build);
    expect(portrait).toContain("Hammer");
  });

  it("renders horizontal_spinner weapon", () => {
    const build = makeBuild({ weaponId: "horizontal_spinner" });
    const portrait = renderPortrait(build);
    expect(portrait).toContain("Horizontal Spinner");
    expect(portrait).toContain("=O=");
  });

  it("renders grappler weapon", () => {
    const build = makeBuild({ weaponId: "grappler" });
    const portrait = renderPortrait(build);
    expect(portrait).toContain("Grappler");
    expect(portrait).toContain("/");
    expect(portrait).toContain("\\");
  });

  it("renders flipper weapon", () => {
    const build = makeBuild({ weaponId: "flipper" });
    const portrait = renderPortrait(build);
    expect(portrait).toContain("Flipper");
  });

  it("renders utility when not none", () => {
    const build = makeBuild({ utilityId: "cooling" });
    const portrait = renderPortrait(build);
    expect(portrait).toContain("Utility: Cooling");
  });

  it("does not render utility when none", () => {
    const build = makeBuild({ utilityId: "none" });
    const portrait = renderPortrait(build);
    expect(portrait).not.toContain("Utility:");
  });

  it("sanitizes long machine names", () => {
    const build = makeBuild({ machineName: "A".repeat(30) });
    const portrait = renderPortrait(build);
    expect(portrait).toContain("AAAAAAA~");
  });
});
