import { describe, expect, it } from "vitest";
import {
  createGridBetaFighterExecutionValues,
  parseGridBetaFighterSpec,
} from "../../src/beta/grid-beta-fighter-spec.js";
import {
  GridBetaExecutionError,
  executeGridBetaMatch,
  executeGridBetaMatchWithRunner,
  gridBetaMatchResultChecksum,
} from "../../src/beta/grid-beta-execution-core.js";
import { runGridMatch } from "../../src/simulator/grid-runtime.js";
import type { MatchConfig } from "../../src/simulator/types.js";
import { ALPHA_FIGHTER_SPEC, BETA_FIGHTER_SPEC } from "../helpers/grid-beta-builder.js";

function freshInput() {
  const specA = parseGridBetaFighterSpec(ALPHA_FIGHTER_SPEC, "alpha").spec;
  const specB = parseGridBetaFighterSpec(BETA_FIGHTER_SPEC, "beta").spec;
  return {
    seed: 12345,
    fighterA: createGridBetaFighterExecutionValues(specA),
    fighterB: createGridBetaFighterExecutionValues(specB),
  };
}

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

  it("detects simulator mutation of the primary config, build and policy (Phase 3G.1 Phase 10)", () => {
    const input = freshInput();
    const mutatingRunner = (config: MatchConfig) => {
      config.seed = 999;
      config.fighterA.build.totalCost += 1;
      config.fighterB.policy.aggression += 1;
      return runGridMatch(config);
    };
    expect(() => executeGridBetaMatchWithRunner(input, mutatingRunner)).toThrow(
      /mutated the primary config, build or policy input/,
    );
  });

  it("detects simulator mutation of the repeat input (Phase 3G.1 Phase 10)", () => {
    const input = freshInput();
    const observed: string[] = [];
    let calls = 0;
    const runner = (config: MatchConfig) => {
      // Record the pristine graph before any mutation.
      observed.push(JSON.stringify(config));
      calls += 1;
      if (calls === 2) {
        config.seed = 999;
        config.fighterA.build.totalCost += 1;
      }
      return runGridMatch(config);
    };
    expect(() => executeGridBetaMatchWithRunner(input, runner)).toThrow(
      /mutated the repeat config, build or policy input/,
    );
    // Both executions received identical, independent fresh input graphs: the
    // primary execution could not influence the repeat input.
    expect(observed.length).toBe(2);
    expect(observed[0]).toBe(observed[1]);
  });

  it("constructs independent fresh input graphs for primary and repeat (Phase 3G.1 Phase 10)", () => {
    const input = freshInput();
    const observed: string[] = [];
    const runner = (config: MatchConfig) => {
      observed.push(JSON.stringify(config));
      return runGridMatch(config);
    };
    const outcome = executeGridBetaMatchWithRunner(input, runner);
    expect(outcome.deterministic).toBe(true);
    // Two independent fresh config graphs, byte-identical before execution.
    expect(observed.length).toBe(2);
    expect(observed[0]).toBe(observed[1]);
  });
});
