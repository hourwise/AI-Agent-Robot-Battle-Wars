import { describe, it, expect } from "vitest";
import {
  checkComponentQualification,
  selectComponentForTransition,
  transitionComponentState,
  applyTransition,
  createInitialComponentStates,
  getEffectiveSpeed,
  getEffectiveWeaponDamage,
  getEffectiveCoolingBonus,
  isComponentDamaged,
  isComponentDisabled,
  deriveBinaryComponents,
} from "../../src/simulator/component-state.js";
import { SeededRandom } from "../../src/simulator/seeded-random.js";
import type { ComponentStates } from "../../src/simulator/types.js";

// Helper: create a minimal ComponentStates for testing
function makeComps(overrides?: Partial<{
  mobilityState: "healthy" | "damaged" | "disabled";
  weaponState: "healthy" | "damaged" | "disabled";
  utilityState: "healthy" | "damaged" | "disabled";
  utilityInstalled: boolean;
  utilityId: string;
}>): ComponentStates {
  const utilityId = overrides?.utilityId ?? "cooling";
  const comps = createInitialComponentStates(utilityId);
  if (overrides?.mobilityState) comps.mobility.state = overrides.mobilityState;
  if (overrides?.weaponState) comps.weapon.state = overrides.weaponState;
  if (overrides?.utilityState) comps.utility.state = overrides.utilityState;
  if (overrides?.utilityInstalled !== undefined) comps.utility.installed = overrides.utilityInstalled;
  return comps;
}

function makeRng(seed = 1): SeededRandom {
  return new SeededRandom(seed);
}

// ═══════════════════════════════════════════════════════════════════
// Qualification threshold boundary tests
// ═══════════════════════════════════════════════════════════════════

