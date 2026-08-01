import { describe, expect, it } from "vitest";
import {
  validateMatchRecord,
  serializeMatchRecord,
  deserializeMatchRecord,
  isV1Record,
  isV2Record,
  isV3Record,
} from "../../src/schemas/match-record.schema.js";
import { GRID_ZONES, type GridZone } from "../../src/simulator/arena-grid.js";
import {
  makeV3Record,
  makeV3Fighter,
  V3_FIXTURE_BUILD,
  V3_FIXTURE_POLICY,
} from "../fixtures/v3-match-record.js";
import type { MatchRecordV2 } from "../../src/schemas/match-record.schema.js";

function makeV2Record(overrides: Partial<MatchRecordV2> = {}): MatchRecordV2 {
  return {
    schemaVersion: "2",
    matchId: "550e8400-e29b-41d4-a716-446655440222",
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
      fighterA: {
        ...makeV3Fighter("fighter_a", "south_edge", "north"),
        zone: "south_edge",
      },
      fighterB: {
        ...makeV3Fighter("fighter_b", "north_edge", "south"),
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
    ...overrides,
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

describe("MatchRecord schema v3", () => {
  it("validates a valid v3 record", () => {
    const record = makeV3Record();
    const result = validateMatchRecord(record);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.schemaVersion).toBe("3");
      expect(result.record.positioningModel).toBe("grid-3x3-v1");
    }
  });

  it("accepts every one of the nine initial grid zones", () => {
    for (const zone of GRID_ZONES) {
      const record = makeV3Record({ initialZoneA: zone });
      const result = validateMatchRecord(record);
      expect(result.ok).toBe(true);
      if (result.ok && result.record.schemaVersion === "3") {
        expect(result.record.initialState.fighterA.zone).toBe(zone);
      }
    }
  });

  it("round-trips serialisation and deserialisation preserving identity and zones", () => {
    const record = makeV3Record({
      initialZoneA: "north_west",
      initialZoneB: "south_east",
      events: [
        {
          schemaVersion: "1",
          sequence: 0,
          round: 0,
          timestampMs: 0,
          type: "competition_started",
          data: { seed: 7 },
        },
        {
          schemaVersion: "1",
          sequence: 1,
          round: 1,
          timestampMs: 0,
          type: "movement_resolved",
          actorId: "fighter_a",
          data: { from: "north_west", to: "north", facing: "north", action: "advance" },
        },
        {
          schemaVersion: "1",
          sequence: 2,
          round: 1,
          timestampMs: 0,
          type: "round_ended",
          data: {
            fighterA: { zone: "north" },
            fighterB: { zone: "south_east" },
          },
        },
      ],
    });
    const json = serializeMatchRecord(record);
    const deserialised = deserializeMatchRecord(json);
    expect(deserialised.ok).toBe(true);
    if (deserialised.ok) {
      expect(deserialised.record.schemaVersion).toBe("3");
      if (deserialised.record.schemaVersion === "3") {
        expect(deserialised.record.positioningModel).toBe("grid-3x3-v1");
        expect(deserialised.record.initialState.fighterA.zone).toBe("north_west");
        expect(deserialised.record.initialState.fighterB.zone).toBe("south_east");
        expect(deserialised.record.events).toHaveLength(3);
      }
    }
  });

  it("distinguishes record versions with the type guards", () => {
    const v1 = { ...makeV2Record(), schemaVersion: "1" as const };
    const v2 = makeV2Record();
    const v3 = makeV3Record();
    expect(isV1Record(v1)).toBe(true);
    expect(isV2Record(v1)).toBe(false);
    expect(isV3Record(v1)).toBe(false);
    expect(isV1Record(v2)).toBe(false);
    expect(isV2Record(v2)).toBe(true);
    expect(isV3Record(v2)).toBe(false);
    expect(isV1Record(v3)).toBe(false);
    expect(isV2Record(v3)).toBe(false);
    expect(isV3Record(v3)).toBe(true);
  });

  it("keeps v1 and v2 legacy records valid", () => {
    const v1Result = validateMatchRecord({
      ...makeV2Record(),
      schemaVersion: "1",
      initialState: {
        fighterA: makeV3Fighter("fighter_a", "center", "north"),
        fighterB: makeV3Fighter("fighter_b", "center", "south"),
      },
    });
    expect(v1Result.ok).toBe(true);
    const v2Result = validateMatchRecord(makeV2Record());
    expect(v2Result.ok).toBe(true);
  });

  it("rejects grid-only corner zones in v1 and v2", () => {
    for (const corner of ["north_west", "north_east", "south_west", "south_east"]) {
      const v2WithCorner = makeV2Record();
      v2WithCorner.initialState.fighterA.zone = corner;
      const v2Result = validateMatchRecord(v2WithCorner);
      expect(v2Result.ok).toBe(false);

      const v1WithCorner = {
        ...makeV2Record(),
        schemaVersion: "1" as const,
        initialState: {
          fighterA: { ...makeV3Fighter("fighter_a", "center", "north"), zone: corner },
          fighterB: makeV3Fighter("fighter_b", "center", "south"),
        },
      };
      const v1Result = validateMatchRecord(v1WithCorner);
      expect(v1Result.ok).toBe(false);
    }
  });

  it("rejects legacy edge zones in v3", () => {
    for (const edge of ["north_edge", "south_edge", "east_edge", "west_edge"]) {
      const record = makeV3Record();
      record.initialState.fighterA.zone = edge as GridZone;
      const result = validateMatchRecord(record);
      expect(result.ok).toBe(false);
    }
  });

  it("rejects a missing or incorrect positioningModel in v3", () => {
    const missing = makeV3Record() as Record<string, unknown>;
    delete missing.positioningModel;
    const missingResult = validateMatchRecord(missing);
    expect(missingResult.ok).toBe(false);

    const wrong = { ...makeV3Record(), positioningModel: "legacy-five-zone-v1" };
    const wrongResult = validateMatchRecord(wrong);
    expect(wrongResult.ok).toBe(false);
  });

  it("rejects invalid movement event zones in v3", () => {
    const badFrom = makeV3Record({
      events: [
        {
          schemaVersion: "1",
          sequence: 0,
          round: 0,
          timestampMs: 0,
          type: "competition_started",
          data: { seed: 7 },
        },
        {
          schemaVersion: "1",
          sequence: 1,
          round: 1,
          timestampMs: 0,
          type: "movement_resolved",
          actorId: "fighter_a",
          data: { from: "north_edge", to: "north", facing: "north", action: "advance" },
        },
      ],
    });
    const fromResult = validateMatchRecord(badFrom);
    expect(fromResult.ok).toBe(false);

    const badTo = makeV3Record({
      events: [
        {
          schemaVersion: "1",
          sequence: 0,
          round: 0,
          timestampMs: 0,
          type: "competition_started",
          data: { seed: 7 },
        },
        {
          schemaVersion: "1",
          sequence: 1,
          round: 1,
          timestampMs: 0,
          type: "movement_resolved",
          actorId: "fighter_a",
          data: { from: "north", to: "west_edge", facing: "west", action: "advance" },
        },
      ],
    });
    const toResult = validateMatchRecord(badTo);
    expect(toResult.ok).toBe(false);
  });

  it("rejects invalid round-end zones in v3", () => {
    const badRoundEnd = makeV3Record({
      events: [
        {
          schemaVersion: "1",
          sequence: 0,
          round: 0,
          timestampMs: 0,
          type: "competition_started",
          data: { seed: 7 },
        },
        {
          schemaVersion: "1",
          sequence: 1,
          round: 1,
          timestampMs: 0,
          type: "round_ended",
          data: {
            fighterA: { zone: "north" },
            fighterB: { zone: "east_edge" },
          },
        },
      ],
    });
    const result = validateMatchRecord(badRoundEnd);
    expect(result.ok).toBe(false);
  });

  it("rejects unsupported schema versions", () => {
    const result = validateMatchRecord({ ...makeV3Record(), schemaVersion: "9" });
    expect(result.ok).toBe(false);
    const missing = validateMatchRecord({ ...makeV3Record(), schemaVersion: undefined });
    expect(missing.ok).toBe(false);
  });

  it("does not mutate its input during validation", () => {
    const record = deepFreeze(makeV3Record());
    const result = validateMatchRecord(record);
    expect(result.ok).toBe(true);
  });
});

describe("v3 authoritative event contract hardening", () => {
  function withEvents(events: readonly unknown[]): ReturnType<typeof makeV3Record> {
    return makeV3Record({
      events: events as never,
    });
  }

  const validMovement = {
    schemaVersion: "1",
    sequence: 1,
    round: 1,
    timestampMs: 0,
    type: "movement_resolved",
    actorId: "fighter_a",
    data: { from: "south", to: "center", facing: "north", action: "advance" },
  };
  const validRoundEnd = {
    schemaVersion: "1",
    sequence: 2,
    round: 1,
    timestampMs: 0,
    type: "round_ended",
    data: {
      fighterA: { zone: "center", integrity: 100 },
      fighterB: { zone: "north", integrity: 100 },
    },
  };

  it("accepts complete valid v3 positioning events", () => {
    const record = makeV3Record({
      events: [
        {
          schemaVersion: "1",
          sequence: 0,
          round: 0,
          timestampMs: 0,
          type: "competition_started",
          data: { seed: 7 },
        },
        validMovement,
        validRoundEnd,
      ],
    });
    expect(validateMatchRecord(record).ok).toBe(true);
  });

  it("rejects a missing movement from", () => {
    const record = withEvents([
      validMovement,
      { ...validMovement, sequence: 3, data: { to: "center", facing: "north" } },
    ]);
    const result = validateMatchRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("data.from");
  });

  it("rejects a missing movement to", () => {
    const record = withEvents([
      validMovement,
      { ...validMovement, sequence: 3, data: { from: "south", facing: "north" } },
    ]);
    const result = validateMatchRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("data.to");
  });

  it("rejects a missing round-end fighterA", () => {
    const record = withEvents([
      validMovement,
      {
        ...validRoundEnd,
        sequence: 3,
        data: { fighterB: { zone: "north" } },
      },
    ]);
    const result = validateMatchRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("data.fighterA");
  });

  it("rejects a missing round-end fighterB", () => {
    const record = withEvents([
      validMovement,
      {
        ...validRoundEnd,
        sequence: 3,
        data: { fighterA: { zone: "center" } },
      },
    ]);
    const result = validateMatchRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("data.fighterB");
  });

  it("rejects a missing round-end zone on either fighter", () => {
    const missingA = withEvents([
      validMovement,
      {
        ...validRoundEnd,
        sequence: 3,
        data: { fighterA: {}, fighterB: { zone: "north" } },
      },
    ]);
    const resultA = validateMatchRecord(missingA);
    expect(resultA.ok).toBe(false);
    if (!resultA.ok) expect(resultA.errors).toContain("data.fighterA.zone");

    const missingB = withEvents([
      validMovement,
      {
        ...validRoundEnd,
        sequence: 3,
        data: { fighterA: { zone: "center" }, fighterB: {} },
      },
    ]);
    const resultB = validateMatchRecord(missingB);
    expect(resultB.ok).toBe(false);
    if (!resultB.ok) expect(resultB.errors).toContain("data.fighterB.zone");
  });

  it("rejects null or malformed positioning payloads", () => {
    expect(validateMatchRecord(withEvents([{ ...validMovement, data: null }])).ok).toBe(
      false,
    );
    expect(
      validateMatchRecord(withEvents([{ ...validMovement, data: "bogus" }])).ok,
    ).toBe(false);
    expect(validateMatchRecord(withEvents([{ ...validRoundEnd, data: null }])).ok).toBe(
      false,
    );
    expect(
      validateMatchRecord(
        withEvents([
          { ...validRoundEnd, data: { fighterA: null, fighterB: { zone: "north" } } },
        ]),
      ).ok,
    ).toBe(false);
    expect(
      validateMatchRecord(
        withEvents([
          { ...validRoundEnd, data: { fighterA: { zone: "center" }, fighterB: "x" } },
        ]),
      ).ok,
    ).toBe(false);
  });

  it("leaves v1/v2 validation unchanged by the hardening", () => {
    // A v2 record may carry a movement event without zone facts at all.
    const v2 = makeV2Record();
    expect(validateMatchRecord(v2).ok).toBe(true);

    const v1 = { ...makeV2Record(), schemaVersion: "1" };
    expect(validateMatchRecord(v1).ok).toBe(true);
  });
});
