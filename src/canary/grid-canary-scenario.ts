import type { ValidatedBuild } from "../validation/validation.types.js";
import type { ActionPolicy } from "../simulator/types.js";
import { createBulwarkBuild } from "../agents/scripted/bulwark-agent.js";

/**
 * Frozen built-in grid canary scenario (Milestone 0.2C Phase 3D2A).
 *
 * `grid-canary-flank-v1` — a deliberate, deterministic, no-combat flank
 * scenario that exercises the opt-in grid pipeline operationally:
 *
 *   built-in scenario
 *   → runGridMatch
 *   → match-record v3
 *   → factual-report v2
 *   → replay
 *   → deterministic fallback review
 *   → validated atomic artifact bundle
 *
 * Fighter A (`opening: flank`) advances then translatedly circles; fighter B
 * (`opening: hold`) remains stationary. Both fighters always defend
 * (aggression 0), so no attack, damage or component event can occur and the
 * match reaches the frozen round cap, resolving by judges as a draw. The
 * flanking path produces observable grid-only positioning evidence (translated
 * circles, a canonical corner visit, and a rear-adjacent flanking position)
 * without depending on a lucky random combat result.
 */
export const GRID_CANARY_SCENARIO_VERSION = "grid-canary-flank-v1" as const;

/**
 * Frozen Fighter A policy (flank). Exact values are part of the canary
 * contract and must not be tuned.
 */
const GRID_CANARY_FIGHTER_A_POLICY: ActionPolicy = {
  opening: "flank",
  preferredRange: "medium",
  aggression: 0,
  primaryTarget: "rear",
  secondaryTarget: "rear",
  retreatThreshold: 0,
  heatThreshold: 100,
  fallback: "defend",
};

/**
 * Frozen Fighter B policy (hold). Exact values are part of the canary
 * contract and must not be tuned.
 */
const GRID_CANARY_FIGHTER_B_POLICY: ActionPolicy = {
  opening: "hold",
  preferredRange: "medium",
  aggression: 0,
  primaryTarget: "front",
  secondaryTarget: "front",
  retreatThreshold: 0,
  heatThreshold: 100,
  fallback: "defend",
};

export interface GridCanaryFighterConfig {
  build: ValidatedBuild;
  policy: ActionPolicy;
}

export interface GridCanaryScenario {
  readonly fighterA: GridCanaryFighterConfig;
  readonly fighterB: GridCanaryFighterConfig;
}

function freshPolicy(policy: ActionPolicy): ActionPolicy {
  return { ...policy };
}

/**
 * Pure scenario factory. Returns fresh build and policy values on every call
 * so callers can never mutate shared scenario state. `createBulwarkBuild()`
 * shares the module-level Bulwark proposal, so the build is deep-cloned here.
 */
export function createGridCanaryScenario(): GridCanaryScenario {
  return {
    fighterA: {
      build: structuredClone(createBulwarkBuild()),
      policy: freshPolicy(GRID_CANARY_FIGHTER_A_POLICY),
    },
    fighterB: {
      build: structuredClone(createBulwarkBuild()),
      policy: freshPolicy(GRID_CANARY_FIGHTER_B_POLICY),
    },
  };
}

/** The frozen scenario-version constant, exported for contract checks. */
export function gridCanaryScenarioVersion(): string {
  return GRID_CANARY_SCENARIO_VERSION;
}
