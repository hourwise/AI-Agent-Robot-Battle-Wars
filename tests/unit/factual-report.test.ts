import { describe, it, expect } from "vitest";
import { runMatch } from "../../src/simulator/simulator.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import {
  buildFactualReport,
  enrichMatchSummariesWithPolicy,
} from "../../src/reports/factual-match-report.js";
import { validateFactualMatchReport } from "../../src/schemas/factual-report.schema.js";

describe("factual report builder", () => {
  const result = runMatch({
    seed: 42,
    fighterA: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
    fighterB: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
    rulesetVersion: "0.1.0",
    catalogueVersion: CATALOGUE_V1.version,
  });

  it("builds a valid FactualMatchReport from MatchResult", () => {
    const report = buildFactualReport(result);
    const validation = validateFactualMatchReport(report);
    expect(validation.ok).toBe(true);
  });

  it("includes deterministic seed and rounds", () => {
    const report = buildFactualReport(result);
    expect(report.seed).toBe(42);
    expect(report.rounds).toBe(result.rounds);
  });

  it("captures winner and method from competition result", () => {
    const report = buildFactualReport(result);
    expect(report.winner).toBe(result.result.winner);
    expect(report.resultMethod).toBe(result.result.method);
  });

  it("includes fighter summaries with correct machine names", () => {
    const report = buildFactualReport(result);
    expect(report.fighterA.machineName).toBe("The Bulwark");
    expect(report.fighterB.machineName).toBe("The Bulwark");
  });

  it("captures first hit when attacks occurred", () => {
    const report = buildFactualReport(result);
    if (result.events.some((e) => e.type === "attack_hit")) {
      expect(report.firstHit).toBeDefined();
      expect(report.firstHit!.round).toBeGreaterThanOrEqual(1);
    }
  });

  it("populates critical hits for high-damage attacks", () => {
    const report = buildFactualReport(result);
    expect(Array.isArray(report.criticalHits)).toBe(true);
  });

  it("populates component failures array", () => {
    const report = buildFactualReport(result);
    expect(Array.isArray(report.componentFailures)).toBe(true);
  });

  it("populates overturns array", () => {
    const report = buildFactualReport(result);
    expect(Array.isArray(report.overturns)).toBe(true);
  });

  it("includes final states for both fighters", () => {
    const report = buildFactualReport(result);
    expect(report.finalStates.fighterA).toBeDefined();
    expect(report.finalStates.fighterB).toBeDefined();
    expect(report.finalStates.fighterA.integrity).toBeGreaterThanOrEqual(0);
    expect(report.finalStates.fighterB.integrity).toBeGreaterThanOrEqual(0);
  });

  it("produces deterministic output for same seed", () => {
    const report1 = buildFactualReport(result);
    const result2 = runMatch({
      seed: 42,
      fighterA: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
      fighterB: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
      rulesetVersion: "0.1.0",
      catalogueVersion: CATALOGUE_V1.version,
    });
    const report2 = buildFactualReport(result2);
    expect(report1.seed).toBe(report2.seed);
    expect(report1.rounds).toBe(report2.rounds);
    expect(report1.winner).toBe(report2.winner);
    expect(report1.resultMethod).toBe(report2.resultMethod);
  });
});

describe("enrichMatchSummariesWithPolicy", () => {
  const result = runMatch({
    seed: 42,
    fighterA: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
    fighterB: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
    rulesetVersion: "0.1.0",
    catalogueVersion: CATALOGUE_V1.version,
  });

  it("adds policy fields to fighter summaries", () => {
    const report = buildFactualReport(result);
    const enriched = enrichMatchSummariesWithPolicy(
      report,
      BULWARK_POLICY,
      BULWARK_POLICY,
    );
    expect(enriched.fighterA.opening).toBe("rush");
    expect(enriched.fighterA.aggression).toBe(85);
    expect(enriched.fighterB.preferredRange).toBe("close");
  });

  it("preserves original report fields", () => {
    const report = buildFactualReport(result);
    const enriched = enrichMatchSummariesWithPolicy(
      report,
      BULWARK_POLICY,
      BULWARK_POLICY,
    );
    expect(enriched.seed).toBe(report.seed);
    expect(enriched.rounds).toBe(report.rounds);
    expect(enriched.criticalHits).toEqual(report.criticalHits);
  });
});

