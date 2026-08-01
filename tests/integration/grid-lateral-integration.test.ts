import { describe, expect, it } from "vitest";
import { applyGridRound, runGridMatch } from "../../src/simulator/grid-runtime.js";
import { createZoneFighterState } from "../../src/simulator/simulator.js";
import { SeededRandom } from "../../src/simulator/seeded-random.js";
import { isGridZone } from "../../src/simulator/arena-grid.js";
import { getStateAfterEvents } from "../../src/replay/ascii/state-reconstructor.js";
import { renderAsciiReplay } from "../../src/replay/ascii/ascii-replay-renderer.js";
import { renderTextReplay } from "../../src/replay/text-replay-renderer.js";
import { matchResultToRecord } from "../../src/persistence/match-converter.js";
import {
  deserializeMatchRecord,
  isV3Record,
  serializeMatchRecord,
  validateMatchRecord,
} from "../../src/schemas/match-record.schema.js";
import { validateBuild } from "../../src/validation/build-validator.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import {
  V3_FIXTURE_BUILD,
  V3_FIXTURE_POLICY,
  makeV3Record,
} from "../fixtures/v3-match-record.js";
import { getDefaultComponentQualificationConfig } from "../../src/simulator/component-qualification-registry.js";
import { getRelativeBearing, type GridZone } from "../../src/simulator/arena-grid.js";
import type { ActionPolicy, GridFighterState } from "../../src/simulator/types.js";
import type { RoundState } from "../../src/simulator/reducer.js";

const qualificationConfig = getDefaultComponentQualificationConfig();
const GRID_MODEL = "grid-3x3-v1" as const;

function makeFighter(
  zone: GridFighterState["zone"],
  facing: GridFighterState["facing"],
  id: string,
): GridFighterState {
  return createZoneFighterState(V3_FIXTURE_BUILD, id, zone, facing);
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

function validBuild() {
  const r = validateBuild(
    {
      machineName: "Flanker",
      chassisId: "medium",
      mobilityId: "wheels",
      weaponId: "ram",
      utilityId: "none",
      armour: { front: 20, left: 10, right: 10, rear: 5, top: 5 },
      designSummary: "lateral integration",
      designRationale: "lateral integration",
    },
    CATALOGUE_V1,
  );
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join(", "));
  return r.build;
}

const FLANK: ActionPolicy = {
  opening: "flank",
  preferredRange: "medium",
  aggression: 60,
  primaryTarget: "rear",
  secondaryTarget: "rear",
  retreatThreshold: 20,
  heatThreshold: 80,
  fallback: "defend",
};

const HOLD: ActionPolicy = {
  opening: "hold",
  preferredRange: "medium",
  aggression: 40,
  primaryTarget: "front",
  secondaryTarget: "front",
  retreatThreshold: 20,
  heatThreshold: 80,
  fallback: "defend",
};

