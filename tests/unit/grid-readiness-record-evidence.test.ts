import { describe, expect, it } from "vitest";
import { makeV3Record, type V3RecordOptions } from "../fixtures/v3-match-record.js";
import {
  inspectGridReadinessRecordEvidence,
  validateGridReadinessEventChronology,
  GridActivationReadinessEvidenceError,
} from "../../src/readiness/record-evidence.js";
import type { SimulationEvent } from "../../src/simulator/types.js";

/**
 * Phase 3E1.1 / 3E1.2 evidence-source correction and chronology tests.
 *
 * Selected actions come from `policy_triggered` (one per fighter per completed
 * round); stationary `hold` needs no `movement_resolved`; ordinary
 * `movement_resolved` must exactly agree with the actor's selected policy
 * movement; knockback / grapple repositions are never selected actions;
 * translated hold is impossible; and the complete event chronology
 * (competition_started first, per-round round_started → policies →
 * round_ended, competition_ended last) is enforced.
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

/** A shared monotonically increasing sequence counter for building streams. */
interface Stream {
  events: SimulationEvent[];
  started: () => SimulationEvent;
  roundStarted: (round: number) => SimulationEvent;
  policy: (
    round: number,
    actor: "fighter_a" | "fighter_b",
    movement: string,
    combat: string,
  ) => SimulationEvent;
  movement: (
    round: number,
    actor: "fighter_a" | "fighter_b",
    from: string,
    to: string,
    facing: string,
    action: string,
    targetId?: string,
  ) => SimulationEvent;
  roundEnded: (
    round: number,
    zoneA: string,
    zoneB: string,
    conditionsA?: readonly string[],
    conditionsB?: readonly string[],
  ) => SimulationEvent;
  ended: (round: number, winner?: string | null, method?: string) => SimulationEvent;
}

function makeStream(): Stream {
  const events: SimulationEvent[] = [];
  let seq = 0;
  const next = (): number => seq++;
  return {
    events,
    started: () => makeEvent("competition_started", 0, next(), { seed: 7 }),
    roundStarted: (round) => makeEvent("round_started", round, next(), {}),
    policy: (round, actor, movement, combat) =>
      makeEvent(
        "policy_triggered",
        round,
        next(),
        { action: { movement, combat } },
        actor,
      ),
    movement: (round, actor, from, to, facing, action, targetId) =>
      makeEvent(
        "movement_resolved",
        round,
        next(),
        { from, to, facing, action },
        actor,
        targetId,
      ),
    roundEnded: (round, zoneA, zoneB, conditionsA = [], conditionsB = []) =>
      makeEvent("round_ended", round, next(), {
        fighterA: { zone: zoneA, conditions: conditionsA },
        fighterB: { zone: zoneB, conditions: conditionsB },
      }),
    ended: (round, winner = null, method = "draw") =>
      makeEvent("competition_ended", round, next(), {
        winner,
        loser: null,
        method,
        rounds: round,
      }),
  };
}

function makeRecord(
  events: SimulationEvent[],
  rounds: number,
  options: V3RecordOptions = {},
) {
  const record = makeV3Record({ ...options, events });
  return { ...record, rounds };
}

