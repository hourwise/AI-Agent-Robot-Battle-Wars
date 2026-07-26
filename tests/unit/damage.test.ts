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

describe("getExposedZones", () => {
  it("exposes front when defender faces attacker (same zone)", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "center", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "south" });
    const zones = getExposedZones(attacker, defender, "ram");
    expect(zones).toContain("front");
    expect(zones).not.toContain("top");
    expect(zones).not.toContain("rear");
  });

  it("exposes front when attacker is south of north-facing defender", () => {
    // Defender at north_edge facing south (toward attacker). Attacker at south_edge
    // is south of defender — the defender is looking AT the attacker.
    // The position helpers use an inverted convention:
    // facing=north + attacker south = front; facing=south + attacker north = front.
    const attacker = makeFighter({ fighterId: "a", zone: "south_edge", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "north" });
    const zones = getExposedZones(attacker, defender, "ram");
    expect(zones).toContain("front");
  });

  it("exposes rear when attacker is behind defender", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "north_edge", facing: "south" });
    const defender = makeFighter({ fighterId: "b", zone: "south_edge", facing: "north" });
    const zones = getExposedZones(attacker, defender, "ram");
    expect(zones).toContain("rear");
    expect(zones).not.toContain("front");
  });

  it("exposes left/right when flanking (east/west of north-facing defender)", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "east_edge", facing: "west" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "north" });
    const zones = getExposedZones(attacker, defender, "ram");
    expect(zones).toContain("left");
    expect(zones).toContain("right");
    expect(zones).not.toContain("front");
  });

  it("exposes top only for hammer weapon", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "center", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "south" });

    const ramZones = getExposedZones(attacker, defender, "ram");
    expect(ramZones).not.toContain("top");

    const hammerZones = getExposedZones(attacker, defender, "hammer");
    expect(hammerZones).toContain("top");
  });

  it("ram cannot hit top even when front is not exposed", () => {
    // Attacker behind defender — rear is exposed, top should NOT be
    const attacker = makeFighter({ fighterId: "a", zone: "north_edge", facing: "south" });
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
    // Policy says primaryTarget=front, front IS exposed → hit front
    const zone = determineHitZone(attacker, defender, "ram", rng, "front", "front");
    expect(zone).toBe("front");
  });

  it("falls back to secondaryTarget when primary is not exposed", () => {
    // Attacker behind defender — front not exposed, rear is
    const attacker = makeFighter({ fighterId: "a", zone: "north_edge", facing: "south" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "north" });
    const rng = new SeededRandom(42);
    // Policy says primaryTarget=front (not exposed), secondaryTarget=rear (exposed)
    const zone = determineHitZone(attacker, defender, "ram", rng, "front", "rear");
    expect(zone).toBe("rear");
  });

  it("defaults to front when neither primary nor secondary is exposed", () => {
    // Both fighters at opposite edges facing away — neither front nor rear exposed for ram
    const attacker = makeFighter({ fighterId: "a", zone: "east_edge", facing: "west" });
    const defender = makeFighter({ fighterId: "b", zone: "west_edge", facing: "west" });
    const rng = new SeededRandom(42);
    // Policy says primaryTarget=rear, secondaryTarget=rear — neither exposed
    const zone = determineHitZone(attacker, defender, "ram", rng, "rear", "rear");
    expect(zone).toBe("front");
  });

  it("frontal ram attacks overwhelmingly resolve against non-top zones", () => {
    // Head-to-head: both at center, facing each other
    const attacker = makeFighter({ fighterId: "a", zone: "center", facing: "north" });
    const defender = makeFighter({ fighterId: "b", zone: "center", facing: "south" });

    // Only front/left/right exposed for ram in same zone — top is never exposed
    for (let seed = 0; seed < 50; seed++) {
      const rng = new SeededRandom(seed);
      const zone = determineHitZone(attacker, defender, "ram", rng, "front", "front");
      expect(zone).not.toBe("top");
    }
  });

  it("ram from behind exclusively resolves against rear when policy targets rear", () => {
    const attacker = makeFighter({ fighterId: "a", zone: "north_edge", facing: "south" });
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
    // No policy targets → defaults to front for ram
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
});