describe("checkComponentQualification — Candidate C1 thresholds", () => {
  it("qualifies at critical threshold 11", () => {
    const result = checkComponentQualification(true, 11);
    expect(result.qualifies).toBe(true);
    expect(result.reason).toBe("critical_component_impact");
  });

  it("qualifies at high-damage threshold 35", () => {
    const result = checkComponentQualification(false, 13);
    expect(result.qualifies).toBe(true);
    expect(result.reason).toBe("high_component_impact");
  });

  it("does NOT qualify at critical threshold minus 1 (9)", () => {
    const result = checkComponentQualification(true, 10);
    expect(result.qualifies).toBe(false);
  });

  it("does NOT qualify at high-damage threshold minus 1 (34)", () => {
    const result = checkComponentQualification(false, 12);
    expect(result.qualifies).toBe(false);
  });

  it("does not qualify below both thresholds", () => {
    const result = checkComponentQualification(false, 5);
    expect(result.qualifies).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("critical takes precedence over high-damage when both satisfied", () => {
    // critical=true, damage=40 → satisfies both, should pick critical
    const result = checkComponentQualification(true, 13);
    expect(result.qualifies).toBe(true);
    expect(result.reason).toBe("critical_component_impact");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Transition: healthy → damaged
// ═══════════════════════════════════════════════════════════════════

describe("transitionComponentState — healthy → damaged", () => {
  it("transitions healthy mobility to damaged on qualified hit", () => {
    const comps = makeComps();
    const result = transitionComponentState(comps, "mobility", true, 11);
    expect(result.transitionOccurred).toBe(true);
    expect(result.component).toBe("mobility");
    expect(result.previousState).toBe("healthy");
    expect(result.newState).toBe("damaged");
  });

  it("transitions healthy weapon to damaged on qualified hit", () => {
    const comps = makeComps();
    const result = transitionComponentState(comps, "weapon", false, 13);
    expect(result.transitionOccurred).toBe(true);
    expect(result.newState).toBe("damaged");
  });

  it("transitions healthy utility to damaged on qualified hit", () => {
    const comps = makeComps();
    const result = transitionComponentState(comps, "utility", true, 11);
    expect(result.transitionOccurred).toBe(true);
    expect(result.component).toBe("utility");
    expect(result.newState).toBe("damaged");
  });

  it("does not transition on unqualified hit", () => {
    const comps = makeComps();
    const result = transitionComponentState(comps, "mobility", false, 1);
    expect(result.transitionOccurred).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Transition: damaged → disabled
// ═══════════════════════════════════════════════════════════════════

describe("transitionComponentState — damaged → disabled", () => {
  it("transitions damaged mobility to disabled on qualified hit", () => {
    const comps = makeComps({ mobilityState: "damaged" });
    const result = transitionComponentState(comps, "mobility", true, 11);
    expect(result.transitionOccurred).toBe(true);
    expect(result.previousState).toBe("damaged");
    expect(result.newState).toBe("disabled");
  });

  it("transitions damaged weapon to disabled on qualified hit", () => {
    const comps = makeComps({ weaponState: "damaged" });
    const result = transitionComponentState(comps, "weapon", false, 13);
    expect(result.transitionOccurred).toBe(true);
    expect(result.newState).toBe("disabled");
  });

  it("does not transition on unqualified hit when damaged", () => {
    const comps = makeComps({ mobilityState: "damaged" });
    const result = transitionComponentState(comps, "mobility", false, 1);
    expect(result.transitionOccurred).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// No healthy → disabled direct path
// ═══════════════════════════════════════════════════════════════════

describe("transitionComponentState — no healthy → disabled", () => {
  it("never transitions healthy directly to disabled", () => {
    const comps = makeComps();
    // Even with extremely high damage, healthy stays healthy→damaged
    const result = transitionComponentState(comps, "mobility", true, 100);
    expect(result.transitionOccurred).toBe(true);
    expect(result.previousState).toBe("healthy");
    expect(result.newState).toBe("damaged");
    // NOT disabled
    expect(result.newState).not.toBe("disabled");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Disabled: no further transition
// ═══════════════════════════════════════════════════════════════════

describe("transitionComponentState — disabled terminal", () => {
  it("does not transition an already-disabled component", () => {
    const comps = makeComps({ mobilityState: "disabled" });
    const result = transitionComponentState(comps, "mobility", true, 100);
    expect(result.transitionOccurred).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Reinforced-drive guard: spent on resistance
// ═══════════════════════════════════════════════════════════════════

describe("transitionComponentState — reinforced-drive guard", () => {
  it("consumes guard on qualified mobility hit when guard is available", () => {
    const comps = createInitialComponentStates("reinforced_drive");
    // Mobility healthy, utility healthy, guard available
    const result = transitionComponentState(comps, "mobility", true, 11);
    expect(result.transitionOccurred).toBe(true);
    expect(result.reason).toBe("reinforced_drive");
    expect(result.guardStateBefore).toBe("available");
    expect(result.guardStateAfter).toBe("spent");
    expect(result.newState).toBe("healthy"); // mobility stays healthy
    expect(result.utilityRuntimeChange).toEqual({
      reinforcedDriveGuardBefore: "available",
      reinforcedDriveGuardAfter: "spent",
    });
  });

  it("does not consume guard when guard is already spent", () => {
    const comps = createInitialComponentStates("reinforced_drive");
    comps.utility.reinforcedDriveGuard = "spent";
    const result = transitionComponentState(comps, "mobility", true, 11);
    expect(result.transitionOccurred).toBe(true);
    expect(result.reason).not.toBe("reinforced_drive");
    expect(result.newState).toBe("damaged"); // normal transition
  });

  it("does not consume guard for non-mobility components", () => {
    const comps = createInitialComponentStates("reinforced_drive");
    const result = transitionComponentState(comps, "weapon", true, 11);
    expect(result.transitionOccurred).toBe(true);
    expect(result.reason).not.toBe("reinforced_drive");
  });

  it("does not consume guard when utility is damaged", () => {
    const comps = createInitialComponentStates("reinforced_drive");
    comps.utility.state = "damaged";
    const result = transitionComponentState(comps, "mobility", true, 11);
    expect(result.transitionOccurred).toBe(true);
    expect(result.reason).not.toBe("reinforced_drive");
  });
});

// ═══════════════════════════════════════════════════════════════════
// applyTransition: guard persistence
// ═══════════════════════════════════════════════════════════════════

describe("applyTransition — guard persistence", () => {
  it("spends guard on reinforced-drive resistance", () => {
    const comps = createInitialComponentStates("reinforced_drive");
    const result = transitionComponentState(comps, "mobility", true, 11);
    const next = applyTransition(comps, result);
    expect(next.utility.reinforcedDriveGuard).toBe("spent");
    expect(next.mobility.state).toBe("healthy");
  });

  it("loses guard when utility becomes damaged", () => {
    const comps = createInitialComponentStates("reinforced_drive");
    const result = transitionComponentState(comps, "utility", true, 11);
    expect(result.utilityRuntimeChange).toEqual({
      reinforcedDriveGuardBefore: "available",
      reinforcedDriveGuardAfter: "lost",
    });
    const next = applyTransition(comps, result);
    expect(next.utility.state).toBe("damaged");
    expect(next.utility.reinforcedDriveGuard).toBe("lost");
  });

  it("loses guard when utility becomes disabled", () => {
    const comps = createInitialComponentStates("reinforced_drive");
    comps.utility.state = "damaged";
    const result = transitionComponentState(comps, "utility", true, 11);
    expect(result.utilityRuntimeChange).toEqual({
      reinforcedDriveGuardBefore: "available",
      reinforcedDriveGuardAfter: "lost",
    });
    const next = applyTransition(comps, result);
    expect(next.utility.state).toBe("disabled");
    expect(next.utility.reinforcedDriveGuard).toBe("lost");
  });

  it("does not create utilityRuntimeChange when no guard is present", () => {
    const comps = createInitialComponentStates("cooling");
    const result = transitionComponentState(comps, "utility", true, 11);
    expect(result.utilityRuntimeChange).toBeUndefined();
    const next = applyTransition(comps, result);
    expect(next.utility.state).toBe("damaged");
    expect(next.utility.reinforcedDriveGuard).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Component selection: absent utility excluded
// ═══════════════════════════════════════════════════════════════════

describe("selectComponentForTransition", () => {
  it("excludes absent utility from selection", () => {
    const comps = createInitialComponentStates("none");
    const rng = makeRng(1);
    // Run many times — utility should never be selected
    for (let i = 0; i < 100; i++) {
      const selected = selectComponentForTransition(comps, "front", rng);
      expect(selected).not.toBe("utility");
    }
  });

  it("excludes disabled components from selection", () => {
    const comps = makeComps({ mobilityState: "disabled" });
    const rng = makeRng(1);
    for (let i = 0; i < 100; i++) {
      const selected = selectComponentForTransition(comps, "front", rng);
      expect(selected).not.toBe("mobility");
    }
  });

  it("includes damaged components in selection", () => {
    const comps = makeComps({ mobilityState: "damaged" });
    const rng = makeRng(1);
    let mobilitySelected = false;
    for (let i = 0; i < 100; i++) {
      const selected = selectComponentForTransition(comps, "front", rng);
      if (selected === "mobility") mobilitySelected = true;
    }
    expect(mobilitySelected).toBe(true);
  });

  it("returns null when no eligible components remain", () => {
    const comps = makeComps({
      mobilityState: "disabled",
      weaponState: "disabled",
      utilityState: "disabled",
    });
    const rng = makeRng(1);
    const selected = selectComponentForTransition(comps, "front", rng);
    expect(selected).toBeNull();
  });

  it("returns null when only absent utility remains eligible", () => {
    const comps = makeComps({
      mobilityState: "disabled",
      weaponState: "disabled",
      utilityInstalled: false,
    });
    const rng = makeRng(1);
    const selected = selectComponentForTransition(comps, "front", rng);
    expect(selected).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Effective-stat helpers
// ═══════════════════════════════════════════════════════════════════

describe("effective-stat helpers", () => {
  it("getEffectiveSpeed reduces speed when mobility damaged", () => {
    const comps = makeComps({ mobilityState: "damaged" });
    const fighter = {
      comps,
      build: { proposal: { mobilityId: "wheels" } },
    } as Parameters<typeof getEffectiveSpeed>[0];
    const speed = getEffectiveSpeed(fighter);
    // wheels base speed is 9, penalty is 2 → 7
    expect(speed).toBe(7);
  });

  it("getEffectiveSpeed minimum is 1", () => {
    const comps = makeComps({ mobilityState: "damaged" });
    const fighter = {
      comps,
      build: { proposal: { mobilityId: "tracks" } },
    } as Parameters<typeof getEffectiveSpeed>[0];
    const speed = getEffectiveSpeed(fighter);
    // tracks base speed is 5, penalty is 2 → 3, but min is 1
    expect(speed).toBe(3);
  });

  it("getEffectiveSpeed is unchanged when mobility healthy", () => {
    const comps = makeComps();
    const fighter = {
      comps,
      build: { proposal: { mobilityId: "wheels" } },
    } as Parameters<typeof getEffectiveSpeed>[0];
    const speed = getEffectiveSpeed(fighter);
    expect(speed).toBe(9);
  });

  it("getEffectiveWeaponDamage reduced when weapon damaged", () => {
    const comps = makeComps({ weaponState: "damaged" });
    const fighter = {
      comps,
    } as Parameters<typeof getEffectiveWeaponDamage>[0];
    const damage = getEffectiveWeaponDamage(fighter, 20);
    expect(damage).toBe(15); // 20 * 0.75 = 15
  });

  it("getEffectiveWeaponDamage unchanged when weapon healthy", () => {
    const comps = makeComps();
    const fighter = {
      comps,
    } as Parameters<typeof getEffectiveWeaponDamage>[0];
    const damage = getEffectiveWeaponDamage(fighter, 20);
    expect(damage).toBe(20);
  });

  it("getEffectiveCoolingBonus returns 0 when utility disabled", () => {
    const comps = makeComps({ utilityState: "disabled" });
    const fighter = { comps } as Parameters<typeof getEffectiveCoolingBonus>[0];
    expect(getEffectiveCoolingBonus(fighter)).toBe(0);
  });

  it("getEffectiveCoolingBonus returns reduced bonus when utility damaged", () => {
    const comps = makeComps({ utilityState: "damaged" });
    const fighter = { comps } as Parameters<typeof getEffectiveCoolingBonus>[0];
    expect(getEffectiveCoolingBonus(fighter)).toBe(2); // DAMAGED_COOLING_BONUS
  });

  it("getEffectiveCoolingBonus returns full bonus when utility healthy", () => {
    const comps = makeComps();
    const fighter = { comps } as Parameters<typeof getEffectiveCoolingBonus>[0];
    expect(getEffectiveCoolingBonus(fighter)).toBe(5); // COOLING_BONUS
  });
});

// ═══════════════════════════════════════════════════════════════════
// Derive binary components from authoritative state
// ═══════════════════════════════════════════════════════════════════

describe("deriveBinaryComponents", () => {
  it("reflects disabled state correctly", () => {
    const comps = makeComps({ mobilityState: "disabled", weaponState: "damaged" });
    const binary = deriveBinaryComponents(comps);
    expect(binary.mobilityDisabled).toBe(true);
    expect(binary.weaponDisabled).toBe(false);
    expect(binary.utilityDisabled).toBe(false);
  });

  it("shows all healthy when nothing is damaged or disabled", () => {
    const comps = makeComps();
    const binary = deriveBinaryComponents(comps);
    expect(binary.mobilityDisabled).toBe(false);
    expect(binary.weaponDisabled).toBe(false);
    expect(binary.utilityDisabled).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Predicates
// ═══════════════════════════════════════════════════════════════════

describe("component predicates", () => {
  it("isComponentDamaged detects damaged components", () => {
    const comps = makeComps({ weaponState: "damaged" });
    expect(isComponentDamaged(comps, "weapon")).toBe(true);
    expect(isComponentDamaged(comps, "mobility")).toBe(false);
  });

  it("isComponentDamaged returns false for disabled (not damaged)", () => {
    const comps = makeComps({ mobilityState: "disabled" });
    expect(isComponentDamaged(comps, "mobility")).toBe(false);
  });

  it("isComponentDisabled detects disabled components", () => {
    const comps = makeComps({ mobilityState: "disabled" });
    expect(isComponentDisabled(comps, "mobility")).toBe(true);
  });
});
