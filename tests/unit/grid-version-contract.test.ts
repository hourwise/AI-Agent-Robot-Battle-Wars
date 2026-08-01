import { describe, expect, it } from "vitest";
import { runMatch } from "../../src/simulator/simulator.js";
import { runGridMatch } from "../../src/simulator/grid-runtime.js";
import { matchResultToRecord } from "../../src/persistence/match-converter.js";
import {
  isV3Record,
  validateMatchRecord,
} from "../../src/schemas/match-record.schema.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { makeV3Record } from "../fixtures/v3-match-record.js";

const build = createBulwarkBuild();

function gridConfig(
  seed: number,
  overrides: Partial<{ rulesetVersion: string; catalogueVersion: string }> = {},
) {
  return {
    seed,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: overrides.rulesetVersion ?? "0.2.0",
    catalogueVersion: overrides.catalogueVersion ?? CATALOGUE_V1.version,
  };
}

const GRID_CONTRACT = {
  simulatorVersion: "0.3.0",
  positioningModel: "grid-3x3-v1",
  rulesetVersion: "0.2.0",
  catalogueVersion: "1",
} as const;

describe("grid version contract (Phase 3B)", () => {
  it("accepts a valid grid configuration (ruleset 0.2.0, catalogue 1)", () => {
    const result = runGridMatch(gridConfig(42));
    expect(result.runtime).toEqual({
      simulatorVersion: "0.3.0",
      positioningModel: "grid-3x3-v1",
    });
  });

  it("rejects any rulesetVersion other than 0.2.0", () => {
    for (const rulesetVersion of ["0.3.0", "0.1.0", "1.0.0", "0.2.1"]) {
      expect(() => runGridMatch(gridConfig(42, { rulesetVersion }))).toThrow(
        /rulesetVersion 0\.2\.0/,
      );
    }
  });

  it("rejects any catalogueVersion other than 1", () => {
    for (const catalogueVersion of ["0", "2", "1.0", "abc"]) {
      expect(() => runGridMatch(gridConfig(42, { catalogueVersion }))).toThrow(
        /catalogueVersion 1/,
      );
    }
  });

  it("leaves legacy runMatch acceptance unchanged", () => {
    // Legacy runMatch never validated ruleset/catalogue at the entry point;
    // that behaviour is preserved even for the grid-style ruleset value.
    const legacy = runMatch({
      seed: 42,
      fighterA: { build, policy: BULWARK_POLICY },
      fighterB: { build, policy: BULWARK_POLICY },
      rulesetVersion: "0.3.0",
      catalogueVersion: CATALOGUE_V1.version,
    });
    expect(legacy.runtime.positioningModel).toBe("legacy-five-zone-v1");
  });

  it("agrees competition_started, result identity and persisted v3 facts", () => {
    const result = runGridMatch(gridConfig(123));
    const started = result.events.find((e) => e.type === "competition_started");
    expect(started?.data).toMatchObject({
      seed: 123,
      rulesetVersion: "0.2.0",
      catalogueVersion: "1",
      simulatorVersion: "0.3.0",
      positioningModel: "grid-3x3-v1",
    });
    expect(result.runtime).toEqual({
      simulatorVersion: "0.3.0",
      positioningModel: "grid-3x3-v1",
    });

    const record = matchResultToRecord(result);
    expect(isV3Record(record)).toBe(true);
    if (isV3Record(record)) {
      expect(record.simulatorVersion).toBe(GRID_CONTRACT.simulatorVersion);
      expect(record.positioningModel).toBe(GRID_CONTRACT.positioningModel);
      expect(record.rulesetVersion).toBe(GRID_CONTRACT.rulesetVersion);
      expect(record.catalogueVersion).toBe(GRID_CONTRACT.catalogueVersion);
      expect(record.seed).toBe(123);
      expect(record.config.rulesetVersion).toBe(GRID_CONTRACT.rulesetVersion);
      expect(record.config.catalogueVersion).toBe(GRID_CONTRACT.catalogueVersion);
      expect(record.config.seed).toBe(123);
    }
  });
});

describe("v3 schema cross-field version contract", () => {
  it("requires v3 simulatorVersion to be 0.3.0", () => {
    const bad = { ...makeV3Record(), simulatorVersion: "0.2.0" };
    const result = validateMatchRecord(bad);
    expect(result.ok).toBe(false);
  });

  it("requires v3 positioningModel to be grid-3x3-v1", () => {
    const bad = { ...makeV3Record(), positioningModel: "legacy-five-zone-v1" };
    const result = validateMatchRecord(bad);
    expect(result.ok).toBe(false);
  });

  it("requires top-level and config rulesetVersion to agree", () => {
    const consistent = validateMatchRecord(makeV3Record());
    expect(consistent.ok).toBe(true);
    const bad = { ...makeV3Record(), rulesetVersion: "9.9.9" };
    const result = validateMatchRecord(bad);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.includes("rulesetVersion")).toBe(true);
  });

  it("requires top-level and config catalogueVersion to agree", () => {
    const bad = { ...makeV3Record(), catalogueVersion: "2" };
    const result = validateMatchRecord(bad);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.includes("catalogueVersion")).toBe(true);
  });

  it("requires top-level and config seed to agree", () => {
    const bad = { ...makeV3Record(), seed: 9999 };
    const result = validateMatchRecord(bad);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.includes("seed")).toBe(true);
  });

  it("does not retroactively apply the v3-only requirements to v2", () => {
    // A v2 record keeps its historical validation: ruleset/catalogue/seed are
    // not cross-checked against the embedded config, and simulatorVersion is
    // a free string. The top-level ruleset disagrees with the config, yet the
    // record still validates because the cross-field contract is v3-only.
    const base = makeV3Record();
    const v2 = {
      ...base,
      schemaVersion: "2" as const,
      simulatorVersion: "0.2.0",
      rulesetVersion: "0.3.0",
      config: {
        ...base.config,
        rulesetVersion: "0.2.0",
      },
      initialState: {
        fighterA: { ...base.initialState.fighterA, zone: "south_edge" },
        fighterB: { ...base.initialState.fighterB, zone: "north_edge" },
      },
    };
    const result = validateMatchRecord(v2);
    expect(result.ok).toBe(true);
  });
});
