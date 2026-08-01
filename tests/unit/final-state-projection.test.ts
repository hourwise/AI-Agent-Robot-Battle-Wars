import { describe, expect, it } from "vitest";
import { projectFinalFighterState } from "../../src/reports/final-state-projection.js";
import { createZoneFighterState } from "../../src/simulator/simulator.js";
import { V3_FIXTURE_BUILD } from "../fixtures/v3-match-record.js";
import type { GridFighterState, SimulationEvent } from "../../src/simulator/types.js";

function gridFighter(zone: GridFighterState["zone"], id = "fighter_a") {
  return createZoneFighterState(V3_FIXTURE_BUILD, id, zone, "north");
}

function movement(overrides: Partial<SimulationEvent> = {}): SimulationEvent {
  return {
    schemaVersion: "1",
    sequence: 0,
    round: 1,
    timestampMs: 0,
    type: "movement_resolved",
    actorId: "fighter_a",
    targetId: "fighter_b",
    data: { from: "south", to: "south_west", facing: "north", action: "circle_left" },
    ...overrides,
  };
}

function roundEnd(
  fighterA: Record<string, unknown>,
  fighterB: Record<string, unknown>,
  round = 1,
): SimulationEvent {
  return {
    schemaVersion: "1",
    sequence: 100,
    round,
    timestampMs: round * 1000,
    type: "round_ended",
    data: { fighterA, fighterB },
  };
}

function componentEvent(
  type: "component_damaged" | "component_disabled" | "component_damage_resisted",
  component: string,
  overrides: Record<string, unknown> = {},
): SimulationEvent {
  return {
    schemaVersion: "1",
    sequence: 0,
    round: 1,
    timestampMs: 0,
    type,
    actorId: "fighter_a",
    targetId: "fighter_b",
    data: {
      component,
      newState: type === "component_damaged" ? "damaged" : "disabled",
      ...overrides,
    },
  };
}