// Regression: match f0f00065 (seed 12345, Rear-Hunter vs The Bulwark)
describe("factual report regression — Rear-Hunter vs Bulwark (seed 12345)", () => {
  it("reports correct winner, method, rounds, and final integrity", () => {
    // Simulate the exact config from the saved match
    const rearHunterBuild = {
      machineName: "Rear-Hunter",
      chassisId: "medium" as const,
      mobilityId: "wheels" as const,
      weaponId: "horizontal_spinner" as const,
      utilityId: "cooling" as const,
      armour: { front: 30, left: 20, right: 20, rear: 10, top: 10 },
      designSummary: "test",
      designRationale: "test",
    };
    const buildResult = {
      proposal: rearHunterBuild,
      totalCost: 86,
      armourCost: 9,
      totalArmourPoints: 90,
      catalogueVersion: "1",
    };
    const validated = { ok: true as const, build: buildResult, errors: [] };

    if (!validated.ok) throw new Error("Invalid build");

    const result = runMatch({
      seed: 12345,
      fighterA: {
        build: validated.build,
        policy: {
          opening: "flank" as const,
          preferredRange: "close" as const,
          aggression: 80,
          primaryTarget: "rear" as const,
          secondaryTarget: "left" as const,
          retreatThreshold: 30,
          heatThreshold: 70,
          fallback: "retreat" as const,
        },
      },
      fighterB: {
        build: createBulwarkBuild(),
        policy: BULWARK_POLICY,
      },
      rulesetVersion: "0.1.0",
      catalogueVersion: CATALOGUE_V1.version,
    });

    const report = buildFactualReport(result);

    // Authoritative facts from the saved match
    expect(report.winner).toBe("fighter_b");
    expect(report.resultMethod).toBe("immobilisation");
    expect(report.rounds).toBe(6);
    expect(report.finalStates.fighterA.integrity).toBe(80);
    expect(report.finalStates.fighterA.mobilityDisabled).toBe(true);
    expect(report.finalStates.fighterB.integrity).toBe(150);
    expect(report.finalStates.fighterB.mobilityDisabled).toBe(false);

    // Schema validation
    const validation = validateFactualMatchReport(report);
    expect(validation.ok).toBe(true);
  });
});

describe("buildFactualReport immutability", () => {
  it("does not mutate MatchResult.initialState", () => {
    const buildResult = {
      proposal: {
        machineName: "Test",
        chassisId: "medium" as const,
        mobilityId: "wheels" as const,
        weaponId: "ram" as const,
        utilityId: "none" as const,
        armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
        designSummary: "test",
        designRationale: "test",
      },
      totalCost: 52,
      armourCost: 2,
      totalArmourPoints: 20,
      catalogueVersion: "1",
    };

    const result = runMatch({
      seed: 42,
      fighterA: { build: buildResult, policy: BULWARK_POLICY },
      fighterB: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
      rulesetVersion: "0.1.0",
      catalogueVersion: CATALOGUE_V1.version,
    });

    // Snapshot initial state before building report
    const initialIntegrityA = result.initialState.fighterA.integrity;
    const initialComponentsA = { ...result.initialState.fighterA.components };
    const initialConditionsA = [...result.initialState.fighterA.conditions];

    buildFactualReport(result);

    // Verify initialState was not mutated
    expect(result.initialState.fighterA.integrity).toBe(initialIntegrityA);
    expect(result.initialState.fighterA.components).toEqual(initialComponentsA);
    expect(result.initialState.fighterA.conditions).toEqual(initialConditionsA);
  });
});
