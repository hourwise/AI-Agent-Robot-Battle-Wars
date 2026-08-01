import { describe, it, expect } from "vitest";
import {
  getInitialState,
  getStateAfterEvents,
  getRoundEndState,
  populateHighlightStates,
} from "../../src/replay/ascii/state-reconstructor.js";
import type {
  AsciiReplayInput,
  HighlightMoment,
} from "../../src/replay/ascii/ascii.types.js";
import type { SimulationEvent } from "../../src/simulator/types.js";

function makeInput(): AsciiReplayInput {
  return {
    initialState: {
      fighterA: {
        fighterId: "fighter_a",
        build: {
          proposal: {
            machineName: "Bot A",
            chassisId: "medium",
            mobilityId: "wheels",
            weaponId: "ram",
            utilityId: "none",
            armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
            designSummary: "test",
            designRationale: "test",
          },
          totalCost: 52,
          armourCost: 2,
          totalArmourPoints: 20,
          catalogueVersion: "1",
        },
        integrity: 100,
        maxIntegrity: 100,
        energy: 100,
        heat: 0,
        zone: "south_edge",
        facing: "north",
        weaponCooldown: 0,
        utilityCooldown: 0,
        armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
        components: {
          mobilityDisabled: false,
          weaponDisabled: false,
          utilityDisabled: false,
        },
        conditions: [],
      },
      fighterB: {
        fighterId: "fighter_b",
        build: {
          proposal: {
            machineName: "Bot B",
            chassisId: "medium",
            mobilityId: "wheels",
            weaponId: "hammer",
            utilityId: "none",
            armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
            designSummary: "test",
            designRationale: "test",
          },
          totalCost: 52,
          armourCost: 2,
          totalArmourPoints: 20,
          catalogueVersion: "1",
        },
        integrity: 100,
        maxIntegrity: 100,
        energy: 100,
        heat: 0,
        zone: "north_edge",
        facing: "south",
        weaponCooldown: 0,
        utilityCooldown: 0,
        armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
        components: {
          mobilityDisabled: false,
          weaponDisabled: false,
          utilityDisabled: false,
        },
        conditions: [],
      },
    },
    events: [],
  };
}

function makeEvent(overrides: Partial<SimulationEvent>): SimulationEvent {
  return {
    schemaVersion: "1",
    sequence: 0,
    round: 1,
    timestampMs: 0,
    type: "movement_resolved",
    data: {},
    ...overrides,
  };
}

describe("getInitialState", () => {
  it("returns the initial state from input", () => {
    const input = makeInput();
    const state = getInitialState(input);
    expect(state.fighterA.zone).toBe("south_edge");
    expect(state.fighterB.zone).toBe("north_edge");
  });
});

describe("integrity_damaged uses targetId", () => {
  it("damages the correct fighter based on targetId", () => {
    const input = makeInput();
    const events = [
      makeEvent({
        type: "integrity_damaged",
        actorId: "fighter_a",
        targetId: "fighter_b",
        data: { damage: 10, remaining: 90 },
      }),
    ];

    const state = getStateAfterEvents(input, events);
    expect(state.fighterA.integrity).toBe(100);
    expect(state.fighterB.integrity).toBe(90);
  });

  it("damages fighter_a when targetId is fighter_a", () => {
    const input = makeInput();
    const events = [
      makeEvent({
        type: "integrity_damaged",
        actorId: "fighter_b",
        targetId: "fighter_a",
        data: { damage: 5, remaining: 95 },
      }),
    ];

    const state = getStateAfterEvents(input, events);
    expect(state.fighterA.integrity).toBe(95);
    expect(state.fighterB.integrity).toBe(100);
  });
});

describe("robot_overturned uses targetId", () => {
  it("overturns the target, not the actor", () => {
    const input = makeInput();
    const events = [
      makeEvent({
        type: "robot_overturned",
        actorId: "fighter_a",
        targetId: "fighter_b",
        data: {},
      }),
    ];

    const state = getStateAfterEvents(input, events);
    expect(state.fighterA.conditions).not.toContain("overturned");
    expect(state.fighterB.conditions).toContain("overturned");
  });
});

