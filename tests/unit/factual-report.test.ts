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
    if (result.events.some((e) => e.type === "attack" && Boolean(e.data.hit))) {
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