/** Two completed rounds where both fighters select `hold` every round. */
function sentinelHoldRecord() {
  const s = makeStream();
  s.events.push(s.started());
  for (let r = 1; r <= 2; r++) {
    s.events.push(s.roundStarted(r));
    s.events.push(s.policy(r, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(r, "fighter_b", "hold", "idle"));
    s.events.push(s.roundEnded(r, "south", "north"));
  }
  s.events.push(s.ended(2));
  return makeRecord(s.events, 2);
}

/** Round 1: advance + hold; round 2: circle_right + hold, with a knockback
 * and a grapple reposition event that are not selected actions. */
function mixedRecord() {
  const s = makeStream();
  s.events.push(s.started());
  s.events.push(s.roundStarted(1));
  s.events.push(s.policy(1, "fighter_a", "advance", "attack"));
  s.events.push(s.policy(1, "fighter_b", "hold", "defend"));
  s.events.push(s.movement(1, "fighter_a", "south", "center", "north", "advance"));
  // Knockback and grapple reposition events (target-subject semantics):
  // never selected actions, never translated ordinary movement.
  s.events.push(
    s.movement(1, "fighter_b", "north", "north_east", "south", "knockback", "fighter_b"),
  );
  s.events.push(
    s.movement(1, "fighter_a", "center", "north", "north", "grapple", "fighter_a"),
  );
  s.events.push(s.roundEnded(1, "north", "north_east"));
  s.events.push(s.roundStarted(2));
  s.events.push(s.policy(2, "fighter_a", "circle_right", "attack"));
  s.events.push(s.policy(2, "fighter_b", "hold", "idle"));
  s.events.push(s.movement(2, "fighter_a", "north", "east", "east", "circle_right"));
  s.events.push(s.movement(2, "fighter_b", "north_east", "north_east", "south", "hold"));
  s.events.push(s.roundEnded(2, "east", "north_east"));
  s.events.push(s.ended(2));
  return makeRecord(s.events, 2);
}

/** A single valid completed round where fighter A advances, fighter B holds. */
function advanceHoldRecord() {
  const s = makeStream();
  s.events.push(s.started());
  s.events.push(s.roundStarted(1));
  s.events.push(s.policy(1, "fighter_a", "advance", "attack"));
  s.events.push(s.policy(1, "fighter_b", "hold", "defend"));
  s.events.push(s.movement(1, "fighter_a", "south", "center", "north", "advance"));
  s.events.push(s.movement(1, "fighter_b", "north", "north", "south", "hold"));
  s.events.push(s.roundEnded(1, "center", "north"));
  s.events.push(s.ended(1));
  return makeRecord(s.events, 1);
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
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_a", "advance", "attack"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.ended(1));
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(s.events, 1))).toThrow(
      GridActivationReadinessEvidenceError,
    );
  });

  it("fails closed when a completed round lacks a policy_triggered per fighter", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    // fighter_b selection missing for round 1.
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.ended(1));
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(s.events, 1))).toThrow(
      /exactly two policy_triggered/,
    );
  });

  it("fails closed on a policy_triggered with an invalid round", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(0, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.ended(1));
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(s.events, 1))).toThrow(
      /round ordering must be monotonic|invalid round/,
    );
  });

  it("fails closed when a policy appears after competition completion", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.ended(1));
    // A policy event after competition_ended (same final round).
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(s.events, 1))).toThrow(
      /competition_ended must be the final event/,
    );
  });

  it("fails closed when ordinary movement_resolved disagrees with the selected policy movement", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.movement(1, "fighter_a", "south", "north", "north", "advance"));
    s.events.push(s.roundEnded(1, "north", "north"));
    s.events.push(s.ended(1));
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(s.events, 1))).toThrow(
      /does not equal the selected policy movement/,
    );
  });

  it("fails closed when ordinary movement_resolved has no selected policy movement", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    // fighter_a movement in round 2 (which has no selection because rounds=1).
    s.events.push(s.movement(2, "fighter_a", "south", "north", "north", "hold"));
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.ended(1));
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(s.events, 1))).toThrow(
      /has no selected policy movement|appears before the round's round_started|begins before round/,
    );
  });

  it("fails closed on a non-canonical policy movement selection", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "teleport", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.ended(1));
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(s.events, 1))).toThrow(
      /unknown movement selection/,
    );
  });

  it("fails closed on a non-canonical policy combat selection", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "flee"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.ended(1));
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(s.events, 1))).toThrow(
      /unknown combat selection/,
    );
  });

  it("fails closed on a non-canonical movement_resolved zone or action", () => {
    const badZone = makeStream();
    badZone.events.push(badZone.started());
    badZone.events.push(badZone.roundStarted(1));
    badZone.events.push(badZone.policy(1, "fighter_a", "advance", "attack"));
    badZone.events.push(badZone.policy(1, "fighter_b", "hold", "idle"));
    badZone.events.push(
      badZone.movement(1, "fighter_a", "south", "moon", "north", "advance"),
    );
    badZone.events.push(badZone.roundEnded(1, "south", "north"));
    badZone.events.push(badZone.ended(1));
    expect(() =>
      inspectGridReadinessRecordEvidence(makeRecord(badZone.events, 1)),
    ).toThrow(/canonical grid zones/);

    const badAction = makeStream();
    badAction.events.push(badAction.started());
    badAction.events.push(badAction.roundStarted(1));
    badAction.events.push(badAction.policy(1, "fighter_a", "advance", "attack"));
    badAction.events.push(badAction.policy(1, "fighter_b", "hold", "idle"));
    badAction.events.push(
      badAction.movement(1, "fighter_a", "south", "north", "north", "lunge"),
    );
    badAction.events.push(badAction.roundEnded(1, "north", "north"));
    badAction.events.push(badAction.ended(1));
    expect(() =>
      inspectGridReadinessRecordEvidence(makeRecord(badAction.events, 1)),
    ).toThrow(/non-canonical action/);
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
    expect(evidence.eventTypeCounts["competition_started"]).toBe(1);
    expect(evidence.eventTypeCounts["competition_ended"]).toBe(1);
  });

  it("fails closed on a malformed record with zero rounds", () => {
    const s = makeStream();
    s.events.push(s.started());
    const record = makeRecord(s.events, 0);
    expect(() => inspectGridReadinessRecordEvidence(record)).toThrow(
      /at least one completed round/,
    );
  });
});

