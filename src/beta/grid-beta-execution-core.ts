import { sha256Hex } from "../canary/grid-canary-digest.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import { DEFAULT_COMPONENT_QUALIFICATION_ID } from "../simulator/component-qualification-registry.js";
import { RULESET_VERSION } from "../simulator/constants.js";
import { runGridMatch } from "../simulator/grid-runtime.js";
import type { GridMatchResult, MatchConfig } from "../simulator/types.js";
import type { GridBetaFighterExecutionValues } from "./grid-beta-fighter-spec.js";

/**
 * Pure beta execution core (Milestone 0.2C Phase 3G, Phase 7).
 *
 * `executeGridBetaMatch` may call only `runGridMatch`. It never reads or
 * writes files, never reads the clock, never generates UUIDs, never calls
 * legacy `runMatch`/`runSeries`, never calls an agent/provider/benchmark and
 * never opens readiness or held-out data. Runtime selection is already fixed
 * to grid before simulation. The same match is executed twice with identical
 * build, policy and seed inputs and every simulator fact must be equal; only
 * the primary result is published by the caller.
 */

export class GridBetaExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridBetaExecutionError";
  }
}

export interface ExecuteGridBetaMatchInput {
  readonly seed: number;
  readonly fighterA: GridBetaFighterExecutionValues;
  readonly fighterB: GridBetaFighterExecutionValues;
}

export interface GridBetaExecutionOutcome {
  readonly primary: GridMatchResult;
  readonly repeat: GridMatchResult;
  readonly deterministic: boolean;
}

/** Deterministic checksum of a grid match result (all persisted facts). */
export function gridBetaMatchResultChecksum(result: GridMatchResult): string {
  return sha256Hex(JSON.stringify(result));
}

function assertSeed(seed: number): void {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new GridBetaExecutionError(
      `grid beta seed must be a non-negative integer; received ${String(seed)}`,
    );
  }
}

/**
 * Executes the same grid beta match twice with identical inputs and requires
 * deterministic equality of all simulator facts: runtime identity, config,
 * initial states, complete ordered event streams, result and rounds.
 */
export function executeGridBetaMatch(
  input: ExecuteGridBetaMatchInput,
): GridBetaExecutionOutcome {
  assertSeed(input.seed);
  const config: MatchConfig = {
    seed: input.seed,
    fighterA: {
      build: input.fighterA.build,
      policy: input.fighterA.policy,
    },
    fighterB: {
      build: input.fighterB.build,
      policy: input.fighterB.policy,
    },
    rulesetVersion: RULESET_VERSION,
    catalogueVersion: CATALOGUE_V1.version,
    componentQualificationId: DEFAULT_COMPONENT_QUALIFICATION_ID,
  };

  const primary = runGridMatch(config);
  const repeat = runGridMatch(config);

  const factsEqual =
    JSON.stringify(primary.runtime) === JSON.stringify(repeat.runtime) &&
    JSON.stringify(primary.config) === JSON.stringify(repeat.config) &&
    JSON.stringify(primary.initialState) === JSON.stringify(repeat.initialState) &&
    JSON.stringify(primary.events) === JSON.stringify(repeat.events) &&
    JSON.stringify(primary.result) === JSON.stringify(repeat.result) &&
    primary.rounds === repeat.rounds;
  if (!factsEqual) {
    throw new GridBetaExecutionError(
      "grid beta is not deterministic: the repeat execution differs from the primary across runtime, config, initial states, events, result or rounds",
    );
  }
  if (gridBetaMatchResultChecksum(primary) !== gridBetaMatchResultChecksum(repeat)) {
    throw new GridBetaExecutionError(
      "grid beta is not deterministic: primary and repeat result checksums differ",
    );
  }

  return { primary, repeat, deterministic: true };
}
