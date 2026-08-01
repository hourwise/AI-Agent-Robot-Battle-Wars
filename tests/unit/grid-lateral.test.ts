import { describe, expect, it } from "vitest";
import {
  chooseGridCircleCandidate,
  getFacingTowardGridZone,
  resolveGridCircleMovement,
} from "../../src/simulator/grid-lateral.js";
import { getGridMovementMomentum } from "../../src/simulator/grid-runtime.js";
import { createZoneFighterState } from "../../src/simulator/simulator.js";
import {
  GRID_ZONES,
  getGridCoordinate,
  getOrthogonalNeighbours,
  getRelativeBearing,
  isGridZone,
  type GridZone,
} from "../../src/simulator/arena-grid.js";
import { V3_FIXTURE_BUILD } from "../fixtures/v3-match-record.js";
import type { GridFighterState, Direction } from "../../src/simulator/types.js";

const DIRECTIONS: readonly Direction[] = ["north", "east", "south", "west"];
const CIRCLE_ACTIONS = ["circle_left", "circle_right"] as const;

function makeGridFighter(
  zone: GridZone,
  facing: Direction,
  fighterId = "fighter",
): GridFighterState {
  return createZoneFighterState(V3_FIXTURE_BUILD, fighterId, zone, facing);
}

/**
 * Independent reference implementation of the frozen circle-candidate ranking
 * (used as an oracle for the exhaustive sweep): filter orthogonal neighbours
 * to those with strictly positive tangent dot product (excluding the
 * opponent's cell), then rank by smallest absolute Chebyshev distance change,
 * greatest tangent dot product, then the frozen north→east→south→west order.
 */
function referenceBestCircleCandidate(
  actorZone: GridZone,
  opponentZone: GridZone,
  action: "circle_left" | "circle_right",
): GridZone | null {
  const actor = getGridCoordinate(actorZone);
  const opponent = getGridCoordinate(opponentZone);
  const dx = opponent.x - actor.x;
  const dy = opponent.y - actor.y;
  const tangentX = action === "circle_left" ? -dy : dy;
  const tangentY = action === "circle_left" ? dx : -dx;

  const chebyshev = (z: GridZone): number => {
    const c = getGridCoordinate(z);
    return Math.max(Math.abs(opponent.x - c.x), Math.abs(opponent.y - c.y));
  };
  const currentChebyshev = chebyshev(actorZone);
  const dotOf = (z: GridZone): number => {
    const c = getGridCoordinate(z);
    return (c.x - actor.x) * tangentX + (c.y - actor.y) * tangentY;
  };

  const candidates: Array<{ zone: GridZone; index: number }> = [];
  getOrthogonalNeighbours(actorZone).forEach((zone, index) => {
    if (zone === opponentZone) return;
    if (dotOf(zone) > 0) candidates.push({ zone, index });
  });
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const distanceA = Math.abs(chebyshev(a.zone) - currentChebyshev);
    const distanceB = Math.abs(chebyshev(b.zone) - currentChebyshev);
    if (distanceA !== distanceB) return distanceA - distanceB;
    const dotA = dotOf(a.zone);
    const dotB = dotOf(b.zone);
    if (dotA !== dotB) return dotB - dotA;
    return a.index - b.index;
  });
  return candidates[0]!.zone;
}

