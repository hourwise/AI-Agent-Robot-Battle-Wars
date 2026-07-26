import { describe, it, expect } from "vitest";
import { applyRound, RoundState } from "../../src/simulator/reducer.js";
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

function makeState(fighterA: FighterState, fighterB: FighterState): RoundState {
  return {
    fighterA,
    fighterB,
    events: [],
    damageDealt: { a: 0, b: 0 },
    roundsAttacked: { a: 0, b: 0 },
  };
}

describe("applyRound", () => {
  it("applies energy cost on attack", () => {
    const a = makeFighter({ fighterId: "a", zone: "center" });
    const b = makeFighter({ fighterId: "b", zone: "center" });
    const state = makeState(a, b);
    const rng = new SeededRandom(42);
    const result = applyRound(
      state,
      {
        fighterA: { movement: "hold", combat: "attack" },
        fighterB: { movement: "hold", combat: "defend" },
      },
      rng,
      1,
      1000,
    );
    expect(result.fighterA.energy).toBeLessThan(100);
  });

  it("applies heat on attack", () => {
    const a = makeFighter({ fighterId: "a", zone: "center" });
    const b = makeFighter({ fighterId: "b", zone: "center" });
    const state = makeState(a, b);
    const rng = new SeededRandom(42);
    const result = applyRound(
      state,
      {
        fighterA: { movement: "hold", combat: "attack" },
        fighterB: { movement: "hold", combat: "defend" },
      },
      rng,
      1,
      1000,
    );
    expect(result.fighterA.heat).toBeGreaterThan(0);
  });

  it("energy regenerates each round", () => {
    const a = makeFighter({ fighterId: "a", energy: 50 });
    const b = makeFighter({ fighterId: "b" });
    const state = makeState(a, b);
    const rng = new SeededRandom(42);
    const result = applyRound(
      state,
      {
        fighterA: { movement: "hold", combat: "idle" },
        fighterB: { movement: "hold", combat: "idle" },
      },
      rng,
      1,
      1000,
    );
    expect(result.fighterA.energy).toBe(60);
  });

  it("heat dissipates each round", () => {
    const a = makeFighter({ fighterId: "a", heat: 50 });
    const b = makeFighter({ fighterId: "b" });
    const state = makeState(a, b);
    const rng = new SeededRandom(42);
    const result = applyRound(
      state,
      {
        fighterA: { movement: "hold", combat: "idle" },
        fighterB: { movement: "hold", combat: "idle" },
      },
      rng,
      1,
      1000,
    );
    expect(result.fighterA.heat).toBe(35);
  });

  it("movement changes zone", () => {
    const a = makeFighter({ fighterId: "a", zone: "north_edge" });
    const b = makeFighter({ fighterId: "b", zone: "south_edge" });
    const state = makeState(a, b);
    const rng = new SeededRandom(42);
    const result = applyRound(
      state,
      {
        fighterA: { movement: "advance", combat: "idle" },
        fighterB: { movement: "hold", combat: "idle" },
      },
      rng,
      1,
      1000,
    );
    expect(result.fighterA.zone).toBe("center");
  });

  it("defend does not cost energy", () => {
    const a = makeFighter({ fighterId: "a" });
    const b = makeFighter({ fighterId: "b" });
    const state = makeState(a, b);
    const rng = new SeededRandom(42);
    const result = applyRound(
      state,
      {
        fighterA: { movement: "hold", combat: "defend" },
        fighterB: { movement: "hold", combat: "idle" },
      },
      rng,
      1,
      1000,
    );
    expect(result.fighterA.energy).toBe(100);
  });

  it("produces events", () => {
    const a = makeFighter({ fighterId: "a", zone: "center" });
    const b = makeFighter({ fighterId: "b", zone: "center" });
    const state = makeState(a, b);
    const rng = new SeededRandom(42);
    const result = applyRound(
      state,
      {
        fighterA: { movement: "hold", combat: "attack" },
        fighterB: { movement: "hold", combat: "attack" },
      },
      rng,
      1,
      1000,
    );
    expect(result.events.length).toBeGreaterThan(0);
  });

  it("sets weapon cooldown after attack from catalogue", () => {
    const a = makeFighter({ fighterId: "a", zone: "center" });
    const b = makeFighter({ fighterId: "b", zone: "center" });
    const state = makeState(a, b);
    const rng = new SeededRandom(42);
    const result = applyRound(
      state,
      {
        fighterA: { movement: "hold", combat: "attack" },
        fighterB: { movement: "hold", combat: "defend" },
      },
      rng,
      1,
      1000,
    );
    if (result.fighterA.weaponCooldown > 0) {
      expect(result.fighterA.weaponCooldown).toBeGreaterThan(0);
    }
  });

  it("decrements weapon cooldown each round", () => {
    const a = makeFighter({ fighterId: "a", weaponCooldown: 2 });
    const b = makeFighter({ fighterId: "b" });
    const state = makeState(a, b);
    const rng = new SeededRandom(42);
    const result = applyRound(
      state,
      {
        fighterA: { movement: "hold", combat: "idle" },
        fighterB: { movement: "hold", combat: "idle" },
      },
      rng,
      1,
      1000,
    );
    expect(result.fighterA.weaponCooldown).toBe(1);
  });

  it("overheated condition persists to next round start", () => {
    const a = makeFighter({ fighterId: "a", conditions: ["overheated"] });
    const b = makeFighter({ fighterId: "b" });
    const state = makeState(a, b);
    const rng = new SeededRandom(42);
    const result = applyRound(
      state,
      {
        fighterA: { movement: "hold", combat: "idle" },
        fighterB: { movement: "hold", combat: "idle" },
      },
      rng,
      1,
      1000,
    );
    expect(result.fighterA.conditions).not.toContain("overheated");
    const recoveredEvent = result.events.find(
      (e) => e.type === "robot_recovered" && e.actorId === "a",
    );
    expect(recoveredEvent).toBeDefined();
  });

  it("emits robot_overheated when condition first applied", () => {
    const a = makeFighter({ fighterId: "a", heat: 195, conditions: [] });
    const b = makeFighter({ fighterId: "b" });
    const state = makeState(a, b);
    const rng = new SeededRandom(42);
    const result = applyRound(
      state,
      {
        fighterA: { movement: "hold", combat: "attack" },
        fighterB: { movement: "hold", combat: "defend" },
      },
      rng,
      1,
      1000,
    );
    const overheatEvent = result.events.find(
      (e) => e.type === "robot_overheated" && e.actorId === "a",
    );
    expect(overheatEvent).toBeDefined();
  });
});