describe("grid lateral integration (Phase 3C)", () => {
  it("emits canonical translated circle events with from/to/facing/action", () => {
    const state = makeRoundState(
      makeFighter("south", "north", "fighter_a"),
      makeFighter("center", "south", "fighter_b"),
    );
    const next = applyGridRound(
      state,
      {
        fighterA: { movement: "circle_left", combat: "attack" },
        fighterB: { movement: "hold", combat: "defend" },
      },
      new SeededRandom(1),
      1,
      1000,
      V3_FIXTURE_POLICY,
      V3_FIXTURE_POLICY,
      qualificationConfig,
    );
    const movement = next.events.find(
      (e) => e.type === "movement_resolved" && e.actorId === "fighter_a",
    );
    expect(movement).toBeDefined();
    expect(movement!.data).toMatchObject({
      from: "south",
      to: "south_west",
      facing: "north",
      action: "circle_left",
    });
    expect(isGridZone(movement!.data.from)).toBe(true);
    expect(isGridZone(movement!.data.to)).toBe(true);
    expect(next.fighterA.zone).toBe("south_west");
    expect(next.fighterA.facing).toBe("north");
  });

  it("reconstructs translated circle movement from events", () => {
    const state = makeRoundState(
      makeFighter("south", "north", "fighter_a"),
      makeFighter("center", "south", "fighter_b"),
    );
    const next = applyGridRound(
      state,
      {
        fighterA: { movement: "circle_right", combat: "defend" },
        fighterB: { movement: "hold", combat: "defend" },
      },
      new SeededRandom(2),
      1,
      1000,
      V3_FIXTURE_POLICY,
      V3_FIXTURE_POLICY,
      qualificationConfig,
    );
    const input = {
      config: {
        seed: 2,
        fighterA: { build: V3_FIXTURE_BUILD, policy: V3_FIXTURE_POLICY },
        fighterB: { build: V3_FIXTURE_BUILD, policy: V3_FIXTURE_POLICY },
        rulesetVersion: "0.2.0",
        catalogueVersion: "1",
      },
      initialState: state,
      events: next.events,
      result: { winner: null, loser: null, method: "draw" as const },
      rounds: 1,
    };
    const reconstructed = getStateAfterEvents(input, next.events, GRID_MODEL);
    expect(reconstructed.fighterA.zone).toBe("south_east");
    expect(reconstructed.fighterA.facing).toBe("north");
    expect(reconstructed.fighterB.zone).toBe("center");
  });

  it("accepts translated circle events in the v3 schema", () => {
    const record = {
      ...makeV3Record(),
      events: [
        {
          schemaVersion: "1",
          sequence: 0,
          round: 1,
          timestampMs: 0,
          type: "movement_resolved" as const,
          actorId: "fighter_a",
          data: {
            from: "south",
            to: "south_west",
            facing: "north",
            action: "circle_left",
          },
        },
        {
          schemaVersion: "1",
          sequence: 1,
          round: 1,
          timestampMs: 0,
          type: "movement_resolved" as const,
          actorId: "fighter_b",
          data: { from: "center", to: "center", facing: "west", action: "circle_left" },
        },
      ],
    };
    const result = validateMatchRecord(record);
    expect(result.ok).toBe(true);
  });

  it("produces a valid v3 record from a flank match with translated circles", () => {
    const build = validBuild();
    const result = runGridMatch({
      seed: 1,
      fighterA: { build, policy: FLANK },
      fighterB: { build, policy: HOLD },
      rulesetVersion: "0.2.0",
      catalogueVersion: CATALOGUE_V1.version,
    });
    const circles = result.events.filter(
      (e) =>
        e.type === "movement_resolved" &&
        (e.data?.action === "circle_left" || e.data?.action === "circle_right") &&
        e.data?.from !== e.data?.to,
    );
    expect(circles.length).toBeGreaterThan(0);

    const record = matchResultToRecord(result);
    expect(isV3Record(record)).toBe(true);
    const validation = validateMatchRecord(record);
    expect(validation.ok).toBe(true);
  });

  it("round-trips serialised lateral movement", () => {
    const build = validBuild();
    const result = runGridMatch({
      seed: 1,
      fighterA: { build, policy: FLANK },
      fighterB: { build, policy: HOLD },
      rulesetVersion: "0.2.0",
      catalogueVersion: CATALOGUE_V1.version,
    });
    const record = matchResultToRecord(result);
    const json = serializeMatchRecord(record);
    const restored = deserializeMatchRecord(json);
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.record.events).toEqual(record.events);
      const circles = restored.record.events.filter(
        (e) =>
          e.type === "movement_resolved" &&
          (e.data?.action === "circle_left" || e.data?.action === "circle_right") &&
          e.data?.from !== e.data?.to,
      );
      expect(circles.length).toBeGreaterThan(0);
    }
  });

  it("renders translated positions in ASCII and text replay", () => {
    const build = validBuild();
    const result = runGridMatch({
      seed: 3,
      fighterA: { build, policy: FLANK },
      fighterB: { build, policy: HOLD },
      rulesetVersion: "0.2.0",
      catalogueVersion: CATALOGUE_V1.version,
    });
    const input = {
      config: result.config,
      initialState: result.initialState,
      events: result.events,
      result: result.result,
      rounds: result.rounds,
    };
    const ascii = renderAsciiReplay(result, { mode: "ascii" }, GRID_MODEL);
    expect(ascii.length).toBeGreaterThan(0);
    expect(ascii).toContain("FORGE ARENA");
    const text = renderTextReplay(result);
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain(result.result.method);
    // Reconstruction matches the last round-end positions.
    const final = getStateAfterEvents(input, result.events, GRID_MODEL);
    const lastRoundEnd = [...result.events]
      .reverse()
      .find((e) => e.type === "round_ended");
    expect(final.fighterA.zone).toBe(lastRoundEnd?.data?.fighterA?.zone);
    expect(final.fighterB.zone).toBe(lastRoundEnd?.data?.fighterB?.zone);
  });

  it("is deterministic across repeated opt-in grid matches", () => {
    const build = validBuild();
    const config = {
      seed: 5,
      fighterA: { build, policy: FLANK },
      fighterB: { build, policy: HOLD },
      rulesetVersion: "0.2.0",
      catalogueVersion: CATALOGUE_V1.version,
    };
    const first = runGridMatch(config);
    const second = runGridMatch(config);
    expect(second.events).toEqual(first.events);
    expect(second.result).toEqual(first.result);
    expect(second.rounds).toBe(first.rounds);
  });

  it("produces rear or rear-diagonal exposure through a controlled circling route", () => {
    // Fighter A circles left three times around a stationary centre opponent
    // facing south: south → south_west → west → north_west exposes rear.
    const opponent = makeFighter("center", "south", "fighter_b");
    let a = makeFighter("south", "north", "fighter_a");
    let events: RoundState<GridZone>["events"] = [];
    for (let round = 1; round <= 3; round++) {
      const state: RoundState<GridZone> = {
        fighterA: a,
        fighterB: opponent,
        events,
        damageDealt: { a: 0, b: 0 },
        roundsAttacked: { a: 0, b: 0 },
      };
      const next = applyGridRound(
        state,
        {
          fighterA: { movement: "circle_left", combat: "defend" },
          fighterB: { movement: "hold", combat: "defend" },
        },
        new SeededRandom(10 + round),
        round,
        round * 1000,
        V3_FIXTURE_POLICY,
        V3_FIXTURE_POLICY,
        qualificationConfig,
      );
      a = next.fighterA;
      events = next.events;
    }
    expect(a.zone).toBe("north_west");
    const bearing = bearingOf(a.zone, opponent.zone, opponent.facing);
    expect(["rear", "rear_left", "rear_right"]).toContain(bearing);
  });
});

function bearingOf(
  attacker: string,
  defender: string,
  defenderFacing: GridFighterState["facing"],
): string {
  return getRelativeBearing(attacker as GridZone, defender as GridZone, defenderFacing);
}
