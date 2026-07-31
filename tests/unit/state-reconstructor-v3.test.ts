import { describe, expect, it } from "vitest";
import {
  getInitialState,
  getStateAfterEvents,
} from "../../src/replay/ascii/state-reconstructor.js";
import type { AsciiReplayInput } from "../../src/replay/ascii/ascii.types.js";
import type { SimulationEvent } from "../../src/simulator/types.js";
import { GRID_ZONES } from "../../src/simulator/arena-grid.js";
import { V3_FIXTURE_BUILD, V3_FIXTURE_POLICY } from "../fixtures/v3-match-record.js";

function makeVisualFighter(zone: string, facing: string) {
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

function makeInput(
  zoneA: string,
  zoneB: string,
  events: readonly SimulationEvent[] = [],
): AsciiReplayInput {
  return {
    config: {
      seed: 7,
      fighterA: { build: V3_FIXTURE_BUILD, policy: V3_FIXTURE_POLICY },
      fighterB: { build: V3_FIXTURE_BUILD, policy: V3_FIXTURE_POLICY },
      rulesetVersion: "0.3.0",
      catalogueVersion: "1",
    },
    initialState: {
      fighterA: makeVisualFighter(zoneA, "north"),
      fighterB: makeVisualFighter(zoneB, "south"),
    },
    events: [...events],
    result: { winner: null, loser: null, method: "draw" },
    rounds: 1,
  };
}

function movementEvent(
  sequence: number,
  overrides: Partial<SimulationEvent> = {},
): SimulationEvent {
  return {
    schemaVersion: "1",
    sequence,
    round: 1,
    timestampMs: 0,
    type: "movement_resolved",
    data: {},
    ...overrides,
  };
}

describe("v3 grid state reconstruction", () => {
  it("reconstructs every one of the nine grid initial zones", () => {
    for (const zone of GRID_ZONES) {
      const input = makeInput(zone, "center");
      const state = getInitialState(input, "grid-3x3-v1");
      expect(state.fighterA.zone).toBe(zone);
    }
  });

  it("rejects legacy edge values in grid initial zones", () => {
    const input = makeInput("north_edge", "center");
    expect(() => getInitialState(input, "grid-3x3-v1")).toThrow(/non-grid zone/);
  });

  it("tracks v3 movement through corners, edges and center", () => {
    const input = makeInput("north_west", "south_east", [
      movementEvent(0, {
        actorId: "fighter_a",
        data: { from: "north_west", to: "north", facing: "north", action: "advance" },
      }),
      movementEvent(1, {
        actorId: "fighter_a",
        data: { from: "north", to: "center", facing: "south", action: "advance" },
      }),
      movementEvent(2, {
        actorId: "fighter_b",
        data: { from: "south_east", to: "east", facing: "north", action: "advance" },
      }),
      movementEvent(3, {
        actorId: "fighter_a",
        data: { from: "center", to: "west", facing: "west", action: "advance" },
      }),
    ]);
    const state = getStateAfterEvents(input, input.events, "grid-3x3-v1");
    expect(state.fighterA.zone).toBe("west");
    expect(state.fighterB.zone).toBe("east");
    expect(state.fighterA.facing).toBe("west");
    expect(state.fighterB.facing).toBe("north");
  });

  it("supports same-cell grid occupancy through reconstruction", () => {
    const input = makeInput("center", "center");
    const state = getInitialState(input, "grid-3x3-v1");
    expect(state.fighterA.zone).toBe("center");
    expect(state.fighterB.zone).toBe("center");
  });

  it("handles knockback actor/target semantics", () => {
    const input = makeInput("north", "south", [
      movementEvent(0, {
        type: "movement_resolved",
        actorId: "fighter_a",
        targetId: "fighter_b",
        data: { from: "south", to: "south_west", facing: "south", action: "knockback" },
      }),
    ]);
    const state = getStateAfterEvents(input, input.events, "grid-3x3-v1");
    // The knockback moves the target (fighter_b), not the actor.
    expect(state.fighterA.zone).toBe("north");
    expect(state.fighterB.zone).toBe("south_west");
  });

  it("rejects mixed legacy/grid movement event values in grid mode", () => {
    const input = makeInput("center", "center", [
      movementEvent(0, {
        actorId: "fighter_a",
        data: { from: "center", to: "north_edge", facing: "north", action: "advance" },
      }),
    ]);
    expect(() => getStateAfterEvents(input, input.events, "grid-3x3-v1")).toThrow(
      /non-grid zone/,
    );
  });

  it("rejects a legacy movement source in grid mode", () => {
    const input = makeInput("center", "center", [
      movementEvent(0, {
        actorId: "fighter_a",
        data: { from: "south_edge", to: "center", facing: "north", action: "advance" },
      }),
    ]);
    expect(() => getStateAfterEvents(input, input.events, "grid-3x3-v1")).toThrow(
      /non-grid zone/,
    );
  });

  it("preserves legacy reconstruction behaviour without a model argument", () => {
    const input = makeInput("south_edge", "north_edge", [
      movementEvent(0, {
        actorId: "fighter_a",
        data: { from: "south_edge", to: "center", facing: "north", action: "advance" },
      }),
    ]);
    const state = getStateAfterEvents(input, input.events);
    expect(state.fighterA.zone).toBe("center");
    expect(state.fighterB.zone).toBe("north_edge");
  });
});