describe("final-state projection (Phase 3D1)", () => {
  it("updates the actor zone on advance, retreat and translated circle", () => {
    const initial = gridFighter("south");
    for (const [action, to] of [
      ["advance", "center"],
      ["retreat", "south_west"],
      ["circle_left", "south_west"],
      ["circle_right", "south_east"],
    ] as const) {
      const state = projectFinalFighterState(
        initial,
        [movement({ data: { from: "south", to, facing: "north", action } })],
        "fighter_a",
        "grid-3x3-v1",
      );
      expect(state.zone, action).toBe(to);
    }
  });

  it("updates the actor facing on a translated circle", () => {
    const state = projectFinalFighterState(
      gridFighter("south"),
      [
        movement({
          data: {
            from: "south",
            to: "south_west",
            facing: "north",
            action: "circle_left",
          },
        }),
      ],
      "fighter_a",
      "grid-3x3-v1",
    );
    expect(state.zone).toBe("south_west");
    expect(state.facing).toBe("north");
  });

  it("keeps the zone and only updates facing for a facing-only circle", () => {
    const state = projectFinalFighterState(
      gridFighter("center"),
      [
        movement({
          data: { from: "center", to: "center", facing: "west", action: "circle_left" },
        }),
      ],
      "fighter_a",
      "grid-3x3-v1",
    );
    expect(state.zone).toBe("center");
    expect(state.facing).toBe("west");
  });

  it("repositions the target on knockback", () => {
    const state = projectFinalFighterState(
      gridFighter("center", "fighter_b"),
      [
        movement({
          actorId: "fighter_a",
          targetId: "fighter_b",
          data: { from: "center", to: "east", facing: "south", action: "knockback" },
        }),
      ],
      "fighter_b",
      "grid-3x3-v1",
    );
    expect(state.zone).toBe("east");
  });

  it("repositions the target on grapple", () => {
    const state = projectFinalFighterState(
      gridFighter("north", "fighter_b"),
      [
        movement({
          actorId: "fighter_a",
          targetId: "fighter_b",
          data: { from: "north", to: "center", facing: "south", action: "grapple" },
        }),
      ],
      "fighter_b",
      "grid-3x3-v1",
    );
    expect(state.zone).toBe("center");
  });

  it("moves nothing for a malformed movement event without a subject", () => {
    const initial = gridFighter("south");
    const state = projectFinalFighterState(
      initial,
      [
        movement({
          actorId: undefined,
          targetId: undefined,
          data: {
            from: "south",
            to: "south_west",
            facing: "north",
            action: "circle_left",
          },
        }),
      ],
      "fighter_a",
      "grid-3x3-v1",
    );
    expect(state.zone).toBe("south");
  });

  it("applies simultaneous movement for both fighters from shared events", () => {
    const events: SimulationEvent[] = [
      movement({
        actorId: "fighter_a",
        data: { from: "south", to: "center", facing: "north", action: "advance" },
      }),
      movement({
        actorId: "fighter_b",
        data: { from: "north", to: "center", facing: "south", action: "advance" },
      }),
    ];
    const stateA = projectFinalFighterState(
      gridFighter("south", "fighter_a"),
      events,
      "fighter_a",
      "grid-3x3-v1",
    );
    const stateB = projectFinalFighterState(
      gridFighter("north", "fighter_b"),
      events,
      "fighter_b",
      "grid-3x3-v1",
    );
    expect(stateA.zone).toBe("center");
    expect(stateB.zone).toBe("center");
  });

  it("respects latest authoritative round-end facts", () => {
    const events: SimulationEvent[] = [
      roundEnd(
        { integrity: 90, energy: 70, heat: 25, zone: "west", conditions: ["overturned"] },
        { integrity: 100, energy: 60, heat: 5, zone: "north", conditions: [] },
        1,
      ),
      roundEnd(
        { integrity: 80, energy: 55, heat: 40, zone: "west", conditions: ["overturned"] },
        {
          integrity: 95,
          energy: 50,
          heat: 10,
          zone: "east",
          conditions: ["immobilised"],
        },
        2,
      ),
    ];
    const state = projectFinalFighterState(
      gridFighter("south"),
      events,
      "fighter_a",
      "grid-3x3-v1",
    );
    expect(state.integrity).toBe(80);
    expect(state.energy).toBe(55);
    expect(state.heat).toBe(40);
    expect(state.zone).toBe("west");
    expect(state.conditions).toEqual(["overturned"]);
  });

  it("applies component damaged and disabled transitions", () => {
    const events: SimulationEvent[] = [
      componentEvent("component_damaged", "mobility"),
      componentEvent("component_disabled", "weapon"),
    ];
    const state = projectFinalFighterState(
      gridFighter("south", "fighter_b"),
      events,
      "fighter_b",
      "grid-3x3-v1",
    );
    expect(state.comps.mobility.state).toBe("damaged");
    expect(state.comps.weapon.state).toBe("disabled");
    expect(state.components.weaponDisabled).toBe(true);
    expect(state.components.mobilityDisabled).toBe(false);
  });

  it("applies mobility-disable immobilisation", () => {
    const events: SimulationEvent[] = [componentEvent("component_disabled", "mobility")];
    const state = projectFinalFighterState(
      gridFighter("south", "fighter_b"),
      events,
      "fighter_b",
      "grid-3x3-v1",
    );
    expect(state.comps.mobility.state).toBe("disabled");
    expect(state.components.mobilityDisabled).toBe(true);
    expect(state.conditions).toContain("immobilised");
  });

  it("applies reinforced-drive guard consumption", () => {
    const initial = gridFighter("south", "fighter_b");
    const guarded = {
      ...initial,
      comps: {
        ...initial.comps,
        utility: {
          ...initial.comps.utility,
          reinforcedDriveGuard: "available" as const,
        },
      },
    };
    const state = projectFinalFighterState(
      guarded,
      [
        componentEvent("component_damage_resisted", "utility", {
          guardStateAfter: "spent",
        }),
      ],
      "fighter_b",
      "grid-3x3-v1",
    );
    expect(state.comps.utility.reinforcedDriveGuard).toBe("spent");
  });

  it("applies overheated then recovered conditions and heat", () => {
    const events: SimulationEvent[] = [
      {
        schemaVersion: "1",
        sequence: 1,
        round: 1,
        timestampMs: 0,
        type: "robot_overheated",
        actorId: "fighter_a",
        data: { heat: 100 },
      },
      {
        schemaVersion: "1",
        sequence: 2,
        round: 2,
        timestampMs: 1000,
        type: "robot_recovered",
        actorId: "fighter_a",
        data: { heatAfterRecovery: 30 },
      },
    ];
    const state = projectFinalFighterState(
      gridFighter("south"),
      events,
      "fighter_a",
      "grid-3x3-v1",
    );
    expect(state.conditions).not.toContain("overheated");
    expect(state.heat).toBe(30);
  });

  it("rejects a legacy edge zone in grid mode", () => {
    expect(() =>
      projectFinalFighterState(
        gridFighter("south"),
        [
          movement({
            data: { from: "south", to: "north_edge", facing: "north", action: "advance" },
          }),
        ],
        "fighter_a",
        "grid-3x3-v1",
      ),
    ).toThrow(/non-grid zone/);
  });

  it("rejects a grid corner zone in legacy mode", () => {
    expect(() =>
      projectFinalFighterState(
        createZoneFighterState(V3_FIXTURE_BUILD, "fighter_a", "south_edge", "north"),
        [
          movement({
            data: {
              from: "south_edge",
              to: "north_east",
              facing: "north",
              action: "advance",
            },
          }),
        ],
        "fighter_a",
        "legacy-five-zone-v1",
      ),
    ).toThrow(/non-legacy zone/);
  });

  it("does not mutate the input state or events", () => {
    const initial = gridFighter("south");
    const initialSnapshot = JSON.stringify(initial);
    const events: SimulationEvent[] = [
      componentEvent("component_disabled", "mobility"),
      movement({
        data: { from: "south", to: "center", facing: "north", action: "advance" },
      }),
    ];
    const eventsSnapshot = JSON.stringify(events);
    projectFinalFighterState(initial, events, "fighter_a", "grid-3x3-v1");
    expect(JSON.stringify(initial)).toBe(initialSnapshot);
    expect(JSON.stringify(events)).toBe(eventsSnapshot);
  });
});

