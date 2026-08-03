import type {
  MachineBuildProposal,
  ValidatedBuild,
} from "../validation/validation.types.js";
import type { ActionPolicy } from "../simulator/types.js";
import { validateBuild } from "../validation/build-validator.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import { sha256Hex } from "../canary/grid-canary-digest.js";
import {
  deepFreezeReadinessValue,
  type GridReadinessCompetitor,
} from "./scenario-registry.js";

/**
 * Frozen supplemental grapple-coverage scenario registry (Milestone 0.2C
 * Phase 3E2).
 *
 * A deliberately feature-exercising, additive scenario registry for the
 * isolated grapple-reposition coverage supplement. It contains exactly one
 * scenario (`grid-grapple-coverage`) with two role assignments and answers
 * whether the frozen grid runtime can produce valid, deterministic
 * grapple-reposition events in both fighter slots.
 *
 * This is NOT a balance scenario and does not modify the original readiness
 * Grappler or Bulwark scenarios. The original `grid-readiness-scenarios-v1`
 * registry (seven scenarios / thirteen assignments) is untouched.
 *
 * Every build is validated against catalogue v1 before use. Every factory
 * returns fresh deep-cloned builds and policies so shared module state can
 * never be mutated. The registry is deeply frozen at runtime and produces a
 * deterministic canonical checksum.
 */
export const GRID_GRAPPLE_COVERAGE_SCENARIO_REGISTRY_ID =
  "grid-grapple-coverage-scenarios-v1" as const;

export const GRID_GRAPPLE_COVERAGE_SCENARIO_ID = "grid-grapple-coverage" as const;
export const GRID_GRAPPLE_COVERAGE_SCENARIO_COUNT = 1 as const;
export const GRID_GRAPPLE_COVERAGE_ASSIGNMENT_COUNT = 2 as const;

/**
 * The frozen canonical checksum of the supplemental scenario registry. A
 * persisted supplemental scenario registry is canonical exactly when it is
 * structurally equal to a freshly created canonical registry AND its canonical
 * checksum equals this value.
 */
export const GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM =
  "1aba546d5e0aa3ef3c95ee5bb45b2c412480a3822543999b291227a22a8c503f" as const;

export interface GridGrappleCoverageFighterDefinition {
  displayName: string;
  buildProposal: MachineBuildProposal;
  policy: ActionPolicy;
}

export interface GridGrappleCoverageScenarioFamily {
  scenarioId: "grid-grapple-coverage";
  familyName: string;
  /** fighterX is always the Grapple Coverage Attacker. */
  fighterX: GridGrappleCoverageFighterDefinition;
  /** fighterY is always the Stationary Coverage Target. */
  fighterY: GridGrappleCoverageFighterDefinition;
}

export interface GridGrappleCoverageRoleAssignment {
  assignmentId: string;
  scenarioId: "grid-grapple-coverage";
  fighterACompetitor: GridReadinessCompetitor;
  fighterBCompetitor: GridReadinessCompetitor;
  roleSwapped: boolean;
}

export interface GridGrappleCoverageScenarioRegistry {
  readonly schemaVersion: "1";
  readonly registryId: "grid-grapple-coverage-scenarios-v1";
  readonly purpose: "supplemental-grapple-reposition-coverage";
  readonly simulatorVersion: "0.3.0";
  readonly positioningModel: "grid-3x3-v1";
  readonly rulesetVersion: "0.2.0";
  readonly catalogueVersion: "1";
  readonly scenarios: readonly GridGrappleCoverageScenarioFamily[];
  readonly assignments: readonly GridGrappleCoverageRoleAssignment[];
}

export class GridGrappleCoverageScenarioRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridGrappleCoverageScenarioRegistryError";
  }
}

/** Frozen Grapple Coverage Attacker definition (fighterX). */
const GRAPPLE_COVERAGE_ATTACKER: GridGrappleCoverageFighterDefinition = {
  displayName: "Grapple Coverage Attacker",
  buildProposal: {
    machineName: "Grapple Coverage Attacker",
    chassisId: "medium",
    mobilityId: "legs",
    weaponId: "grappler",
    utilityId: "traction_boost",
    armour: { front: 30, left: 25, right: 25, rear: 25, top: 15 },
    designSummary:
      "A maximum-aggression close-control grappler built to exercise grapple repositioning.",
    designRationale:
      "Legs and grappler for close-control repositioning, traction boost for stability, aggressive rush policy to force engagements.",
  },
  policy: {
    opening: "rush",
    preferredRange: "close",
    aggression: 100,
    primaryTarget: "front",
    secondaryTarget: "left",
    retreatThreshold: 0,
    heatThreshold: 100,
    fallback: "desperate_attack",
  },
};