describe("component_disabled uses targetId", () => {
  it("disables weapon on the target", () => {
    const input = makeInput();
    const events = [
      makeEvent({
        type: "component_disabled",
        actorId: "fighter_a",
        targetId: "fighter_b",
        data: { component: "weapon" },
      }),
    ];

    const state = getStateAfterEvents(input, events);
    expect(state.fighterA.components.weaponDisabled).toBe(false);
    expect(state.fighterB.components.weaponDisabled).toBe(true);
  });

  it("disables mobility and adds immobilised condition", () => {
    const input = makeInput();
    const events = [
      makeEvent({
        type: "component_disabled",
        actorId: "fighter_b",
        targetId: "fighter_a",
        data: { component: "mobility" },
      }),
    ];

    const state = getStateAfterEvents(input, events);
    expect(state.fighterA.components.mobilityDisabled).toBe(true);
    expect(state.fighterA.conditions).toContain("immobilised");
    expect(state.fighterB.components.mobilityDisabled).toBe(false);
  });
});

describe("robot_overheated and robot_recovered", () => {
  it("adds overheated condition on robot_overheated", () => {
    const input = makeInput();
    const events = [
      makeEvent({
        type: "robot_overheated",
        actorId: "fighter_a",
        data: { heat: 100 },
      }),
    ];

    const state = getStateAfterEvents(input, events);
    expect(state.fighterA.conditions).toContain("overheated");
    expect(state.fighterB.conditions).not.toContain("overheated");
  });

  it("removes overheated condition on robot_recovered", () => {
    const input = makeInput();
    const events = [
      makeEvent({
        type: "robot_overheated",
        actorId: "fighter_a",
        data: { heat: 100 },
      }),
      makeEvent({
        type: "robot_recovered",
        actorId: "fighter_a",
        data: { heatAfterRecovery: 70 },
      }),
    ];

    const state = getStateAfterEvents(input, events);
    expect(state.fighterA.conditions).not.toContain("overheated");
    expect(state.fighterA.heat).toBe(70);
  });
});

describe("getRoundEndState", () => {
  it("accumulates state through all events up to the round", () => {
    const input = makeInput();
    input.events = [
      makeEvent({
        type: "movement_resolved",
        round: 1,
        actorId: "fighter_a",
        data: { to: "center", facing: "north", action: "advance" },
      }),
      makeEvent({
        type: "integrity_damaged",
        round: 1,
        actorId: "fighter_b",
        targetId: "fighter_a",
        data: { damage: 20, remaining: 80 },
      }),
      makeEvent({
        type: "round_started",
        round: 2,
        data: {},
      }),
    ];

    const state = getRoundEndState(input, 1);
    expect(state).not.toBeNull();
    expect(state!.fighterA.zone).toBe("center");
    expect(state!.fighterA.integrity).toBe(80);
  });

  it("returns initial state for a round with no events", () => {
    const input = makeInput();
    const state = getRoundEndState(input, 5);
    expect(state).not.toBeNull();
    expect(state!.fighterA.zone).toBe("south_edge");
  });
});

describe("populateHighlightStates", () => {
  it("fills stateAfter for each moment", () => {
    const input = makeInput();
    const moments: HighlightMoment[] = [
      {
        type: "first_blood",
        description: "First blood",
        round: 1,
        events: [
          makeEvent({
            type: "integrity_damaged",
            round: 1,
            actorId: "fighter_a",
            targetId: "fighter_b",
            data: { damage: 10, remaining: 90 },
          }),
        ],
        stateAfter: undefined as unknown as AsciiReplayInput["initialState"],
      },
    ];

    const populated = populateHighlightStates(input, moments);
    expect(populated[0]!.stateAfter.fighterB.integrity).toBe(90);
  });
});

