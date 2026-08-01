import { describe, expect, it } from "vitest";
import { deriveGridAction } from "../../src/simulator/actions.js";
import { createZoneFighterState } from "../../src/simulator/simulator.js";
import { SeededRandom } from "../../src/simulator/seeded-random.js";
import { V3_FIXTURE_BUILD, V3_FIXTURE_POLICY } from "../fixtures/v3-match-record.js";
import type {
  GridFighterState,
  ActionPolicy,
  Direction,
} from "../../src/simulator/types.js";

function makeFighter(
  zone: GridFighterState["zone"],
  facing: Direction,
): GridFighterState {
  return createZoneFighterState(V3_FIXTURE_BUILD, "fighter", zone, facing);
}

const RUSH_POLICY: ActionPolicy = { ...V3_FIXTURE_POLICY, opening: "rush" };

describe("grid action derivation", () => {
  it("is deterministic for identical state, policy and seed", () => {
    const attacker = makeFighter("south", "north");
    const opponent = makeFighter("north", "south");
    const first = deriveGridAction(
      attacker,
      V3_FIXTURE_POLICY,
      opponent,
      new SeededRandom(42),
    );
    for (let run = 0; run < 10; run++) {
      expect(
        deriveGridAction(attacker, V3_FIXTURE_POLICY, opponent, new SeededRandom(42)),
      ).toEqual(first);
    }
  });

  it("uses the grid combat proximity band for movement decisions", () => {
    // Far apart (Chebyshev 2): rush policies advance.
    const far = deriveGridAction(
      makeFighter("south_west", "north"),
      RUSH_POLICY,
      makeFighter("north_east", "south"),
      new SeededRandom(1),
    );
    expect(far.movement).toBe("advance");

    // Same cell (close): rush no longer forces advance.
    const close = deriveGridAction(
      makeFighter("center", "north"),
      RUSH_POLICY,
      makeFighter("center", "south"),
      new SeededRandom(1),
    );
    expect(close.movement).not.toBe("advance");
  });

  it("returns hold for overturned and overheated states", () => {
    const overturned = makeFighter("south", "north");
    overturned.conditions = ["overturned"];
    expect(
      deriveGridAction(
        overturned,
        V3_FIXTURE_POLICY,
        makeFighter("north", "south"),
        new SeededRandom(2),
      ),
    ).toEqual({ movement: "hold", combat: "idle" });

    const overheated = makeFighter("south", "north");
    overheated.conditions = ["overheated"];
    expect(
      deriveGridAction(
        overheated,
        V3_FIXTURE_POLICY,
        makeFighter("north", "south"),
        new SeededRandom(3),
      ),
    ).toEqual({ movement: "hold", combat: "defend" });
  });

  it("holds when mobility is disabled", () => {
    const disabled = makeFighter("south", "north");
    disabled.comps.mobility.state = "disabled";
    disabled.components.mobilityDisabled = true;
    const action = deriveGridAction(
      disabled,
      V3_FIXTURE_POLICY,
      makeFighter("north", "south"),
      new SeededRandom(4),
    );
    expect(action.movement).toBe("hold");
  });

  it("preserves policy fields without introducing new options", () => {
    const attacker = makeFighter("west", "east");
    const opponent = makeFighter("east", "west");
    const action = deriveGridAction(
      attacker,
      V3_FIXTURE_POLICY,
      opponent,
      new SeededRandom(5),
    );
    // Only the five established movement actions exist.
    expect(["advance", "retreat", "circle_left", "circle_right", "hold"]).toContain(
      action.movement,
    );
    expect(["attack", "defend", "idle"]).toContain(action.combat);
  });
});
