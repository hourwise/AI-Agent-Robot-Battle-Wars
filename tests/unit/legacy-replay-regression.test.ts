import { describe, expect, it } from "vitest";
import {
  validateMatchRecord,
  isV1Record,
  isV2Record,
} from "../../src/schemas/match-record.schema.js";
import { renderArenaSnapshot } from "../../src/replay/ascii/arena-snapshot-renderer.js";
import { renderArenaForModel } from "../../src/replay/ascii/arena-renderer.js";
import { renderTextReplay } from "../../src/replay/text-replay-renderer.js";
import { renderAsciiReplay } from "../../src/replay/ascii/ascii-replay-renderer.js";
import { matchResultToRecord } from "../../src/persistence/match-converter.js";
import { runMatch } from "../../src/simulator/simulator.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import {
  makeV3Fighter,
  V3_FIXTURE_BUILD,
  V3_FIXTURE_POLICY,
} from "../fixtures/v3-match-record.js";
import type {
  MatchRecordV1,
  MatchRecordV2,
} from "../../src/schemas/match-record.schema.js";
import type { FighterVisualState } from "../../src/replay/ascii/ascii.types.js";
import type { MatchResult } from "../../src/simulator/types.js";

function makeCanonicalV2Record(): MatchRecordV2 {
  return {
    schemaVersion: "2",
    matchId: "550e8400-e29b-41d4-a716-446655440555",
    createdAt: "2026-07-31T12:00:00.000Z",
    rulesetVersion: "0.2.0",
    catalogueVersion: "1",
    simulatorVersion: "0.2.0",
    seed: 7,
    config: {
      seed: 7,
      rulesetVersion: "0.2.0",
      catalogueVersion: "1",
      fighterA: { build: V3_FIXTURE_BUILD, policy: V3_FIXTURE_POLICY },
      fighterB: { build: V3_FIXTURE_BUILD, policy: V3_FIXTURE_POLICY },
    },
    initialState: {
      fighterA: { ...makeV3Fighter("fighter_a", "south", "north"), zone: "south_edge" },
      fighterB: { ...makeV3Fighter("fighter_b", "north", "south"), zone: "north_edge" },
    },
    events: [
      {
        schemaVersion: "1",
        sequence: 0,
        round: 0,
        timestampMs: 0,
        type: "competition_started",
        data: { seed: 7 },
      },
    ],
    result: { winner: null, loser: null, method: "draw" },
    rounds: 1,
  };
}

function makeVisualFighter(zone: string, facing: string): FighterVisualState {
  return {
    fighterId: "fighter",
    build: V3_FIXTURE_BUILD,
    integrity: 100,
    maxIntegrity: 100,
    energy: 100,
    heat: 0,
    zone,
    facing,
    weaponCooldown: 0,
    utilityCooldown: 0,
    armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
    components: {
      mobilityDisabled: false,
      weaponDisabled: false,
      utilityDisabled: false,
      mobilityDamaged: false,
      weaponDamaged: false,
      utilityDamaged: false,
    },
    conditions: [],
  };
}

describe("legacy (v1/v2) regression", () => {
  it("still validates canonical v1 and v2 records", () => {
    const v2 = makeCanonicalV2Record();
    const v1 = { ...makeCanonicalV2Record(), schemaVersion: "1" } as MatchRecordV1;
    expect(validateMatchRecord(v1).ok).toBe(true);
    expect(validateMatchRecord(v2).ok).toBe(true);
    expect(isV1Record(v1)).toBe(true);
    expect(isV2Record(v2)).toBe(true);
    expect(isV1Record(v2)).toBe(false);
    expect(isV2Record(v1)).toBe(false);
  });

  it("keeps the five-zone ASCII snapshot byte-for-byte unchanged via the dispatcher", () => {
    const a = makeVisualFighter("south_edge", "north");
    const b = makeVisualFighter("north_edge", "south");
    expect(renderArenaForModel("legacy-five-zone-v1", a, b)).toBe(
      renderArenaSnapshot(a, b),
    );
  });

  it("replays a v2 record through text and ASCII renderers", () => {
    const record = makeCanonicalV2Record();
    const result = {
      config: record.config,
      initialState: record.initialState,
      events: record.events,
      result: record.result,
      rounds: record.rounds,
      runtime: {
        simulatorVersion: "0.2.0",
        positioningModel: "legacy-five-zone-v1",
      },
    } as unknown as MatchResult;

    const text = renderTextReplay(result);
    expect(text).toContain("MATCH COMPLETE");

    const ascii = renderAsciiReplay(result);
    expect(ascii).toContain("[NORTH]");
    expect(ascii).toContain("[SOUTH]");
  });

  it("writes schema v2 with legacy starting zones for current matches", () => {
    const build = createBulwarkBuild();
    const result = runMatch({
      seed: 42,
      fighterA: { build, policy: BULWARK_POLICY },
      fighterB: { build, policy: BULWARK_POLICY },
      rulesetVersion: "0.2.0",
      catalogueVersion: CATALOGUE_V1.version,
    });
    expect(result.initialState.fighterA.zone).toBe("south_edge");
    expect(result.initialState.fighterB.zone).toBe("north_edge");

    const record = matchResultToRecord(result);
    expect(record.schemaVersion).toBe("2");
  });
});
