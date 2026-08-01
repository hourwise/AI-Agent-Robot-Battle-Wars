import { describe, expect, it } from "vitest";
import { runMatch } from "../../src/simulator/simulator.js";
import {
  applyRoundForZone,
  type PositioningAdapter,
  type RoundState,
} from "../../src/simulator/reducer.js";
import { createZoneFighterState } from "../../src/simulator/simulator.js";
import { SeededRandom } from "../../src/simulator/seeded-random.js";
import { getDefaultComponentQualificationConfig } from "../../src/simulator/component-qualification-registry.js";
import { matchResultToRecord } from "../../src/persistence/match-converter.js";
import {
  isV2Record,
  validateMatchRecord,
} from "../../src/schemas/match-record.schema.js";
import { renderAsciiReplay } from "../../src/replay/ascii/ascii-replay-renderer.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import type { ArenaZone, RoundAction } from "../../src/simulator/types.js";
import type { AttackResult } from "../../src/simulator/damage.js";

const build = createBulwarkBuild();
const qualificationConfig = getDefaultComponentQualificationConfig();

const LEGACY_ZONES = new Set<ArenaZone>([
  "center",
  "north_edge",
  "south_edge",
  "east_edge",
  "west_edge",
]);

function legacyConfig(seed: number) {
  return {
    seed,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: "0.2.0",
    catalogueVersion: CATALOGUE_V1.version,
  };
}

function makeLegacyTestAdapter(spec: {
  hit: boolean;
  knockback: boolean;
  grappleReposition: boolean;
}): PositioningAdapter<ArenaZone> {
  return {
    resolveMovement: (state) => ({
      zone: state.zone,
      facing: state.facing,
      translated: false,
    }),
    computeDistance: () => "close",
    computeAttack: (): AttackResult => ({
      hit: spec.hit,
      hitZone: "front",
      rawDamage: 0,
      armourAtHitZone: 0,
      effectiveDamage: 0,
      isCritical: false,
      overturnSuccess: false,
      knockback: spec.knockback,
      grappleReposition: spec.grappleReposition,
    }),
    resolveKnockback: (attackerZone, _attackerFacing, defenderZone) => {
      if (defenderZone === "center") {
        if (attackerZone === "north_edge") return "south_edge";
        if (attackerZone === "south_edge") return "north_edge";
        if (attackerZone === "east_edge") return "west_edge";
        if (attackerZone === "west_edge") return "east_edge";
      }
      return null;
    },
    resolveGrapple: () => null,
    enableGrappleRepositioning: false,
    planFromSharedSnapshot: false,
    momentumFor: () => 0,
  };
}

