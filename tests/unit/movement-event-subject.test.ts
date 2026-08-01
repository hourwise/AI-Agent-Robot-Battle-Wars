import { describe, expect, it } from "vitest";
import {
  getMovementEventSubjectId,
  isMovementEventAction,
} from "../../src/events/battle-event.js";
import type { SimulationEvent } from "../../src/simulator/types.js";

function movementEvent(overrides: Partial<SimulationEvent> = {}): SimulationEvent {
  return {
    schemaVersion: "1",
    sequence: 0,
    round: 1,
    timestampMs: 0,
    type: "movement_resolved",
    actorId: "fighter_a",
    targetId: "fighter_b",
    data: { from: "south", to: "south_west", facing: "north", action: "advance" },
    ...overrides,
  };
}

describe("getMovementEventSubjectId (Phase 3D1)", () => {
  it("resolves advance to the actor", () => {
    expect(
      getMovementEventSubjectId(movementEvent({ data: { action: "advance" } })),
    ).toBe("fighter_a");
  });

  it("resolves retreat to the actor", () => {
    expect(
      getMovementEventSubjectId(movementEvent({ data: { action: "retreat" } })),
    ).toBe("fighter_a");
  });

  it("resolves a translated circle to the actor", () => {
    expect(
      getMovementEventSubjectId(
        movementEvent({
          data: { from: "south", to: "south_west", action: "circle_left" },
        }),
      ),
    ).toBe("fighter_a");
    expect(
      getMovementEventSubjectId(
        movementEvent({
          data: { from: "south", to: "south_east", action: "circle_right" },
        }),
      ),
    ).toBe("fighter_a");
  });

  it("resolves a facing-only circle to the actor", () => {
    expect(
      getMovementEventSubjectId(
        movementEvent({
          data: { from: "center", to: "center", action: "circle_left" },
        }),
      ),
    ).toBe("fighter_a");
  });

  it("resolves hold (facing change) to the actor", () => {
    expect(
      getMovementEventSubjectId(
        movementEvent({ data: { from: "center", to: "center", action: "hold" } }),
      ),
    ).toBe("fighter_a");
  });

  it("resolves knockback to the target", () => {
    expect(
      getMovementEventSubjectId(
        movementEvent({
          data: { from: "center", to: "east", action: "knockback" },
        }),
      ),
    ).toBe("fighter_b");
  });

  it("resolves grapple to the target", () => {
    expect(
      getMovementEventSubjectId(
        movementEvent({
          data: { from: "north", to: "center", action: "grapple" },
        }),
      ),
    ).toBe("fighter_b");
  });

  it("returns null for a malformed event with no actor or target", () => {
    expect(
      getMovementEventSubjectId(
        movementEvent({ actorId: undefined, data: { action: "advance" } }),
      ),
    ).toBeNull();
    expect(
      getMovementEventSubjectId(
        movementEvent({
          targetId: undefined,
          data: { action: "knockback" },
        }),
      ),
    ).toBeNull();
    expect(
      getMovementEventSubjectId(
        movementEvent({ targetId: undefined, data: { action: "grapple" } }),
      ),
    ).toBeNull();
  });

  it("returns null for a movement event with an unknown action and no subject", () => {
    expect(
      getMovementEventSubjectId(
        movementEvent({ actorId: undefined, data: { action: "teleport" } }),
      ),
    ).toBeNull();
  });

  it("returns null for an unknown action even with valid actor and target (Phase 3D1.1)", () => {
    expect(
      getMovementEventSubjectId(movementEvent({ data: { action: "teleport" } })),
    ).toBeNull();
    expect(
      getMovementEventSubjectId(movementEvent({ data: { action: "dash" } })),
    ).toBeNull();
  });

  it("returns null for an empty-string action", () => {
    expect(getMovementEventSubjectId(movementEvent({ data: { action: "" } }))).toBeNull();
  });

  it("returns null for a missing action", () => {
    expect(getMovementEventSubjectId(movementEvent({ data: {} }))).toBeNull();
  });

  it("returns null for a null action", () => {
    expect(
      getMovementEventSubjectId(movementEvent({ data: { action: null } })),
    ).toBeNull();
  });

  it("returns null for a numeric action", () => {
    expect(getMovementEventSubjectId(movementEvent({ data: { action: 42 } }))).toBeNull();
  });

  it("returns null for a known normal action without an actor", () => {
    expect(
      getMovementEventSubjectId(
        movementEvent({ actorId: undefined, data: { action: "advance" } }),
      ),
    ).toBeNull();
    expect(
      getMovementEventSubjectId(
        movementEvent({ actorId: undefined, data: { action: "hold" } }),
      ),
    ).toBeNull();
  });

  it("returns null for knockback or grapple without a target", () => {
    expect(
      getMovementEventSubjectId(
        movementEvent({ targetId: undefined, data: { action: "knockback" } }),
      ),
    ).toBeNull();
    expect(
      getMovementEventSubjectId(
        movementEvent({ targetId: undefined, data: { action: "grapple" } }),
      ),
    ).toBeNull();
  });

  it("returns null for a non-movement event carrying movement-like data", () => {
    expect(
      getMovementEventSubjectId({
        schemaVersion: "1",
        sequence: 0,
        round: 1,
        timestampMs: 0,
        type: "attack_attempted",
        actorId: "fighter_a",
        targetId: "fighter_b",
        data: { from: "south", to: "center", facing: "north", action: "advance" },
      }),
    ).toBeNull();
  });

  it("returns null for an object action value", () => {
    expect(getMovementEventSubjectId(movementEvent({ data: { action: {} } }))).toBeNull();
  });

  it("returns null for non-movement events", () => {
    expect(
      getMovementEventSubjectId({
        schemaVersion: "1",
        sequence: 0,
        round: 1,
        timestampMs: 0,
        type: "attack_hit",
        actorId: "fighter_a",
        targetId: "fighter_b",
        data: {},
      }),
    ).toBeNull();
  });

  it("never mutates the source event", () => {
    const event = movementEvent({
      data: { from: "center", to: "east", action: "knockback" },
    });
    const snapshot = JSON.stringify(event);
    getMovementEventSubjectId(event);
    expect(JSON.stringify(event)).toBe(snapshot);
  });
});

describe("isMovementEventAction (Phase 3D1.1)", () => {
  it("accepts exactly the canonical movement-event actions", () => {
    for (const action of [
      "advance",
      "retreat",
      "circle_left",
      "circle_right",
      "hold",
      "knockback",
      "grapple",
    ]) {
      expect(isMovementEventAction(action), action).toBe(true);
    }
  });

  it("rejects non-canonical values", () => {
    for (const value of [
      "teleport",
      "dash",
      "",
      null,
      undefined,
      42,
      {},
      [],
      "Advance",
    ]) {
      expect(isMovementEventAction(value), String(value)).toBe(false);
    }
  });
});