describe("malformed movement never moves a fighter (Phase 3D1.1)", () => {
  const malformedActions: unknown[] = ["teleport", "", null, 42, {}, []];

  for (const action of malformedActions) {
    it(`does not move on malformed action ${JSON.stringify(action)} even with actor and target`, () => {
      const initial = gridFighter("south");
      const state = projectFinalFighterState(
        initial,
        [
          movement({
            actorId: "fighter_a",
            targetId: "fighter_b",
            data: {
              from: "south",
              to: "center",
              facing: "east",
              action,
            },
          }),
        ],
        "fighter_a",
        "grid-3x3-v1",
      );
      expect(state.zone).toBe("south");
      expect(state.facing).toBe("north");
    });
  }

  it("does not move on a missing action", () => {
    const initial = gridFighter("south");
    const state = projectFinalFighterState(
      initial,
      [movement({ actorId: "fighter_a", data: { from: "south", to: "center" } })],
      "fighter_a",
      "grid-3x3-v1",
    );
    expect(state.zone).toBe("south");
    expect(state.facing).toBe("north");
  });

  it("does not move on a known normal action without an actor", () => {
    const initial = gridFighter("south");
    const state = projectFinalFighterState(
      initial,
      [
        movement({
          actorId: undefined,
          targetId: "fighter_b",
          data: { from: "south", to: "center", facing: "east", action: "advance" },
        }),
      ],
      "fighter_a",
      "grid-3x3-v1",
    );
    expect(state.zone).toBe("south");
    expect(state.facing).toBe("north");
  });

  it("does not move on knockback without a target", () => {
    const initial = gridFighter("center", "fighter_b");
    const state = projectFinalFighterState(
      initial,
      [
        movement({
          actorId: "fighter_a",
          targetId: undefined,
          data: { from: "center", to: "east", facing: "south", action: "knockback" },
        }),
      ],
      "fighter_b",
      "grid-3x3-v1",
    );
    expect(state.zone).toBe("center");
    expect(state.facing).toBe("north");
  });

  it("does not move on a non-movement event carrying movement-like data", () => {
    const initial = gridFighter("south");
    const state = projectFinalFighterState(
      initial,
      [
        {
          schemaVersion: "1",
          sequence: 0,
          round: 1,
          timestampMs: 0,
          type: "attack_attempted",
          actorId: "fighter_a",
          targetId: "fighter_b",
          data: { from: "south", to: "center", facing: "east", action: "advance" },
        },
      ],
      "fighter_a",
      "grid-3x3-v1",
    );
    expect(state.zone).toBe("south");
    expect(state.facing).toBe("north");
  });

  it("never silently reinterprets an unknown action as hold", () => {
    const initial = gridFighter("south");
    const state = projectFinalFighterState(
      initial,
      [
        movement({
          actorId: "fighter_a",
          data: { from: "south", to: "south", facing: "west", action: "teleport" },
        }),
      ],
      "fighter_a",
      "grid-3x3-v1",
    );
    expect(state.zone).toBe("south");
    expect(state.facing).toBe("north");
  });
});

