import { describe, expect, it } from "vitest";
import { makeV3Record, type V3RecordOptions } from "../fixtures/v3-match-record.js";
import {
  inspectGridReadinessRecordEvidence,
  GridActivationReadinessEvidenceError,
} from "../../src/readiness/record-evidence.js";
import type { SimulationEvent } from "../../src/simulator/types.js";

/**
 * Phase 3E1.1 evidence-source correction tests: selected actions come from
 * `policy_triggered` (one per fighter per completed round), stationary
 * `hold` needs no `movement_resolved`, ordinary `movement_resolved` must
 * exactly agree with the actor's selected policy movement, and knockback /
 * grapple reposition events are never selected actions.
 */

function makeEvent(
  type: string,
  round: number,
  sequence: number,
  extra: Record<string, unknown>,
  actorId?: string,
  targetId?: string,
): SimulationEvent {
  return {
    schemaVersion: "1",
    sequence,
    round,
    timestampMs: 0,
    type,
    actorId,
    targetId,
    data: extra,
  } as unknown as SimulationEvent;
}

function policy(
  round: number,
  sequence: number,
  actor: "fighter_a" | "fighter_b",
  movement: string,
  combat: string,
): SimulationEvent {
  return makeEvent(
    "policy_triggered",
    round,
    sequence,
    { action: { movement, combat } },
    actor,
  );
}

function movement(
  round: number,
  sequence: number,
  actor: "fighter_a" | "fighter_b",
  from: string,
  to: string,
  facing: string,
  action: string,
  targetId?: string,
): SimulationEvent {
  return makeEvent(
    "movement_resolved",
    round,
    sequence,
    { from, to, facing, action },
    actor,
    targetId,
  );
}

function roundEnded(
  round: number,
  sequence: number,
  zoneA: string,
  zoneB: string,
  conditionsA: readonly string[] = [],
  conditionsB: readonly string[] = [],
): SimulationEvent {
  return makeEvent("round_ended", round, sequence, {
    fighterA: { zone: zoneA, conditions: conditionsA },
    fighterB: { zone: zoneB, conditions: conditionsB },
  });
}

function baseEvents(): SimulationEvent[] {
  return [
    {
      schemaVersion: "1",
      sequence: 0,
      round: 0,
      timestampMs: 0,
      type: "competition_started",
      data: { seed: 7 },
    },
    {
      schemaVersion: "1",
      sequence: 1,
      round: 0,
      timestampMs: 0,
      type: "competition_ended",
      data: {},
    },
  ];
}

function makeRecord(events: SimulationEvent[], rounds: number, options: V3RecordOptions = {}) {
  const record = makeV3Record({ ...options, events });
  return { ...record, rounds };
}

/** Two completed rounds where both fighters select `hold` every round. */
function sentinelHoldRecord() {
  const events = [
    ...baseEvents(),
    policy(1, 2, "fighter_a", "hold", "idle"),
    policy(1, 3, "fighter_b", "hold", "idle"),
    roundEnded(1, 4, "south", "north"),
    policy(2, 5, "fighter_a", "hold", "idle"),
    policy(2, 6, "fighter_b", "hold", "idle"),
    roundEnded(2, 7, "south", "north"),
  ];
  return makeRecord(events, 2);
}

/** Round 1: advance + hold; round 2: circle_right + hold, with a knockback
 * and a grapple reposition event that are not selected actions. */
function mixedRecord() {
  const events = [
    ...baseEvents(),
    policy(1, 2, "fighter_a", "advance", "attack"),
    policy(1, 3, "fighter_b", "hold", "defend"),
    movement(1, 4, "fighter_a", "south", "center", "north", "advance"),
    // Knockback and grapple reposition events (target-subject semantics):
    // never selected actions, never translated ordinary movement.
    movement(1, 5, "fighter_b", "north", "north_east", "south", "knockback", "fighter_b"),
    movement(1, 6, "fighter_a", "center", "north", "north", "grapple", "fighter_a"),
    roundEnded(1, 7, "north", "north_east"),
    policy(2, 8, "fighter_a", "circle_right", "attack"),
    policy(2, 9, "fighter_b", "hold", "idle"),
    movement(2, 10, "fighter_a", "north", "east", "east", "circle_right"),
    movement(2, 11, "fighter_b", "north_east", "north_east", "south", "hold"),
    roundEnded(2, 12, "east", "north_east"),
  ];
  return makeRecord(events, 2);
}

