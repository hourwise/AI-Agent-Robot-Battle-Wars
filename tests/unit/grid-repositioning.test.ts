import { describe, expect, it } from "vitest";
import {
  resolveGridKnockback,
  resolveGridGrapple,
} from "../../src/simulator/grid-runtime.js";
import { getStateAfterEvents } from "../../src/replay/ascii/state-reconstructor.js";
import type { AsciiReplayInput } from "../../src/replay/ascii/ascii.types.js";
import type { SimulationEvent } from "../../src/simulator/types.js";
import { V3_FIXTURE_BUILD, V3_FIXTURE_POLICY } from "../fixtures/v3-match-record.js";

function visual(zone: string, facing: string) {
  return {
    fighterId: "fighter",
    build: V3_FIXTURE_BUILD,
    integrity: 100,
    maxIntegrity: 100,
    energy: 100,
    heat: 0,
    zone,
    facing,
    weaponCooldown: 0,
    utilityCooldown: 0,
    armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
    components: {
      mobilityDisabled: false,
      weaponDisabled: false,
      utilityDisabled: false,
      mobilityDamaged: false,
      weaponDamaged: false,
      utilityDamaged: false,
    },
    conditions: [] as string[],
  };
}

function makeInput(events: readonly SimulationEvent[]): AsciiReplayInput {
  return {
    config: {
      seed: 7,
      fighterA: { build: V3_FIXTURE_BUILD, policy: V3_FIXTURE_POLICY },
      fighterB: { build: V3_FIXTURE_BUILD, policy: V3_FIXTURE_POLICY },
      rulesetVersion: "0.2.0",
      catalogueVersion: "1",
    },
    initialState: {
      fighterA: visual("south", "north"),
      fighterB: visual("north", "south"),
    },
    events: [...events],
    result: { winner: null, loser: null, method: "draw" },
    rounds: 1,
  };
}

describe("grid knockback", () => {
  it("knocks orthogonally to the greatest-distance neighbour", () => {
    // Defender at center, attacker directly north: east is the first
    // greatest-distance neighbour in north→east→south→west order.
    expect(resolveGridKnockback("north", "south", "center")).toBe("east");
    // Attacker directly south: north is the first greatest-distance neighbour.
    expect(resolveGridKnockback("south", "north", "center")).toBe("north");
  });

  it("resolves diagonal-relative knockback ties deterministically", () => {
    // Defender at east, attacker at north: south_east is strictly further.
    expect(resolveGridKnockback("north", "south", "east")).toBe("south_east");
    // Defender at center, attacker at north_west: east is first at distance 2.
    expect(resolveGridKnockback("north_west", "south", "center")).toBe("east");
  });

  it("knocks a same-cell defender one step in the attacker's facing", () => {
    expect(resolveGridKnockback("center", "north", "center")).toBe("north");
    expect(resolveGridKnockback("center", "east", "center")).toBe("east");
  });

  it("falls back to the first valid neighbour when the facing step leaves the arena", () => {
    // Attacker and defender share north; stepping north leaves the arena, so
    // the first valid neighbour in north→east→south→west order is north_east.
    expect(resolveGridKnockback("north", "north", "north")).toBe("north_east");
  });

  it("does not move when every candidate fails to increase distance", () => {
    // Defender at south_east is already at maximum distance from the attacker.
    expect(resolveGridKnockback("north_west", "south", "south_east")).toBeNull();
  });
});

describe("grid grapple repositioning", () => {
  it("moves the target one step toward the attacker", () => {
    expect(resolveGridGrapple("north", "center")).toBe("north");
    expect(resolveGridGrapple("south_west", "west")).toBe("south_west");
    expect(resolveGridGrapple("east", "south_east")).toBe("east");
  });

  it("does not reposition when already sharing a cell", () => {
    expect(resolveGridGrapple("center", "center")).toBeNull();
    expect(resolveGridGrapple("north", "north")).toBeNull();
  });
});

describe("grid repositioning reconstruction (targetId semantics)", () => {
  it("applies a knockback to the target fighter via targetId", () => {
    const input = makeInput([
      {
        schemaVersion: "1",
        sequence: 0,
        round: 1,
        timestampMs: 0,
        type: "movement_resolved",
        actorId: "fighter_a",
        targetId: "fighter_b",
        data: { from: "north", to: "north_west", facing: "south", action: "knockback" },
      },
    ]);
    const state = getStateAfterEvents(input, input.events, "grid-3x3-v1");
    expect(state.fighterA.zone).toBe("south");
    expect(state.fighterB.zone).toBe("north_west");
  });

  it("applies a grapple reposition to the target fighter via targetId", () => {
    const input = makeInput([
      {
        schemaVersion: "1",
        sequence: 0,
        round: 1,
        timestampMs: 0,
        type: "movement_resolved",
        actorId: "fighter_a",
        targetId: "fighter_b",
        data: { from: "north", to: "center", facing: "south", action: "grapple" },
      },
    ]);
    const state = getStateAfterEvents(input, input.events, "grid-3x3-v1");
    expect(state.fighterA.zone).toBe("south");
    expect(state.fighterB.zone).toBe("center");
  });

  it("rejects legacy edge values in grid reconstruction events", () => {
    const input = makeInput([
      {
        schemaVersion: "1",
        sequence: 0,
        round: 1,
        timestampMs: 0,
        type: "movement_resolved",
        actorId: "fighter_a",
        targetId: "fighter_b",
        data: { from: "north", to: "north_edge", facing: "south", action: "knockback" },
      },
    ]);
    expect(() => getStateAfterEvents(input, input.events, "grid-3x3-v1")).toThrow(
      /non-grid zone/,
    );
  });
});