describe("movement facing validation (Phase 3D1.1)", () => {
  it("rejects a present but invalid facing in grid mode", () => {
    expect(() =>
      projectFinalFighterState(
        gridFighter("south"),
        [
          movement({
            data: { from: "south", to: "center", facing: "northwest", action: "advance" },
          }),
        ],
        "fighter_a",
        "grid-3x3-v1",
      ),
    ).toThrow(/invalid movement facing/);
  });

  it("rejects a present but invalid facing in legacy mode", () => {
    expect(() =>
      projectFinalFighterState(
        createZoneFighterState(V3_FIXTURE_BUILD, "fighter_a", "south_edge", "north"),
        [
          movement({
            data: {
              from: "south_edge",
              to: "center",
              facing: "up",
              action: "advance",
            },
          }),
        ],
        "fighter_a",
        "legacy-five-zone-v1",
      ),
    ).toThrow(/invalid movement facing/);
  });

  it("preserves the current facing when the facing field is genuinely absent", () => {
    const initial = gridFighter("south");
    const state = projectFinalFighterState(
      initial,
      [
        movement({
          data: { from: "south", to: "center", action: "advance" },
        }),
      ],
      "fighter_a",
      "grid-3x3-v1",
    );
    expect(state.zone).toBe("center");
    expect(state.facing).toBe("north");
  });

  it("accepts every cardinal facing", () => {
    for (const facing of ["north", "east", "south", "west"]) {
      const state = projectFinalFighterState(
        gridFighter("south"),
        [
          movement({
            data: { from: "south", to: "center", facing, action: "advance" },
          }),
        ],
        "fighter_a",
        "grid-3x3-v1",
      );
      expect(state.facing, facing).toBe(facing);
    }
  });
});

