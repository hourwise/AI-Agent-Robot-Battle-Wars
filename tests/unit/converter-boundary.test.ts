import { describe, expect, it } from "vitest";
import { runMatch } from "../../src/simulator/simulator.js";
import { runGridMatch } from "../../src/simulator/grid-runtime.js";
import { matchResultToRecord } from "../../src/persistence/match-converter.js";
import { validateMatchRecord } from "../../src/schemas/match-record.schema.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import type { GridMatchResult, SimulationEvent } from "../../src/simulator/types.js";

const build = createBulwarkBuild();

function gridConfig(seed: number) {
  return {
    seed,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: "0.2.0",
    catalogueVersion: CATALOGUE_V1.version,
  };
}

function legacyConfig(seed: number) {
  return {
    seed,
    fighterA: { build, policy: BULWARK_POLICY },
    fighterB: { build, policy: BULWARK_POLICY },
    rulesetVersion: "0.2.0",
    catalogueVersion: CATALOGUE_V1.version,
  };
}

function withExtraEvent(
  result: GridMatchResult,
  event: SimulationEvent,
): GridMatchResult {
  return {
    ...result,
    events: [...result.events, event],
  };
}

function movementEvent(overrides: Partial<SimulationEvent>): SimulationEvent {
  return {
    schemaVersion: "1",
    sequence: 9999,
    round: 1,
    timestampMs: 0,
    type: "movement_resolved",
    actorId: "fighter_a",
    targetId: "fighter_b",
    data: {},
    ...overrides,
  };
}

describe("converter-boundary validation (Phase 3B)", () => {
  it("returns the parsed valid v3 record for a valid grid result", () => {
    const result = runGridMatch(gridConfig(3));
    const record = matchResultToRecord(result);
    const validation = validateMatchRecord(record);
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.record.schemaVersion).toBe("3");
    }
  });

  it("returns the parsed valid v2 record for a valid legacy result", () => {
    const result = runMatch(legacyConfig(3));
    const record = matchResultToRecord(result);
    const validation = validateMatchRecord(record);
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.record.schemaVersion).toBe("2");
    }
  });

  it("rejects a malformed movement_resolved positioning fact before repository access", () => {
    const result = runGridMatch(gridConfig(4));
    const tampered = withExtraEvent(
      result,
      movementEvent({
        data: { from: "north", to: "north_edge", facing: "south", action: "knockback" },
      }),
    );
    expect(() => matchResultToRecord(tampered)).toThrow(
      /invalid v3 record[\s\S]*grid zone/,
    );
  });

  it("rejects a malformed round_ended positioning fact before repository access", () => {
    const result = runGridMatch(gridConfig(5));
    const tampered = withExtraEvent(result, {
      schemaVersion: "1",
      sequence: 9999,
      round: 1,
      timestampMs: 0,
      type: "round_ended",
      data: { fighterA: { zone: "west" }, fighterB: { zone: "south_edge" } },
    });
    expect(() => matchResultToRecord(tampered)).toThrow(
      /invalid v3 record[\s\S]*grid zone/,
    );
  });

  it("rejects a malformed initial grid zone before repository access", () => {
    const result = runGridMatch(gridConfig(6));
    const tampered: GridMatchResult = {
      ...result,
      initialState: {
        ...result.initialState,
        fighterA: { ...result.initialState.fighterA, zone: "north_edge" as never },
      },
    };
    expect(() => matchResultToRecord(tampered)).toThrow(/non-grid zone/);
  });

  it("rejects inconsistent runtime/version facts for a grid result", () => {
    const result = runGridMatch(gridConfig(7));
    const tampered = {
      ...result,
      runtime: {
        simulatorVersion: "0.2.0",
        positioningModel: "grid-3x3-v1",
      },
    } as unknown as GridMatchResult;
    expect(() => matchResultToRecord(tampered)).toThrow(/0\.3\.0/);
  });

  it("proves valid grid production never reaches an invalid record state", () => {
    // A broad sweep of seeds: every converter output must validate.
    for (const seed of [1, 2, 3, 9, 17, 42]) {
      const record = matchResultToRecord(runGridMatch(gridConfig(seed)));
      const validation = validateMatchRecord(record);
      expect(validation.ok).toBe(true);
      if (validation.ok) {
        expect(validation.record.schemaVersion).toBe("3");
      }
    }
  });
});
