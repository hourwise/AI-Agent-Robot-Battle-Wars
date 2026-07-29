import { describe, it, expect } from "vitest";
import {
  runBenchmark,
  fingerprintBuild,
  fingerprintPolicy,
} from "../../src/bench/run-benchmark.js";
import { computeMetrics } from "../../src/bench/metrics.js";
import { loadSeedBank } from "../../src/bench/seed-bank.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import seedFixture from "../../data/seeds/benchmark-100-v1.json";
import type { PerMatchResult } from "../../src/bench/benchmark.types.js";

const bank = loadSeedBank(seedFixture);

function makeResult(overrides: Partial<PerMatchResult> = {}): PerMatchResult {
  return {
    seed: 1,
    roleSwapped: false,
    fighterACompetitor: "x",
    fighterBCompetitor: "y",
    winner: "fighter_a",
    method: "destruction",
    rounds: 5,
    fighterA: {
      machineName: "A",
      integrity: 80,
      maxIntegrity: 100,
      mobilityDisabled: false,
      weaponDisabled: false,
      utilityDisabled: false,
      disabledComponents: [],
    },
    fighterB: {
      machineName: "B",
      integrity: 0,
      maxIntegrity: 100,
      mobilityDisabled: false,
      weaponDisabled: false,
      utilityDisabled: false,
      disabledComponents: [],
    },
    criticalHits: 1,
    attacksAttempted: 5,
    attacksHit: 3,
    ...overrides,
  };
}

describe("fingerprint", () => {
  it("produces stable build fingerprint", () => {
    const build = createBulwarkBuild();
    const fp1 = fingerprintBuild(build);
    const fp2 = fingerprintBuild(build);
    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(16);
  });

  it("produces stable policy fingerprint", () => {
    const fp1 = fingerprintPolicy(BULWARK_POLICY);
    const fp2 = fingerprintPolicy(BULWARK_POLICY);
    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(16);
  });

  it("different builds produce different fingerprints", () => {
    const build1 = createBulwarkBuild();
    const build2 = {
      ...build1,
      proposal: { ...build1.proposal, machineName: "Different" },
    };
    expect(fingerprintBuild(build1)).not.toBe(fingerprintBuild(build2));
  });
});

describe("runBenchmark", () => {
  it("executes exactly once per seed for non-swapped mirror", () => {
    const build = createBulwarkBuild();
    const results = runBenchmark({
      label: "test",
      seedBank: bank,
      partition: "development",
      fighterA: { build, policy: BULWARK_POLICY, machineName: "Bulwark A" },
      fighterB: { build, policy: BULWARK_POLICY, machineName: "Bulwark B" },
      roleSwapped: false,
    });
    expect(results).toHaveLength(80);
  });

  it("executes 2x per seed when role-swapped", () => {
    const build = createBulwarkBuild();
    const smallBank = {
      ...bank,
      developmentSeeds: bank.developmentSeeds.slice(0, 5),
    };
    const results = runBenchmark({
      label: "test",
      seedBank: smallBank,
      partition: "development",
      fighterA: { build, policy: BULWARK_POLICY, machineName: "Bulwark A" },
      fighterB: { build, policy: BULWARK_POLICY, machineName: "Bulwark B" },
      roleSwapped: true,
    });
    expect(results).toHaveLength(10);
    expect(results.filter((r) => r.roleSwapped).length).toBe(5);
    expect(results.filter((r) => !r.roleSwapped).length).toBe(5);
  });

  it("produces deterministic results", () => {
    const build = createBulwarkBuild();
    const smallBank = {
      ...bank,
      developmentSeeds: bank.developmentSeeds.slice(0, 5),
    };
    const results1 = runBenchmark({
      label: "test",
      seedBank: smallBank,
      partition: "development",
      fighterA: { build, policy: BULWARK_POLICY, machineName: "Bulwark A" },
      fighterB: { build, policy: BULWARK_POLICY, machineName: "Bulwark B" },
      roleSwapped: false,
    });
    const results2 = runBenchmark({
      label: "test",
      seedBank: smallBank,
      partition: "development",
      fighterA: { build, policy: BULWARK_POLICY, machineName: "Bulwark A" },
      fighterB: { build, policy: BULWARK_POLICY, machineName: "Bulwark B" },
      roleSwapped: false,
    });
    expect(results1).toEqual(results2);
  });

  it("preserves seed order", () => {
    const build = createBulwarkBuild();
    const smallBank = {
      ...bank,
      developmentSeeds: bank.developmentSeeds.slice(0, 5),
    };
    const results = runBenchmark({
      label: "test",
      seedBank: smallBank,
      partition: "development",
      fighterA: { build, policy: BULWARK_POLICY, machineName: "Bulwark A" },
      fighterB: { build, policy: BULWARK_POLICY, machineName: "Bulwark B" },
      roleSwapped: false,
    });
    expect(results.map((r) => r.seed)).toEqual(smallBank.developmentSeeds);
  });

  it("per-match results include competitor identity fields", () => {
    const build = createBulwarkBuild();
    const smallBank = {
      ...bank,
      developmentSeeds: bank.developmentSeeds.slice(0, 5),
    };
    const results = runBenchmark({
      label: "test",
      seedBank: smallBank,
      partition: "development",
      fighterA: { build, policy: BULWARK_POLICY, machineName: "Bulwark A" },
      fighterB: { build, policy: BULWARK_POLICY, machineName: "Bulwark B" },
      roleSwapped: true,
    });
    const nonSwapped = results.find((r) => !r.roleSwapped)!;
    expect(nonSwapped.fighterACompetitor).toBe("x");
    expect(nonSwapped.fighterBCompetitor).toBe("y");
    const swapped = results.find((r) => r.roleSwapped)!;
    expect(swapped.fighterACompetitor).toBe("y");
    expect(swapped.fighterBCompetitor).toBe("x");
  });
});

