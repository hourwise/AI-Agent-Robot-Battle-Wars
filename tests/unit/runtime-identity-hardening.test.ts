import { describe, expect, it } from "vitest";
import { runMatch } from "../../src/simulator/simulator.js";
import { runGridMatch } from "../../src/simulator/grid-runtime.js";
import {
  LEGACY_RUNTIME_IDENTITY,
  GRID_RUNTIME_IDENTITY,
} from "../../src/simulator/runtime-identity.js";
import { matchResultToRecord } from "../../src/persistence/match-converter.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import type { AnyMatchResult } from "../../src/simulator/types.js";

const build = createBulwarkBuild();

function legacyConfig(seed = 42) {
  return {
    seed,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: "0.2.0",
    catalogueVersion: CATALOGUE_V1.version,
  };
}

function gridConfig(seed = 42) {
  return {
    seed,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: "0.2.0",
    catalogueVersion: CATALOGUE_V1.version,
  };
}

const LEGACY_EXPECTED = {
  simulatorVersion: "0.2.0",
  positioningModel: "legacy-five-zone-v1",
} as const;
const GRID_EXPECTED = {
  simulatorVersion: "0.3.0",
  positioningModel: "grid-3x3-v1",
} as const;

describe("frozen runtime identities (Phase 3B)", () => {
  it("freezes the canonical identity constants", () => {
    expect(Object.isFrozen(LEGACY_RUNTIME_IDENTITY)).toBe(true);
    expect(Object.isFrozen(GRID_RUNTIME_IDENTITY)).toBe(true);
    expect(LEGACY_RUNTIME_IDENTITY).toEqual(LEGACY_EXPECTED);
    expect(GRID_RUNTIME_IDENTITY).toEqual(GRID_EXPECTED);
  });

  it("returns runtime-immutable identities on both results", () => {
    const legacy = runMatch(legacyConfig());
    const grid = runGridMatch(gridConfig());
    expect(Object.isFrozen(legacy.runtime)).toBe(true);
    expect(Object.isFrozen(grid.runtime)).toBe(true);
  });

  it("attempted mutation throws and does not alter the result", () => {
    const legacy = runMatch(legacyConfig());
    expect(() => {
      (legacy.runtime as { simulatorVersion: string }).simulatorVersion = "9.9.9";
    }).toThrow(TypeError);
    expect(legacy.runtime).toEqual(LEGACY_EXPECTED);

    const grid = runGridMatch(gridConfig());
    expect(() => {
      (grid.runtime as { positioningModel: string }).positioningModel = "polar-v1";
    }).toThrow(TypeError);
    expect(grid.runtime).toEqual(GRID_EXPECTED);
  });

  it("attempted mutation of one result does not affect a later match", () => {
    const first = runMatch(legacyConfig(11));
    try {
      (first.runtime as { simulatorVersion: string }).simulatorVersion = "9.9.9";
    } catch {
      // frozen identity — mutation is rejected
    }
    const second = runMatch(legacyConfig(11));
    expect(second.runtime).toEqual(LEGACY_EXPECTED);
    expect(second.events).toEqual(first.events);

    const gridFirst = runGridMatch(gridConfig(12));
    try {
      (gridFirst.runtime as { positioningModel: string }).positioningModel = "polar-v1";
    } catch {
      // frozen identity — mutation is rejected
    }
    const gridSecond = runGridMatch(gridConfig(12));
    expect(gridSecond.runtime).toEqual(GRID_EXPECTED);
    expect(gridSecond.events).toEqual(gridFirst.events);
  });

  it("keeps legacy and grid identities distinct", () => {
    const legacy = runMatch(legacyConfig());
    const grid = runGridMatch(gridConfig());
    expect(legacy.runtime).not.toBe(grid.runtime);
    expect(legacy.runtime).toEqual(LEGACY_EXPECTED);
    expect(grid.runtime).toEqual(GRID_EXPECTED);
  });

  it("persistence routing remains correct after attempted identity mutation", () => {
    const legacy = runMatch(legacyConfig());
    try {
      (legacy.runtime as { positioningModel: string }).positioningModel = "grid-3x3-v1";
    } catch {
      // frozen identity — mutation is rejected
    }
    expect(matchResultToRecord(legacy).schemaVersion).toBe("2");

    const grid = runGridMatch(gridConfig());
    try {
      (grid.runtime as { simulatorVersion: string }).simulatorVersion = "0.2.0";
    } catch {
      // frozen identity — mutation is rejected
    }
    expect(matchResultToRecord(grid).schemaVersion).toBe("3");
  });

  it("adapter results share only the frozen canonical identity object", () => {
    const legacy = runMatch(legacyConfig());
    const grid = runGridMatch(gridConfig());
    // Results reference the frozen canonical constants; because the objects
    // are frozen this shared reference is safe and never mutable.
    expect(legacy.runtime).toBe(LEGACY_RUNTIME_IDENTITY);
    expect(grid.runtime).toBe(GRID_RUNTIME_IDENTITY);
    // A second result still reports the same immutable identity.
    expect(runMatch(legacyConfig()).runtime).toBe(LEGACY_RUNTIME_IDENTITY);
    expect(runGridMatch(gridConfig()).runtime).toBe(GRID_RUNTIME_IDENTITY);
  });

  it("identity is never inferred from zone strings in persistence or replay", () => {
    // Grid and legacy both use "center" in some states; the explicit frozen
    // identity still routes correctly.
    const grid = runGridMatch(gridConfig(7));
    const legacy = runMatch(legacyConfig(7));
    expect(matchResultToRecord(grid).schemaVersion).toBe("3");
    expect(matchResultToRecord(legacy).schemaVersion).toBe("2");
    expect((grid as AnyMatchResult).runtime.positioningModel).toBe("grid-3x3-v1");
    expect((legacy as AnyMatchResult).runtime.positioningModel).toBe(
      "legacy-five-zone-v1",
    );
  });
});
