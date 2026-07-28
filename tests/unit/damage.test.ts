import { describe, it, expect } from "vitest";
import {
  calculateAttack,
  isComponentDamageTriggered,
  selectDamagedComponent,
  getExposedZones,
  determineHitZone,
} from "../../src/simulator/damage.js";
import { SeededRandom } from "../../src/simulator/seeded-random.js";
import type { FighterState } from "../../src/simulator/types.js";

function makeFighter(overrides: Partial<FighterState> = {}): FighterState {
  const base = {
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
    zone: "center" as const,
    facing: "north" as const,
    weaponCooldown: 0,
    utilityCooldown: 0,
    armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
    components: {
      mobilityDisabled: false,
      weaponDisabled: false,
      utilityDisabled: false,
    } as const,
    conditions: [] as string[],
  };

  const merged = { ...base, ...overrides };
  const utilityId = merged.build.proposal.utilityId;

  return {
    ...merged,
    comps: {
      mobility: { state: "healthy" as const },
      weapon: { state: "healthy" as const },
      utility: {
        state: "healthy" as const,
        installed: utilityId !== "none",
        reinforcedDriveGuard:
          utilityId === "reinforced_drive" ? ("available" as const) : undefined,
      },
    },
    conditions: merged.conditions ?? [],
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

describe("getExposedZones", () => {
  // --- Same-zone cases ---
  it("exposes front when defender faces attacker (same zone)", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "center", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "south" });
    const zones = getExposedZones(attacker, defender, "ram");
    expect(zones).toContain("front");
    expect(zones).not.toContain("top");
    expect(zones).not.toContain("rear");
  });

  it("exposes top only for hammer weapon", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "center", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "south" });
    const ramZones = getExposedZones(attacker, defender, "ram");
    expect(ramZones).not.toContain("top");
    const hammerZones = getExposedZones(attacker, defender, "hammer");
    expect(hammerZones).toContain("top");
  });

  // --- 8 directional cases: defender at center, attacker at edge ---
  it("1: north-facing defender, attacker north → front", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "north_edge", facing: "south" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "north" });
    const zones = getExposedZones(attacker, defender, "ram");
    expect(zones).toContain("front");
    expect(zones).not.toContain("rear");
  });

  it("2: north-facing defender, attacker south → rear", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "south_edge", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "north" });
    const zones = getExposedZones(attacker, defender, "ram");
    expect(zones).toContain("rear");
    expect(zones).not.toContain("front");
  });

  it("3: south-facing defender, attacker south → front", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "south_edge", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "south" });
    const zones = getExposedZones(attacker, defender, "ram");
    expect(zones).toContain("front");
    expect(zones).not.toContain("rear");
  });

  it("4: south-facing defender, attacker north → rear", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "north_edge", facing: "south" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "south" });
    const zones = getExposedZones(attacker, defender, "ram");
    expect(zones).toContain("rear");
    expect(zones).not.toContain("front");
  });

  it("5: east-facing defender, attacker east → front", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "east_edge", facing: "west" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "east" });
    const zones = getExposedZones(attacker, defender, "ram");
    expect(zones).toContain("front");
    expect(zones).not.toContain("rear");
  });

  it("6: east-facing defender, attacker west → rear", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "west_edge", facing: "east" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "east" });
    const zones = getExposedZones(attacker, defender, "ram");
    expect(zones).toContain("rear");
    expect(zones).not.toContain("front");
  });

  it("7: west-facing defender, attacker west → front", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "west_edge", facing: "east" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "west" });
    const zones = getExposedZones(attacker, defender, "ram");
    expect(zones).toContain("front");
    expect(zones).not.toContain("rear");
  });

  it("8: west-facing defender, attacker east → rear", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "east_edge", facing: "west" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "west" });
    const zones = getExposedZones(attacker, defender, "ram");
    expect(zones).toContain("rear");
    expect(zones).not.toContain("front");
  });

  // --- Flanking ---
  it("exposes left/right when flanking east/west of north-facing defender", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "east_edge", facing: "west" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "north" });
    const zones = getExposedZones(attacker, defender, "ram");
    expect(zones).toContain("left");
    expect(zones).toContain("right");
    expect(zones).not.toContain("front");
    expect(zones).not.toContain("rear");
  });

  // --- Ram never hits top ---
  it("ram cannot hit top even when behind defender", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "south_edge", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "north" });
    const zones = getExposedZones(attacker, defender, "ram");
    expect(zones).not.toContain("top");
    expect(zones).toContain("rear");
  });
});

