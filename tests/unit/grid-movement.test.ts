import { describe, expect, it } from "vitest";
import { resolveGridMovement, applyGridRound } from "../../src/simulator/grid-runtime.js";
import { createZoneFighterState } from "../../src/simulator/simulator.js";
import { SeededRandom } from "../../src/simulator/seeded-random.js";
import {
  GRID_ZONES,
  getOrthogonalPathDistance,
  findShortestGridPath,
} from "../../src/simulator/arena-grid.js";
import { V3_FIXTURE_BUILD, V3_FIXTURE_POLICY } from "../fixtures/v3-match-record.js";
import type {
  GridFighterState,
  MovementAction,
  Direction,
} from "../../src/simulator/types.js";
import type { RoundState } from "../../src/simulator/reducer.js";
import { getDefaultComponentQualificationConfig } from "../../src/simulator/component-qualification-registry.js";

function makeGridFighter(
  zone: GridFighterState["zone"],
  facing: Direction,
  fighterId = "fighter",
): GridFighterState {
  return createZoneFighterState(V3_FIXTURE_BUILD, fighterId, zone, facing);
}

function makeRoundState(
  a: GridFighterState,
  b: GridFighterState,
): RoundState<GridFighterState["zone"]> {
  return {
    fighterA: a,
    fighterB: b,
    events: [],
    damageDealt: { a: 0, b: 0 },
    roundsAttacked: { a: 0, b: 0 },
  };
}