describe("grid readiness event chronology (Phase 3E1.2)", () => {
  it("accepts a well-formed stream with competition_ended last", () => {
    const record = mixedRecord();
    expect(() => validateGridReadinessEventChronology(record)).not.toThrow();
  });

  it("rejects a policy event after competition_ended in the same final round", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.ended(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    expect(() => validateGridReadinessEventChronology(makeRecord(s.events, 1))).toThrow(
      /competition_ended must be the final event/,
    );
  });

  it("rejects a round-ended event after competition completion", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.ended(1));
    s.events.push(s.roundEnded(1, "south", "north"));
    expect(() => validateGridReadinessEventChronology(makeRecord(s.events, 1))).toThrow(
      /competition_ended must be the final event/,
    );
  });

  it("rejects duplicate terminal events", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.ended(1));
    s.events.push(s.ended(1));
    expect(() => validateGridReadinessEventChronology(makeRecord(s.events, 1))).toThrow(
      /exactly one competition_ended/,
    );
  });

  it("rejects a missing terminal event", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.roundEnded(1, "south", "north"));
    expect(() => validateGridReadinessEventChronology(makeRecord(s.events, 1))).toThrow(
      /exactly one competition_ended/,
    );
  });

  it("rejects a terminal event that is not last", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.ended(1));
    s.events.push(s.roundStarted(2));
    expect(() => validateGridReadinessEventChronology(makeRecord(s.events, 1))).toThrow(
      /competition_ended must be the final event/,
    );
  });

  it("rejects a policy event after round_ended within the same round", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.ended(1));
    expect(() => validateGridReadinessEventChronology(makeRecord(s.events, 1))).toThrow(
      /policy_triggered in round 1 appears after the round's round_ended/,
    );
  });

  it("rejects duplicate round-start events", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.ended(1));
    expect(() => validateGridReadinessEventChronology(makeRecord(s.events, 1))).toThrow(
      /duplicate round_started|exactly one round_started/,
    );
  });

  it("rejects duplicate round-end events", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.ended(1));
    expect(() => validateGridReadinessEventChronology(makeRecord(s.events, 1))).toThrow(
      /duplicate round_ended|exactly one round_ended/,
    );
  });

  it("rejects a missing round-end event", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.ended(1));
    expect(() => validateGridReadinessEventChronology(makeRecord(s.events, 1))).toThrow(
      /exactly one round_ended/,
    );
  });

  it("rejects a missing round-start event", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.ended(1));
    expect(() => validateGridReadinessEventChronology(makeRecord(s.events, 1))).toThrow(
      /policy_triggered in round 1 appears before the round's round_started/,
    );
  });

  it("rejects non-monotonic round ordering", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.roundStarted(3));
    s.events.push(s.ended(1));
    expect(() => validateGridReadinessEventChronology(makeRecord(s.events, 1))).toThrow(
      /beyond competition completion|competition_ended must be the final event/,
    );
  });

  it("rejects duplicate structural sequence numbers", () => {
    const events = [
      makeEvent("competition_started", 0, 0, { seed: 7 }),
      makeEvent("round_started", 1, 1, {}),
      makeEvent(
        "policy_triggered",
        1,
        2,
        { action: { movement: "hold", combat: "idle" } },
        "fighter_a",
      ),
      makeEvent(
        "policy_triggered",
        1,
        2,
        { action: { movement: "hold", combat: "idle" } },
        "fighter_b",
      ),
      makeEvent("round_ended", 1, 3, {
        fighterA: { zone: "south", conditions: [] },
        fighterB: { zone: "north", conditions: [] },
      }),
      makeEvent("competition_ended", 1, 4, {
        winner: null,
        loser: null,
        method: "draw",
        rounds: 1,
      }),
    ];
    expect(() => validateGridReadinessEventChronology(makeRecord(events, 1))).toThrow(
      /structural event sequence numbers must be strictly increasing/,
    );
  });

  it("rejects non-monotonic structural sequence numbers", () => {
    const events = [
      makeEvent("competition_started", 0, 0, { seed: 7 }),
      makeEvent("round_started", 1, 1, {}),
      makeEvent(
        "policy_triggered",
        1,
        3,
        { action: { movement: "hold", combat: "idle" } },
        "fighter_a",
      ),
      makeEvent(
        "policy_triggered",
        1,
        2,
        { action: { movement: "hold", combat: "idle" } },
        "fighter_b",
      ),
      makeEvent("round_ended", 1, 4, {
        fighterA: { zone: "south", conditions: [] },
        fighterB: { zone: "north", conditions: [] },
      }),
      makeEvent("competition_ended", 1, 5, {
        winner: null,
        loser: null,
        method: "draw",
        rounds: 1,
      }),
    ];
    expect(() => validateGridReadinessEventChronology(makeRecord(events, 1))).toThrow(
      /structural event sequence numbers must be strictly increasing/,
    );
  });

  it("rejects a competition_ended round that disagrees with record.rounds", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.ended(2));
    expect(() => validateGridReadinessEventChronology(makeRecord(s.events, 1))).toThrow(
      /competition_ended round 2 must equal record.rounds 1/,
    );
  });

  it("rejects a terminal payload that disagrees with the record result", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.roundEnded(1, "south", "north"));
    // Record result is {winner: null, method: "draw"}; claim a winner instead.
    s.events.push(s.ended(1, "fighter_a", "judges"));
    const record = makeRecord(s.events, 1);
    expect(() => validateGridReadinessEventChronology(record)).toThrow(
      /competition_ended winner does not agree/,
    );
  });
});

