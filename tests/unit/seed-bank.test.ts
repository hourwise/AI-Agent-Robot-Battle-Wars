import { describe, it, expect } from "vitest";
import {
  loadSeedBank,
  validateSeedBank,
  getSeedsForPartition,
} from "../../src/bench/seed-bank.js";
import seedFixture from "../../data/seeds/benchmark-100-v1.json";

describe("seed bank fixture", () => {
  it("has correct schema version", () => {
    expect(seedFixture.schemaVersion).toBe("1");
  });

  it("has correct bank ID", () => {
    expect(seedFixture.bankId).toBe("prototype-0.2-baseline-v1");
  });

  it("has exactly 100 total seeds", () => {
    const total = seedFixture.developmentSeeds.length + seedFixture.heldOutSeeds.length;
    expect(total).toBe(100);
  });

  it("has 80 development seeds", () => {
    expect(seedFixture.developmentSeeds).toHaveLength(80);
  });

  it("has 20 held-out seeds", () => {
    expect(seedFixture.heldOutSeeds).toHaveLength(20);
  });

  it("all seeds are unique", () => {
    const all = [...seedFixture.developmentSeeds, ...seedFixture.heldOutSeeds];
    expect(new Set(all).size).toBe(100);
  });

  it("no overlap between partitions", () => {
    const dev = new Set(seedFixture.developmentSeeds);
    for (const s of seedFixture.heldOutSeeds) {
      expect(dev.has(s)).toBe(false);
    }
  });

  it("all seeds are valid positive integers", () => {
    for (const s of seedFixture.developmentSeeds) {
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThan(0);
    }
    for (const s of seedFixture.heldOutSeeds) {
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThan(0);
    }
  });

  it("passes seed bank validation", () => {
    const bank = loadSeedBank(seedFixture);
    const errors = validateSeedBank(bank);
    expect(errors).toHaveLength(0);
  });

  it("records frozen Prototype 0.1 version baseline", () => {
    expect(seedFixture.simulatorVersion).toBe("0.1.2");
    expect(seedFixture.rulesetVersion).toBe("0.1.0");
    expect(seedFixture.catalogueVersion).toBe("1");
  });

  it("getSeedsForPartition returns correct subsets", () => {
    const bank = loadSeedBank(seedFixture);
    expect(getSeedsForPartition(bank, "development")).toHaveLength(80);
    expect(getSeedsForPartition(bank, "held-out")).toHaveLength(20);
    expect(getSeedsForPartition(bank, "all")).toHaveLength(100);
  });
});
