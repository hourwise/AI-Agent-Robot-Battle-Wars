import { describe, expect, it } from "vitest";
import {
  chooseGridFlankMovement,
  resolveDesiredFlankTarget,
  scoreGridFlankPosition,
} from "../../src/simulator/grid-lateral.js";
import { deriveGridAction } from "../../src/simulator/actions.js";
import { createZoneFighterState } from "../../src/simulator/simulator.js";
import { SeededRandom } from "../../src/simulator/seeded-random.js";
import { V3_FIXTURE_BUILD } from "../fixtures/v3-match-record.js";
import type {
  ActionPolicy,
  GridFighterState,
  RoundAction,
} from "../../src/simulator/types.js";

class CountingRandom extends SeededRandom {
  public draws = 0;
  next(): number {
    this.draws += 1;
    return super.next();
  }
}

function makeFighter(
  zone: GridFighterState["zone"],
  facing: GridFighterState["facing"] = "north",
  overrides: Partial<GridFighterState> = {},
): GridFighterState {
  return {
    ...createZoneFighterState(V3_FIXTURE_BUILD, "fighter_a", zone, facing),
    ...overrides,
  };
}

function makePolicy(overrides: Partial<ActionPolicy> = {}): ActionPolicy {
  return {
    opening: "flank",
    preferredRange: "medium",
    aggression: 60,
    primaryTarget: "rear",
    secondaryTarget: "rear",
    retreatThreshold: 20,
    heatThreshold: 80,
    fallback: "defend",
    ...overrides,
  };
}

describe("grid flank-policy movement (Phase 3C)", () => {
  it("advances when combat proximity is far", () => {
    const movement = chooseGridFlankMovement(
      makeFighter("south"),
      makeFighter("north", "south"),
      makePolicy(),
    );
    expect(movement).toBe("advance");
  });

  it("holds when sharing a cell", () => {
    const movement = chooseGridFlankMovement(
      makeFighter("center"),
      makeFighter("center", "south"),
      makePolicy(),
    );
    expect(movement).toBe("hold");
  });

  it("chooses lateral movement at medium range", () => {
    // South of a south-facing centre opponent both lateral destinations are
    // front-diagonals with equal scores; the tie resolves to circle_left.
    const movement = chooseGridFlankMovement(
      makeFighter("south"),
      makeFighter("center", "south"),
      makePolicy(),
    );
    expect(movement).toBe("circle_left");
  });

  it("can choose lateral movement at close but non-same-cell range", () => {
    // North_east of a centre opponent facing east (Chebyshev close).
    const movement = chooseGridFlankMovement(
      makeFighter("north_east"),
      makeFighter("center", "east"),
      makePolicy({ preferredRange: "medium" }),
    );
    expect(movement).toBe("circle_right");
  });

  it("selects the direction that improves rear exposure", () => {
    // West of a north-facing centre opponent: circle_right reaches south_west
    // (rear_left → rear exposed); circle_left reaches north_west (front_left,
    // no rear).
    const movement = chooseGridFlankMovement(
      makeFighter("west"),
      makeFighter("center", "north"),
      makePolicy({ primaryTarget: "rear", secondaryTarget: "rear" }),
    );
    expect(movement).toBe("circle_right");
    expect(
      scoreGridFlankPosition("south_west", "center", "north", makePolicy(), true),
    ).toBeGreaterThan(
      scoreGridFlankPosition("north_west", "center", "north", makePolicy(), true),
    );
  });

  it("selects the direction that improves left exposure", () => {
    // South of a north-facing centre opponent: circle_left reaches south_west
    // (rear_left → left exposed); circle_right reaches south_east (right).
    const movement = chooseGridFlankMovement(
      makeFighter("south"),
      makeFighter("center", "north"),
      makePolicy({ primaryTarget: "left", secondaryTarget: "rear" }),
    );
    expect(movement).toBe("circle_left");
  });

  it("selects the direction that improves right exposure", () => {
    const movement = chooseGridFlankMovement(
      makeFighter("south"),
      makeFighter("center", "north"),
      makePolicy({ primaryTarget: "right", secondaryTarget: "rear" }),
    );
    expect(movement).toBe("circle_right");
  });

  it("falls back to rear when primary and secondary are not flank targets", () => {
    // primary top + secondary front are not flank objectives → desired rear.
    expect(
      resolveDesiredFlankTarget(
        makePolicy({ primaryTarget: "top", secondaryTarget: "front" }),
      ),
    ).toBe("rear");
    // The fallback rear target drives the direction: west of a north-facing
    // centre opponent, circle_right reaches the rear-exposing south_west.
    const movement = chooseGridFlankMovement(
      makeFighter("west"),
      makeFighter("center", "north"),
      makePolicy({ primaryTarget: "top", secondaryTarget: "front" }),
    );
    expect(movement).toBe("circle_right");
  });

  it("holds when the desired target is already exposed", () => {
    // North_west of a south-facing centre opponent exposes rear.
    const movement = chooseGridFlankMovement(
      makeFighter("north_west"),
      makeFighter("center", "south"),
      makePolicy({ primaryTarget: "rear", secondaryTarget: "rear" }),
    );
    expect(movement).toBe("hold");
  });

  it("breaks exact score ties toward circle_left", () => {
    // North of a north-facing centre opponent the two circle destinations are
    // front-diagonals (north_west front_left, north_east front_right) with
    // identical scores; the tie resolves to circle_left.
    const movement = chooseGridFlankMovement(
      makeFighter("north"),
      makeFighter("center", "north"),
      makePolicy({ primaryTarget: "top", secondaryTarget: "front" }),
    );
    expect(movement).toBe("circle_left");
    const leftScore = scoreGridFlankPosition(
      "north_west",
      "center",
      "north",
      makePolicy({ primaryTarget: "top", secondaryTarget: "front" }),
      true,
    );
    const rightScore = scoreGridFlankPosition(
      "north_east",
      "center",
      "north",
      makePolicy({ primaryTarget: "top", secondaryTarget: "front" }),
      true,
    );
    expect(leftScore).toBe(rightScore);
  });

  it("holds when neither direction translates or improves the score", () => {
    // North_west of an east-facing centre opponent: the current position
    // exposes rear and left; both circle destinations (north, west) lose some
    // of that exposure, so neither improves the score and the flank selector
    // holds even though both circles translate.
    const movement = chooseGridFlankMovement(
      makeFighter("north_west"),
      makeFighter("center", "east"),
      makePolicy({
        preferredRange: "medium",
        primaryTarget: "right",
        secondaryTarget: "right",
      }),
    );
    expect(movement).toBe("hold");
  });
});

