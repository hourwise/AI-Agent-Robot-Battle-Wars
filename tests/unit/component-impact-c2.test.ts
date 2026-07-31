import { describe, expect, it } from "vitest";
import {
  calculateComponentImpact,
  checkComponentQualification,
} from "../../src/simulator/component-state.js";
import { getComponentQualificationConfig } from "../../src/simulator/component-qualification-registry.js";

describe("Candidate C2 component impact", () => {
  it.each([
    [16, 4],
    [22, 10],
    [23, 11],
    [24, 12],
    [25, 13],
  ])("calculates raw damage %i against armour 60 as impact %i", (raw, expected) => {
    expect(
      calculateComponentImpact({ rawDamage: raw, armourAtHitZone: 60 }).componentImpact,
    ).toBe(expected);
  });

  it("uses C2 critical precedence and exact boundaries", () => {
    expect(checkComponentQualification(true, 12).qualifies).toBe(false);
    expect(checkComponentQualification(true, 13).reason).toBe(
      "critical_component_impact",
    );
    expect(checkComponentQualification(false, 14).qualifies).toBe(false);
    expect(checkComponentQualification(false, 15).reason).toBe("high_component_impact");
    expect(checkComponentQualification(true, 15).reason).toBe(
      "critical_component_impact",
    );
  });

  it("preserves explicit C1 boundaries while C2 remains the default", () => {
    const c1 = getComponentQualificationConfig("component-impact-c1");
    expect(checkComponentQualification(true, 10, c1).qualifies).toBe(false);
    expect(checkComponentQualification(true, 11, c1).reason).toBe(
      "critical_component_impact",
    );
    expect(checkComponentQualification(false, 12, c1).qualifies).toBe(false);
    expect(checkComponentQualification(false, 13, c1).reason).toBe(
      "high_component_impact",
    );
    expect(checkComponentQualification(true, 12).qualifies).toBe(false);
  });

  it("clamps high armour to zero and keeps the minimum at zero", () => {
    const result = calculateComponentImpact({ rawDamage: 1, armourAtHitZone: 1000 });
    expect(result.componentImpact).toBe(0);
    expect(result.minimumImpact).toBe(0);
  });

  it("rounds after armour subtraction", () => {
    expect(
      calculateComponentImpact({ rawDamage: 10, armourAtHitZone: 13 }).componentImpact,
    ).toBe(7);
  });

  it("rejects invalid damage and armour", () => {
    expect(() =>
      calculateComponentImpact({ rawDamage: -1, armourAtHitZone: 0 }),
    ).toThrow();
    expect(() =>
      calculateComponentImpact({ rawDamage: 1, armourAtHitZone: -1 }),
    ).toThrow();
  });
});

describe("Candidate AB2 armour-band component impact", () => {
  const ab2 = getComponentQualificationConfig("component-impact-ab2");

  it.each([
    [0, "exposed", 17, 20],
    [9, "exposed", 17, 20],
    [10, "light", 15, 18],
    [24, "light", 15, 18],
    [25, "protected", 13, 15],
    [49, "protected", 13, 15],
    [50, "heavy", 11, 13],
    [60, "heavy", 11, 13],
  ] as const)("selects %s band at armour %i", (armour, bandId, critical, high) => {
    const result = calculateComponentImpact({ rawDamage: 30, armourAtHitZone: armour }, ab2);
    expect(result.bandId).toBe(bandId);
    expect(result.criticalThreshold).toBe(critical);
    expect(result.highImpactThreshold).toBe(high);
  });

  it("uses struck-zone armour only and preserves the impact formula", () => {
    const result = calculateComponentImpact({ rawDamage: 25, armourAtHitZone: 10 }, ab2);
    expect(result.componentImpact).toBe(23);
    expect(result.bandId).toBe("light");
  });

  it.each([
    ["exposed", 17, 20],
    ["light", 15, 18],
    ["protected", 13, 15],
    ["heavy", 11, 13],
  ] as const)("applies critical/high boundaries for %s", (bandId, critical, high) => {
    const band = ab2.model === "armour-band-component-impact"
      ? ab2.bands.find((candidate) => candidate.id === bandId)
      : undefined;
    expect(band).toBeDefined();
    expect(checkComponentQualification(true, critical - 1, ab2, band)).toMatchObject({
      qualifies: false,
    });
    expect(checkComponentQualification(true, critical, ab2, band)).toMatchObject({
      qualifies: true,
      reason: "critical_component_impact",
    });
    expect(checkComponentQualification(false, high - 1, ab2, band)).toMatchObject({
      qualifies: false,
    });
    expect(checkComponentQualification(false, high, ab2, band)).toMatchObject({
      qualifies: true,
      reason: "high_component_impact",
    });
    expect(checkComponentQualification(true, high, ab2, band).reason).toBe(
      "critical_component_impact",
    );
  });

  it("clamps zero impact and verifies a rounding boundary", () => {
    expect(calculateComponentImpact({ rawDamage: 1, armourAtHitZone: 60 }, ab2).componentImpact).toBe(0);
    expect(calculateComponentImpact({ rawDamage: 10, armourAtHitZone: 24 }, ab2).componentImpact).toBe(5);
  });
});