describe("grid lateral movement (Phase 3C)", () => {
  it("sweeps every actor zone, opponent zone and facing for both circle directions", () => {
    for (const actorZone of GRID_ZONES) {
      for (const opponentZone of GRID_ZONES) {
        for (const facing of DIRECTIONS) {
          for (const action of CIRCLE_ACTIONS) {
            const actor = makeGridFighter(actorZone, facing);
            const opponent = makeGridFighter(opponentZone, "south");
            const result = resolveGridCircleMovement(actor, opponent, action);

            // Zone is unchanged or exactly one orthogonal neighbour.
            if (result.translated) {
              expect(getOrthogonalNeighbours(actorZone)).toContain(result.zone);
              expect(result.zone).not.toBe(opponentZone);
            } else {
              expect(result.zone).toBe(actorZone);
            }
            expect(isGridZone(result.zone)).toBe(true);
            expect(DIRECTIONS).toContain(result.facing);

            if (result.translated) {
              // Facing points toward the opponent from the destination.
              expect(result.facing).toBe(
                getFacingTowardGridZone(result.zone, opponentZone),
              );
            }
          }
        }
      }
    }
  });

  it("matches the frozen candidate-ranking oracle exhaustively", () => {
    for (const actorZone of GRID_ZONES) {
      for (const opponentZone of GRID_ZONES) {
        for (const action of CIRCLE_ACTIONS) {
          const actual = chooseGridCircleCandidate(actorZone, opponentZone, action);
          const expected = referenceBestCircleCandidate(actorZone, opponentZone, action);
          expect(actual, `${action} ${actorZone}->${opponentZone}`).toBe(expected);
        }
      }
    }
  });

  it("never translates diagonally or out of bounds", () => {
    for (const actorZone of GRID_ZONES) {
      for (const opponentZone of GRID_ZONES) {
        for (const action of CIRCLE_ACTIONS) {
          const result = resolveGridCircleMovement(
            makeGridFighter(actorZone, "north"),
            makeGridFighter(opponentZone, "south"),
            action,
          );
          if (result.translated) {
            const a = getGridCoordinate(actorZone);
            const b = getGridCoordinate(result.zone);
            expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
          }
        }
      }
    }
  });

  it("never enters the opponent's cell", () => {
    for (const actorZone of GRID_ZONES) {
      for (const opponentZone of GRID_ZONES) {
        if (actorZone === opponentZone) continue;
        for (const action of CIRCLE_ACTIONS) {
          const result = resolveGridCircleMovement(
            makeGridFighter(actorZone, "north"),
            makeGridFighter(opponentZone, "south"),
            action,
          );
          expect(result.zone).not.toBe(opponentZone);
        }
      }
    }
  });

  it("preserves engagement distance when a same-distance candidate exists", () => {
    // Actor south of a centre opponent: both lateral destinations are
    // Chebyshev distance 1, the same as the current position.
    const left = resolveGridCircleMovement(
      makeGridFighter("south", "north"),
      makeGridFighter("center", "south"),
      "circle_left",
    );
    expect(left.zone).toBe("south_west");
    expect(left.translated).toBe(true);
    const right = resolveGridCircleMovement(
      makeGridFighter("south", "north"),
      makeGridFighter("center", "south"),
      "circle_right",
    );
    expect(right.zone).toBe("south_east");
    expect(right.translated).toBe(true);
  });

  it("ranks candidates by smallest Chebyshev distance change", () => {
    // Actor centre, opponent north_west: circle_left candidates are south and
    // west with equal tangent dot; west preserves the distance (Δ 0) while
    // south increases it (Δ 1), so west wins.
    expect(chooseGridCircleCandidate("center", "north_west", "circle_left")).toBe("west");
  });

  it("breaks frozen north→east→south→west ties deterministically", () => {
    // Actor centre, opponent north: the only circle_left candidate is west and
    // the only circle_right candidate is east (tangent signs are opposite and
    // the opponent's cell is excluded).
    expect(chooseGridCircleCandidate("center", "north", "circle_left")).toBe("west");
    expect(chooseGridCircleCandidate("center", "north", "circle_right")).toBe("east");
    // East of the centre opponent: the actor faces the opponent (west), so its
    // own left is south and its own right is north; the frozen tangent vectors
    // select south_east for circle_left and north_east for circle_right.
    expect(chooseGridCircleCandidate("east", "center", "circle_left")).toBe("south_east");
    expect(chooseGridCircleCandidate("east", "center", "circle_right")).toBe(
      "north_east",
    );
  });

  it("rotates in place when circling is blocked at a boundary", () => {
    // Actor north, opponent north_east: circle_left has no positive-tangent
    // candidate (left is off-grid, down has no tangential component), so it
    // rotates left in place.
    const actor = makeGridFighter("north", "north");
    const opponent = makeGridFighter("north_east", "south");
    const result = resolveGridCircleMovement(actor, opponent, "circle_left");
    expect(result.zone).toBe("north");
    expect(result.facing).toBe("west");
    expect(result.translated).toBe(false);
  });

  it("rotates in place when sharing a cell", () => {
    for (const zone of GRID_ZONES) {
      const actor = makeGridFighter(zone, "north");
      const opponent = makeGridFighter(zone, "south");
      const left = resolveGridCircleMovement(actor, opponent, "circle_left");
      expect(left.zone).toBe(zone);
      expect(left.facing).toBe("west");
      expect(left.translated).toBe(false);
      const right = resolveGridCircleMovement(actor, opponent, "circle_right");
      expect(right.zone).toBe(zone);
      expect(right.facing).toBe("east");
      expect(right.translated).toBe(false);
    }
  });

  it("resolves repeated circle requests deterministically", () => {
    for (const actorZone of GRID_ZONES) {
      for (const opponentZone of GRID_ZONES) {
        for (const action of CIRCLE_ACTIONS) {
          const first = resolveGridCircleMovement(
            makeGridFighter(actorZone, "north"),
            makeGridFighter(opponentZone, "south"),
            action,
          );
          for (let i = 0; i < 20; i++) {
            expect(
              resolveGridCircleMovement(
                makeGridFighter(actorZone, "north"),
                makeGridFighter(opponentZone, "south"),
                action,
              ),
            ).toEqual(first);
          }
        }
      }
    }
  });

  it("reaches a rear-exposing diagonal from south of a centre opponent within three translated moves", () => {
    // Opponent centre facing south; actor circles left from south.
    const opponent = makeGridFighter("center", "south");
    let actor = makeGridFighter("south", "north");
    const path: GridZone[] = [];
    for (let i = 0; i < 3; i++) {
      const result = resolveGridCircleMovement(actor, opponent, "circle_left");
      expect(result.translated).toBe(true);
      path.push(result.zone);
      actor = makeGridFighter(result.zone, result.facing);
    }
    expect(path).toEqual(["south_west", "west", "north_west"]);
    // At north_west the rear of the south-facing centre opponent is exposed.
    const bearing = bearingOf("north_west", "center", "south");
    expect(["rear", "rear_left", "rear_right"]).toContain(bearing);
  });

  it("mirrors left and right routes symmetrically", () => {
    const opponent = makeGridFighter("center", "south");
    let leftActor = makeGridFighter("south", "north");
    let rightActor = makeGridFighter("south", "north");
    const leftPath: GridZone[] = [];
    const rightPath: GridZone[] = [];
    for (let i = 0; i < 3; i++) {
      const left = resolveGridCircleMovement(leftActor, opponent, "circle_left");
      const right = resolveGridCircleMovement(rightActor, opponent, "circle_right");
      expect(left.translated).toBe(true);
      expect(right.translated).toBe(true);
      leftPath.push(left.zone);
      rightPath.push(right.zone);
      leftActor = makeGridFighter(left.zone, left.facing);
      rightActor = makeGridFighter(right.zone, right.facing);
    }
    expect(leftPath).toEqual(["south_west", "west", "north_west"]);
    expect(rightPath).toEqual(["south_east", "east", "north_east"]);
  });

  it("lets east and west cells reach adjacent corner/edge cells laterally", () => {
    // West of a north opponent: circle_left reaches the north_west corner.
    expect(
      resolveGridCircleMovement(
        makeGridFighter("west", "north"),
        makeGridFighter("north", "south"),
        "circle_left",
      ).zone,
    ).toBe("north_west");
    // East of a north opponent: circle_right reaches the north_east corner.
    expect(
      resolveGridCircleMovement(
        makeGridFighter("east", "north"),
        makeGridFighter("north", "south"),
        "circle_right",
      ).zone,
    ).toBe("north_east");
  });

  it("reports momentum 0 for translated circling", () => {
    expect(getGridMovementMomentum("circle_left", true)).toBe(0);
    expect(getGridMovementMomentum("circle_right", true)).toBe(0);
    expect(getGridMovementMomentum("circle_left", false)).toBe(0);
    expect(getGridMovementMomentum("circle_right", false)).toBe(0);
  });
});

function bearingOf(
  attacker: GridZone,
  defender: GridZone,
  defenderFacing: Direction,
): string {
  return getRelativeBearing(attacker, defender, defenderFacing);
}