describe("cumulative state reconstruction (both fighters to center)", () => {
  it("shows both fighters in centre after Round 1 movements", () => {
    const input = makeInput();
    // Fighter A advances from south_edge to center
    // Fighter B advances from north_edge to center
    input.events = [
      makeEvent({
        type: "movement_resolved",
        round: 1,
        sequence: 0,
        actorId: "fighter_a",
        data: { from: "south_edge", to: "center", facing: "north", action: "advance" },
      }),
      makeEvent({
        type: "movement_resolved",
        round: 1,
        sequence: 1,
        actorId: "fighter_b",
        data: { from: "north_edge", to: "center", facing: "south", action: "advance" },
      }),
    ];

    const round1State = getStateAfterEvents(input, input.events);
    expect(round1State.fighterA.zone).toBe("center");
    expect(round1State.fighterB.zone).toBe("center");
  });

  it("retains centre positions through later highlights (Round 4 and 6)", () => {
    const input = makeInput();
    // Round 1: both advance to center
    // Rounds 2-6: various attack events, no further movement
    input.events = [
      makeEvent({
        type: "movement_resolved",
        round: 1,
        sequence: 0,
        actorId: "fighter_a",
        data: { from: "south_edge", to: "center", facing: "north", action: "advance" },
      }),
      makeEvent({
        type: "movement_resolved",
        round: 1,
        sequence: 1,
        actorId: "fighter_b",
        data: { from: "north_edge", to: "center", facing: "south", action: "advance" },
      }),
      makeEvent({
        type: "attack_hit",
        round: 2,
        sequence: 2,
        actorId: "fighter_a",
        targetId: "fighter_b",
        data: { weapon: "ram", hitZone: "front", effectiveDamage: 15, isCritical: false },
      }),
      makeEvent({
        type: "integrity_damaged",
        round: 2,
        sequence: 3,
        actorId: "fighter_a",
        targetId: "fighter_b",
        data: { damage: 15, remaining: 135 },
      }),
      makeEvent({
        type: "attack_hit",
        round: 4,
        sequence: 4,
        actorId: "fighter_b",
        targetId: "fighter_a",
        data: { weapon: "ram", hitZone: "front", effectiveDamage: 12, isCritical: false },
      }),
      makeEvent({
        type: "integrity_damaged",
        round: 4,
        sequence: 5,
        actorId: "fighter_b",
        targetId: "fighter_a",
        data: { damage: 12, remaining: 138 },
      }),
      makeEvent({
        type: "attack_hit",
        round: 6,
        sequence: 6,
        actorId: "fighter_a",
        targetId: "fighter_b",
        data: { weapon: "ram", hitZone: "front", effectiveDamage: 18, isCritical: true },
      }),
      makeEvent({
        type: "integrity_damaged",
        round: 6,
        sequence: 7,
        actorId: "fighter_a",
        targetId: "fighter_b",
        data: { damage: 18, remaining: 117 },
      }),
    ];

    // Get state after Round 4 events (up to sequence 5)
    const round4Events = input.events.filter((e) => e.sequence <= 5);
    const round4State = getStateAfterEvents(input, round4Events);
    expect(round4State.fighterA.zone).toBe("center");
    expect(round4State.fighterB.zone).toBe("center");

    // Get state after Round 6 events (up to sequence 7)
    const round6Events = input.events.filter((e) => e.sequence <= 7);
    const round6State = getStateAfterEvents(input, round6Events);
    expect(round6State.fighterA.zone).toBe("center");
    expect(round6State.fighterB.zone).toBe("center");
  });

  it("does not overwrite mid-round positions with opening positions", () => {
    const input = makeInput();
    input.events = [
      makeEvent({
        type: "movement_resolved",
        round: 1,
        sequence: 0,
        actorId: "fighter_a",
        data: { from: "south_edge", to: "center", facing: "north", action: "advance" },
      }),
      makeEvent({
        type: "movement_resolved",
        round: 1,
        sequence: 1,
        actorId: "fighter_b",
        data: { from: "north_edge", to: "center", facing: "south", action: "advance" },
      }),
    ];

    // getRoundEndState(1) must show both at center, not at edges
    const state = getRoundEndState(input, 1);
    expect(state!.fighterA.zone).toBe("center");
    expect(state!.fighterB.zone).toBe("center");
    // Specifically NOT the opening positions
    expect(state!.fighterA.zone).not.toBe("south_edge");
    expect(state!.fighterB.zone).not.toBe("north_edge");
  });
});

