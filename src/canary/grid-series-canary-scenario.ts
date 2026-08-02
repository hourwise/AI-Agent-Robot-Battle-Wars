import type { ValidatedBuild } from "../validation/validation.types.js";
import type { ActionPolicy } from "../simulator/types.js";
import { createBulwarkBuild, BULWARK_POLICY } from "../agents/scripted/bulwark-agent.js";

/**
 * Frozen built-in grid adaptive-series canary scenario (Milestone 0.2C Phase
 * 3D2B).
 *
 * `grid-series-canary-adaptive-v1` — a deliberate, deterministic, local-only
 * three-match adaptive series that exercises the full grid series pipeline
 * operationally:
 *
 *   three frozen grid matches
 *   → match-record v3 × 3
 *   → factual-report v2 × 3
 *   → replay × 3
 *   → deterministic fallback review × 3
 *   → two deterministic policy adaptations
 *   → series-record v2
 *   → validated atomic artifact bundle
 *
 * Fighter A (the deterministic local competitor) opens with a flank policy at
 * maximum aggression and adapts after matches 1 and 2 through the frozen
 * `grid-canary-policy-adaptation-v1` rule (no RNG, no provider, no mutation).
 * Fighter B is the canonical `BULWARK_POLICY` opponent. Both fighters use a
 * fresh deep-cloned Bulwark build every match. The series never changes the
 * build (`no nextDesign`), never records agent usage and never requires a
 * particular winner.
 *
 * The exact scenario values are part of the canary contract and must not be
 * tuned.
 */
export const GRID_SERIES_CANARY_SCENARIO_VERSION =
  "grid-series-canary-adaptive-v1" as const;

/** Frozen maximum matches for the series canary (three). */
export const GRID_SERIES_CANARY_MAXIMUM_MATCHES = 3 as const;

/** Frozen target wins for the series canary (three). */
export const GRID_SERIES_CANARY_TARGET_WINS = 3 as const;

/** Frozen deterministic local competitor identity. */
export const GRID_SERIES_CANARY_COMPETITOR = {
  id: "grid-canary-competitor",
  displayName: "Grid Canary Competitor",
  provider: "deterministic-local",
} as const;

/**
 * Frozen initial competitor policy (match 1). Exact values are part of the
 * canary contract and must not be tuned.
 */
const GRID_SERIES_CANARY_INITIAL_POLICY: ActionPolicy = {
  opening: "flank",
  preferredRange: "medium",
  aggression: 100,
  primaryTarget: "rear",
  secondaryTarget: "rear",
  retreatThreshold: 20,
  heatThreshold: 80,
  fallback: "defend",
};

/**
 * The frozen opponent policy — the canonical Bulwark policy. Cloned fresh for
 * every match so shared module state can never be mutated.
 */
const GRID_SERIES_CANARY_OPPONENT_POLICY: ActionPolicy = { ...BULWARK_POLICY };

export interface GridSeriesCanaryFighterConfig {
  build: ValidatedBuild;
  policy: ActionPolicy;
}

export interface GridSeriesCanaryScenario {
  readonly fighterA: GridSeriesCanaryFighterConfig;
  readonly fighterB: GridSeriesCanaryFighterConfig;
}

/**
 * Pure scenario factory. Returns fresh build and policy values on every call
 * so callers can never mutate shared scenario state.
 */
export function createGridSeriesCanaryScenario(): GridSeriesCanaryScenario {
  return {
    fighterA: {
      build: structuredClone(createBulwarkBuild()),
      policy: { ...GRID_SERIES_CANARY_INITIAL_POLICY },
    },
    fighterB: {
      build: structuredClone(createBulwarkBuild()),
      policy: { ...GRID_SERIES_CANARY_OPPONENT_POLICY },
    },
  };
}

/** The frozen scenario-version constant, exported for contract checks. */
export function gridSeriesCanaryScenarioVersion(): string {
  return GRID_SERIES_CANARY_SCENARIO_VERSION;
}

/** The frozen initial competitor policy, exported for contract checks. */
export function gridSeriesCanaryInitialPolicy(): ActionPolicy {
  return { ...GRID_SERIES_CANARY_INITIAL_POLICY };
}
