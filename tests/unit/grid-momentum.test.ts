import { describe, expect, it } from "vitest";
import {
  applyGridRound,
  getGridMovementMomentum,
  resolveGridKnockback,
  resolveGridGrapple,
  resolveGridMovement,
} from "../../src/simulator/grid-runtime.js";
import {
  applyRoundForZone,
  type PositioningAdapter,
  type RoundState,
} from "../../src/simulator/reducer.js";
import { createZoneFighterState } from "../../src/simulator/simulator.js";
import { SeededRandom } from "../../src/simulator/seeded-random.js";
import { getCombatProximity, type GridZone } from "../../src/simulator/arena-grid.js";
import { getDefaultComponentQualificationConfig } from "../../src/simulator/component-qualification-registry.js";
import { V3_FIXTURE_BUILD, V3_FIXTURE_POLICY } from "../fixtures/v3-match-record.js";
import type {
  GridFighterState,
  MovementAction,
  Direction,
} from "../../src/simulator/types.js";
import type { AttackResult } from "../../src/simulator/damage.js";

const qualificationConfig = getDefaultComponentQualificationConfig();

function makeGridFighter(
  zone: GridZone,
  facing: Direction,
  fighterId = "fighter",
): GridFighterState {
  return createZoneFighterState(V3_FIXTURE_BUILD, fighterId, zone, facing);
}

function makeRoundState(a: GridFighterState, b: GridFighterState): RoundState<GridZone> {
  return {
    fighterA: a,
    fighterB: b,
    events: [],
    damageDealt: { a: 0, b: 0 },
    roundsAttacked: { a: 0, b: 0 },
  };
}

function findAttackAttemptedMomentum(
  state: RoundState<GridZone>,
  actions: {
    fighterA: { movement: MovementAction; combat: "attack" | "defend" | "idle" };
    fighterB: { movement: MovementAction; combat: "attack" | "defend" | "idle" };
  },
  seed = 1,
): number {
  const next = applyGridRound(
    state,
    actions as never,
    new SeededRandom(seed),
    1,
    1000,
    V3_FIXTURE_POLICY,
    V3_FIXTURE_POLICY,
    qualificationConfig,
  );
  const attack = next.events.find((e) => e.type === "attack_attempted");
  expect(attack).toBeDefined();
  return attack!.data.momentum as number;
}

const ATTACK_HOLD = {
  fighterA: { movement: "advance" as const, combat: "attack" as const },
  fighterB: { movement: "hold" as const, combat: "defend" as const },
};

describe("getGridMovementMomentum truth table (Phase 3B.1)", () => {
  const actions: MovementAction[] = [
    "advance",
    "retreat",
    "circle_left",
    "circle_right",
    "hold",
  ];

  it("grants momentum 1 only for a translated advance", () => {
    for (const action of actions) {
      for (const translated of [true, false]) {
        const expected = action === "advance" && translated ? 1 : 0;
        expect(
          getGridMovementMomentum(action, translated),
          `${action} translated=${translated}`,
        ).toBe(expected);
      }
    }
  });

  it("covers the exact frozen truth table", () => {
    const table: Array<[MovementAction, boolean, 0 | 1]> = [
      ["advance", true, 1],
      ["advance", false, 0],
      ["retreat", true, 0],
      ["retreat", false, 0],
      ["circle_left", true, 0],
      ["circle_left", false, 0],
      ["circle_right", true, 0],
      ["circle_right", false, 0],
      ["hold", true, 0],
      ["hold", false, 0],
    ];
    for (const [action, translated, expected] of table) {
      expect(getGridMovementMomentum(action, translated)).toBe(expected);
    }
  });
});

