import { describe, it, expect } from "vitest";
import { checkVictory, judgeDecision } from "../../src/simulator/victory.js";
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

describe("checkVictory", () => {
  it("returns destruction when opponent integrity is zero", () => {
    const a = makeFighter({ fighterId: "a", integrity: 50 });
    const b = makeFighter({ fighterId: "b", integrity: 0 });
    const result = checkVictory(a, b, 5, 20, { a: 100, b: 50 }, { a: 3, b: 2 });
    expect(result).not.toBeNull();
    expect(result!.winner).toBe("a");
    expect(result!.method).toBe("destruction");
  });

  it("returns immobilisation when mobility disabled", () => {
    const a = makeFighter({ fighterId: "a" });
    const b = makeFighter({
      fighterId: "b",
      components: {
        mobilityDisabled: true,
        weaponDisabled: false,
        utilityDisabled: false,
      },
    });
    const result = checkVictory(a, b, 5, 20, { a: 100, b: 50 }, { a: 3, b: 2 });
    expect(result).not.toBeNull();
    expect(result!.winner).toBe("a");
    expect(result!.method).toBe("immobilisation");
  });

  it("returns null when match continues", () => {
    const a = makeFighter({ fighterId: "a", integrity: 80 });
    const b = makeFighter({ fighterId: "b", integrity: 80 });
    const result = checkVictory(a, b, 5, 20, { a: 20, b: 20 }, { a: 3, b: 2 });
    expect(result).toBeNull();
  });

  it("returns judges at round limit", () => {
    const a = makeFighter({ fighterId: "a", integrity: 50 });
    const b = makeFighter({ fighterId: "b", integrity: 60 });
    const result = checkVictory(a, b, 20, 20, { a: 40, b: 30 }, { a: 10, b: 8 });
    expect(result).not.toBeNull();
    expect(result!.method).toBe("judges");
  });

  it("mutual destruction goes to judges", () => {
    const a = makeFighter({ fighterId: "a", integrity: 0 });
    const b = makeFighter({ fighterId: "b", integrity: 0 });
    const result = checkVictory(a, b, 10, 20, { a: 150, b: 150 }, { a: 8, b: 8 });
    expect(result).not.toBeNull();
    expect(result!.method).toBe("judges");
  });

  // v2: damaged mobility does NOT trigger immobilisation
  it("damaged mobility does NOT end the match (v2 behaviour)", () => {
    // Damaged mobility → components.mobilityDisabled is false (from deriveBinaryComponents)
    const a = makeFighter({ fighterId: "a" });
    const b = makeFighter({
      fighterId: "b",
      components: {
        mobilityDisabled: false, // damaged, not disabled
        weaponDisabled: false,
        utilityDisabled: false,
      },
    });
    // match should continue when only mobility is damaged, not disabled
    const result = checkVictory(a, b, 5, 20, { a: 30, b: 20 }, { a: 3, b: 2 });
    expect(result).toBeNull();
  });

  // v2: only disabled mobility ends match by immobilisation
  it("disabled mobility STILL ends the match by immobilisation", () => {
    const a = makeFighter({ fighterId: "a" });
    const b = makeFighter({
      fighterId: "b",
      components: {
        mobilityDisabled: true, // disabled
        weaponDisabled: false,
        utilityDisabled: false,
      },
    });
    const result = checkVictory(a, b, 5, 20, { a: 30, b: 20 }, { a: 3, b: 2 });
    expect(result).not.toBeNull();
    expect(result!.method).toBe("immobilisation");
  });
});

describe("judgeDecision", () => {
  it("winner has higher score", () => {
    const a = makeFighter({
      fighterId: "a",
      integrity: 80,
      maxIntegrity: 100,
      components: {
        mobilityDisabled: false,
        weaponDisabled: false,
        utilityDisabled: false,
      },
    });
    const b = makeFighter({
      fighterId: "b",
      integrity: 30,
      maxIntegrity: 100,
      components: {
        mobilityDisabled: false,
        weaponDisabled: true,
        utilityDisabled: false,
      },
    });
    const result = judgeDecision(a, b, { a: 100, b: 50 }, { a: 10, b: 8 }, 20);
    expect(result.winner).toBe("a");
    expect(result.method).toBe("judges");
    expect(result.judgeScores).toBeDefined();
  });

  it("equal scores go to tiebreak", () => {
    const a = makeFighter({ fighterId: "a", integrity: 50, maxIntegrity: 100 });
    const b = makeFighter({ fighterId: "b", integrity: 50, maxIntegrity: 100 });
    const result = judgeDecision(a, b, { a: 50, b: 50 }, { a: 5, b: 5 }, 20);
    expect(result.method).toBe("judges");
  });
});