describe("grid readiness hold invariants (Phase 3E1.2)", () => {
  it("accepts selected hold without any movement event", () => {
    const evidence = inspectGridReadinessRecordEvidence(sentinelHoldRecord());
    expect(evidence.selectedMovementActionCounts.hold).toBe(4);
    expect(evidence.stationaryHoldCount).toBe(4);
    expect(evidence.translatedActionCounts.hold).toBe(0);
  });

  it("accepts a same-cell same-facing ordinary hold movement event", () => {
    const evidence = inspectGridReadinessRecordEvidence(advanceHoldRecord());
    expect(evidence.selectedMovementActionCounts.hold).toBe(1);
    expect(evidence.stationaryHoldCount).toBe(1);
    expect(evidence.translatedActionCounts.hold).toBe(0);
  });

  it("rejects a translated hold as impossible under the frozen grid runtime", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    s.events.push(s.movement(1, "fighter_a", "south", "north", "north", "hold"));
    s.events.push(s.roundEnded(1, "north", "north"));
    s.events.push(s.ended(1));
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(s.events, 1))).toThrow(
      /translated hold is impossible/,
    );
  });

  it("rejects an ordinary hold movement event that changes facing", () => {
    const s = makeStream();
    s.events.push(s.started());
    s.events.push(s.roundStarted(1));
    s.events.push(s.policy(1, "fighter_a", "hold", "idle"));
    s.events.push(s.policy(1, "fighter_b", "hold", "idle"));
    // fighter_a holds but changes facing south → east.
    s.events.push(s.movement(1, "fighter_a", "south", "south", "east", "hold"));
    s.events.push(s.roundEnded(1, "south", "north"));
    s.events.push(s.ended(1));
    expect(() => inspectGridReadinessRecordEvidence(makeRecord(s.events, 1))).toThrow(
      /hold must preserve facing/,
    );
  });

  it("derives stationaryHoldCount directly from the selected hold count (no divergence)", () => {
    const evidence = inspectGridReadinessRecordEvidence(mixedRecord());
    expect(evidence.stationaryHoldCount).toBe(evidence.selectedMovementActionCounts.hold);
    expect(evidence.stationaryHoldCount).toBe(evidence.actionCounts.hold);
  });
});