describe("grid flank early-state overrides (Phase 3C)", () => {
  function derive(
    state: GridFighterState,
    opponent: GridFighterState,
    policy: ActionPolicy,
    rng: SeededRandom = new SeededRandom(1),
  ): RoundAction {
    return deriveGridAction(state, policy, opponent, rng);
  }

  it("overrides flank when overturned", () => {
    const action = derive(
      makeFighter("south", "north", { conditions: ["overturned"] }),
      makeFighter("center", "south"),
      makePolicy(),
    );
    expect(action).toEqual({ movement: "hold", combat: "idle" });
  });

  it("overrides flank when overheated", () => {
    const action = derive(
      makeFighter("south", "north", { conditions: ["overheated"] }),
      makeFighter("center", "south"),
      makePolicy(),
    );
    expect(action).toEqual({ movement: "hold", combat: "defend" });
  });

  it("overrides flank when mobility is disabled", () => {
    const state = makeFighter("south", "north");
    const disabled = {
      ...state,
      comps: {
        ...state.comps,
        mobility: { state: "disabled" as const },
      },
    };
    const action = derive(disabled, makeFighter("center", "south"), makePolicy());
    expect(action).toEqual({ movement: "hold", combat: "attack" });
  });

  it("overrides flank at the retreat threshold fallback", () => {
    const action = derive(
      makeFighter("south", "north", { integrity: 10 }),
      makeFighter("center", "south"),
      makePolicy({ retreatThreshold: 20, fallback: "defend" }),
    );
    expect(action).toEqual({ movement: "hold", combat: "defend" });
  });

  it("overrides flank at the heat threshold", () => {
    const action = derive(
      makeFighter("south", "north", { heat: 85 }),
      makeFighter("center", "south"),
      makePolicy({ heatThreshold: 80 }),
    );
    expect(action).toEqual({ movement: "hold", combat: "defend" });
  });

  it("keeps cooldown producing defend while flank movement still selects", () => {
    const action = derive(
      makeFighter("south", "north", { weaponCooldown: 2 }),
      makeFighter("center", "south"),
      makePolicy(),
    );
    expect(action.movement).toBe("circle_left");
    expect(action.combat).toBe("defend");
  });
});

describe("grid flank RNG behaviour (Phase 3C)", () => {
  it("consumes no randomness in flank movement selection", () => {
    // Aggression 60 short-circuits the combat roll without a draw; with the
    // flank movement being pure, the total draw count must be 0.
    const rng = new CountingRandom(7);
    const action = deriveGridAction(
      makeFighter("south", "north"),
      makePolicy({ aggression: 60 }),
      makeFighter("center", "south"),
      rng,
    );
    expect(action.movement).toBe("circle_left");
    expect(rng.draws).toBe(0);

    // Even when the aggression roll draws, only the single combat roll occurs.
    const rngLow = new CountingRandom(7);
    const lowAction = deriveGridAction(
      makeFighter("south", "north"),
      makePolicy({ aggression: 40 }),
      makeFighter("center", "south"),
      rngLow,
    );
    expect(lowAction.movement).toBe("circle_left");
    expect(rngLow.draws).toBe(1);
  });

  it("keeps aggression combat selection seeded and deterministic", () => {
    const state = makeFighter("south", "north");
    const opponent = makeFighter("center", "south");
    const policy = makePolicy({ aggression: 40 });
    const first = deriveGridAction(state, policy, opponent, new SeededRandom(3));
    const second = deriveGridAction(state, policy, opponent, new SeededRandom(3));
    expect(second).toEqual(first);
    expect(first.movement).toBe("circle_left");
    expect(["attack", "defend"]).toContain(first.combat);
    // A different seed may change only the combat roll, never the movement.
    const other = deriveGridAction(state, policy, opponent, new SeededRandom(4));
    expect(other.movement).toBe(first.movement);
  });
});
