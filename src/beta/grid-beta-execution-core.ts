import { sha256Hex } from "../canary/grid-canary-digest.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import { DEFAULT_COMPONENT_QUALIFICATION_ID } from "../simulator/component-qualification-registry.js";
import { RULESET_VERSION } from "../simulator/constants.js";
import { runGridMatch } from "../simulator/grid-runtime.js";
import type { GridMatchResult, MatchConfig } from "../simulator/types.js";
import type { GridBetaFighterExecutionValues } from "./grid-beta-fighter-spec.js";
import type { ValidatedBuild } from "../validation/validation.types.js";

/**
 * Pure beta execution core (Milestone 0.2C Phase 3G, Phase 7; Phase 3G.1,
 * Phase 10).
 *
 * `executeGridBetaMatch` may call only `runGridMatch`. It never reads or
 * writes files, never reads the clock, never generates UUIDs, never calls
 * legacy `runMatch`/`runSeries`, never calls an agent/provider/benchmark and
 * never opens readiness or held-out data. Runtime selection is already fixed
 * to grid before simulation. The same match is executed twice with identical
 * build, policy and seed inputs and every simulator fact must be equal; only
 * the primary result is published by the caller.
 *
 * Each execution receives an independent fresh input graph: primary and
 * repeat never share build, policy or config object references, so a primary
 * execution can never influence the repeat input. Before and after each
 * execution the supplied build and policy inputs are required to remain
 * unchanged, so simulator mutation of the config, build or policy is
 * detected and fails the beta closed.
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

/** Deep clone of a validated build (fresh mutable graph per execution). */
function cloneBuild(build: ValidatedBuild): ValidatedBuild {
  return {
    proposal: {
      machineName: build.proposal.machineName,
      chassisId: build.proposal.chassisId,
      mobilityId: build.proposal.mobilityId,
      weaponId: build.proposal.weaponId,
      utilityId: build.proposal.utilityId,
      armour: { ...build.proposal.armour },
      designSummary: build.proposal.designSummary,
      designRationale: build.proposal.designRationale,
    },
    totalCost: build.totalCost,
    armourCost: build.armourCost,
    totalArmourPoints: build.totalArmourPoints,
    catalogueVersion: build.catalogueVersion,
  };
}

/** One independent fresh config graph for a single execution. */
function buildConfig(input: ExecuteGridBetaMatchInput): MatchConfig {
  return {
    seed: input.seed,
    fighterA: {
      build: cloneBuild(input.fighterA.build),
      policy: { ...input.fighterA.policy },
    },
    fighterB: {
      build: cloneBuild(input.fighterB.build),
      policy: { ...input.fighterB.policy },
    },
    rulesetVersion: RULESET_VERSION,
    catalogueVersion: CATALOGUE_V1.version,
    componentQualificationId: DEFAULT_COMPONENT_QUALIFICATION_ID,
  };
}

/**
 * Executes the same grid beta match twice with identical but independent
 * inputs and requires deterministic equality of all simulator facts. This is
 * the production entry point and may call only the fixed imported
 * `runGridMatch`.
 */
export function executeGridBetaMatch(
  input: ExecuteGridBetaMatchInput,
): GridBetaExecutionOutcome {
  return executeGridBetaMatchWithRunner(input, runGridMatch);
}

/**
 * Test-only seam around the fixed imported `runGridMatch`. The production
 * application service never supplies an alternate simulator: it always calls
 * `executeGridBetaMatch`, which hard-codes the real `runGridMatch`. This
 * variant exists so unit tests can inject a deterministic mutating runner to
 * prove the input-isolation and mutation-detection guarantees.
 */
export function executeGridBetaMatchWithRunner(
  input: ExecuteGridBetaMatchInput,
  runner: (config: MatchConfig) => GridMatchResult,
): GridBetaExecutionOutcome {
  assertSeed(input.seed);

  // Independent fresh input graphs for primary and repeat: neither execution
  // shares build, policy or config object references with the other, so the
  // primary execution cannot influence the repeat input.
  const primaryConfig = buildConfig(input);
  const repeatConfig = buildConfig(input);

  const primaryInputBefore = JSON.stringify(primaryConfig);
  const primary = runner(primaryConfig);
  if (JSON.stringify(primaryConfig) !== primaryInputBefore) {
    throw new GridBetaExecutionError(
      "grid beta is not deterministic: the simulator mutated the primary config, build or policy input",
    );
  }

  const repeatInputBefore = JSON.stringify(repeatConfig);
  const repeat = runner(repeatConfig);
  if (JSON.stringify(repeatConfig) !== repeatInputBefore) {
    throw new GridBetaExecutionError(
      "grid beta is not deterministic: the simulator mutated the repeat config, build or policy input",
    );
  }

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