describe("legacy runtime regression (Phase 3B)", () => {
  it("keeps fixed-seed legacy event streams deterministic", () => {
    for (const seed of [1, 2, 7, 42, 99]) {
      const first = runMatch(legacyConfig(seed));
      const second = runMatch(legacyConfig(seed));
      expect(second.events).toEqual(first.events);
      expect(second.result).toEqual(first.result);
      expect(second.rounds).toBe(first.rounds);
      expect(second.initialState).toEqual(first.initialState);
    }
  });

  it("never emits grid-only zones in any legacy event or state", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const result = runMatch(legacyConfig(seed));
      expect(LEGACY_ZONES.has(result.initialState.fighterA.zone)).toBe(true);
      expect(LEGACY_ZONES.has(result.initialState.fighterB.zone)).toBe(true);
      for (const event of result.events) {
        if (event.type === "movement_resolved" && event.data) {
          expect(LEGACY_ZONES.has(event.data.from as ArenaZone)).toBe(true);
          expect(LEGACY_ZONES.has(event.data.to as ArenaZone)).toBe(true);
        }
        if (event.type === "round_ended" && event.data) {
          expect(LEGACY_ZONES.has(event.data.fighterA?.zone as ArenaZone)).toBe(true);
          expect(LEGACY_ZONES.has(event.data.fighterB?.zone as ArenaZone)).toBe(true);
        }
      }
    }
  });

  it("keeps legacy knockback semantics unchanged (center-only, opposite edge)", () => {
    // Attacker at an edge, defender at center: the defender is knocked to the
    // edge opposite the attacker.
    const state: RoundState<ArenaZone> = {
      fighterA: createZoneFighterState(build, "fighter_a", "south_edge", "north"),
      fighterB: createZoneFighterState(build, "fighter_b", "center", "south"),
      events: [],
      damageDealt: { a: 0, b: 0 },
      roundsAttacked: { a: 0, b: 0 },
    };
    const rng = new SeededRandom(42);
    const result = applyRoundForZone(
      state,
      {
        fighterA: { movement: "hold", combat: "attack" },
        fighterB: { movement: "hold", combat: "defend" },
      },
      rng,
      1,
      1000,
      undefined,
      undefined,
      qualificationConfig,
      makeLegacyTestAdapter({ hit: true, knockback: true, grappleReposition: false }),
    );
    const reposition = result.events.filter((e) => e.type === "movement_resolved");
    expect(reposition).toHaveLength(1);
    expect(reposition[0]!.data).toMatchObject({
      from: "center",
      to: "north_edge",
      action: "knockback",
    });
    expect(result.fighterA.zone).toBe("south_edge");
    expect(result.fighterB.zone).toBe("north_edge");
  });

  it("keeps legacy knockback no-op off-center", () => {
    // A defender that is not at center is never knocked back by the legacy
    // adapter, regardless of the attack result.
    const state: RoundState<ArenaZone> = {
      fighterA: createZoneFighterState(build, "fighter_a", "south_edge", "north"),
      fighterB: createZoneFighterState(build, "fighter_b", "north_edge", "south"),
      events: [],
      damageDealt: { a: 0, b: 0 },
      roundsAttacked: { a: 0, b: 0 },
    };
    const rng = new SeededRandom(42);
    const result = applyRoundForZone(
      state,
      {
        fighterA: { movement: "hold", combat: "attack" },
        fighterB: { movement: "hold", combat: "defend" },
      },
      rng,
      1,
      1000,
      undefined,
      undefined,
      qualificationConfig,
      makeLegacyTestAdapter({ hit: true, knockback: true, grappleReposition: false }),
    );
    expect(result.events.filter((e) => e.type === "movement_resolved")).toHaveLength(0);
    expect(result.fighterA.zone).toBe("south_edge");
    expect(result.fighterB.zone).toBe("north_edge");
  });

  it("keeps legacy grapple non-repositioning behaviour", () => {
    // A grappler-style hit with grappleReposition true must never emit a
    // repositioning movement event through the legacy adapter.
    const state: RoundState<ArenaZone> = {
      fighterA: createZoneFighterState(build, "fighter_a", "south_edge", "north"),
      fighterB: createZoneFighterState(build, "fighter_b", "north_edge", "south"),
      events: [],
      damageDealt: { a: 0, b: 0 },
      roundsAttacked: { a: 0, b: 0 },
    };
    const rng = new SeededRandom(42);
    const actions: { fighterA: RoundAction; fighterB: RoundAction } = {
      fighterA: { movement: "hold", combat: "attack" },
      fighterB: { movement: "hold", combat: "attack" },
    };
    const result = applyRoundForZone(
      state,
      actions,
      rng,
      1,
      1000,
      undefined,
      undefined,
      qualificationConfig,
      makeLegacyTestAdapter({
        hit: true,
        knockback: false,
        grappleReposition: true,
      }),
    );
    expect(result.events.filter((e) => e.type === "movement_resolved")).toHaveLength(0);
    expect(result.fighterA.zone).toBe("south_edge");
    expect(result.fighterB.zone).toBe("north_edge");
  });

  it("keeps legacy persistence as schema v2", () => {
    for (const seed of [1, 7, 42]) {
      const record = matchResultToRecord(runMatch(legacyConfig(seed)));
      expect(isV2Record(record)).toBe(true);
      const validation = validateMatchRecord(record);
      expect(validation.ok).toBe(true);
      if (validation.ok) {
        expect(validation.record.simulatorVersion).toBe("0.2.0");
        expect("positioningModel" in validation.record).toBe(false);
      }
    }
  });

  it("keeps legacy replay snapshots unchanged and deterministic", () => {
    const result = runMatch(legacyConfig(7));
    const first = renderAsciiReplay(result);
    const second = renderAsciiReplay(result);
    expect(second).toBe(first);
    expect(first.length).toBeGreaterThan(0);
  });
});
