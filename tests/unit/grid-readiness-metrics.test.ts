import { describe, expect, it } from "vitest";
import {
  computeGridActivationReadinessMetrics,
  type GridActivationReadinessMetrics,
} from "../../src/readiness/metrics.js";
import {
  computeMaximumConsecutiveNoProgressRounds,
  type GridActivationReadinessRunResult,
  type GridActivationReadinessSuiteOutcome,
  type GridActivationReadinessRunEvidence,
} from "../../src/readiness/execution-core.js";
import type { SimulationEvent } from "../../src/simulator/types.js";

function emptyEvidence(): GridActivationReadinessRunEvidence {
  return {
    actionCounts: { advance: 0, retreat: 0, circle_left: 0, circle_right: 0, hold: 0 },
    translatedActionCounts: {
      advance: 0,
      retreat: 0,
      circle_left: 0,
      circle_right: 0,
      hold: 0,
    },
    stationaryHoldCount: 0,
    zoneVisits: {
      north_west: 0,
      north: 0,
      north_east: 0,
      west: 0,
      center: 0,
      east: 0,
      south_west: 0,
      south: 0,
      south_east: 0,
    },
    bearingCounts: {
      same: 0,
      front: 0,
      front_right: 0,
      right: 0,
      rear_right: 0,
      rear: 0,
      rear_left: 0,
      left: 0,
      front_left: 0,
    },
    exposedPlanarArmourZoneCounts: { front: 0, left: 0, right: 0, rear: 0 },
    eventTypeCounts: {},
    maximumConsecutiveNoProgressRounds: 0,
    attacksAttempted: 0,
    hits: 0,
    misses: 0,
    integrityDamageEvents: 0,
    criticalHits: 0,
    knockbackEvents: 0,
    grappleRepositionEvents: 0,
    overturnEvents: 0,
    componentDamaged: 0,
    componentDisabled: 0,
    componentDamageResisted: 0,
  };
}

interface SyntheticRunOverrides {
  scenarioId?: string;
  seed?: number;
  fighterACompetitor?: "x" | "y";
  fighterBCompetitor?: "x" | "y";
  roleSwapped?: boolean;
  winner?: string | null;
  resultMethod?: "destruction" | "immobilisation" | "judges" | "draw";
  rounds?: number;
  evidence?: Partial<GridActivationReadinessRunEvidence>;
}

function syntheticRun(
  overrides: SyntheticRunOverrides = {},
): GridActivationReadinessRunResult {
  return {
    runNumber: 1,
    scenarioId: overrides.scenarioId ?? "flanker-bulwark",
    assignmentId: "flanker-bulwark-xa-yb",
    seed: overrides.seed ?? 1,
    fighterACompetitor: overrides.fighterACompetitor ?? "x",
    fighterBCompetitor: overrides.fighterBCompetitor ?? "y",
    roleSwapped: overrides.roleSwapped ?? false,
    matchId: "11111111-1111-4111-8111-111111111111",
    recordIndex: 0,
    reportIndex: 0,
    winner: overrides.winner ?? "fighter_a",
    resultMethod: overrides.resultMethod ?? "judges",
    rounds: overrides.rounds ?? 20,
    eventCount: 10,
    record: {} as never,
    report: {} as never,
    serializedRecord: "",
    serializedReport: "",
    recordChecksum: "a".repeat(64),
    reportChecksum: "a".repeat(64),
    textReplayChecksum: "a".repeat(64),
    asciiReplayChecksum: "a".repeat(64),
    reviewPromptChecksum: "a".repeat(64),
    evidence: { ...emptyEvidence(), ...overrides.evidence },
  };
}

function syntheticOutcome(
  results: GridActivationReadinessRunResult[],
): GridActivationReadinessSuiteOutcome {
  return {
    evaluationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    createdAt: "2024-06-01T00:00:00.000Z",
    suiteChecksum: "a".repeat(64),
    inputsUnmodified: true,
    matchCount: 312,
    results,
  } as GridActivationReadinessSuiteOutcome;
}