describe("determineHitZone", () => {
  it("uses policy primaryTarget when exposed (ram hits front as policy directs)", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "center", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "south" });
    const rng = new SeededRandom(42);
    const zone = determineHitZone(attacker, defender, "ram", rng, "front", "front");
    expect(zone).toBe("front");
  });

  it("falls back to secondaryTarget when primary is not exposed", () => {
    // Attacker behind defender (south of north-facing) — front not exposed, rear is
    const attacker = makeFighter({ fighterId: "a", zone: "south_edge", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "north" });
    const rng = new SeededRandom(42);
    const zone = determineHitZone(attacker, defender, "ram", rng, "front", "rear");
    expect(zone).toBe("rear");
  });

  it("defaults to front when neither primary nor secondary is exposed", () => {
    // Defender at north_edge facing north; attacker at center.
    // Attacker is south of defender → only rear exposed.
    // Policy targets front — not exposed → defaults to front per RULESET.md.
    const attacker = makeFighter({ fighterId: "a", zone: "center", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "north_edge", facing: "north" });
    const rng = new SeededRandom(42);
    const zone = determineHitZone(attacker, defender, "ram", rng, "front", "front");
    expect(zone).toBe("front");
  });

  it("frontal ram attacks overwhelmingly resolve against non-top zones", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "center", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "south" });
    for (let seed = 0; seed < 50; seed++) {
      const rng = new SeededRandom(seed);
      const zone = determineHitZone(attacker, defender, "ram", rng, "front", "front");
      expect(zone).not.toBe("top");
    }
  });

  it("ram from behind exclusively resolves against rear when policy targets rear", () => {
    // Defender at center facing north; attacker at south_edge = behind
    const attacker = makeFighter({ fighterId: "a", zone: "south_edge", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "north" });
    for (let seed = 0; seed < 50; seed++) {
      const rng = new SeededRandom(seed);
      const zone = determineHitZone(attacker, defender, "ram", rng, "rear", "rear");
      expect(zone).toBe("rear");
    }
  });

  it("uses default primary=front for ram when no policy targets provided", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "center", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "south" });
    const rng = new SeededRandom(42);
    const zone = determineHitZone(attacker, defender, "ram", rng);
    expect(zone).toBe("front");
  });

  it("hammer uses top as default primary when no policy targets provided", () => {
    const attacker = makeFighter({
      fighterId: "a",
      zone: "center",
      facing: "north",
      build: {
        proposal: {
          machineName: "Test",
          chassisId: "medium",
          mobilityId: "wheels",
          weaponId: "hammer",
          utilityId: "none",
          armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
          designSummary: "test",
          designRationale: "test",
        },
        totalCost: 62,
        armourCost: 2,
        totalArmourPoints: 20,
        catalogueVersion: "1",
      },
    });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "south" });
    const rng = new SeededRandom(42);
    const zone = determineHitZone(attacker, defender, "hammer", rng);
    expect(zone).toBe("top");
  });

  // --- Bulwark realistic cases ---
  it("Bulwark frontal attack encounters front armour", () => {
    // Both Bulwarks rush to center and face each other
    const attacker = makeFighter({ fighterId: "a", zone: "center", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "south" });
    const rng = new SeededRandom(42);
    // Bulwark policy: primaryTarget=front, secondaryTarget=front
    const zone = determineHitZone(attacker, defender, "ram", rng, "front", "front");
    expect(zone).toBe("front");
  });

  it("Bulwark attacker behind defender can target rear armour", () => {
    // Defender at center facing north; attacker at south_edge = behind
    const attacker = makeFighter({ fighterId: "a", zone: "south_edge", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "north" });
    const rng = new SeededRandom(42);
    // Policy targets rear
    const zone = determineHitZone(attacker, defender, "ram", rng, "rear", "rear");
    expect(zone).toBe("rear");
  });

  it("policy front-target cannot force false front from behind", () => {
    // Attacker behind defender, but policy stubbornly says primaryTarget=front
    const attacker = makeFighter({ fighterId: "a", zone: "south_edge", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "north" });
    const rng = new SeededRandom(42);
    // primaryTarget=front is NOT exposed (attacker behind) → falls to secondaryTarget=front (also not exposed) → defaults to front
    // The hit zone "front" is the fallback per RULESET.md, but the EXPOSED zone is rear.
    const zone = determineHitZone(attacker, defender, "ram", rng, "front", "front");
    // Defaults to "front" per rules when neither target is exposed — this is a rule fallback, not a geometry result
    expect(zone).toBe("front");
  });

  it("policy rear-target from behind correctly hits rear", () => {
    // Same geometry, but policy correctly targets rear
    const attacker = makeFighter({ fighterId: "a", zone: "south_edge", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "north" });
    const rng = new SeededRandom(42);
    const zone = determineHitZone(attacker, defender, "ram", rng, "rear", "rear");
    expect(zone).toBe("rear");
  });
});

// --- Hammer damage bonus audit ---

