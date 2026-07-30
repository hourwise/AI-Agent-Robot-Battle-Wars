import { describe, it, expect } from "vitest";
import {
  validateMatchRecord,
  serializeMatchRecord,
  deserializeMatchRecord,
} from "../../src/schemas/match-record.schema.js";
import type { MatchRecord } from "../../src/schemas/match-record.schema.js";

function makeValidRecord(): MatchRecord {
  return {
    schemaVersion: "1",
    matchId: "550e8400-e29b-41d4-a716-446655440000",
    createdAt: "2026-07-26T12:00:00.000Z",
    rulesetVersion: "1",
    catalogueVersion: "1",
    simulatorVersion: "0.1.0",
    seed: 42,
    config: {
      seed: 42,
      rulesetVersion: "1",
      catalogueVersion: "1",
      fighterA: {
        build: {
          proposal: {
            machineName: "Test",
            chassisId: "medium",
            mobilityId: "wheels",
            weaponId: "ram",
            utilityId: "none",
            armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
            designSummary: "test",
            designRationale: "test",
          },
          totalCost: 52,
          armourCost: 2,
          totalArmourPoints: 20,
          catalogueVersion: "1",
        },
        policy: {
          opening: "rush",
          preferredRange: "close",
          aggression: 80,
          primaryTarget: "front",
          secondaryTarget: "front",
          retreatThreshold: 20,
          heatThreshold: 80,
          fallback: "defend",
        },
      },
      fighterB: {
        build: {
          proposal: {
            machineName: "Opponent",
            chassisId: "medium",
            mobilityId: "wheels",
            weaponId: "ram",
            utilityId: "none",
            armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
            designSummary: "test",
            designRationale: "test",
          },
          totalCost: 52,
          armourCost: 2,
          totalArmourPoints: 20,
          catalogueVersion: "1",
        },
        policy: {
          opening: "rush",
          preferredRange: "close",
          aggression: 80,
          primaryTarget: "front",
          secondaryTarget: "front",
          retreatThreshold: 20,
          heatThreshold: 80,
          fallback: "defend",
        },
      },
    },
    initialState: {
      fighterA: {
        fighterId: "fighter_a",
        build: {
          proposal: {
            machineName: "Test",
            chassisId: "medium",
            mobilityId: "wheels",
            weaponId: "ram",
            utilityId: "none",
            armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
            designSummary: "test",
            designRationale: "test",
          },
          totalCost: 52,
          armourCost: 2,
          totalArmourPoints: 20,
          catalogueVersion: "1",
        },
        integrity: 100,
        maxIntegrity: 100,
        energy: 100,
        heat: 0,
        zone: "south_edge",
        facing: "north",
        weaponCooldown: 0,
        utilityCooldown: 0,
        armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
        components: {
          mobilityDisabled: false,
          weaponDisabled: false,
          utilityDisabled: false,
        },
        conditions: [],
      },
      fighterB: {
        fighterId: "fighter_b",
        build: {
          proposal: {
            machineName: "Opponent",
            chassisId: "medium",
            mobilityId: "wheels",
            weaponId: "ram",
            utilityId: "none",
            armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
            designSummary: "test",
            designRationale: "test",
          },
          totalCost: 52,
          armourCost: 2,
          totalArmourPoints: 20,
          catalogueVersion: "1",
        },
        integrity: 100,
        maxIntegrity: 100,
        energy: 100,
        heat: 0,
        zone: "north_edge",
        facing: "south",
        weaponCooldown: 0,
        utilityCooldown: 0,
        armour: { front: 10, left: 5, right: 5, rear: 0, top: 0 },
        components: {
          mobilityDisabled: false,
          weaponDisabled: false,
          utilityDisabled: false,
        },
        conditions: [],
      },
    },
    events: [
      {
        schemaVersion: "1",
        sequence: 0,
        round: 0,
        timestampMs: 0,
        type: "competition_started",
        data: { seed: 42 },
      },
    ],
    result: {
      winner: "fighter_a",
      loser: "fighter_b",
      method: "destruction",
    },
    rounds: 5,
  };
}