/** Frozen Stationary Coverage Target definition (fighterY). */
const STATIONARY_COVERAGE_TARGET: GridGrappleCoverageFighterDefinition = {
  displayName: "Stationary Coverage Target",
  buildProposal: {
    machineName: "Stationary Coverage Target",
    chassisId: "light",
    mobilityId: "wheels",
    weaponId: "hammer",
    utilityId: "cooling",
    armour: { front: 20, left: 25, right: 25, rear: 35, top: 15 },
    designSummary:
      "A stationary defensive target that holds position so the attacker can grapple.",
    designRationale:
      "Hold policy with zero aggression and a heavy rear armour profile to remain a stable reposition target.",
  },
  policy: {
    opening: "hold",
    preferredRange: "medium",
    aggression: 0,
    primaryTarget: "front",
    secondaryTarget: "front",
    retreatThreshold: 0,
    heatThreshold: 100,
    fallback: "defend",
  },
};

/**
 * Frozen role assignments: attacker in fighter_a (assignment 1) and attacker
 * in fighter_b (assignment 2). Exact role swapping.
 */
const GRAPPLE_COVERAGE_ASSIGNMENTS: readonly GridGrappleCoverageRoleAssignment[] =
  Object.freeze([
    Object.freeze({
      assignmentId: "grapple-coverage-attacker-xa-target-yb",
      scenarioId: GRID_GRAPPLE_COVERAGE_SCENARIO_ID,
      fighterACompetitor: "x",
      fighterBCompetitor: "y",
      roleSwapped: false,
    }),
    Object.freeze({
      assignmentId: "grapple-coverage-target-ya-attacker-xb",
      scenarioId: GRID_GRAPPLE_COVERAGE_SCENARIO_ID,
      fighterACompetitor: "y",
      fighterBCompetitor: "x",
      roleSwapped: true,
    }),
  ]);

function validateFighterDefinition(
  competitor: GridReadinessCompetitor,
  definition: GridGrappleCoverageFighterDefinition,
): void {
  const result = validateBuild(definition.buildProposal, CATALOGUE_V1);
  if (!result.ok) {
    throw new GridGrappleCoverageScenarioRegistryError(
      `Grid grapple coverage fighter ${competitor} (${definition.displayName}) is not a legal catalogue v1 build: ${result.errors.map((e) => e.message).join(", ")}`,
    );
  }
}

function assertRegistryInvariants(registry: GridGrappleCoverageScenarioRegistry): void {
  if (registry.scenarios.length !== GRID_GRAPPLE_COVERAGE_SCENARIO_COUNT) {
    throw new GridGrappleCoverageScenarioRegistryError(
      `Grid grapple coverage registry must contain exactly ${GRID_GRAPPLE_COVERAGE_SCENARIO_COUNT} scenario; found ${registry.scenarios.length}`,
    );
  }
  const scenario = registry.scenarios[0]!;
  if (scenario.scenarioId !== GRID_GRAPPLE_COVERAGE_SCENARIO_ID) {
    throw new GridGrappleCoverageScenarioRegistryError(
      `Grid grapple coverage registry scenario id must be ${GRID_GRAPPLE_COVERAGE_SCENARIO_ID}; received ${scenario.scenarioId}`,
    );
  }
  if (registry.assignments.length !== GRID_GRAPPLE_COVERAGE_ASSIGNMENT_COUNT) {
    throw new GridGrappleCoverageScenarioRegistryError(
      `Grid grapple coverage registry must contain exactly ${GRID_GRAPPLE_COVERAGE_ASSIGNMENT_COUNT} assignments; found ${registry.assignments.length}`,
    );
  }
  const seen = new Set<string>();
  let nonSwapped = 0;
  let swapped = 0;
  for (const assignment of registry.assignments) {
    if (seen.has(assignment.assignmentId)) {
      throw new GridGrappleCoverageScenarioRegistryError(
        `Duplicate assignment id in grapple coverage registry: ${assignment.assignmentId}`,
      );
    }
    seen.add(assignment.assignmentId);
    if (assignment.scenarioId !== GRID_GRAPPLE_COVERAGE_SCENARIO_ID) {
      throw new GridGrappleCoverageScenarioRegistryError(
        `Grapple coverage assignment ${assignment.assignmentId} references unknown scenario ${assignment.scenarioId}`,
      );
    }
    if (assignment.roleSwapped) swapped += 1;
    else nonSwapped += 1;
    // Exact role swap: the two assignments must map the attacker (x) to
    // opposite slots.
    if (!(
      (assignment.fighterACompetitor === "x" &&
        assignment.fighterBCompetitor === "y" &&
        !assignment.roleSwapped) ||
      (assignment.fighterACompetitor === "y" &&
        assignment.fighterBCompetitor === "x" &&
        assignment.roleSwapped)
    )) {
      throw new GridGrappleCoverageScenarioRegistryError(
        `Grapple coverage assignment ${assignment.assignmentId} does not implement the canonical attacker/target role mapping`,
      );
    }
  }
  if (nonSwapped !== 1 || swapped !== 1) {
    throw new GridGrappleCoverageScenarioRegistryError(
      "Grapple coverage registry requires exactly one non-swapped and one role-swapped assignment",
    );
  }
}

