import { describe, expect, it } from "vitest";
import {
  applyRoundForZone,
  type PositioningAdapter,
  type RoundState,
} from "../../src/simulator/reducer.js";
import { createZoneFighterState } from "../../src/simulator/simulator.js";
import {
  resolveGridGrapple,
  resolveGridKnockback,
} from "../../src/simulator/grid-runtime.js";
import { SeededRandom } from "../../src/simulator/seeded-random.js";
import {
  getCombatProximity,
  getOrthogonalNeighbours,
  isGridZone,
  type GridZone,
} from "../../src/simulator/arena-grid.js";
import { getDefaultComponentQualificationConfig } from "../../src/simulator/component-qualification-registry.js";
import { createBulwarkBuild } from "../../src/agents/scripted/bulwark-agent.js";
import type { AttackResult } from "../../src/simulator/damage.js";
import type {
  Direction,
  RoundAction,
  ZoneFighterState,
} from "../../src/simulator/types.js";

const build = createBulwarkBuild();
const qualificationConfig = getDefaultComponentQualificationConfig();

class CountingRandom extends SeededRandom {
  public draws = 0;
  next(): number {
    this.draws += 1;
    return super.next();
  }
}

interface AttackSpec {
  hit: boolean;
  knockback: boolean;
  grappleReposition: boolean;
}

/**
 * Injectable test positioning/attack adapter. `computeAttack` returns the
 * controlled spec for each fighter without drawing any RNG, so a
 * double-effect round is arranged directly instead of searching seeds.
 * Knockback/grapple resolution and movement use the real grid functions.
 */
function makeTestAdapter(
  specA: AttackSpec,
  specB: AttackSpec,
  planFromSharedSnapshot = true,
): PositioningAdapter<GridZone> {
  return {
    resolveMovement: (state) => ({
      zone: state.zone,
      facing: state.facing,
      translated: false,
    }),
    computeDistance: (a, b) => getCombatProximity(a, b),
    computeAttack: (attacker: ZoneFighterState<GridZone>): AttackResult => {
      const spec = attacker.fighterId === "fighter_a" ? specA : specB;
      return {
        hit: spec.hit,
        hitZone: "front",
        rawDamage: 0,
        armourAtHitZone: 0,
        effectiveDamage: 0,
        isCritical: false,
        overturnSuccess: false,
        knockback: spec.knockback,
        grappleReposition: spec.grappleReposition,
      };
    },
    resolveKnockback: resolveGridKnockback,
    resolveGrapple: resolveGridGrapple,
    enableGrappleRepositioning: true,
    planFromSharedSnapshot,
    momentumFor: () => 0,
  };
}

const ATTACK_BOTH: { fighterA: RoundAction; fighterB: RoundAction } = {
  fighterA: { movement: "hold", combat: "attack" },
  fighterB: { movement: "hold", combat: "attack" },
};

const KNOCKBACK: AttackSpec = { hit: true, knockback: true, grappleReposition: false };
const GRAPPLE: AttackSpec = { hit: true, knockback: false, grappleReposition: true };
const HIT_NO_EFFECT: AttackSpec = {
  hit: true,
  knockback: false,
  grappleReposition: false,
};

function makeRoundState(
  zoneA: GridZone,
  facingA: Direction,
  zoneB: GridZone,
  facingB: Direction,
): RoundState<GridZone> {
  return {
    fighterA: createZoneFighterState(build, "fighter_a", zoneA, facingA),
    fighterB: createZoneFighterState(build, "fighter_b", zoneB, facingB),
    events: [],
    damageDealt: { a: 0, b: 0 },
    roundsAttacked: { a: 0, b: 0 },
  };
}

function runRound(
  state: RoundState<GridZone>,
  adapter: PositioningAdapter<GridZone>,
  seed = 42,
) {
  const rng = new CountingRandom(seed);
  const result = applyRoundForZone(
    state,
    ATTACK_BOTH,
    rng,
    1,
    1000,
    undefined,
    undefined,
    qualificationConfig,
    adapter,
  );
  return { result, rng };
}

function repositionEvents(result: RoundState<GridZone>) {
  return result.events.filter((e) => e.type === "movement_resolved");
}

