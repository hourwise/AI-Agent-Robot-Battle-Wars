import { describe, expect, it } from "vitest";
import { runMatch } from "../../src/simulator/simulator.js";
import { runGridMatch } from "../../src/simulator/grid-runtime.js";
import { matchResultToRecord } from "../../src/persistence/match-converter.js";
import {
  deserializeMatchRecord,
  isV2Record,
  isV3Record,
  serializeMatchRecord,
  validateMatchRecord,
} from "../../src/schemas/match-record.schema.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import type {
  AnyMatchResult,
  GridMatchResult,
  MatchResult,
} from "../../src/simulator/types.js";

const build = createBulwarkBuild();

function legacyConfig() {
  return {
    seed: 42,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: "0.2.0",
    catalogueVersion: CATALOGUE_V1.version,
  };
}

function gridConfig() {
  return {
    seed: 42,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: "0.3.0",
    catalogueVersion: CATALOGUE_V1.version,
  };
}

describe("persistence routing by explicit runtime identity", () => {
  it("persists a legacy result as a valid v2 record", () => {
    const result = runMatch(legacyConfig());
    const record = matchResultToRecord(result);
    expect(record.schemaVersion).toBe("2");
    expect(isV2Record(record)).toBe(true);
    const validation = validateMatchRecord(record);
    expect(validation.ok).toBe(true);
    if (validation.ok && isV2Record(validation.record)) {
      expect(validation.record.simulatorVersion).toBe("0.2.0");
      expect(validation.record.initialState.fighterA.zone).toBe("south_edge");
      expect("positioningModel" in validation.record).toBe(false);
    }
  });

  it("persists a grid result as a valid v3 record that round-trips", () => {
    const result = runGridMatch(gridConfig());
    const record = matchResultToRecord(result);
    expect(record.schemaVersion).toBe("3");
    expect(isV3Record(record)).toBe(true);

    const validation = validateMatchRecord(record);
    expect(validation.ok).toBe(true);
    if (validation.ok && isV3Record(validation.record)) {
      expect(validation.record.simulatorVersion).toBe("0.3.0");
      expect(validation.record.positioningModel).toBe("grid-3x3-v1");
      expect(validation.record.initialState.fighterA.zone).toBe("south");
      expect(validation.record.initialState.fighterB.zone).toBe("north");
    }

    const json = serializeMatchRecord(record);
    const restored = deserializeMatchRecord(json);
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.record.schemaVersion).toBe("3");
      expect(isV3Record(restored.record)).toBe(true);
      if (isV3Record(restored.record)) {
        expect(restored.record.positioningModel).toBe("grid-3x3-v1");
        expect(restored.record.matchId).toBe(record.matchId);
      }
    }
  });

  it("rejects a grid model paired with simulatorVersion 0.2.0", () => {
    const result = runGridMatch(gridConfig());
    const malformed = {
      ...result,
      runtime: { simulatorVersion: "0.2.0", positioningModel: "grid-3x3-v1" },
    } as unknown as GridMatchResult;
    expect(() => matchResultToRecord(malformed)).toThrow(/0\.3\.0/);
  });

  it("rejects a legacy model paired with simulatorVersion 0.3.0", () => {
    const result = runMatch(legacyConfig());
    const malformed = {
      ...result,
      runtime: { simulatorVersion: "0.3.0", positioningModel: "legacy-five-zone-v1" },
    } as unknown as MatchResult;
    expect(() => matchResultToRecord(malformed)).toThrow(/0\.2\.0/);
  });

  it("rejects a grid result that contains a legacy edge zone", () => {
    const result = runGridMatch(gridConfig());
    const malformed = {
      ...result,
      initialState: {
        fighterA: {
          ...result.initialState.fighterA,
          zone: "south_edge" as never,
        },
        fighterB: result.initialState.fighterB,
      },
    } as unknown as GridMatchResult;
    expect(() => matchResultToRecord(malformed)).toThrow(/non-grid zone/);
  });

  it("rejects a legacy result that contains a grid-only corner zone", () => {
    const result = runMatch(legacyConfig());
    const malformed = {
      ...result,
      initialState: {
        fighterA: {
          ...result.initialState.fighterA,
          zone: "north_east" as never,
        },
        fighterB: result.initialState.fighterB,
      },
    } as unknown as MatchResult;
    expect(() => matchResultToRecord(malformed)).toThrow(/grid-only zone/);
  });

  it("rejects an unknown positioning model", () => {
    const result = runMatch(legacyConfig());
    const malformed = {
      ...result,
      runtime: { simulatorVersion: "0.4.0", positioningModel: "polar-v1" },
    } as unknown as AnyMatchResult;
    expect(() => matchResultToRecord(malformed)).toThrow(/Unknown positioning model/);
  });
});
