import { describe, it, expect } from "vitest";
import { DeterministicSeedSource } from "../../src/seed-source.js";

describe("DeterministicSeedSource", () => {
  it("returns seeds in order", () => {
    const source = new DeterministicSeedSource([101, 202, 303]);
    expect(source.nextSeed()).toBe(101);
    expect(source.nextSeed()).toBe(202);
    expect(source.nextSeed()).toBe(303);
  });

  it("wraps around when exhausted", () => {
    const source = new DeterministicSeedSource([10, 20]);
    expect(source.nextSeed()).toBe(10);
    expect(source.nextSeed()).toBe(20);
    expect(source.nextSeed()).toBe(10);
    expect(source.nextSeed()).toBe(20);
  });

  it("reports remaining correctly", () => {
    const source = new DeterministicSeedSource([1, 2, 3]);
    expect(source.remaining).toBe(3);
    source.nextSeed();
    expect(source.remaining).toBe(2);
    source.nextSeed();
    source.nextSeed();
    expect(source.remaining).toBe(0);
  });

  it("throws on empty seeds", () => {
    expect(() => new DeterministicSeedSource([])).toThrow("at least one seed");
  });
});