describe("computeMetrics", () => {
  it("counts seed and simulation totals", () => {
    const results = [makeResult(), makeResult({ seed: 2 })];
    const m = computeMetrics(results, 2, 1);
    expect(m.seedCount).toBe(2);
    expect(m.totalSimulations).toBe(2);
  });

  it("computes slot outcomes", () => {
    const results = [
      makeResult({ winner: "fighter_a" }),
      makeResult({ seed: 2, winner: "fighter_b" }),
      makeResult({ seed: 3, winner: null }),
      makeResult({ seed: 4, winner: "fighter_a" }),
    ];
    const m = computeMetrics(results, 4, 1);
    expect(m.slotOutcomes.fighterAWins).toBe(2);
    expect(m.slotOutcomes.fighterBWins).toBe(1);
    expect(m.slotOutcomes.draws).toBe(1);
  });

  it("competitor outcomes for role-swapped: X wins both slots", () => {
    const results = [
      makeResult({
        seed: 1,
        roleSwapped: false,
        winner: "fighter_a",
        fighterACompetitor: "x",
        fighterBCompetitor: "y",
      }),
      makeResult({
        seed: 1,
        roleSwapped: true,
        winner: "fighter_b",
        fighterACompetitor: "y",
        fighterBCompetitor: "x",
      }),
    ];
    const m = computeMetrics(results, 1, 2);
    expect(m.totalSimulations).toBe(2);
    expect(m.slotOutcomes.fighterAWins).toBe(1);
    expect(m.slotOutcomes.fighterBWins).toBe(1);
    expect(m.competitorOutcomes!.xWins).toBe(2);
    expect(m.competitorOutcomes!.yWins).toBe(0);
  });

  it("first-slot advantage is correct", () => {
    const results = [
      makeResult({ winner: "fighter_a" }),
      makeResult({ seed: 2, winner: "fighter_a" }),
      makeResult({ seed: 3, winner: "fighter_a" }),
      makeResult({ seed: 4, winner: "fighter_b" }),
    ];
    const m = computeMetrics(results, 4, 1);
    expect(m.slotOutcomes.firstSlotAdvantage).toBeCloseTo(0.5);
  });

  it("all rates in [0, 1]", () => {
    const results = [
      makeResult({ method: "destruction", rounds: 5 }),
      makeResult({
        seed: 2,
        method: "immobilisation",
        rounds: 1,
        winner: "fighter_b",
        fighterA: {
          ...makeResult().fighterA,
          mobilityDisabled: true,
          disabledComponents: ["mobility"],
        },
      }),
      makeResult({ seed: 3, method: "judges", rounds: 20, winner: null }),
    ];
    const m = computeMetrics(results, 3, 1);
    expect(m.destructionRate).toBeGreaterThanOrEqual(0);
    expect(m.destructionRate).toBeLessThanOrEqual(1);
    expect(m.immobilisationRate).toBeGreaterThanOrEqual(0);
    expect(m.immobilisationRate).toBeLessThanOrEqual(1);
    expect(m.judgesRate).toBeGreaterThanOrEqual(0);
    expect(m.judgesRate).toBeLessThanOrEqual(1);
    expect(m.firstRoundFinishRate).toBeGreaterThanOrEqual(0);
    expect(m.firstRoundFinishRate).toBeLessThanOrEqual(1);
    expect(m.matchesWithAnyDisable).toBeGreaterThanOrEqual(0);
    expect(m.matchesWithAnyDisable).toBeLessThanOrEqual(1);
    expect(m.hitRate).toBeGreaterThanOrEqual(0);
    expect(m.hitRate).toBeLessThanOrEqual(1);
  });

  it("attacks from hits + misses", () => {
    const results = [makeResult({ attacksAttempted: 8, attacksHit: 3 })];
    const m = computeMetrics(results, 1, 1);
    expect(m.totalAttacks).toBe(8);
    expect(m.totalHits).toBe(3);
  });

  it("zero attacks → zero hit rate", () => {
    const results = [makeResult({ attacksAttempted: 0, attacksHit: 0 })];
    const m = computeMetrics(results, 1, 1);
    expect(m.totalAttacks).toBe(0);
    expect(m.hitRate).toBe(0);
  });

  it("Wilson CI bounds: 0/10 and 10/10", () => {
    const m0 = computeMetrics(
      Array.from({ length: 10 }, (_, i) => makeResult({ seed: i, winner: "fighter_b" })),
      10,
      1,
    );
    expect(m0.slotOutcomes.wilsonCI.lower).toBe(0);
    expect(m0.slotOutcomes.wilsonCI.upper).toBeLessThan(0.35);

    const m10 = computeMetrics(
      Array.from({ length: 10 }, (_, i) => makeResult({ seed: i, winner: "fighter_a" })),
      10,
      1,
    );
    expect(m10.slotOutcomes.wilsonCI.lower).toBeGreaterThan(0.65);
    expect(m10.slotOutcomes.wilsonCI.upper).toBe(1);
  });

  it("Bulwark mirror development baseline is stable", () => {
    const build = createBulwarkBuild();
    const results = runBenchmark({
      label: "test",
      seedBank: bank,
      partition: "development",
      fighterA: { build, policy: BULWARK_POLICY, machineName: "Bulwark A" },
      fighterB: { build, policy: BULWARK_POLICY, machineName: "Bulwark B" },
      roleSwapped: false,
    });
    const m = computeMetrics(results, 80, 1);
    expect(m.totalSimulations).toBe(80);
    expect(
      m.slotOutcomes.fighterAWins + m.slotOutcomes.fighterBWins + m.slotOutcomes.draws,
    ).toBe(80);
  });
});
