import { describe, expect, it } from "vitest";
import {
  evaluateGridActivationReadinessGates,
  type GridActivationReadinessGateResults,
  type ReadinessGateResult,
} from "../../src/readiness/gates.js";
import {
  deriveGridActivationReadinessDecision,
  buildGridActivationReadinessDecision,
} from "../../src/readiness/decision.js";
import type { GridActivationReadinessMetrics } from "../../src/readiness/metrics.js";
import type { GridActivationReadinessRunResult } from "../../src/readiness/execution-core.js";

function baseMetrics(): GridActivationReadinessMetrics {
  return {
    execution: {
      totalPlannedRuns: 312,
      totalCompletedRuns: 312,
      deterministicMatches: 312,
      schemaValidRecords: 312,
      schemaValidReports: 312,
      replayAgreeingMatches: 312,
      invalidEventCount: 0,
      mutationFailures: 0,
    },
    movement: {
      actionCounts: {
        advance: 1,
        retreat: 1,
        circle_left: 1,
        circle_right: 1,
        hold: 1,
      },
      translatedActionCounts: {
        advance: 1,
        retreat: 1,
        circle_left: 1,
        circle_right: 1,
        hold: 0,
      },
      stationaryHoldCount: 1,
      zoneVisits: {
        north_west: 1,
        north: 1,
        north_east: 1,
        west: 1,
        center: 1,
        east: 1,
        south_west: 1,
        south: 1,
        south_east: 1,
      },
      bearingCounts: {
        same: 1,
        front: 1,
        front_right: 1,
        right: 1,
        rear_right: 1,
        rear: 1,
        rear_left: 1,
        left: 1,
        front_left: 1,
      },
      exposedPlanarArmourZoneCounts: { front: 1, left: 1, right: 1, rear: 1 },
    },
    combat: {
      attacksAttempted: 10,
      hits: 5,
      misses: 5,
      selectedCombatActionCounts: { attack: 10, defend: 10, idle: 0 },
      integrityDamageEvents: 5,
      criticalHits: 1,
      knockbackEvents: 1,
      grappleRepositionEvents: 1,
      overturnEvents: 1,
      componentDamaged: 1,
      componentDisabled: 1,
      componentDamageResisted: 1,
    },
    results: {
      judges: 10,
      destruction: 5,
      immobilisation: 5,
      draws: 2,
      roundCapMatches: 10,
      roundsMin: 2,
      roundsMax: 20,
      roundsMean: 10,
      roundsMedian: 10,
      maximumConsecutiveNoProgressRounds: 2,
    },
    slotOrder: {
      fighterAWins: 100,
      fighterBWins: 100,
      decisiveMatches: 200,
      absoluteFirstSlotAdvantage: 0,
      bulwarkMirrorDecisiveCount: 20,
      bulwarkMirrorSlotImbalance: 0,
      pairedAsymmetricComparisons: 144,
      pairedOutcomeStableComparisons: 144,
      pairedSlotSensitiveComparisons: 0,
      pairedSlotSensitivityRatio: 0,
    },
    timing: {
      totalElapsedMs: 1000,
      meanMsPerMatch: 3.2,
      medianMsPerMatch: 3,
      p95MsPerMatch: 6,
    },
    attacklessRate: 0,
    roundCapRate: 10 / 312,
  };
}

function minimalRun(): GridActivationReadinessRunResult {
  return {
    runNumber: 1,
    scenarioId: "flanker-bulwark",
    assignmentId: "flanker-bulwark-xa-yb",
    seed: 1,
    fighterACompetitor: "x",
    fighterBCompetitor: "y",
    roleSwapped: false,
    matchId: "11111111-1111-4111-8111-111111111111",
    recordIndex: 0,
    reportIndex: 0,
    winner: "fighter_a",
    resultMethod: "judges",
    rounds: 10,
    eventCount: 5,
    record: {
      schemaVersion: "3",
      matchId: "11111111-1111-4111-8111-111111111111",
      simulatorVersion: "0.3.0",
      positioningModel: "grid-3x3-v1",
      rulesetVersion: "0.2.0",
      catalogueVersion: "1",
      result: { winner: "fighter_a", method: "judges" },
    } as never,
    report: {
      schemaVersion: "2",
      matchId: "11111111-1111-4111-8111-111111111111",
      simulatorVersion: "0.3.0",
      positioningModel: "grid-3x3-v1",
      rulesetVersion: "0.2.0",
      catalogueVersion: "1",
      winner: "fighter_a",
      resultMethod: "judges",
    } as never,
    serializedRecord: "",
    serializedReport: "",
    recordChecksum: "a".repeat(64),
    reportChecksum: "a".repeat(64),
    textReplayChecksum: "a".repeat(64),
    asciiReplayChecksum: "a".repeat(64),
    reviewPromptChecksum: "a".repeat(64),
    evidence: {} as never,
  };
}