function canonicalGridZones(result: RoundState<GridZone>): void {
  for (const event of result.events) {
    if (event.type === "movement_resolved") {
      const from = event.data.from as string;
      const to = event.data.to as string;
      expect(isGridZone(from)).toBe(true);
      expect(isGridZone(to)).toBe(true);
      // Knockback and grapple repositioning move one orthogonal step — never
      // diagonally, and never out of bounds (neighbours exclude OOB).
      expect(getOrthogonalNeighbours(from as GridZone)).toContain(to as GridZone);
    }
  }
  expect(isGridZone(result.fighterA.zone)).toBe(true);
  expect(isGridZone(result.fighterB.zone)).toBe(true);
}

describe("simultaneous positional effects (Phase 3B)", () => {
  it("plans both knockback destinations from the shared post-movement snapshot", () => {
    // A at north, B at centre. A knocks B to east; B knocks A to north_east.
    // Under the old sequential origin, B's knockback would have used B's
    // post-A-knockback zone (east) and knocked A to north_west instead.
    const state = makeRoundState("north", "south", "center", "north");
    const { result } = runRound(state, makeTestAdapter(KNOCKBACK, KNOCKBACK));

    const reposition = repositionEvents(result);
    expect(reposition).toHaveLength(2);
    // Stable A-then-B event ordering.
    expect(reposition[0]!.actorId).toBe("fighter_a");
    expect(reposition[0]!.targetId).toBe("fighter_b");
    expect(reposition[1]!.actorId).toBe("fighter_b");
    expect(reposition[1]!.targetId).toBe("fighter_a");

    // A's plan: from the shared snapshot (B at centre) to east.
    expect(reposition[0]!.data).toMatchObject({
      from: "center",
      to: "east",
      action: "knockback",
    });
    // B's plan: from the shared snapshot (A at north) to north_east — NOT the
    // post-A-knockback state.
    expect(reposition[1]!.data).toMatchObject({
      from: "north",
      to: "north_east",
      action: "knockback",
    });

    expect(result.fighterA.zone).toBe("north_east");
    expect(result.fighterB.zone).toBe("east");
    canonicalGridZones(result);
  });

  it("regression: the old sequential-origin behaviour would produce a different destination", () => {
    // Reproduce the OLD algorithm by hand: apply A's knockback (B centre ->
    // east) first, then plan B's knockback from that sequential state.
    const bAfterA = resolveGridKnockback("north", "south", "center");
    expect(bAfterA).toBe("east");
    const oldBKnocksA = resolveGridKnockback(bAfterA!, "north", "north");
    expect(oldBKnocksA).toBe("north_west");

    // New simultaneous semantics: B's plan uses the shared post-movement
    // snapshot, so B is still at centre when its destination is planned.
    const newBKnocksA = resolveGridKnockback("center", "north", "north");
    expect(newBKnocksA).toBe("north_east");

    expect(newBKnocksA).not.toBe(oldBKnocksA);
  });

  it("plans both grapple repositionings from the shared snapshot", () => {
    const state = makeRoundState("north", "south", "center", "north");
    const { result } = runRound(state, makeTestAdapter(GRAPPLE, GRAPPLE));

    const reposition = repositionEvents(result);
    expect(reposition).toHaveLength(2);
    expect(reposition[0]!.data).toMatchObject({
      from: "center",
      to: "north",
      action: "grapple",
    });
    expect(reposition[1]!.data).toMatchObject({
      from: "north",
      to: "center",
      action: "grapple",
    });
    // Both destinations applied: A is pulled to centre, B to north.
    expect(result.fighterA.zone).toBe("center");
    expect(result.fighterB.zone).toBe("north");
    canonicalGridZones(result);
  });

  it("supports one knockback against one grapple in the same round", () => {
    const state = makeRoundState("north", "south", "center", "north");
    const { result } = runRound(state, makeTestAdapter(KNOCKBACK, GRAPPLE));

    const reposition = repositionEvents(result);
    expect(reposition).toHaveLength(2);
    expect(reposition[0]!.data).toMatchObject({ action: "knockback" });
    expect(reposition[1]!.data).toMatchObject({ action: "grapple" });
    expect(result.fighterA.zone).toBe("center"); // grappled by B
    expect(result.fighterB.zone).toBe("east"); // knocked by A
    canonicalGridZones(result);
  });

  it("handles fighters starting in the same cell", () => {
    const state = makeRoundState("center", "north", "center", "south");
    const { result } = runRound(state, makeTestAdapter(KNOCKBACK, KNOCKBACK));

    const reposition = repositionEvents(result);
    expect(reposition).toHaveLength(2);
    // Same-cell knockback steps in the attacker's facing.
    expect(reposition[0]!.data).toMatchObject({ from: "center", to: "north" });
    expect(reposition[1]!.data).toMatchObject({ from: "center", to: "south" });
    expect(result.fighterA.zone).toBe("south");
    expect(result.fighterB.zone).toBe("north");
    canonicalGridZones(result);
  });

  it("permits same-cell final occupancy when both planned destinations coincide", () => {
    // Both fighters face north from the same cell: each knocks the other one
    // step north, so both planned destinations are north and both are applied.
    const state = makeRoundState("center", "north", "center", "north");
    const { result } = runRound(state, makeTestAdapter(KNOCKBACK, KNOCKBACK));

    const reposition = repositionEvents(result);
    expect(reposition).toHaveLength(2);
    expect(result.fighterA.zone).toBe("north");
    expect(result.fighterB.zone).toBe("north");
    expect(isGridZone(result.fighterA.zone)).toBe(true);
    expect(isGridZone(result.fighterB.zone)).toBe(true);
  });

  it("handles blocked boundary cases without emitting no-op events", () => {
    // Opposite corners are at maximum distance: neither fighter can be knocked
    // further away, so no knockback events are emitted and zones are unchanged.
    const state = makeRoundState("south_west", "north", "north_east", "south");
    const { result } = runRound(state, makeTestAdapter(KNOCKBACK, KNOCKBACK));

    expect(repositionEvents(result)).toHaveLength(0);
    expect(result.fighterA.zone).toBe("south_west");
    expect(result.fighterB.zone).toBe("north_east");
    canonicalGridZones(result);
  });

  it("keeps the stable A-then-B event sequence in every combination", () => {
    for (const specB of [KNOCKBACK, GRAPPLE, HIT_NO_EFFECT]) {
      const state = makeRoundState("north", "south", "center", "north");
      const { result } = runRound(state, makeTestAdapter(KNOCKBACK, specB));
      const reposition = repositionEvents(result);
      expect(reposition.length).toBeGreaterThan(0);
      expect(reposition[0]!.actorId).toBe("fighter_a");
      for (let index = 1; index < reposition.length; index++) {
        expect(reposition[index]!.actorId).toBe("fighter_b");
        expect(reposition[index]!.sequence).toBeGreaterThan(
          reposition[index - 1]!.sequence,
        );
      }
    }
  });

  it("mirrors final zones when fighter labels are swapped", () => {
    // Original: A at north, B at centre -> A=north_east, B=east.
    const original = runRound(
      makeRoundState("north", "south", "center", "north"),
      makeTestAdapter(KNOCKBACK, KNOCKBACK),
    ).result;
    expect(original.fighterA.zone).toBe("north_east");
    expect(original.fighterB.zone).toBe("east");

    // Swapped: A takes B's position and vice versa -> A=east, B=north_east.
    const swapped = runRound(
      makeRoundState("center", "north", "north", "south"),
      makeTestAdapter(KNOCKBACK, KNOCKBACK),
    ).result;
    expect(swapped.fighterA.zone).toBe("east");
    expect(swapped.fighterB.zone).toBe("north_east");

    // Mirror correspondence: swapped A = original B, swapped B = original A.
    expect(swapped.fighterA.zone).toBe(original.fighterB.zone);
    expect(swapped.fighterB.zone).toBe(original.fighterA.zone);
  });

  it("adds no RNG consumption relative to the sequential path", () => {
    const state = makeRoundState("north", "south", "center", "north");

    const simultaneous = runRound(state, makeTestAdapter(KNOCKBACK, KNOCKBACK));
    const sequential = runRound(
      state,
      makeTestAdapter(KNOCKBACK, KNOCKBACK, /* planFromSharedSnapshot */ false),
    );

    // Identical RNG draw counts: simultaneous planning is pure and introduces
    // no extra randomness.
    expect(simultaneous.rng.draws).toBe(sequential.rng.draws);
    // Both consume the exact same non-positional event stream.
    const stripPosition = (events: RoundState<GridZone>["events"]) =>
      events.filter((e) => e.type !== "movement_resolved");
    expect(stripPosition(simultaneous.result.events)).toEqual(
      stripPosition(sequential.result.events),
    );
  });
});
