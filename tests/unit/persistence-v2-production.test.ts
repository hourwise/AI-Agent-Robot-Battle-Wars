import { describe, expect, it } from "vitest";
import { matchResultToRecord } from "../../src/persistence/match-converter.js";
import { validateMatchRecord } from "../../src/schemas/match-record.schema.js";
import {
  makeV3Fighter,
  V3_FIXTURE_BUILD,
  V3_FIXTURE_POLICY,
} from "../fixtures/v3-match-record.js";
import type { MatchResult } from "../../src/simulator/types.js";

function makeCurrentLegacyResult(): MatchResult {
  return {
    config: {
      seed: 7,
      fighterA: { build: V3_FIXTURE_BUILD, policy: V3_FIXTURE_POLICY },
      fighterB: { build: V3_FIXTURE_BUILD, policy: V3_FIXTURE_POLICY },
      rulesetVersion: "0.2.0",
      catalogueVersion: "1",
    },
    initialState: {
      fighterA: {
        ...makeV3Fighter("fighter_a", "south", "north"),
        zone: "south_edge",
      },
      fighterB: {
        ...makeV3Fighter("fighter_b", "north", "south"),
        zone: "north_edge",
      },
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
    runtime: { simulatorVersion: "0.2.0", positioningModel: "legacy-five-zone-v1" },
  } as unknown as MatchResult;
}

describe("current record production (0.2.0)", () => {
  it("still produces schema v2 records with legacy zones", () => {
    const record = matchResultToRecord(makeCurrentLegacyResult());
    expect(record.schemaVersion).toBe("2");
    const validation = validateMatchRecord(record);
    expect(validation.ok).toBe(true);
    if (validation.ok && validation.record.schemaVersion === "2") {
      expect(validation.record.initialState.fighterA.zone).toBe("south_edge");
      expect(validation.record.initialState.fighterB.zone).toBe("north_edge");
      expect(validation.record.simulatorVersion).toBe("0.2.0");
    }
  });

  it("never maps legacy zones silently into a v3 record", () => {
    // A v3 record built from the same legacy-zone match must fail validation
    // instead of being auto-migrated through mapLegacyZoneToGridZone.
    const legacyResult = makeCurrentLegacyResult();
    const v3Shaped = {
      schemaVersion: "3",
      positioningModel: "grid-3x3-v1",
      matchId: "550e8400-e29b-41d4-a716-446655440444",
      createdAt: "2026-07-31T12:00:00.000Z",
      rulesetVersion: legacyResult.config.rulesetVersion,
      catalogueVersion: legacyResult.config.catalogueVersion,
      simulatorVersion: legacyResult.config.catalogueVersion,
      seed: legacyResult.config.seed,
      config: legacyResult.config,
      initialState: legacyResult.initialState,
      events: legacyResult.events,
      result: legacyResult.result,
      rounds: legacyResult.rounds,
    };
    const validation = validateMatchRecord(v3Shaped);
    expect(validation.ok).toBe(false);
  });

  it("keeps normal persistence free of grid conversion", () => {
    const record = matchResultToRecord(makeCurrentLegacyResult());
    expect(record.schemaVersion).toBe("2");
    // The record must not carry a grid positioning field.
    expect("positioningModel" in record).toBe(false);
  });
});
