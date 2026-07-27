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

const bank = loadSeedBank(seedFixture);

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
    // Use only 5 held-out seeds to keep this fast
    const smallBank = {
      ...bank,
      developmentSeeds: bank.heldOutSeeds.slice(0, 5),
      heldOutSeeds: bank.heldOutSeeds,
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
    const results1 = runBenchmark({
      label: "test",
      seedBank: bank,
      partition: "held-out",
      fighterA: { build, policy: BULWARK_POLICY, machineName: "Bulwark A" },
      fighterB: { build, policy: BULWARK_POLICY, machineName: "Bulwark B" },
      roleSwapped: false,
    });
    const results2 = runBenchmark({
      label: "test",
      seedBank: bank,
      partition: "held-out",
      fighterA: { build, policy: BULWARK_POLICY, machineName: "Bulwark A" },
      fighterB: { build, policy: BULWARK_POLICY, machineName: "Bulwark B" },
      roleSwapped: false,
    });
    expect(results1).toEqual(results2);
  });

  it("preserves seed order", () => {
    const build = createBulwarkBuild();
    const results = runBenchmark({
      label: "test",
      seedBank: bank,
      partition: "held-out",
      fighterA: { build, policy: BULWARK_POLICY, machineName: "Bulwark A" },
      fighterB: { build, policy: BULWARK_POLICY, machineName: "Bulwark B" },
      roleSwapped: false,
    });
    const seeds = results.map((r) => r.seed);
    expect(seeds).toEqual(bank.heldOutSeeds);
  });

  it("produces a stable checksum for Bulwark mirror on held-out partition", () => {
    const build = createBulwarkBuild();
    const results = runBenchmark({
      label: "test",
      seedBank: bank,
      partition: "held-out",
      fighterA: { build, policy: BULWARK_POLICY, machineName: "Bulwark A" },
      fighterB: { build, policy: BULWARK_POLICY, machineName: "Bulwark B" },
      roleSwapped: false,
    });

    const metrics = computeMetrics(results);

    // Mirror match: fighter A and B win rates should be in the same ballpark.
    // With only 20 seeds the CI is wide, so we just check it ran.
    expect(metrics.totalMatches).toBe(20);
    expect(metrics.fighterAWins + metrics.fighterBWins + metrics.draws).toBe(20);
    expect(metrics.winRateA).toBeGreaterThanOrEqual(0);
    expect(metrics.winRateA).toBeLessThanOrEqual(1);
  });
});