describe("grid movement", () => {
  it("advances one orthogonal step along the deterministic path toward the opponent", () => {
    for (const actorZone of GRID_ZONES) {
      for (const opponentZone of GRID_ZONES) {
        if (actorZone === opponentZone) continue;
        const actor = makeGridFighter(actorZone, "north");
        const opponent = makeGridFighter(opponentZone, "south");
        const result = resolveGridMovement(actor, opponent, "advance");
        expect(result.translated).toBe(true);
        expect(result.facing).toBe("north");
        expect(getOrthogonalPathDistance(result.zone, actorZone)).toBe(1);
        expect(getOrthogonalPathDistance(result.zone, opponentZone)).toBeLessThan(
          getOrthogonalPathDistance(actorZone, opponentZone),
        );
        const expectedPath = findShortestGridPath(actorZone, opponentZone);
        expect(result.zone).toBe(expectedPath[1]);
      }
    }
  });

  it("does not translate on advance when sharing a cell", () => {
    for (const zone of GRID_ZONES) {
      const actor = makeGridFighter(zone, "north");
      const opponent = makeGridFighter(zone, "south");
      const result = resolveGridMovement(actor, opponent, "advance");
      expect(result.zone).toBe(zone);
      expect(result.translated).toBe(false);
      expect(result.facing).toBe("north");
    }
  });

  it("retreats to the greatest-distance neighbour with deterministic tie-breaking", () => {
    // North→east→south→west order selects the first strictly-greater
    // candidate; when several neighbours tie on distance the first in that
    // order wins.
    const cases: Array<{
      actor: GridFighterState["zone"];
      opponent: GridFighterState["zone"];
      expected: GridFighterState["zone"];
    }> = [
      { actor: "center", opponent: "north", expected: "east" },
      { actor: "center", opponent: "east", expected: "north" },
      { actor: "south_west", opponent: "north_west", expected: "south" },
      { actor: "west", opponent: "north", expected: "south_west" },
    ];
    for (const { actor, opponent, expected } of cases) {
      const result = resolveGridMovement(
        makeGridFighter(actor, "north"),
        makeGridFighter(opponent, "south"),
        "retreat",
      );
      expect(result.zone).toBe(expected);
      expect(result.translated).toBe(true);
      expect(result.facing).toBe("north");
    }
  });

  it("keeps a strictly increasing distance when retreating", () => {
    for (const actorZone of GRID_ZONES) {
      for (const opponentZone of GRID_ZONES) {
        if (actorZone === opponentZone) continue;
        const result = resolveGridMovement(
          makeGridFighter(actorZone, "north"),
          makeGridFighter(opponentZone, "south"),
          "retreat",
        );
        if (result.translated) {
          expect(getOrthogonalPathDistance(result.zone, opponentZone)).toBeGreaterThan(
            getOrthogonalPathDistance(actorZone, opponentZone),
          );
        }
      }
    }
  });

  it("does not translate on a blocked retreat", () => {
    // A corner actor retreating away from the opposite corner has no
    // neighbour further from the opponent.
    const actor = makeGridFighter("north_west", "north");
    const opponent = makeGridFighter("south_east", "south");
    const result = resolveGridMovement(actor, opponent, "retreat");
    expect(result.zone).toBe("north_west");
    expect(result.translated).toBe(false);
  });

  it("rotates in place for circle_left and circle_right without translating", () => {
    for (const zone of GRID_ZONES) {
      const actor = makeGridFighter(zone, "north");
      const opponent = makeGridFighter("center", "south");
      const left = resolveGridMovement(actor, opponent, "circle_left");
      expect(left.zone).toBe(zone);
      expect(left.facing).toBe("west");
      expect(left.translated).toBe(false);
      const right = resolveGridMovement(actor, opponent, "circle_right");
      expect(right.zone).toBe(zone);
      expect(right.facing).toBe("east");
      expect(right.translated).toBe(false);
    }
  });

  it("preserves zone and facing on hold", () => {
    const actor = makeGridFighter("north_east", "south");
    const result = resolveGridMovement(actor, makeGridFighter("center", "north"), "hold");
    expect(result.zone).toBe("north_east");
    expect(result.facing).toBe("south");
    expect(result.translated).toBe(false);
  });

  it("never translates diagonally or out of bounds", () => {
    for (const actorZone of GRID_ZONES) {
      for (const opponentZone of GRID_ZONES) {
        for (const action of ["advance", "retreat"] as const) {
          const result = resolveGridMovement(
            makeGridFighter(actorZone, "north"),
            makeGridFighter(opponentZone, "south"),
            action,
          );
          if (result.translated) {
            expect(getOrthogonalPathDistance(actorZone, result.zone)).toBe(1);
          }
        }
      }
    }
  });

  it("resolves simultaneous movement from the shared start-of-round state", () => {
    // Both fighters advance from opposite edges; neither may move based on the
    // other's already-translated cell, so both end in the centre.
    const actions: Record<
      string,
      { movement: MovementAction; combat: "attack" | "defend" | "idle" }
    > = {
      fighterA: { movement: "advance", combat: "defend" },
      fighterB: { movement: "advance", combat: "defend" },
    };
    const state = makeRoundState(
      makeGridFighter("south", "north"),
      makeGridFighter("north", "south"),
    );
    const next = applyGridRound(
      state,
      actions as never,
      new SeededRandom(1),
      1,
      1000,
      V3_FIXTURE_POLICY,
      V3_FIXTURE_POLICY,
      getDefaultComponentQualificationConfig(),
    );
    expect(next.fighterA.zone).toBe("center");
    expect(next.fighterB.zone).toBe("center");
  });

  it("emits canonical movement event facts and momentum only on translated advance", () => {
    const actions = {
      fighterA: { movement: "advance", combat: "attack" },
      fighterB: { movement: "hold", combat: "defend" },
    };
    const state = makeRoundState(
      makeGridFighter("south", "north", "fighter_a"),
      makeGridFighter("north", "south", "fighter_b"),
    );
    const next = applyGridRound(
      state,
      actions as never,
      new SeededRandom(5),
      1,
      1000,
      V3_FIXTURE_POLICY,
      V3_FIXTURE_POLICY,
      getDefaultComponentQualificationConfig(),
    );
    const movement = next.events.filter((e) => e.type === "movement_resolved");
    const aMove = movement.find((e) => e.actorId === "fighter_a");
    expect(aMove).toBeDefined();
    expect(aMove!.data.from).toBe("south");
    expect(aMove!.data.to).toBe("center");
    expect(aMove!.data.facing).toBe("north");
    expect(aMove!.data.action).toBe("advance");

    const attack = next.events.find((e) => e.type === "attack_attempted");
    if (attack) {
      expect(attack.data.momentum).toBe(1);
    }
  });

  it("reports zero momentum for an advance that cannot translate", () => {
    const actions = {
      fighterA: { movement: "advance", combat: "attack" },
      fighterB: { movement: "hold", combat: "defend" },
    };
    const state = makeRoundState(
      makeGridFighter("center", "north", "fighter_a"),
      makeGridFighter("center", "south", "fighter_b"),
    );
    const next = applyGridRound(
      state,
      actions as never,
      new SeededRandom(6),
      1,
      1000,
      V3_FIXTURE_POLICY,
      V3_FIXTURE_POLICY,
      getDefaultComponentQualificationConfig(),
    );
    const attack = next.events.find((e) => e.type === "attack_attempted");
    if (attack) {
      expect(attack.data.momentum).toBe(0);
    }
  });
});