describe("grid round momentum (Phase 3B.1)", () => {
  it("emits momentum 1 for a translated advance", () => {
    const state = makeRoundState(
      makeGridFighter("south", "north", "fighter_a"),
      makeGridFighter("north", "south", "fighter_b"),
    );
    // fighter_a advances south -> center (translated) and attacks.
    expect(
      findAttackAttemptedMomentum(state, {
        ...ATTACK_HOLD,
        fighterA: { movement: "advance", combat: "attack" },
      }),
    ).toBe(1);
  });

  it("emits momentum 0 for a blocked same-cell advance", () => {
    const state = makeRoundState(
      makeGridFighter("center", "north", "fighter_a"),
      makeGridFighter("center", "south", "fighter_b"),
    );
    expect(
      findAttackAttemptedMomentum(state, {
        ...ATTACK_HOLD,
        fighterA: { movement: "advance", combat: "attack" },
      }),
    ).toBe(0);
  });

  it("emits momentum 0 for a translated retreat", () => {
    const state = makeRoundState(
      makeGridFighter("center", "north", "fighter_a"),
      makeGridFighter("north", "south", "fighter_b"),
    );
    // fighter_a retreats center -> east (translated); momentum must stay 0.
    expect(
      findAttackAttemptedMomentum(state, {
        ...ATTACK_HOLD,
        fighterA: { movement: "retreat", combat: "attack" },
      }),
    ).toBe(0);
  });

  it("emits momentum 0 for circle_left, circle_right and hold", () => {
    const baseState = makeRoundState(
      makeGridFighter("south", "north", "fighter_a"),
      makeGridFighter("north", "south", "fighter_b"),
    );
    for (const movement of ["circle_left", "circle_right", "hold"] as const) {
      const momentum = findAttackAttemptedMomentum(baseState, {
        ...ATTACK_HOLD,
        fighterA: { movement, combat: "attack" },
      });
      expect(momentum, movement).toBe(0);
    }
  });

  it("stays deterministic across repeated execution", () => {
    const state = makeRoundState(
      makeGridFighter("south", "north", "fighter_a"),
      makeGridFighter("north", "south", "fighter_b"),
    );
    const actions = {
      fighterA: { movement: "retreat" as const, combat: "attack" as const },
      fighterB: { movement: "advance" as const, combat: "attack" as const },
    };
    const first = applyGridRound(
      state,
      actions as never,
      new SeededRandom(9),
      1,
      1000,
      V3_FIXTURE_POLICY,
      V3_FIXTURE_POLICY,
      qualificationConfig,
    );
    const second = applyGridRound(
      state,
      actions as never,
      new SeededRandom(9),
      1,
      1000,
      V3_FIXTURE_POLICY,
      V3_FIXTURE_POLICY,
      qualificationConfig,
    );
    expect(second.events).toEqual(first.events);
  });
});

describe("retreating ram receives no charge momentum (Phase 3B.1)", () => {
  /**
   * Injectable attack adapter: resolves real grid movement, uses the real grid
   * momentum function, and records the exact momentum value passed into attack
   * calculation. This proves the plumbing delivers 0 to `calculateAttack` for
   * a translated retreat, so the ram movement multiplier never applies.
   */
  function makeRecordingAdapter() {
    const momentumSeen: number[] = [];
    const adapter: PositioningAdapter<GridZone> = {
      resolveMovement: (state, opponent, action) =>
        resolveGridMovement(
          state as GridFighterState,
          opponent as GridFighterState,
          action,
        ),
      computeDistance: (a, b) => getCombatProximity(a, b),
      computeAttack: (_attacker, _defender, _hitChance, momentum, _rng): AttackResult => {
        momentumSeen.push(momentum);
        return {
          hit: true,
          hitZone: "front",
          rawDamage: 0,
          armourAtHitZone: 0,
          effectiveDamage: 0,
          isCritical: false,
          overturnSuccess: false,
          knockback: false,
          grappleReposition: false,
        };
      },
      resolveKnockback: resolveGridKnockback,
      resolveGrapple: resolveGridGrapple,
      enableGrappleRepositioning: true,
      planFromSharedSnapshot: true,
      momentumFor: getGridMovementMomentum,
    };
    return { adapter, momentumSeen };
  }

  it("passes momentum 0 into attack calculation for a translated retreating ram", () => {
    const { adapter, momentumSeen } = makeRecordingAdapter();
    const state = makeRoundState(
      makeGridFighter("center", "north", "fighter_a"),
      makeGridFighter("north", "south", "fighter_b"),
    );
    applyRoundForZone(
      state,
      {
        fighterA: { movement: "retreat", combat: "attack" },
        fighterB: { movement: "hold", combat: "defend" },
      },
      new SeededRandom(1),
      1,
      1000,
      V3_FIXTURE_POLICY,
      V3_FIXTURE_POLICY,
      qualificationConfig,
      adapter,
    );
    // Only fighter_a attacks; the momentum argument it receives is 0 even
    // though the retreat translated (center -> east).
    expect(momentumSeen).toEqual([0]);
  });

  it("passes momentum 1 into attack calculation for a translated advancing ram", () => {
    const { adapter, momentumSeen } = makeRecordingAdapter();
    const state = makeRoundState(
      makeGridFighter("south", "north", "fighter_a"),
      makeGridFighter("north", "south", "fighter_b"),
    );
    applyRoundForZone(
      state,
      {
        fighterA: { movement: "advance", combat: "attack" },
        fighterB: { movement: "hold", combat: "defend" },
      },
      new SeededRandom(1),
      1,
      1000,
      V3_FIXTURE_POLICY,
      V3_FIXTURE_POLICY,
      qualificationConfig,
      adapter,
    );
    expect(momentumSeen).toEqual([1]);
  });
});