function evaluate(
  overrides: {
    metrics?: GridActivationReadinessMetrics;
    results?: GridActivationReadinessRunResult[];
    deterministicReexecutionPassed?: boolean;
    inputsUnmodified?: boolean;
    artifactIntegrityVerified?: boolean;
    legacyIsolationVerified?: boolean;
  } = {},
): GridActivationReadinessGateResults {
  return evaluateGridActivationReadinessGates({
    metrics: overrides.metrics ?? baseMetrics(),
    results: (overrides.results ?? []).map((run) => ({
      record: run.record,
      report: run.report,
    })),
    operational: {
      deterministicReexecutionPassed: overrides.deterministicReexecutionPassed ?? true,
      inputsUnmodified: overrides.inputsUnmodified ?? true,
      artifactIntegrityVerified: overrides.artifactIntegrityVerified ?? true,
      legacyIsolationVerified: overrides.legacyIsolationVerified ?? true,
    },
  });
}

function gate(
  gates: GridActivationReadinessGateResults,
  id: string,
): ReadinessGateResult {
  const found = gates.gates.find((g) => g.gateId === id);
  if (!found) throw new Error(`gate ${id} not found`);
  return found;
}

describe("grid activation readiness gates (Phase 3E1)", () => {
  it("passes every gate under an ideal metrics baseline", () => {
    const results = evaluate();
    expect(results.anyFail).toBe(false);
    expect(results.anyInconclusive).toBe(false);
    for (const g of results.gates) {
      expect(g.outcome, `${g.gateId} should pass`).toBe("pass");
    }
  });

  it("H01 fails when not all planned matches complete", () => {
    const metrics = baseMetrics();
    metrics.execution.totalCompletedRuns = 300;
    expect(gate(evaluate({ metrics }), "H01").outcome).toBe("fail");
  });

  it("H02 fails when the deterministic-reexecution attestation is false", () => {
    expect(gate(evaluate({ deterministicReexecutionPassed: false }), "H02").outcome).toBe(
      "fail",
    );
    expect(gate(evaluate(), "H02").outcome).toBe("pass");
  });

  it("H03 fails on a record identity mismatch", () => {
    const run = minimalRun();
    (run.record as { simulatorVersion: string }).simulatorVersion = "0.2.0";
    expect(gate(evaluate({ results: [run] }), "H03").outcome).toBe("fail");
  });

  it("H04 fails on a record/report binding mismatch", () => {
    const run = minimalRun();
    (run.report as { matchId: string }).matchId = "99999999-9999-4999-8999-999999999999";
    expect(gate(evaluate({ results: [run] }), "H04").outcome).toBe("fail");
  });

  it("H05 fails when complete report/final-state agreement is not complete", () => {
    const metrics = baseMetrics();
    metrics.execution.replayAgreeingMatches = 311;
    expect(gate(evaluate({ metrics }), "H05").outcome).toBe("fail");
  });

  it("H06 fails on an invalid event count", () => {
    const metrics = baseMetrics();
    metrics.execution.invalidEventCount = 1;
    expect(gate(evaluate({ metrics }), "H06").outcome).toBe("fail");
  });

  it("H07 fails when the input-immutability attestation is false", () => {
    expect(gate(evaluate({ inputsUnmodified: false }), "H07").outcome).toBe("fail");
    expect(gate(evaluate(), "H07").outcome).toBe("pass");
  });

  it("H08 fails only above 10 consecutive no-progress rounds", () => {
    const metrics = baseMetrics();
    metrics.results.maximumConsecutiveNoProgressRounds = 10;
    expect(gate(evaluate({ metrics }), "H08").outcome).toBe("pass");
    metrics.results.maximumConsecutiveNoProgressRounds = 11;
    expect(gate(evaluate({ metrics }), "H08").outcome).toBe("fail");
  });

  it("H09 and H10 reflect artifact-integrity and legacy-isolation evidence", () => {
    expect(gate(evaluate({ artifactIntegrityVerified: false }), "H09").outcome).toBe(
      "fail",
    );
    expect(gate(evaluate({ legacyIsolationVerified: false }), "H10").outcome).toBe(
      "fail",
    );
  });

  it("coverage gates are inconclusive (never fail) when a coverage item is missing", () => {
    const metrics = baseMetrics();
    metrics.movement.zoneVisits.north_west = 0;
    const results = evaluate({ metrics });
    expect(gate(results, "C01").outcome).toBe("inconclusive");
    expect(results.anyFail).toBe(false);

    metrics.movement.actionCounts.hold = 0;
    expect(gate(evaluate({ metrics }), "C02").outcome).toBe("inconclusive");

    const combat = baseMetrics();
    combat.combat.knockbackEvents = 0;
    expect(gate(evaluate({ metrics: combat }), "C04").outcome).toBe("inconclusive");
  });

  it("S01 is inconclusive with fewer than eight decisive mirror matches", () => {
    const metrics = baseMetrics();
    metrics.slotOrder.bulwarkMirrorDecisiveCount = 7;
    expect(gate(evaluate({ metrics }), "S01").outcome).toBe("inconclusive");
  });

  it("S01 passes at 0.25, is inconclusive between, fails above 0.50", () => {
    const metrics = baseMetrics();
    metrics.slotOrder.bulwarkMirrorDecisiveCount = 20;
    metrics.slotOrder.bulwarkMirrorSlotImbalance = 0.25;
    expect(gate(evaluate({ metrics }), "S01").outcome).toBe("pass");
    metrics.slotOrder.bulwarkMirrorSlotImbalance = 0.4;
    expect(gate(evaluate({ metrics }), "S01").outcome).toBe("inconclusive");
    metrics.slotOrder.bulwarkMirrorSlotImbalance = 0.5000001;
    expect(gate(evaluate({ metrics }), "S01").outcome).toBe("fail");
  });

  it("S02 and S03 pass/fail/inconclusive at their thresholds", () => {
    const metrics = baseMetrics();
    metrics.slotOrder.pairedSlotSensitivityRatio = 0.25;
    expect(gate(evaluate({ metrics }), "S02").outcome).toBe("pass");
    metrics.slotOrder.pairedSlotSensitivityRatio = 0.3;
    expect(gate(evaluate({ metrics }), "S02").outcome).toBe("inconclusive");
    metrics.slotOrder.pairedSlotSensitivityRatio = 0.51;
    expect(gate(evaluate({ metrics }), "S02").outcome).toBe("fail");

    metrics.slotOrder.fighterAWins = 120;
    metrics.slotOrder.fighterBWins = 80;
    metrics.slotOrder.decisiveMatches = 200;
    metrics.slotOrder.absoluteFirstSlotAdvantage = 40;
    expect(gate(evaluate({ metrics }), "S03").outcome).toBe("pass");
    metrics.slotOrder.absoluteFirstSlotAdvantage = 60;
    expect(gate(evaluate({ metrics }), "S03").outcome).toBe("inconclusive");
    metrics.slotOrder.absoluteFirstSlotAdvantage = 90;
    expect(gate(evaluate({ metrics }), "S03").outcome).toBe("fail");
  });

  it("P01 and P02 pass/fail/inconclusive at their thresholds", () => {
    const metrics = baseMetrics();
    metrics.attacklessRate = 0.1;
    expect(gate(evaluate({ metrics }), "P01").outcome).toBe("pass");
    metrics.attacklessRate = 0.2;
    expect(gate(evaluate({ metrics }), "P01").outcome).toBe("inconclusive");
    metrics.attacklessRate = 0.26;
    expect(gate(evaluate({ metrics }), "P01").outcome).toBe("fail");

    metrics.roundCapRate = 0.75;
    expect(gate(evaluate({ metrics }), "P02").outcome).toBe("pass");
    metrics.roundCapRate = 0.8;
    expect(gate(evaluate({ metrics }), "P02").outcome).toBe("inconclusive");
    metrics.roundCapRate = 0.96;
    expect(gate(evaluate({ metrics }), "P02").outcome).toBe("fail");
  });

  it("derives the final decision exactly", () => {
    expect(
      deriveGridActivationReadinessDecision({ anyFail: true, anyInconclusive: true }),
    ).toBe("not_ready");
    expect(
      deriveGridActivationReadinessDecision({ anyFail: true, anyInconclusive: false }),
    ).toBe("not_ready");
    expect(
      deriveGridActivationReadinessDecision({ anyFail: false, anyInconclusive: true }),
    ).toBe("inconclusive");
    expect(
      deriveGridActivationReadinessDecision({ anyFail: false, anyInconclusive: false }),
    ).toBe("ready_for_opt_in_beta_review");
  });

  it("builds a validated decision artifact with every gate and no tuning recommendation", () => {
    const results = evaluate();
    const decision = buildGridActivationReadinessDecision({
      evaluationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      createdAt: "2024-06-01T00:00:00.000Z",
      gates: results.gates,
      anyFail: results.anyFail,
      anyInconclusive: results.anyInconclusive,
    });
    expect(decision.schemaVersion).toBe("3");
    expect(decision.evaluationKind).toBe("grid-activation-readiness");
    expect(decision.suiteId).toBe("grid-activation-readiness-v3");
    expect(decision.status).toBe("completed");
    expect(decision.decision).toBe("ready_for_opt_in_beta_review");
    expect(decision.gates.length).toBe(21);
    expect(decision.disclaimer).toContain("does not activate the grid runtime");
    expect(JSON.stringify(decision)).not.toContain("tun");
    const gateIds = decision.gates.map((g) => g.gateId);
    expect(gateIds).toEqual([
      "H01",
      "H02",
      "H03",
      "H04",
      "H05",
      "H06",
      "H07",
      "H08",
      "H09",
      "H10",
      "C01",
      "C02",
      "C03",
      "C04",
      "C05",
      "C06",
      "S01",
      "S02",
      "S03",
      "P01",
      "P02",
    ]);
  });
});