/**
 * Builds and validates the deeply frozen supplemental scenario registry.
 * Every returned value is a fresh deeply frozen clone; no nested mutable
 * references are shared. Callers obtain fighter values through
 * `createGridGrappleCoverageFighterConfig`, which always returns fresh
 * mutable clones.
 */
export function createGridGrappleCoverageScenarioRegistry(): GridGrappleCoverageScenarioRegistry {
  validateFighterDefinition("x", GRAPPLE_COVERAGE_ATTACKER);
  validateFighterDefinition("y", STATIONARY_COVERAGE_TARGET);
  const scenarios = Object.freeze([
    Object.freeze({
      scenarioId: GRID_GRAPPLE_COVERAGE_SCENARIO_ID,
      familyName: "Grapple Coverage",
      fighterX: deepFreezeReadinessValue(GRAPPLE_COVERAGE_ATTACKER),
      fighterY: deepFreezeReadinessValue(STATIONARY_COVERAGE_TARGET),
    }),
  ]);
  const assignments = GRAPPLE_COVERAGE_ASSIGNMENTS.map((assignment) =>
    deepFreezeReadinessValue(assignment),
  );
  const registry: GridGrappleCoverageScenarioRegistry = Object.freeze({
    schemaVersion: "1",
    registryId: GRID_GRAPPLE_COVERAGE_SCENARIO_REGISTRY_ID,
    purpose: "supplemental-grapple-reposition-coverage",
    simulatorVersion: "0.3.0",
    positioningModel: "grid-3x3-v1",
    rulesetVersion: "0.2.0",
    catalogueVersion: "1",
    scenarios: Object.freeze(scenarios),
    assignments: Object.freeze(assignments),
  });
  assertRegistryInvariants(registry);
  return registry;
}

/**
 * Returns fresh deep-cloned build and policy values for one fighter of the
 * grapple-coverage scenario. Never returns shared module state, so callers
 * can mutate the returned values freely without affecting the registry or
 * other runs.
 */
export function createGridGrappleCoverageFighterConfig(
  scenario: GridGrappleCoverageScenarioFamily,
  competitor: GridReadinessCompetitor,
): { build: ValidatedBuild; policy: ActionPolicy } {
  const definition = competitor === "x" ? scenario.fighterX : scenario.fighterY;
  const result = validateBuild(definition.buildProposal, CATALOGUE_V1);
  if (!result.ok) {
    throw new GridGrappleCoverageScenarioRegistryError(
      `Grid grapple coverage fighter ${competitor} is not a legal catalogue v1 build: ${result.errors.map((e) => e.message).join(", ")}`,
    );
  }
  return {
    build: structuredClone(result.build),
    policy: { ...definition.policy },
  };
}

/**
 * Deterministic canonical supplemental scenario-registry checksum over the
 * exact scenario and assignment definitions in frozen order.
 */
export function gridGrappleCoverageScenarioRegistryChecksum(
  registry: GridGrappleCoverageScenarioRegistry,
): string {
  const canonical = JSON.stringify({
    schemaVersion: registry.schemaVersion,
    registryId: registry.registryId,
    purpose: registry.purpose,
    simulatorVersion: registry.simulatorVersion,
    positioningModel: registry.positioningModel,
    rulesetVersion: registry.rulesetVersion,
    catalogueVersion: registry.catalogueVersion,
    scenarios: registry.scenarios.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      familyName: scenario.familyName,
      fighterX: {
        displayName: scenario.fighterX.displayName,
        buildProposal: scenario.fighterX.buildProposal,
        policy: scenario.fighterX.policy,
      },
      fighterY: {
        displayName: scenario.fighterY.displayName,
        buildProposal: scenario.fighterY.buildProposal,
        policy: scenario.fighterY.policy,
      },
    })),
    assignments: registry.assignments.map((assignment) => ({
      assignmentId: assignment.assignmentId,
      scenarioId: assignment.scenarioId,
      fighterACompetitor: assignment.fighterACompetitor,
      fighterBCompetitor: assignment.fighterBCompetitor,
      roleSwapped: assignment.roleSwapped,
    })),
  });
  return sha256Hex(canonical);
}

/**
 * Pure canonical assertion. Requires exact structural equality with a freshly
 * created canonical registry AND the known canonical checksum.
 */
export function assertCanonicalGridGrappleCoverageScenarioRegistry(
  registry: GridGrappleCoverageScenarioRegistry,
): void {
  const canonical = createGridGrappleCoverageScenarioRegistry();
  if (JSON.stringify(registry) !== JSON.stringify(canonical)) {
    throw new GridGrappleCoverageScenarioRegistryError(
      "Grid grapple coverage scenario registry is not structurally equal to the canonical registry",
    );
  }
  const checksum = gridGrappleCoverageScenarioRegistryChecksum(registry);
  if (checksum !== GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM) {
    throw new GridGrappleCoverageScenarioRegistryError(
      `Grid grapple coverage scenario registry checksum does not match the canonical registry: expected ${GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM}, received ${checksum}`,
    );
  }
}