function compute(
  results: GridActivationReadinessRunResult[],
  perMatchMs: number[] = [],
): GridActivationReadinessMetrics {
  return computeGridActivationReadinessMetrics({
    outcome: syntheticOutcome(results),
    execution: { deterministicMatches: 312, invalidEventCount: 0, mutationFailures: 0 },
    timing: { totalElapsedMs: 1200, perMatchMs },
  });
}

describe("grid activation readiness metrics (Phase 3E1)", () => {
  it("aggregates execution, movement and combat counts", () => {
    const runs = [
      syntheticRun({
        evidence: {
          actionCounts: {
            advance: 3,
            retreat: 1,
            circle_left: 2,
            circle_right: 1,
            hold: 0,
          },
          translatedActionCounts: {
            advance: 2,
            retreat: 1,
            circle_left: 0,
            circle_right: 0,
            hold: 0,
          },
          stationaryHoldCount: 0,
          zoneVisits: { ...emptyEvidence().zoneVisits, center: 5, north: 3 },
          bearingCounts: { ...emptyEvidence().bearingCounts, front: 4 },
          exposedPlanarArmourZoneCounts: { front: 6, left: 0, right: 0, rear: 0 },
          attacksAttempted: 7,
          hits: 3,
          misses: 4,
          integrityDamageEvents: 3,
          criticalHits: 2,
          knockbackEvents: 1,
          grappleRepositionEvents: 0,
          overturnEvents: 1,
          componentDamaged: 2,
          componentDisabled: 1,
          componentDamageResisted: 1,
          maximumConsecutiveNoProgressRounds: 4,
        },
      }),
      syntheticRun({
        evidence: {
          actionCounts: {
            advance: 1,
            retreat: 0,
            circle_left: 0,
            circle_right: 2,
            hold: 1,
          },
          stationaryHoldCount: 1,
          attacksAttempted: 1,
          hits: 0,
          misses: 1,
          maximumConsecutiveNoProgressRounds: 9,
        },
      }),
    ];
    const metrics = compute(runs);
    expect(metrics.execution.totalPlannedRuns).toBe(312);
    expect(metrics.execution.totalCompletedRuns).toBe(2);
    expect(metrics.execution.deterministicMatches).toBe(312);
    expect(metrics.execution.schemaValidRecords).toBe(2);
    expect(metrics.execution.schemaValidReports).toBe(2);
    expect(metrics.execution.replayAgreeingMatches).toBe(2);
    expect(metrics.execution.invalidEventCount).toBe(0);
    expect(metrics.execution.mutationFailures).toBe(0);
    expect(metrics.movement.actionCounts.advance).toBe(4);
    expect(metrics.movement.actionCounts.hold).toBe(1);
    expect(metrics.movement.translatedActionCounts.advance).toBe(2);
    expect(metrics.movement.stationaryHoldCount).toBe(1);
    expect(metrics.movement.zoneVisits.center).toBe(5);
    expect(metrics.movement.bearingCounts.front).toBe(4);
    expect(metrics.movement.exposedPlanarArmourZoneCounts.front).toBe(6);
    expect(metrics.combat.attacksAttempted).toBe(8);
    expect(metrics.combat.hits).toBe(3);
    expect(metrics.combat.misses).toBe(5);
    expect(metrics.combat.integrityDamageEvents).toBe(3);
    expect(metrics.combat.criticalHits).toBe(2);
    expect(metrics.combat.knockbackEvents).toBe(1);
    expect(metrics.combat.overturnEvents).toBe(1);
    expect(metrics.combat.componentDamaged).toBe(2);
    expect(metrics.combat.componentDisabled).toBe(1);
    expect(metrics.combat.componentDamageResisted).toBe(1);
    expect(metrics.results.maximumConsecutiveNoProgressRounds).toBe(9);
  });

  it("computes result-method counts and round statistics", () => {
    const runs = [
      syntheticRun({ resultMethod: "judges", rounds: 20, winner: "fighter_a" }),
      syntheticRun({ resultMethod: "immobilisation", rounds: 10, winner: "fighter_b" }),
      syntheticRun({ resultMethod: "destruction", rounds: 5, winner: "fighter_a" }),
      syntheticRun({ resultMethod: "draw", rounds: 20, winner: null }),
    ];
    const metrics = compute(runs);
    expect(metrics.results.judges).toBe(1);
    expect(metrics.results.immobilisation).toBe(1);
    expect(metrics.results.destruction).toBe(1);
    expect(metrics.results.draws).toBe(1);
    expect(metrics.results.roundCapMatches).toBe(2);
    expect(metrics.results.roundsMin).toBe(5);
    expect(metrics.results.roundsMax).toBe(20);
    expect(metrics.results.roundsMean).toBe(13.75);
    expect(metrics.results.roundsMedian).toBe(15);
  });

  it("computes slot-order diagnostics including mirror and paired role-swap", () => {
    // Mirror: 8 decisive, 4 A wins / 4 B wins → imbalance 0.
    const mirrorRuns = [
      ...Array.from({ length: 4 }, () =>
        syntheticRun({ scenarioId: "bulwark-mirror", winner: "fighter_a" }),
      ),
      ...Array.from({ length: 4 }, () =>
        syntheticRun({ scenarioId: "bulwark-mirror", winner: "fighter_b" }),
      ),
    ];
    // Paired role-swap: two seeds where X stays stable (both lose), and one
    // seed where X flips (slot-sensitive).
    const pairRuns = [
      syntheticRun({
        scenarioId: "flanker-bulwark",
        seed: 1,
        roleSwapped: false,
        fighterACompetitor: "x",
        fighterBCompetitor: "y",
        winner: "fighter_b",
      }),
      syntheticRun({
        scenarioId: "flanker-bulwark",
        seed: 1,
        roleSwapped: true,
        fighterACompetitor: "y",
        fighterBCompetitor: "x",
        winner: "fighter_b",
      }),
      syntheticRun({
        scenarioId: "spinner-bulwark",
        seed: 2,
        roleSwapped: false,
        fighterACompetitor: "x",
        fighterBCompetitor: "y",
        winner: "fighter_b",
      }),
      syntheticRun({
        scenarioId: "spinner-bulwark",
        seed: 2,
        roleSwapped: true,
        fighterACompetitor: "y",
        fighterBCompetitor: "x",
        winner: "fighter_b",
      }),
      syntheticRun({
        scenarioId: "grappler-bulwark",
        seed: 3,
        roleSwapped: false,
        fighterACompetitor: "x",
        fighterBCompetitor: "y",
        winner: "fighter_b",
      }),
      syntheticRun({
        scenarioId: "grappler-bulwark",
        seed: 3,
        roleSwapped: true,
        fighterACompetitor: "y",
        fighterBCompetitor: "x",
        winner: "fighter_a",
      }),
    ];
    const metrics = compute([...mirrorRuns, ...pairRuns]);
    expect(metrics.slotOrder.decisiveMatches).toBe(14);
    expect(metrics.slotOrder.bulwarkMirrorDecisiveCount).toBe(8);
    expect(metrics.slotOrder.bulwarkMirrorSlotImbalance).toBe(0);
    expect(metrics.slotOrder.pairedAsymmetricComparisons).toBe(3);
    // Seeds 1 and 2: X flips (win when in slot b, loss when in slot a) → sensitive.
    // Seed 3: X loses in both slots → stable.
    expect(metrics.slotOrder.pairedOutcomeStableComparisons).toBe(1);
    expect(metrics.slotOrder.pairedSlotSensitiveComparisons).toBe(2);
    expect(metrics.slotOrder.pairedSlotSensitivityRatio).toBeCloseTo(2 / 3);
  });

  it("computes attackless and round-cap rates excluding and including the Sentinel scenario", () => {
    const nonSentinelAttackless = syntheticRun({
      scenarioId: "flanker-bulwark",
      rounds: 5,
      evidence: { attacksAttempted: 0 },
    });
    const nonSentinelAttacking = syntheticRun({
      scenarioId: "flanker-bulwark",
      evidence: { attacksAttempted: 5 },
    });
    const sentinel = syntheticRun({
      scenarioId: "sentinel-bulwark",
      evidence: { attacksAttempted: 0 },
      rounds: 20,
    });
    const metrics = compute([nonSentinelAttackless, nonSentinelAttacking, sentinel]);
    // Attackless rate excludes the Sentinel hold scenario: 1/2.
    expect(metrics.attacklessRate).toBeCloseTo(0.5);
    // Round-cap rate includes all runs: 2/3 (runs at 20 rounds).
    expect(metrics.roundCapRate).toBeCloseTo(2 / 3);
  });

  it("computes timing percentiles but they are informational only", () => {
    const perMatchMs = Array.from({ length: 100 }, (_, i) => i + 1);
    const metrics = compute([syntheticRun()], perMatchMs);
    expect(metrics.timing.totalElapsedMs).toBe(1200);
    expect(metrics.timing.meanMsPerMatch).toBe(12);
    expect(metrics.timing.medianMsPerMatch).toBe(50.5);
    // p95 of 1..100 → index ceil(0.95*100)-1 = 94 → 95.
    expect(metrics.timing.p95MsPerMatch).toBe(95);
  });

  it("aggregates the maximum consecutive no-progress streak across runs", () => {
    const metrics = compute([
      syntheticRun({ evidence: { maximumConsecutiveNoProgressRounds: 3 } }),
      syntheticRun({ evidence: { maximumConsecutiveNoProgressRounds: 11 } }),
      syntheticRun({ evidence: { maximumConsecutiveNoProgressRounds: 5 } }),
    ]);
    expect(metrics.results.maximumConsecutiveNoProgressRounds).toBe(11);
  });

  it("computes the no-progress streak from event streams", () => {
    const makeEvent = (
      round: number,
      type: string,
      extra: Record<string, unknown> = {},
    ): SimulationEvent => ({
      schemaVersion: "1",
      sequence: round,
      round,
      timestampMs: 0,
      type,
      data: extra,
    });
    // Rounds 1,2: no progress. Round 3: translated movement. Rounds 4,5,6:
    // no progress. Round 7: attack. → streak of 3 (rounds 4-6).
    const events = [
      makeEvent(1, "round_ended", {
        fighterA: { conditions: [] },
        fighterB: { conditions: [] },
      }),
      makeEvent(2, "round_ended", {
        fighterA: { conditions: [] },
        fighterB: { conditions: [] },
      }),
      makeEvent(3, "movement_resolved", { from: "north", to: "center" }),
      makeEvent(4, "round_ended", {
        fighterA: { conditions: [] },
        fighterB: { conditions: [] },
      }),
      makeEvent(5, "round_ended", {
        fighterA: { conditions: [] },
        fighterB: { conditions: [] },
      }),
      makeEvent(6, "round_ended", {
        fighterA: { conditions: [] },
        fighterB: { conditions: [] },
      }),
      makeEvent(7, "attack_attempted", {}),
    ];
    expect(computeMaximumConsecutiveNoProgressRounds(events)).toBe(3);
  });

  it("treats a condition-set change as meaningful progress", () => {
    const makeEvent = (
      round: number,
      conditionsA: string[],
      conditionsB: string[],
    ): SimulationEvent => ({
      schemaVersion: "1",
      sequence: round,
      round,
      timestampMs: 0,
      type: "round_ended",
      data: {
        fighterA: { conditions: conditionsA },
        fighterB: { conditions: conditionsB },
      },
    });
    const events = [
      makeEvent(1, [], []),
      makeEvent(2, ["overturned"], []),
      makeEvent(3, ["overturned"], []),
    ];
    // Round 2 changed conditions → progress. Rounds 1 and 3 are no-progress
    // but not consecutive. Maximum streak is 1.
    expect(computeMaximumConsecutiveNoProgressRounds(events)).toBe(1);
  });
});