describe("grid readiness record evidence (Phase 3E1.1)", () => {
  it("counts Sentinel stationary holds from policy_triggered without any movement_resolved", () => {
    const evidence = inspectGridReadinessRecordEvidence(sentinelHoldRecord());
    expect(evidence.selectedMovementActionCounts.hold).toBe(4);
    expect(evidence.stationaryHoldCount).toBe(4);
    expect(evidence.actionCounts.hold).toBe(4);
    // No translation happened.
    expect(evidence.translatedActionCounts).toEqual({
      advance: 0,
      retreat: 0,
      circle_left: 0,
      circle_right: 0,
      hold: 0,
    });
    // Selected total equals 2 × completed rounds.
    const selectedTotal = Object.values(evidence.selectedMovementActionCounts).reduce(
      (a, b) => a + b,
      0,
    );
    expect(selectedTotal).toBe(4);
    expect(evidence.selectedCombatActionCounts.idle).toBe(4);
  });

  it("counts selected movement/combat and separates translated, knockback and grapple evidence", () => {
    const evidence = inspectGridReadinessRecordEvidence(mixedRecord());
    expect(evidence.selectedMovementActionCounts).toEqual({
      advance: 1,
      retreat: 0,
      circle_left: 0,
      circle_right: 1,
      hold: 2,
    });
    expect(evidence.actionCounts).toEqual(evidence.selectedMovementActionCounts);
    expect(evidence.stationaryHoldCount).toBe(2);
    // Only ordinary translated movement counts; knockback/grapple excluded.
    expect(evidence.translatedActionCounts).toEqual({
      advance: 1,
      retreat: 0,
      circle_left: 0,
      circle_right: 1,
      hold: 0,
    });
    expect(evidence.knockbackEvents).toBe(1);
    expect(evidence.grappleRepositionEvents).toBe(1);
    expect(evidence.selectedCombatActionCounts).toEqual({
      attack: 2,
      defend: 1,
      idle: 1,
    });
    const selectedTotal = Object.values(evidence.selectedMovementActionCounts).reduce(
      (a, b) => a + b,
      0,
    );
    expect(selectedTotal).toBe(2 * 2);
  });

  it("fails closed on a duplicate policy_triggered for the same actor in a round", () => {
    const events = [
      ...baseEvents(),
      policy(1, 2, "fighter_a", "hold", "idle"),
      policy(1, 3, "fighter_a", "advance", "attack"),
      policy(1, 4, "fighter_b", "hold", "idle"),
      roundEnded(1, 5, "south", "north"),
    ];
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(events, 1))).toThrow(
      GridActivationReadinessEvidenceError,
    );
  });

  it("fails closed when a completed round lacks a policy_triggered per fighter", () => {
    const events = [
      ...baseEvents(),
      policy(1, 2, "fighter_a", "hold", "idle"),
      // fighter_b selection missing for round 1.
      roundEnded(1, 3, "south", "north"),
    ];
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(events, 1))).toThrow(
      /exactly two policy_triggered/,
    );
  });

  it("fails closed on a policy_triggered with an invalid round", () => {
    const events = [
      ...baseEvents(),
      policy(0, 2, "fighter_a", "hold", "idle"),
      policy(1, 3, "fighter_b", "hold", "idle"),
      roundEnded(1, 4, "south", "north"),
    ];
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(events, 1))).toThrow(
      /invalid round/,
    );
  });

  it("fails closed when policy_triggered appears after competition completion", () => {
    const events = [
      ...baseEvents(),
      policy(1, 2, "fighter_a", "hold", "idle"),
      policy(1, 3, "fighter_b", "hold", "idle"),
      roundEnded(1, 4, "south", "north"),
      policy(2, 5, "fighter_a", "hold", "idle"),
    ];
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(events, 1))).toThrow(
      /after competition completion/,
    );
  });

  it("fails closed when ordinary movement_resolved disagrees with the selected policy movement", () => {
    const events = [
      ...baseEvents(),
      policy(1, 2, "fighter_a", "hold", "idle"),
      policy(1, 3, "fighter_b", "hold", "idle"),
      movement(1, 4, "fighter_a", "south", "north", "north", "advance"),
      roundEnded(1, 5, "north", "north"),
    ];
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(events, 1))).toThrow(
      /does not equal the selected policy movement/,
    );
  });

  it("fails closed when ordinary movement_resolved has no selected policy movement", () => {
    const events = [
      ...baseEvents(),
      policy(1, 2, "fighter_a", "hold", "idle"),
      policy(1, 3, "fighter_b", "hold", "idle"),
      // fighter_a movement in round 2 (which has no selection because rounds=1).
      movement(2, 4, "fighter_a", "south", "north", "north", "hold"),
      roundEnded(1, 5, "south", "north"),
    ];
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(events, 1))).toThrow(
      /has no selected policy movement/,
    );
  });

  it("fails closed on a non-canonical policy movement selection", () => {
    const events = [
      ...baseEvents(),
      policy(1, 2, "fighter_a", "teleport", "idle"),
      policy(1, 3, "fighter_b", "hold", "idle"),
      roundEnded(1, 4, "south", "north"),
    ];
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(events, 1))).toThrow(
      /unknown movement selection/,
    );
  });

  it("fails closed on a non-canonical policy combat selection", () => {
    const events = [
      ...baseEvents(),
      policy(1, 2, "fighter_a", "hold", "flee"),
      policy(1, 3, "fighter_b", "hold", "idle"),
      roundEnded(1, 4, "south", "north"),
    ];
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(events, 1))).toThrow(
      /unknown combat selection/,
    );
  });

  it("fails closed on a non-canonical movement_resolved zone or action", () => {
    const badZone = [
      ...baseEvents(),
      policy(1, 2, "fighter_a", "advance", "attack"),
      policy(1, 3, "fighter_b", "hold", "idle"),
      movement(1, 4, "fighter_a", "south", "moon", "north", "advance"),
      roundEnded(1, 5, "south", "north"),
    ];
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(badZone, 1))).toThrow(
      /canonical grid zones/,
    );

    const badAction = [
      ...baseEvents(),
      policy(1, 2, "fighter_a", "advance", "attack"),
      policy(1, 3, "fighter_b", "hold", "idle"),
      movement(1, 4, "fighter_a", "south", "north", "north", "lunge"),
      roundEnded(1, 5, "north", "north"),
    ];
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(badAction, 1))).toThrow(
      /non-canonical action/,
    );
  });

  it("derives zone, bearing, exposure and no-progress evidence from the stream", () => {
    const evidence = inspectGridReadinessRecordEvidence(mixedRecord());
    expect(evidence.zoneVisits.south).toBeGreaterThan(0);
    expect(evidence.zoneVisits.north).toBeGreaterThan(0);
    expect(evidence.zoneVisits.center).toBeGreaterThan(0);
    expect(evidence.zoneVisits.east).toBeGreaterThan(0);
    // The fighters face each other head-on for most of the stream.
    expect(evidence.bearingCounts.front).toBeGreaterThan(0);
    expect(evidence.exposedPlanarArmourZoneCounts.front).toBeGreaterThan(0);
    expect(evidence.maximumConsecutiveNoProgressRounds).toBeGreaterThanOrEqual(0);
    expect(evidence.eventTypeCounts["policy_triggered"]).toBe(4);
    expect(evidence.eventTypeCounts["movement_resolved"]).toBe(5);
    expect(evidence.eventTypeCounts["round_ended"]).toBe(2);
  });

  it("fails closed on a malformed record with zero rounds", () => {
    const record = makeRecord([...baseEvents()], 0);
    expect(() => inspectGridReadinessRecordEvidence(record)).toThrow(
      /at least one completed round/,
    );
  });
});