describe("malformed movement never moves either fighter in replay (Phase 3D1.1)", () => {
  const malformedActions: unknown[] = ["teleport", "", null, 42, {}, []];

  for (const action of malformedActions) {
    it(`ignores malformed action ${JSON.stringify(action)} even with actor and target`, () => {
      const input = makeInput();
      input.events = [
        makeEvent({
          type: "movement_resolved",
          round: 1,
          sequence: 0,
          actorId: "fighter_a",
          targetId: "fighter_b",
          data: { from: "south_edge", to: "center", facing: "east", action },
        }),
      ];
      const state = getStateAfterEvents(input, input.events);
      expect(state.fighterA.zone).toBe("south_edge");
      expect(state.fighterA.facing).toBe("north");
      expect(state.fighterB.zone).toBe("north_edge");
      expect(state.fighterB.facing).toBe("south");
    });
  }

  it("ignores a missing action", () => {
    const input = makeInput();
    input.events = [
      makeEvent({
        type: "movement_resolved",
        round: 1,
        sequence: 0,
        actorId: "fighter_a",
        targetId: "fighter_b",
        data: { from: "south_edge", to: "center", facing: "east" },
      }),
    ];
    const state = getStateAfterEvents(input, input.events);
    expect(state.fighterA.zone).toBe("south_edge");
    expect(state.fighterA.facing).toBe("north");
  });

  it("ignores a known normal action without an actor", () => {
    const input = makeInput();
    input.events = [
      makeEvent({
        type: "movement_resolved",
        round: 1,
        sequence: 0,
        actorId: undefined,
        targetId: "fighter_b",
        data: { from: "south_edge", to: "center", facing: "east", action: "advance" },
      }),
    ];
    const state = getStateAfterEvents(input, input.events);
    expect(state.fighterA.zone).toBe("south_edge");
    expect(state.fighterB.zone).toBe("north_edge");
  });

  it("ignores knockback without a target", () => {
    const input = makeInput();
    input.events = [
      makeEvent({
        type: "movement_resolved",
        round: 1,
        sequence: 0,
        actorId: "fighter_a",
        targetId: undefined,
        data: { from: "north_edge", to: "center", facing: "south", action: "knockback" },
      }),
    ];
    const state = getStateAfterEvents(input, input.events);
    expect(state.fighterB.zone).toBe("north_edge");
    expect(state.fighterB.facing).toBe("south");
  });

  it("ignores a non-movement event carrying movement-like data", () => {
    const input = makeInput();
    input.events = [
      makeEvent({
        type: "attack_attempted",
        round: 1,
        sequence: 0,
        actorId: "fighter_a",
        targetId: "fighter_b",
        data: { from: "south_edge", to: "center", facing: "east", action: "advance" },
      }),
    ];
    const state = getStateAfterEvents(input, input.events);
    expect(state.fighterA.zone).toBe("south_edge");
    expect(state.fighterA.facing).toBe("north");
  });

  it("never silently reinterprets an unknown action as hold", () => {
    const input = makeInput();
    input.events = [
      makeEvent({
        type: "movement_resolved",
        round: 1,
        sequence: 0,
        actorId: "fighter_a",
        targetId: "fighter_b",
        data: {
          from: "south_edge",
          to: "south_edge",
          facing: "west",
          action: "teleport",
        },
      }),
    ];
    const state = getStateAfterEvents(input, input.events);
    expect(state.fighterA.zone).toBe("south_edge");
    expect(state.fighterA.facing).toBe("north");
  });
});
