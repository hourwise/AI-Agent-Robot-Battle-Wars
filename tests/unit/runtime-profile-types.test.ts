import { describe, expect, it } from "vitest";
import {
  runMatchForZone,
  type MatchRuntimeAdapter,
  type ZoneMatchResult,
} from "../../src/simulator/simulator.js";
import {
  GRID_RUNTIME_IDENTITY,
  LEGACY_RUNTIME_IDENTITY,
} from "../../src/simulator/runtime-identity.js";
import type {
  ArenaZone,
  ActionPolicy,
  GridZone,
  GridMatchResult,
  MatchConfig,
  MatchResult,
  RoundAction,
} from "../../src/simulator/types.js";
import type { RoundState } from "../../src/simulator/reducer.js";
import type { SeededRandom } from "../../src/simulator/seeded-random.js";
import type { ComponentQualificationConfig } from "../../src/simulator/component-qualification-registry.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";

const build = createBulwarkBuild();

const config: MatchConfig = {
  seed: 1,
  fighterA: { build, policy: BULWARK_POLICY },
  fighterB: { build, policy: BULWARK_POLICY },
  rulesetVersion: "0.2.0",
  catalogueVersion: CATALOGUE_V1.version,
};

function noopRound<Z extends ArenaZone | GridZone>(
  state: RoundState<Z>,
  _actions: { fighterA: RoundAction; fighterB: RoundAction },
  _rng: SeededRandom,
  _round: number,
  _timestampMs: number,
  _policyA: ActionPolicy | undefined,
  _policyB: ActionPolicy | undefined,
  _qualificationConfig: ComponentQualificationConfig,
): RoundState<Z> {
  return state;
}

function legacyAdapterBase(): Omit<MatchRuntimeAdapter<ArenaZone>, "runtime"> {
  return {
    initialZones: { fighterA: "south_edge", fighterB: "north_edge" },
    initialFacing: { fighterA: "north", fighterB: "south" },
    deriveAction: () => ({ movement: "hold", combat: "idle" }),
    applyRound: noopRound,
    competitionStartedExtra: {},
    eventSimulatorVersion: "0.2.0",
  };
}

function gridAdapterBase(): Omit<MatchRuntimeAdapter<GridZone>, "runtime"> {
  return {
    initialZones: { fighterA: "south", fighterB: "north" },
    initialFacing: { fighterA: "north", fighterB: "south" },
    deriveAction: () => ({ movement: "hold", combat: "idle" }),
    applyRound: noopRound,
    competitionStartedExtra: {},
    eventSimulatorVersion: "0.3.0",
  };
}

// ── Invalid pairings must FAIL to compile ────────────────────────────────
// These are the Phase 3B compile-time contract assertions. Each `@ts-expect-error`
// line proves the invalid construction is rejected by the type system through
// normal typed use; `npm run check` (tsc) enforces them.

// @ts-expect-error grid identity cannot pair with a legacy (ArenaZone) adapter
const _invalidGridIdentityOnLegacy: MatchRuntimeAdapter<ArenaZone> = {
  ...legacyAdapterBase(),
  runtime: GRID_RUNTIME_IDENTITY,
};

// @ts-expect-error legacy identity cannot pair with a grid adapter
const _invalidLegacyIdentityOnGrid: MatchRuntimeAdapter<GridZone> = {
  ...gridAdapterBase(),
  runtime: LEGACY_RUNTIME_IDENTITY,
};

// @ts-expect-error legacy-only initial zones cannot be supplied to a grid adapter
const _invalidLegacyZonesOnGrid: MatchRuntimeAdapter<GridZone> = {
  ...gridAdapterBase(),
  initialZones: { fighterA: "north_edge", fighterB: "north" },
};

// @ts-expect-error grid-only corner zones cannot be supplied to a legacy adapter
const _invalidGridCornersOnLegacy: MatchRuntimeAdapter<ArenaZone> = {
  ...legacyAdapterBase(),
  initialZones: { fighterA: "north_east", fighterB: "center" },
};

// @ts-expect-error grid identity cannot pair with a legacy zone in runMatchForZone
runMatchForZone<ArenaZone>(config, {
  ...legacyAdapterBase(),
  runtime: GRID_RUNTIME_IDENTITY,
});

// @ts-expect-error legacy initial zones cannot be supplied to a grid runtime profile
runMatchForZone<GridZone>(config, {
  ...gridAdapterBase(),
  runtime: GRID_RUNTIME_IDENTITY,
  initialZones: { fighterA: "north_edge", fighterB: "north" },
});

// @ts-expect-error grid-only corner zones cannot be supplied to a legacy runtime profile
runMatchForZone<ArenaZone>(config, {
  ...legacyAdapterBase(),
  runtime: LEGACY_RUNTIME_IDENTITY,
  initialZones: { fighterA: "north_east", fighterB: "center" },
});

// ── Valid pairings compile and behave correctly ──────────────────────────

describe("paired runtime/profile types (Phase 3B)", () => {
  it("compiles valid legacy and grid adapter pairings", () => {
    const legacy: MatchRuntimeAdapter<ArenaZone> = {
      ...legacyAdapterBase(),
      runtime: LEGACY_RUNTIME_IDENTITY,
    };
    const grid: MatchRuntimeAdapter<GridZone> = {
      ...gridAdapterBase(),
      runtime: GRID_RUNTIME_IDENTITY,
    };
    expect(legacy.runtime.positioningModel).toBe("legacy-five-zone-v1");
    expect(grid.runtime.positioningModel).toBe("grid-3x3-v1");
  });

  it("runMatchForZone returns the identity paired with the zone type", () => {
    const legacy: ZoneMatchResult<ArenaZone> = runMatchForZone(config, {
      ...legacyAdapterBase(),
      runtime: LEGACY_RUNTIME_IDENTITY,
    });
    const grid: ZoneMatchResult<GridZone> = runMatchForZone(config, {
      ...gridAdapterBase(),
      runtime: GRID_RUNTIME_IDENTITY,
    });
    expect(legacy.runtime).toEqual({
      simulatorVersion: "0.2.0",
      positioningModel: "legacy-five-zone-v1",
    });
    expect(grid.runtime).toEqual({
      simulatorVersion: "0.3.0",
      positioningModel: "grid-3x3-v1",
    });
    expect(legacy.initialState.fighterA.zone).toBe("south_edge");
    expect(grid.initialState.fighterA.zone).toBe("south");
  });

  it("typed results remain assignable to the public MatchResult/GridMatchResult", () => {
    const legacy: MatchResult = runMatchForZone(config, {
      ...legacyAdapterBase(),
      runtime: LEGACY_RUNTIME_IDENTITY,
    });
    const grid: GridMatchResult = runMatchForZone(config, {
      ...gridAdapterBase(),
      runtime: GRID_RUNTIME_IDENTITY,
    });
    expect(legacy.runtime.simulatorVersion).toBe("0.2.0");
    expect(grid.runtime.simulatorVersion).toBe("0.3.0");
  });
});
