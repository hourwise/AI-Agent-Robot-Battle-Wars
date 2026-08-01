import { describe, expect, it } from "vitest";
import {
  resolveRecordPositioningModel,
  resolveMatchResultPositioningModel,
  isGridReplayPositioningModel,
} from "../../src/replay/positioning-model.js";
import { validateMatchRecord } from "../../src/schemas/match-record.schema.js";
import {
  makeV3Record,
  makeV3Fighter,
  V3_FIXTURE_BUILD,
  V3_FIXTURE_POLICY,
} from "../fixtures/v3-match-record.js";
import type { MatchRecord } from "../../src/schemas/match-record.schema.js";
import type { MatchResult } from "../../src/simulator/types.js";

function makeLegacyRecord(schemaVersion: "1" | "2"): MatchRecord {
  return {
    schemaVersion,
    matchId: "550e8400-e29b-41d4-a716-446655440333",
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
      fighterA: { ...makeV3Fighter("fighter_a", "center", "north"), zone: "center" },
      fighterB: { ...makeV3Fighter("fighter_b", "center", "south"), zone: "center" },
    },
    events: [],
    result: { winner: null, loser: null, method: "draw" },
    rounds: 1,
  } as MatchRecord;
}

function makeCurrentMatchResult(): MatchResult {
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
        ...makeV3Fighter("fighter_a", "south_edge", "north"),
        zone: "south_edge",
      },
      fighterB: {
        ...makeV3Fighter("fighter_b", "north_edge", "south"),
        zone: "north_edge",
      },
    },
    events: [],
    result: { winner: null, loser: null, method: "draw" },
    rounds: 1,
    runtime: { simulatorVersion: "0.2.0", positioningModel: "legacy-five-zone-v1" },
  } as unknown as MatchResult;
}

describe("replay positioning model dispatch", () => {
  it("selects the legacy model for schema v1 records", () => {
    expect(resolveRecordPositioningModel(makeLegacyRecord("1"))).toBe(
      "legacy-five-zone-v1",
    );
  });

  it("selects the legacy model for schema v2 records", () => {
    expect(resolveRecordPositioningModel(makeLegacyRecord("2"))).toBe(
      "legacy-five-zone-v1",
    );
  });

  it("selects the grid model for schema v3 records", () => {
    const v3 = makeV3Record();
    const validation = validateMatchRecord(v3);
    expect(validation.ok).toBe(true);
    expect(resolveRecordPositioningModel(v3)).toBe("grid-3x3-v1");
  });

  it("never selects a model by guessing from the center zone value", () => {
    // Both a legacy v2 record and a v3 grid record may contain "center".
    const legacyWithCenter = makeLegacyRecord("2");
    const gridWithCenter = makeV3Record({
      initialZoneA: "center",
      initialZoneB: "center",
    });
    expect(resolveRecordPositioningModel(legacyWithCenter)).toBe("legacy-five-zone-v1");
    expect(resolveRecordPositioningModel(gridWithCenter)).toBe("grid-3x3-v1");
  });

  it("resolves raw current 0.2.0 match results to the legacy model", () => {
    expect(resolveMatchResultPositioningModel(makeCurrentMatchResult())).toBe(
      "legacy-five-zone-v1",
    );
  });

  it("rejects a v3-shaped record that lacks its required positioning field", () => {
    const invalid = makeV3Record() as Record<string, unknown>;
    delete invalid.positioningModel;
    const validation = validateMatchRecord(invalid);
    expect(validation.ok).toBe(false);
  });

  it("classifies grid vs legacy models", () => {
    expect(isGridReplayPositioningModel("grid-3x3-v1")).toBe(true);
    expect(isGridReplayPositioningModel("legacy-five-zone-v1")).toBe(false);
  });
});
