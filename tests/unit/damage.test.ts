import { describe, it, expect } from "vitest";
import {
  calculateAttack,
  isComponentDamageTriggered,
  selectDamagedComponent,
} from "../../src/simulator/damage.js";
import { SeededRandom } from "../../src/simulator/seeded-random.js";
import type { FighterState } from "../../src/simulator/types.js";

function makeFighter(overrides: Partial<FighterState> = {}): FighterState {
  return {
    fighterId: "test",
    build: {
      proposal: {
        machineName: "Test",
        chassisId: "medium",
        mobilityId: "wheels",
        weaponId: "ram",
        utilityId: "none",
        armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
        designSummary: "test",
        designRationale: "test",
      },
      totalCost: 52,
      armourCost: 2,
      totalArmourPoints: 20,
      catalogueVersion: "1",
    },
    integrity: 100,
    maxIntegrity: 100,
    energy: 100,
    heat: 0,
    zone: "center",
    facing: "north",
    weaponCooldown: 0,
    utilityCooldown: 0,
    armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
    components: {
      mobilityDisabled: false,
      weaponDisabled: false,
      utilityDisabled: false,
    },
    conditions: [],
    ...overrides,
  };
}

describe("calculateAttack", () => {
  it("miss returns zero damage", () => {
    const rng = new SeededRandom(1);
    const attacker = makeFighter({ fighterId: "a" });
    const defender = makeFighter({ fighterId: "b" });
    const result = calculateAttack(attacker, defender, 0.0, 0, rng);
    expect(result.hit).toBe(false);
    expect(result.effectiveDamage).toBe(0);
  });

  it("guaranteed hit deals minimum 1 damage", () => {
    const rng = new SeededRandom(42);
    const attacker = makeFighter({ fighterId: "a" });
    const defender = makeFighter({
      fighterId: "b",
      armour: { front: 60, left: 60, right: 60, rear: 60, top: 60 },
    });
    const result = calculateAttack(attacker, defender, 1.0, 0, rng);
    expect(result.hit).toBe(true);
    expect(result.effectiveDamage).toBeGreaterThanOrEqual(1);
  });

  it("ram with momentum deals more damage", () => {
    const rng = new SeededRandom(42);
    const attacker = makeFighter({ fighterId: "a" });
    const defender = makeFighter({ fighterId: "b" });
    const noMomentum = calculateAttack(attacker, defender, 1.0, 0, rng);
    const rng2 = new SeededRandom(42);
    const withMomentum = calculateAttack(attacker, defender, 1.0, 1, rng2);
    expect(withMomentum.rawDamage).toBeGreaterThanOrEqual(noMomentum.rawDamage);
  });

  it("flipper can overturn", () => {
    const attacker = makeFighter({
      fighterId: "a",
      build: {
        proposal: {
          machineName: "Test",
          chassisId: "heavy",
          mobilityId: "tracks",
          weaponId: "flipper",
          utilityId: "none",
          armour: { front: 0, left: 0, right: 0, rear: 0, top: 0 },
          designSummary: "test",
          designRationale: "test",
        },
        totalCost: 85,
        armourCost: 0,
        totalArmourPoints: 0,
        catalogueVersion: "1",
      },
    });
    const defender = makeFighter({
      fighterId: "b",
      build: {
        proposal: {
          machineName: "Test",
          chassisId: "light",
          mobilityId: "wheels",
          weaponId: "ram",
          utilityId: "none",
          armour: { front: 0, left: 0, right: 0, rear: 0, top: 0 },
          designSummary: "test",
          designRationale: "test",
        },
        totalCost: 37,
        armourCost: 0,
        totalArmourPoints: 0,
        catalogueVersion: "1",
      },
    });

    let overturned = false;
    for (let seed = 0; seed < 100; seed++) {
      const r = new SeededRandom(seed);
      const result = calculateAttack(attacker, defender, 1.0, 0, r);
      if (result.overturnSuccess) overturned = true;
    }
    expect(overturned).toBe(true);
  });
});

describe("isComponentDamageTriggered", () => {
  it("triggers with some probability", () => {
    let count = 0;
    for (let i = 0; i < 1000; i++) {
      if (isComponentDamageTriggered(new SeededRandom(i))) count++;
    }
    expect(count).toBeGreaterThan(200);
    expect(count).toBeLessThan(300);
  });
});

describe("selectDamagedComponent", () => {
  it("returns a valid component", () => {
    const rng = new SeededRandom(42);
    const components = {
      mobilityDisabled: false,
      weaponDisabled: false,
      utilityDisabled: false,
    };
    const result = selectDamagedComponent("front", components, rng);
    expect(["mobility", "weapon", "utility"]).toContain(result);
  });

  it("returns null when all components disabled", () => {
    const rng = new SeededRandom(42);
    const components = {
      mobilityDisabled: true,
      weaponDisabled: true,
      utilityDisabled: true,
    };
    const result = selectDamagedComponent("front", components, rng);
    expect(result).toBeNull();
  });

  it("respects zone weights", () => {
    const components = {
      mobilityDisabled: false,
      weaponDisabled: false,
      utilityDisabled: false,
    };
    let utilityCount = 0;
    for (let i = 0; i < 1000; i++) {
      const r = new SeededRandom(i);
      if (selectDamagedComponent("front", components, r) === "utility") utilityCount++;
    }
    expect(utilityCount).toBe(0);
  });
});
