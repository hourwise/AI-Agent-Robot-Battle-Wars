import { describe, expect, it } from "vitest";
import {
  createGridBetaFighterExecutionValues,
  parseGridBetaFighterSpec,
} from "../../src/beta/grid-beta-fighter-spec.js";
import {
  GridBetaExecutionError,
  executeGridBetaMatch,
  gridBetaMatchResultChecksum,
} from "../../src/beta/grid-beta-execution-core.js";
import { ALPHA_FIGHTER_SPEC, BETA_FIGHTER_SPEC } from "../helpers/grid-beta-builder.js";

describe("grid beta execution core (Phase 3G Phase 7)", () => {
  it("executes the same match twice and requires deterministic equality of all simulator facts", () => {
    const specA = parseGridBetaFighterSpec(ALPHA_FIGHTER_SPEC, "alpha").spec;
    const specB = parseGridBetaFighterSpec(BETA_FIGHTER_SPEC, "beta").spec;
    const outcome = executeGridBetaMatch({
      seed: 12345,
      fighterA: createGridBetaFighterExecutionValues(specA),
      fighterB: createGridBetaFighterExecutionValues(specB),
    });
    expect(outcome.deterministic).toBe(true);
    expect(outcome.primary).toBeDefined();
    expect(outcome.repeat).toBeDefined();
    // All simulator facts equal: runtime, config, initial states, events,
    // result, rounds.
    expect(JSON.stringify(outcome.primary.runtime)).toBe(
      JSON.stringify(outcome.repeat.runtime),
    );
    expect(JSON.stringify(outcome.primary.config)).toBe(
      JSON.stringify(outcome.repeat.config),
    );
    expect(JSON.stringify(outcome.primary.initialState)).toBe(
      JSON.stringify(outcome.repeat.initialState),
    );
    expect(JSON.stringify(outcome.primary.events)).toBe(
      JSON.stringify(outcome.repeat.events),
    );
    expect(JSON.stringify(outcome.primary.result)).toBe(
      JSON.stringify(outcome.repeat.result),
    );
    expect(outcome.primary.rounds).toBe(outcome.repeat.rounds);
    expect(gridBetaMatchResultChecksum(outcome.primary)).toBe(
      gridBetaMatchResultChecksum(outcome.repeat),
    );
  });

  it("produces a grid identity result with explicit C2 qualification", () => {
    const specA = parseGridBetaFighterSpec(ALPHA_FIGHTER_SPEC, "alpha").spec;
    const specB = parseGridBetaFighterSpec(BETA_FIGHTER_SPEC, "beta").spec;
    const { primary } = executeGridBetaMatch({
      seed: 7,
      fighterA: createGridBetaFighterExecutionValues(specA),
      fighterB: createGridBetaFighterExecutionValues(specB),
    });
    expect(primary.runtime).toEqual({
      simulatorVersion: "0.3.0",
      positioningModel: "grid-3x3-v1",
    });
    expect(primary.config.rulesetVersion).toBe("0.2.0");
    expect(primary.config.catalogueVersion).toBe("1");
    expect(primary.config.componentQualificationId).toBe("component-impact-c2");
  });

  it("supports a mirror match with the same fighter in both slots", () => {
    const specA = parseGridBetaFighterSpec(ALPHA_FIGHTER_SPEC, "alpha").spec;
    const outcome = executeGridBetaMatch({
      seed: 99,
      fighterA: createGridBetaFighterExecutionValues(specA),
      fighterB: createGridBetaFighterExecutionValues(specA),
    });
    expect(outcome.deterministic).toBe(true);
  });

  it("rejects a negative or non-integer seed before simulation", () => {
    const specA = parseGridBetaFighterSpec(ALPHA_FIGHTER_SPEC, "alpha").spec;
    const specB = parseGridBetaFighterSpec(BETA_FIGHTER_SPEC, "beta").spec;
    for (const seed of [-1, 1.5, Number.NaN]) {
      expect(() =>
        executeGridBetaMatch({
          seed,
          fighterA: createGridBetaFighterExecutionValues(specA),
          fighterB: createGridBetaFighterExecutionValues(specB),
        }),
      ).toThrow(GridBetaExecutionError);
    }
  });
});