describe("round-end condition validation (Phase 3D1.1)", () => {
  it("rejects non-array round_ended conditions", () => {
    expect(() =>
      projectFinalFighterState(
        gridFighter("south"),
        [
          roundEnd(
            {
              integrity: 90,
              energy: 70,
              heat: 25,
              zone: "west",
              conditions: "overturned",
            },
            { integrity: 100, energy: 60, heat: 5, zone: "north", conditions: [] },
            1,
          ),
        ],
        "fighter_a",
        "grid-3x3-v1",
      ),
    ).toThrow(/non-array round_ended conditions/);
  });

  it("rejects an unknown condition string in grid mode", () => {
    expect(() =>
      projectFinalFighterState(
        gridFighter("south"),
        [
          roundEnd(
            {
              integrity: 90,
              energy: 70,
              heat: 25,
              zone: "west",
              conditions: ["on_fire"],
            },
            { integrity: 100, energy: 60, heat: 5, zone: "north", conditions: [] },
            1,
          ),
        ],
        "fighter_a",
        "grid-3x3-v1",
      ),
    ).toThrow(/non-canonical round_ended condition/);
  });

  it("rejects an unknown condition string in legacy mode", () => {
    expect(() =>
      projectFinalFighterState(
        createZoneFighterState(V3_FIXTURE_BUILD, "fighter_a", "south_edge", "north"),
        [
          roundEnd(
            {
              integrity: 90,
              energy: 70,
              heat: 25,
              zone: "south_edge",
              conditions: ["stunned", "blessed"],
            },
            { integrity: 100, energy: 60, heat: 5, zone: "north_edge", conditions: [] },
            1,
          ),
        ],
        "fighter_a",
        "legacy-five-zone-v1",
      ),
    ).toThrow(/non-canonical round_ended condition/);
  });

  it("preserves deterministic ordering of copied conditions", () => {
    const state = projectFinalFighterState(
      gridFighter("south"),
      [
        roundEnd(
          {
            integrity: 90,
            energy: 70,
            heat: 25,
            zone: "west",
            conditions: ["overheated", "overturned", "stunned"],
          },
          { integrity: 100, energy: 60, heat: 5, zone: "north", conditions: [] },
          1,
        ),
      ],
      "fighter_a",
      "grid-3x3-v1",
    );
    expect(state.conditions).toEqual(["overheated", "overturned", "stunned"]);
  });
});

describe("projection isolation (Phase 3D1.1)", () => {
  it("mutating the returned conditions array does not modify the source round_ended event", () => {
    const conditionsA = ["overturned"];
    const conditionsB: string[] = [];
    const events = [
      roundEnd(
        { integrity: 90, energy: 70, heat: 25, zone: "west", conditions: conditionsA },
        { integrity: 100, energy: 60, heat: 5, zone: "north", conditions: conditionsB },
        1,
      ),
    ];
    const state = projectFinalFighterState(
      gridFighter("south"),
      events,
      "fighter_a",
      "grid-3x3-v1",
    );
    state.conditions.push("immobilised");
    expect(conditionsA).toEqual(["overturned"]);
  });

  it("mutating the source event after projection does not modify the projected state", () => {
    const events = [
      roundEnd(
        { integrity: 90, energy: 70, heat: 25, zone: "west", conditions: ["overturned"] },
        { integrity: 100, energy: 60, heat: 5, zone: "north", conditions: [] },
        1,
      ),
    ];
    const state = projectFinalFighterState(
      gridFighter("south"),
      events,
      "fighter_a",
      "grid-3x3-v1",
    );
    const data = events[0]!.data as {
      fighterA: { integrity: number; conditions: string[] };
    };
    data.fighterA.integrity = 1;
    data.fighterA.conditions.push("stunned");
    expect(state.integrity).toBe(90);
    expect(state.conditions).toEqual(["overturned"]);
  });

  it("mutating returned component state does not modify the initial state", () => {
    const initial = gridFighter("south");
    const state = projectFinalFighterState(
      initial,
      [componentEvent("component_damaged", "mobility")],
      "fighter_b",
      "grid-3x3-v1",
    );
    state.comps.mobility.state = "disabled";
    state.comps.utility.reinforcedDriveGuard = "spent";
    expect(initial.comps.mobility.state).toBe("healthy");
    expect(initial.comps.utility.reinforcedDriveGuard).toBeUndefined();
  });

  it("mutating the initial state after projection does not modify the result", () => {
    const initial = gridFighter("south");
    const state = projectFinalFighterState(initial, [], "fighter_a", "grid-3x3-v1");
    initial.integrity = 1;
    initial.zone = "north";
    initial.facing = "west";
    initial.conditions.push("stunned");
    initial.armour.front = 99;
    initial.comps.weapon.state = "disabled";
    initial.build.proposal.machineName = "Mutated";
    expect(state.integrity).toBe(100);
    expect(state.zone).toBe("south");
    expect(state.facing).toBe("north");
    expect(state.conditions).toEqual([]);
    expect(state.armour.front).toBe(10);
    expect(state.comps.weapon.state).toBe("healthy");
    expect(state.build.proposal.machineName).toBe("Grid Bot A");
  });
});