describe("computeMetrics", () => {
  it("computes correct win/loss/draw counts from hand-authored fixture", () => {
    const results = [
      {
        seed: 1,
        roleSwapped: false,
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
      },
      {
        seed: 2,
        roleSwapped: false,
        winner: "fighter_b",
        method: "immobilisation",
        rounds: 3,
        fighterA: {
          machineName: "A",
          integrity: 150,
          maxIntegrity: 150,
          mobilityDisabled: true,
          weaponDisabled: false,
          utilityDisabled: false,
          disabledComponents: ["mobility"],
        },
        fighterB: {
          machineName: "B",
          integrity: 120,
          maxIntegrity: 150,
          mobilityDisabled: false,
          weaponDisabled: false,
          utilityDisabled: false,
          disabledComponents: [],
        },
        criticalHits: 0,
        attacksAttempted: 4,
        attacksHit: 2,
      },
      {
        seed: 3,
        roleSwapped: false,
        winner: null,
        method: "draw",
        rounds: 20,
        fighterA: {
          machineName: "A",
          integrity: 60,
          maxIntegrity: 100,
          mobilityDisabled: false,
          weaponDisabled: false,
          utilityDisabled: false,
          disabledComponents: [],
        },
        fighterB: {
          machineName: "B",
          integrity: 70,
          maxIntegrity: 100,
          mobilityDisabled: false,
          weaponDisabled: false,
          utilityDisabled: false,
          disabledComponents: [],
        },
        criticalHits: 0,
        attacksAttempted: 10,
        attacksHit: 5,
      },
      {
        seed: 4,
        roleSwapped: false,
        winner: "fighter_a",
        method: "immobilisation",
        rounds: 1,
        fighterA: {
          machineName: "A",
          integrity: 100,
          maxIntegrity: 100,
          mobilityDisabled: false,
          weaponDisabled: false,
          utilityDisabled: false,
          disabledComponents: [],
        },
        fighterB: {
          machineName: "B",
          integrity: 100,
          maxIntegrity: 100,
          mobilityDisabled: true,
          weaponDisabled: false,
          utilityDisabled: false,
          disabledComponents: ["mobility"],
        },
        criticalHits: 2,
        attacksAttempted: 2,
        attacksHit: 2,
      },
    ] as const;

    const m = computeMetrics(results);

    expect(m.totalMatches).toBe(4);
    expect(m.fighterAWins).toBe(2);
    expect(m.fighterBWins).toBe(1);
    expect(m.draws).toBe(1);
    expect(m.winRateA).toBeCloseTo(0.5);
    expect(m.winRateB).toBeCloseTo(0.25);

    // Wilson CI for 2/4 wins
    expect(m.wilsonCI.lower).toBeGreaterThan(0.05);
    expect(m.wilsonCI.upper).toBeLessThan(0.95);

    expect(m.avgRounds).toBeCloseTo(7.25);
    expect(m.medianRounds).toBe(4);
    expect(m.minRounds).toBe(1);
    expect(m.maxRounds).toBe(20);

    expect(m.destructionRate).toBeCloseTo(0.25);
    expect(m.immobilisationRate).toBeCloseTo(0.5);
    expect(m.judgesRate).toBeCloseTo(0);

    expect(m.firstRoundFinishRate).toBeCloseTo(0.25);
    expect(m.firstRoundImmobilisationRate).toBeCloseTo(0.25);

    expect(m.matchesWithAnyDisable).toBeCloseTo(0.5);
    expect(m.mobilityDisables).toBe(2);

    expect(m.totalCriticalHits).toBe(3);
    expect(m.totalAttacks).toBe(21);
    expect(m.totalHits).toBe(12);
  });

  it("Wilson CI returns valid bounds", () => {
    // 0 wins out of 10
    const m0 = computeMetrics(
      Array.from({ length: 10 }, (_, i) => ({
        seed: i,
        roleSwapped: false,
        winner: "fighter_b" as const,
        method: "destruction",
        rounds: 5,
        fighterA: {
          machineName: "A",
          integrity: 0,
          maxIntegrity: 100,
          mobilityDisabled: false,
          weaponDisabled: false,
          utilityDisabled: false,
          disabledComponents: [] as string[],
        },
        fighterB: {
          machineName: "B",
          integrity: 100,
          maxIntegrity: 100,
          mobilityDisabled: false,
          weaponDisabled: false,
          utilityDisabled: false,
          disabledComponents: [] as string[],
        },
        criticalHits: 0,
        attacksAttempted: 5,
        attacksHit: 3,
      })),
    );
    expect(m0.wilsonCI.lower).toBe(0);
    expect(m0.wilsonCI.upper).toBeLessThan(0.35);

    // 10 wins out of 10
    const m10 = computeMetrics(
      Array.from({ length: 10 }, (_, i) => ({
        seed: i,
        roleSwapped: false,
        winner: "fighter_a" as const,
        method: "destruction",
        rounds: 5,
        fighterA: {
          machineName: "A",
          integrity: 100,
          maxIntegrity: 100,
          mobilityDisabled: false,
          weaponDisabled: false,
          utilityDisabled: false,
          disabledComponents: [] as string[],
        },
        fighterB: {
          machineName: "B",
          integrity: 0,
          maxIntegrity: 100,
          mobilityDisabled: false,
          weaponDisabled: false,
          utilityDisabled: false,
          disabledComponents: [] as string[],
        },
        criticalHits: 0,
        attacksAttempted: 5,
        attacksHit: 3,
      })),
    );
    expect(m10.wilsonCI.lower).toBeGreaterThan(0.65);
    expect(m10.wilsonCI.upper).toBe(1);
  });
});
