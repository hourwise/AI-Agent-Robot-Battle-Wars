import { describe, it, expect } from "vitest";
import { runMatch } from "../../src/simulator/simulator.js";
import { runBenchmark } from "../../src/bench/run-benchmark.js";
import { computeMetrics } from "../../src/bench/metrics.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { validateBuild } from "../../src/validation/build-validator.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import type { BenchmarkConfig, SeedBank } from "../../src/bench/benchmark.types.js";
import type { ActionPolicy } from "../../src/simulator/types.js";

// ── Synthetic low-armour builds that will produce transitions ──

const GLASS_CANNON_BUILD = validateBuild(
  {
    machineName: "Glass Cannon",
    chassisId: "light",
    mobilityId: "wheels",
    weaponId: "ram",
    utilityId: "none",
    armour: { front: 5, left: 0, right: 0, rear: 0, top: 0 },
    designSummary: "All offence, no defence — guaranteed transitions.",
    designRationale: "Designed to trigger component damage in testing.",
  },
  CATALOGUE_V1,
);

if (!GLASS_CANNON_BUILD.ok) throw new Error("Invalid glass cannon build");

const AGGRESSIVE_POLICY: ActionPolicy = {
  opening: "rush",
  preferredRange: "close",
  aggression: 100,
  primaryTarget: "front",
  secondaryTarget: "front",
  retreatThreshold: 0,
  heatThreshold: 100,
  fallback: "desperate_attack",
};

const syntheticSeedBank: SeedBank = {
  schemaVersion: "1",
  bankId: "synthetic-v2-benchmark",
  generatorVersion: "1.0.0",
  simulatorVersion: "0.2.0",
  rulesetVersion: "0.2.0",
  catalogueVersion: CATALOGUE_V1.version,
  developmentSeeds: [100, 200, 300, 400, 500],
  heldOutSeeds: [],
};

const syntheticBenchmarkConfig: BenchmarkConfig = {
  label: "Glass Cannon Mirror — v2 transition detection",
  seedBank: syntheticSeedBank,
  partition: "development",
  fighterA: {
    build: GLASS_CANNON_BUILD.build,
    policy: AGGRESSIVE_POLICY,
    machineName: "Glass Cannon",
  },
  fighterB: {
    build: GLASS_CANNON_BUILD.build,
    policy: AGGRESSIVE_POLICY,
    machineName: "Glass Cannon",
  },
  roleSwapped: false,
};

describe("synthetic benchmark — v2 transition detection", () => {
  // First verify individual matches produce transitions
  it("produces component transitions in glass cannon mirror match", () => {
    const match = runMatch({
      seed: 100,
      fighterA: { build: GLASS_CANNON_BUILD.build, policy: AGGRESSIVE_POLICY },
      fighterB: { build: GLASS_CANNON_BUILD.build, policy: AGGRESSIVE_POLICY },
      rulesetVersion: "0.2.0",
      catalogueVersion: CATALOGUE_V1.version,
    });

    // Check that v2 events exist
    const damagedEvents = match.events.filter((e) => e.type === "component_damaged");
    const disabledEvents = match.events.filter((e) => e.type === "component_disabled");
    const resistedEvents = match.events.filter((e) => e.type === "component_damage_resisted");

    // At least one transition should occur with these builds
    const totalTransitions = damagedEvents.length + disabledEvents.length + resistedEvents.length;
    expect(totalTransitions).toBeGreaterThan(0);
  });

  it("benchmark detects and counts component transitions", () => {
    const results = runBenchmark(syntheticBenchmarkConfig);

    // All 5 seeds should have results
    expect(results.length).toBe(5);

    // At least one result should have transitions
    const anyTransition = results.some(
      (r) =>
        r.componentDamagedTransitions +
        r.componentDisabledTransitions +
        r.componentResistedTransitions >
        0,
    );
    expect(anyTransition).toBe(true);

    // Aggregate metrics should reflect transitions
    const metrics = computeMetrics(results, 5, 1);
    const totalTransitions =
      metrics.totalDamagedTransitions +
      metrics.totalDisabledTransitions +
      metrics.totalResistedTransitions;
    expect(totalTransitions).toBeGreaterThan(0);
  });

  it("benchmark detects per-component damaged counts", () => {
    const results = runBenchmark(syntheticBenchmarkConfig);
    const metrics = computeMetrics(results, 5, 1);

    // At least one component kind should have transitions
    const totalDamaged =
      metrics.mobilityDamagedTransitions +
      metrics.weaponDamagedTransitions +
      metrics.utilityDamagedTransitions;
    expect(totalDamaged).toBeGreaterThan(0);
  });

  it("benchmark correctly reports zero transitions for all-Bulwark mirror (candidate A)", () => {
    const bulwarkBuild = createBulwarkBuild();
    const match = runMatch({
      seed: 42,
      fighterA: { build: bulwarkBuild, policy: BULWARK_POLICY },
      fighterB: { build: bulwarkBuild, policy: BULWARK_POLICY },
      rulesetVersion: "0.2.0",
      catalogueVersion: CATALOGUE_V1.version,
    });

    const damagedEvents = match.events.filter((e) => e.type === "component_damaged");
    const disabledEvents = match.events.filter((e) => e.type === "component_disabled");
    const resistedEvents = match.events.filter((e) => e.type === "component_damage_resisted");

    // With Bulwark 60 front armour, effective damage = 1 for all hits
    // 1 < 10 (critical threshold) and 1 < 35 (high-damage threshold)
    // Therefore zero transitions are expected — this is the CORRECT candidate-A result
    expect(damagedEvents.length).toBe(0);
    expect(disabledEvents.length).toBe(0);
    // Resisted events also require qualification, so 0 expected
    expect(resistedEvents.length).toBe(0);
  });

  it("synthetic benchmark metrics show matchesWithAnyComponentTransition > 0", () => {
    const results = runBenchmark(syntheticBenchmarkConfig);
    const metrics = computeMetrics(results, 5, 1);

    expect(metrics.matchesWithAnyComponentTransition).toBeGreaterThan(0);
    expect(metrics.totalDamagedTransitions).toBeGreaterThan(0);
  });

  it("v2 benchmark produces valid aggregate including zero-guard metrics for no-utility builds", () => {
    const results = runBenchmark(syntheticBenchmarkConfig);
    const metrics = computeMetrics(results, 5, 1);

    // Glass cannon has no utility, so guards should be 0
    expect(metrics.totalGuardsSpent).toBe(0);
    expect(metrics.totalGuardsLost).toBe(0);
    expect(metrics.totalResistedTransitions).toBe(0);
  });
});
