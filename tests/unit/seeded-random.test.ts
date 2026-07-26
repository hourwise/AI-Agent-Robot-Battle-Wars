import { describe, it, expect } from "vitest";
import { SeededRandom } from "../../src/simulator/seeded-random.js";

describe("SeededRandom", () => {
  it("same seed produces same sequence", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("different seeds produce different sequences", () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(2);
    const results = Array.from({ length: 10 }, () => a.next() === b.next());
    expect(results.some((r) => r)).toBe(false);
  });

  it("next returns values in [0, 1)", () => {
    const rng = new SeededRandom(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("range returns values in [min, max)", () => {
    const rng = new SeededRandom(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.range(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it("int returns integers in [min, max]", () => {
    const rng = new SeededRandom(13);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("chance returns boolean with correct probability", () => {
    const rng = new SeededRandom(77);
    let trueCount = 0;
    const trials = 10000;
    for (let i = 0; i < trials; i++) {
      if (rng.chance(0.3)) trueCount++;
    }
    const rate = trueCount / trials;
    expect(rate).toBeGreaterThan(0.25);
    expect(rate).toBeLessThan(0.35);
  });

  it("pick returns elements from the array", () => {
    const rng = new SeededRandom(33);
    const items = ["a", "b", "c"] as const;
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });

  it("weightedPick respects weights", () => {
    const rng = new SeededRandom(55);
    const items = ["a", "b"] as const;
    let countA = 0;
    const trials = 10000;
    for (let i = 0; i < trials; i++) {
      if (rng.weightedPick(items, [3, 1]) === "a") countA++;
    }
    const rate = countA / trials;
    expect(rate).toBeGreaterThan(0.7);
    expect(rate).toBeLessThan(0.8);
  });
});
