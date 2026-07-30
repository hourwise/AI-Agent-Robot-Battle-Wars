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