describe("validateMatchRecord", () => {
  it("validates a correct v1 record", () => {
    const record = makeValidRecord();
    const result = validateMatchRecord(record);
    expect(result.ok).toBe(true);
  });

  it("accepts schema version 2", () => {
    const record = { ...makeValidRecord(), schemaVersion: "2" as const };
    // v2 record needs comps in initial state
    const v2Record = {
      ...record,
      initialState: {
        fighterA: {
          ...record.initialState.fighterA,
          comps: {
            mobility: { state: "healthy" as const },
            weapon: { state: "healthy" as const },
            utility: { state: "healthy" as const, installed: false },
          },
        },
        fighterB: {
          ...record.initialState.fighterB,
          comps: {
            mobility: { state: "healthy" as const },
            weapon: { state: "healthy" as const },
            utility: { state: "healthy" as const, installed: false },
          },
        },
      },
    };
    const result = validateMatchRecord(v2Record);
    expect(result.ok).toBe(true);
  });

  it("accepts explicit historical C1 and active C2 qualification identities", () => {
    expect(validateMatchRecord({ ...makeValidRecord(), componentQualificationId: "component-impact-c1" }).ok).toBe(true);
    expect(validateMatchRecord({ ...makeValidRecord(), componentQualificationId: "component-impact-c2" }).ok).toBe(true);
  });

  it("rejects an unknown qualification identity", () => {
    const result = validateMatchRecord({
      ...makeValidRecord(),
      componentQualificationId: "component-impact-unknown",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects unknown schema version 3", () => {
    const record = { ...makeValidRecord(), schemaVersion: "3" };
    const result = validateMatchRecord(record);
    expect(result.ok).toBe(false);
  });

  it("rejects missing schemaVersion", () => {
    const { schemaVersion, ...rest } = makeValidRecord();
    const result = validateMatchRecord(rest);
    expect(result.ok).toBe(false);
  });

  it("rejects invalid UUID", () => {
    const record = makeValidRecord();
    record.matchId = "not-a-uuid";
    const result = validateMatchRecord(record);
    expect(result.ok).toBe(false);
  });
});

describe("serializeMatchRecord", () => {
  it("serializes v1 to valid JSON", () => {
    const record = makeValidRecord();
    const json = serializeMatchRecord(record);
    const parsed = JSON.parse(json);
    expect(parsed.matchId).toBe(record.matchId);
    expect(parsed.schemaVersion).toBe("1");
  });

  it("serializes v2 to valid JSON with comps", () => {
    const v2Record = {
      ...makeValidRecord(),
      schemaVersion: "2" as const,
      initialState: {
        fighterA: {
          ...makeValidRecord().initialState.fighterA,
          comps: {
            mobility: { state: "healthy" as const },
            weapon: { state: "healthy" as const },
            utility: { state: "healthy" as const, installed: false },
          },
        },
        fighterB: {
          ...makeValidRecord().initialState.fighterB,
          comps: {
            mobility: { state: "healthy" as const },
            weapon: { state: "healthy" as const },
            utility: { state: "healthy" as const, installed: false },
          },
        },
      },
    };
    const json = serializeMatchRecord(v2Record);
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe("2");
    expect(parsed.initialState.fighterA.comps.mobility.state).toBe("healthy");
  });
});

describe("deserializeMatchRecord", () => {
  it("deserializes valid v1 JSON", () => {
    const record = makeValidRecord();
    const json = serializeMatchRecord(record);
    const result = deserializeMatchRecord(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.schemaVersion).toBe("1");
    }
  });

  it("deserializes valid v2 JSON", () => {
    const v2Record = {
      ...makeValidRecord(),
      schemaVersion: "2" as const,
      initialState: {
        fighterA: {
          ...makeValidRecord().initialState.fighterA,
          comps: {
            mobility: { state: "healthy" as const },
            weapon: { state: "healthy" as const },
            utility: { state: "healthy" as const, installed: false },
          },
        },
        fighterB: {
          ...makeValidRecord().initialState.fighterB,
          comps: {
            mobility: { state: "healthy" as const },
            weapon: { state: "healthy" as const },
            utility: { state: "healthy" as const, installed: false },
          },
        },
      },
    };
    const json = serializeMatchRecord(v2Record);
    const result = deserializeMatchRecord(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.schemaVersion).toBe("2");
    }
  });

  it("rejects invalid JSON", () => {
    const result = deserializeMatchRecord("{invalid json");
    expect(result.ok).toBe(false);
  });

  it("rejects unknown schema version 3", () => {
    const result = deserializeMatchRecord('{"schemaVersion": "3"}');
    expect(result.ok).toBe(false);
  });
});