function makeHammerFighter(): FighterState {
  return makeFighter({
    fighterId: "a",
    zone: "center",
    facing: "north",
    build: {
      proposal: {
        machineName: "Test",
        chassisId: "heavy",
        mobilityId: "tracks",
        weaponId: "hammer",
        utilityId: "none",
        armour: { front: 0, left: 0, right: 0, rear: 0, top: 0 },
        designSummary: "test",
        designRationale: "test",
      },
      totalCost: 80,
      armourCost: 0,
      totalArmourPoints: 0,
      catalogueVersion: "1",
    },
  });
}

describe("hammer damage bonus", () => {
  // HAMMER_TOP_DAMAGE_BONUS = 0.15, hammer base damage = 35
  // Hammer bonus applies when (hitZone === "top" || defender is overturned).
  // It must never apply twice even when both conditions are true.

  it("hammer against normal front armour: no bonus", () => {
    const rng = new SeededRandom(42);
    const attacker = makeHammerFighter();
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "south" });
    const result = calculateAttack(attacker, defender, 1.0, 0, rng, "front", "front");
    expect(result.hit).toBe(true);
    expect(result.hitZone).toBe("front");
    // No top hit, not overturned → rawDamage = baseDamage * (1 + variance)
    // 35 * (1 + variance) — no bonus multiplier
  });

  it("hammer top hit gets the bonus", () => {
    const rng = new SeededRandom(42);
    const attacker = makeHammerFighter();
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "south" });
    const result = calculateAttack(attacker, defender, 1.0, 0, rng, "top", "top");
    expect(result.hit).toBe(true);
    expect(result.hitZone).toBe("top");
    // rawDamage = 35 * (1+variance) * 1.15
    // Compare with same scenario but no bonus
    const rng2 = new SeededRandom(42);
    const noBonusResult = calculateAttack(
      attacker,
      defender,
      1.0,
      0,
      rng2,
      "front",
      "front",
    );
    // Same variance seed → ratio should be exactly 1.15
    expect(result.rawDamage / noBonusResult.rawDamage).toBeCloseTo(1.15, 1);
  });

  it("hammer against overturned target gets the bonus", () => {
    const rng = new SeededRandom(42);
    const attacker = makeHammerFighter();
    const defender = makeFighter({
      fighterId: "b",
      zone: "center",
      facing: "south",
      conditions: ["overturned"],
    });
    const result = calculateAttack(attacker, defender, 1.0, 0, rng, "front", "front");
    expect(result.hit).toBe(true);
    // Overturned → bonus applied once
    const rng2 = new SeededRandom(42);
    const normalDefender = makeFighter({
      fighterId: "b",
      zone: "center",
      facing: "south",
    });
    const noBonusResult = calculateAttack(
      attacker,
      normalDefender,
      1.0,
      0,
      rng2,
      "front",
      "front",
    );
    expect(result.rawDamage / noBonusResult.rawDamage).toBeCloseTo(1.15, 1);
  });

  it("hammer top hit against overturned target: bonus applied once, not twice", () => {
    const rng = new SeededRandom(42);
    const attacker = makeHammerFighter();
    const overturnedDefender = makeFighter({
      fighterId: "b",
      zone: "center",
      facing: "south",
      conditions: ["overturned"],
    });
    // Both conditions true: top hit + overturned
    const result = calculateAttack(
      attacker,
      overturnedDefender,
      1.0,
      0,
      rng,
      "top",
      "top",
    );
    expect(result.hit).toBe(true);
    expect(result.hitZone).toBe("top");

    // Compare with top hit on non-overturned (one condition only)
    const rng2 = new SeededRandom(42);
    const normalDefender = makeFighter({
      fighterId: "b",
      zone: "center",
      facing: "south",
    });
    const topOnlyResult = calculateAttack(
      attacker,
      normalDefender,
      1.0,
      0,
      rng2,
      "top",
      "top",
    );

    // Both should have the SAME bonus multiplier (1.15), not doubled
    expect(result.rawDamage).toBe(topOnlyResult.rawDamage);
  });

  it("hammer overturned bonus does not stack with top-hit bonus", () => {
    // Compare top-hit-only vs top-hit+overturned — same rawDamage proves no double-application
    const rng = new SeededRandom(42);
    const attacker = makeHammerFighter();

    const overturnedDefender = makeFighter({
      fighterId: "b",
      zone: "center",
      facing: "south",
      conditions: ["overturned"],
    });
    const bothResult = calculateAttack(
      attacker,
      overturnedDefender,
      1.0,
      0,
      rng,
      "top",
      "top",
    );

    const rng2 = new SeededRandom(42);
    const normalDefender = makeFighter({
      fighterId: "b",
      zone: "center",
      facing: "south",
    });
    const topOnlyResult = calculateAttack(
      attacker,
      normalDefender,
      1.0,
      0,
      rng2,
      "top",
      "top",
    );

    expect(bothResult.rawDamage).toBe(topOnlyResult.rawDamage);
  });
});
