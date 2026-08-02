import { describe, expect, it } from "vitest";
import registryJson from "../../config/readiness/grid-readiness-development-v1.json";
import { loadGridReadinessSeedRegistry } from "../../src/readiness/seed-registry.js";
import { createGridReadinessScenarioRegistry } from "../../src/readiness/scenario-registry.js";
import {
  buildGridActivationReadinessRunPlan,
  type GridActivationReadinessRunPlan,
} from "../../src/readiness/run-plan.js";
import {
  executeGridActivationReadinessSuite,
  verifyGridActivationReadinessDeterminism,
  type GridActivationReadinessSuiteOutcome,
} from "../../src/readiness/execution-core.js";
import { isGridZone } from "../../src/simulator/arena-grid.js";

const EVALUATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CREATED_AT = "2024-06-01T00:00:00.000Z";

function makeMatchIds(): string[] {
  return Array.from({ length: 312 }, (_, i) => {
    const tail = String(i).padStart(12, "0");
    return `bbbbbbbb-bbbb-4bbb-8bbb-${tail}`;
  });
}

function buildPlan(): GridActivationReadinessRunPlan {
  const seedRegistry = loadGridReadinessSeedRegistry(registryJson);
  const scenarioRegistry = createGridReadinessScenarioRegistry();
  return buildGridActivationReadinessRunPlan({ seedRegistry, scenarioRegistry });
}

function executeOnce(): GridActivationReadinessSuiteOutcome {
  const seedRegistry = loadGridReadinessSeedRegistry(registryJson);
  const scenarioRegistry = createGridReadinessScenarioRegistry();
  const runPlan = buildPlan();
  return executeGridActivationReadinessSuite({
    seedRegistry,
    scenarioRegistry,
    runPlan,
    identities: {
      evaluationId: EVALUATION_ID,
      createdAt: CREATED_AT,
      matchIds: makeMatchIds(),
    },
  });
}

describe("grid activation readiness execution core (Phase 3E1)", () => {
  it("executes exactly 312 matches directly through runGridMatch with v3 records and v2 bound reports", () => {
    const outcome = executeOnce();
    expect(outcome.matchCount).toBe(312);
    expect(outcome.results.length).toBe(312);
    expect(outcome.inputsUnmodified).toBe(true);
    expect(outcome.evaluationId).toBe(EVALUATION_ID);
    expect(outcome.createdAt).toBe(CREATED_AT);

    for (const run of outcome.results) {
      expect(run.recordIndex).toBe(run.runNumber - 1);
      expect(run.reportIndex).toBe(run.runNumber - 1);
      expect(run.record.schemaVersion).toBe("3");
      expect(run.record.positioningModel).toBe("grid-3x3-v1");
      expect(run.report.schemaVersion).toBe("2");
      // Report binding.
      expect(run.report.matchId).toBe(run.record.matchId);
      expect(run.report.seed).toBe(run.record.seed);
      expect(run.report.rounds).toBe(run.record.rounds);
      expect(run.report.winner).toBe(run.record.result.winner);
      expect(run.report.resultMethod).toBe(run.record.result.method);
      // Runtime identity.
      expect(run.record.simulatorVersion).toBe("0.3.0");
      expect(run.record.rulesetVersion).toBe("0.2.0");
      expect(run.record.catalogueVersion).toBe("1");
      // Rounds within the cap.
      expect(run.rounds).toBeGreaterThanOrEqual(1);
      expect(run.rounds).toBeLessThanOrEqual(20);
      // Match identity injected.
      expect(run.matchId).toBe(outcome.results[run.runNumber - 1]!.matchId);
    }
  }, 180_000);

  it("produces only canonical zones, actions, subjects, facings and conditions in every run", () => {
    const outcome = executeOnce();
    for (const run of outcome.results) {
      const zones = Object.keys(run.evidence.zoneVisits);
      expect(zones.every((z) => isGridZone(z))).toBe(true);
      expect(Object.keys(run.evidence.bearingCounts)).toEqual([
        "same",
        "front",
        "front_right",
        "right",
        "rear_right",
        "rear",
        "rear_left",
        "left",
        "front_left",
      ]);
      expect(Object.keys(run.evidence.exposedPlanarArmourZoneCounts).sort()).toEqual([
        "front",
        "left",
        "rear",
        "right",
      ]);
      // The core validates every movement/zone/facing/condition fact; a
      // malformed fact would have thrown before producing a result.
      expect(run.evidence.eventTypeCounts["competition_started"]).toBe(1);
      expect(run.evidence.eventTypeCounts["competition_ended"]).toBe(1);
    }
  }, 180_000);

  it("does not mutate any supplied registry or plan object", () => {
    const seedRegistry = loadGridReadinessSeedRegistry(registryJson);
    const scenarioRegistry = createGridReadinessScenarioRegistry();
    const runPlan = buildPlan();
    const seedSnapshot = JSON.stringify(seedRegistry);
    const scenarioSnapshot = JSON.stringify(scenarioRegistry);
    const planSnapshot = JSON.stringify(runPlan);
    executeGridActivationReadinessSuite({
      seedRegistry,
      scenarioRegistry,
      runPlan,
      identities: {
        evaluationId: EVALUATION_ID,
        createdAt: CREATED_AT,
        matchIds: makeMatchIds(),
      },
    });
    expect(JSON.stringify(seedRegistry)).toBe(seedSnapshot);
    expect(JSON.stringify(scenarioRegistry)).toBe(scenarioSnapshot);
    expect(JSON.stringify(runPlan)).toBe(planSnapshot);
  }, 180_000);

  it("re-executes byte-identically under the same injected identities", () => {
    const primary = executeOnce();
    const repeat = executeOnce();
    expect(() => verifyGridActivationReadinessDeterminism(primary, repeat)).not.toThrow();
    for (let i = 0; i < primary.results.length; i++) {
      expect(primary.results[i]!.serializedRecord).toBe(
        repeat.results[i]!.serializedRecord,
      );
      expect(primary.results[i]!.serializedReport).toBe(
        repeat.results[i]!.serializedReport,
      );
      expect(primary.results[i]!.textReplayChecksum).toBe(
        repeat.results[i]!.textReplayChecksum,
      );
      expect(primary.results[i]!.asciiReplayChecksum).toBe(
        repeat.results[i]!.asciiReplayChecksum,
      );
      expect(primary.results[i]!.reviewPromptChecksum).toBe(
        repeat.results[i]!.reviewPromptChecksum,
      );
    }
  }, 300_000);

  it("reports a maximum consecutive no-progress streak bounded by the match length", () => {
    const outcome = executeOnce();
    for (const run of outcome.results) {
      expect(run.evidence.maximumConsecutiveNoProgressRounds).toBeLessThanOrEqual(
        run.rounds,
      );
    }
  });
});
