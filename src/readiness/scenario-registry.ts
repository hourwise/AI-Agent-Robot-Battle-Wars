import type {
  MachineBuildProposal,
  ValidatedBuild,
} from "../validation/validation.types.js";
import type { ActionPolicy } from "../simulator/types.js";
import {
  BULWARK_BUILD_PROPOSAL,
  BULWARK_POLICY,
} from "../agents/scripted/bulwark-agent.js";
import { validateBuild } from "../validation/build-validator.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import { sha256Hex } from "../canary/grid-canary-digest.js";

/**
 * Frozen grid activation-readiness scenario registry (Milestone 0.2C Phase
 * 3E1).
 *
 * Seven scenario families and thirteen concrete role assignments:
 *
 *   R1 bulwark-mirror    — one mirror assignment (X vs Y, both canonical
 *                          Bulwark build and BULWARK_POLICY).
 *   R2 flanker-bulwark   — Grid Flanker vs Bulwark, both role assignments.
 *   R3 spinner-bulwark   — Grid Spinner vs Bulwark, both role assignments.
 *   R4 grappler-bulwark  — Grid Grappler vs Bulwark, both role assignments.
 *   R5 flipper-bulwark   — Grid Flipper vs Bulwark, both role assignments.
 *   R6 runner-bulwark    — Grid Runner vs Bulwark, both role assignments.
 *   R7 sentinel-bulwark  — Grid Sentinel vs Bulwark, both role assignments.
 *
 * Every build is validated against catalogue v1 before any evaluation begins.
 * Every factory returns fresh deep-cloned builds and policies so shared module
 * state can never be mutated. The registry is frozen at runtime and produces a
 * deterministic canonical checksum.
 */
export const GRID_READINESS_SCENARIO_REGISTRY_ID = "grid-readiness-scenarios-v1" as const;

export const GRID_READINESS_SCENARIO_COUNT = 7 as const;
export const GRID_READINESS_ASSIGNMENT_COUNT = 13 as const;

export type GridReadinessCompetitor = "x" | "y";

export interface ReadinessFighterDefinition {
  displayName: string;
  buildProposal: MachineBuildProposal;
  policy: ActionPolicy;
}

export interface GridReadinessScenarioFamily {
  scenarioId: string;
  familyName: string;
  fighterX: ReadinessFighterDefinition;
  fighterY: ReadinessFighterDefinition;
}

export interface GridReadinessRoleAssignment {
  assignmentId: string;
  scenarioId: string;
  fighterACompetitor: GridReadinessCompetitor;
  fighterBCompetitor: GridReadinessCompetitor;
  roleSwapped: boolean;
}

export interface GridReadinessScenarioRegistry {
  readonly registryId: "grid-readiness-scenarios-v1";
  readonly simulatorVersion: "0.3.0";
  readonly positioningModel: "grid-3x3-v1";
  readonly rulesetVersion: "0.2.0";
  readonly catalogueVersion: "1";
  readonly scenarios: readonly GridReadinessScenarioFamily[];
  readonly assignments: readonly GridReadinessRoleAssignment[];
}

export class GridReadinessScenarioRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridReadinessScenarioRegistryError";
  }
}

/** Frozen Bulwark fighter definition (R1 mirror; the opponent for R2–R7). */
const BULWARK_FIGHTER: ReadinessFighterDefinition = {
  displayName: "The Bulwark",
  buildProposal: BULWARK_BUILD_PROPOSAL,
  policy: BULWARK_POLICY,
};

const FLANKER_FIGHTER: ReadinessFighterDefinition = {
  displayName: "Grid Flanker",
  buildProposal: {
    machineName: "Grid Flanker",
    chassisId: "medium",
    mobilityId: "wheels",
    weaponId: "hammer",
    utilityId: "cooling",
    armour: { front: 30, left: 25, right: 25, rear: 25, top: 15 },
    designSummary: "A fast flanking hammer robot that targets rear armour.",
    designRationale:
      "Wheel mobility for lateral flanking, hammer for rear attacks, cooling to sustain aggression.",
  },
  policy: {
    opening: "flank",
    preferredRange: "medium",
    aggression: 70,
    primaryTarget: "rear",
    secondaryTarget: "rear",
    retreatThreshold: 20,
    heatThreshold: 80,
    fallback: "retreat",
  },
};

const SPINNER_FIGHTER: ReadinessFighterDefinition = {
  displayName: "Grid Spinner",
  buildProposal: {
    machineName: "Grid Spinner",
    chassisId: "medium",
    mobilityId: "wheels",
    weaponId: "horizontal_spinner",
    utilityId: "traction_boost",
    armour: { front: 35, left: 25, right: 25, rear: 25, top: 10 },
    designSummary: "A cautious high-damage horizontal spinner.",
    designRationale:
      "Horizontal spinner for knockback, traction boost for ram resistance, frontal armour for engagement.",
  },
  policy: {
    opening: "cautious",
    preferredRange: "medium",
    aggression: 70,
    primaryTarget: "left",
    secondaryTarget: "right",
    retreatThreshold: 35,
    heatThreshold: 75,
    fallback: "retreat",
  },
};

const GRAPPLER_FIGHTER: ReadinessFighterDefinition = {
  displayName: "Grid Grappler",
  buildProposal: {
    machineName: "Grid Grappler",
    chassisId: "medium",
    mobilityId: "legs",
    weaponId: "grappler",
    utilityId: "traction_boost",
    armour: { front: 30, left: 25, right: 25, rear: 25, top: 15 },
    designSummary: "An aggressive control grappler that repositions opponents.",
    designRationale:
      "Legs and grappler for close-control repositioning, traction boost for stability.",
  },
  policy: {
    opening: "rush",
    preferredRange: "close",
    aggression: 85,
    primaryTarget: "rear",
    secondaryTarget: "left",
    retreatThreshold: 20,
    heatThreshold: 85,
    fallback: "defend",
  },
};

const FLIPPER_FIGHTER: ReadinessFighterDefinition = {
  displayName: "Grid Flipper",
  buildProposal: {
    machineName: "Grid Flipper",
    chassisId: "light",
    mobilityId: "wheels",
    weaponId: "flipper",
    utilityId: "cooling",
    armour: { front: 30, left: 25, right: 25, rear: 25, top: 15 },
    designSummary: "A fast lightweight flipper that aims to overturn opponents.",
    designRationale:
      "Light chassis and wheels for speed, flipper for overturn chance, cooling for sustained flips.",
  },
  policy: {
    opening: "rush",
    preferredRange: "close",
    aggression: 90,
    primaryTarget: "top",
    secondaryTarget: "rear",
    retreatThreshold: 15,
    heatThreshold: 85,
    fallback: "desperate_attack",
  },
};

const RUNNER_FIGHTER: ReadinessFighterDefinition = {
  displayName: "Grid Runner",
  buildProposal: {
    machineName: "Grid Runner",
    chassisId: "light",
    mobilityId: "wheels",
    weaponId: "ram",
    utilityId: "cooling",
    armour: { front: 20, left: 25, right: 25, rear: 35, top: 15 },
    designSummary: "A hit-and-run rammer that fights from range.",
    designRationale:
      "Light, fast ram with rear armour for escape and cooling for prolonged runs.",
  },
  policy: {
    opening: "cautious",
    preferredRange: "far",
    aggression: 40,
    primaryTarget: "rear",
    secondaryTarget: "left",
    retreatThreshold: 80,
    heatThreshold: 70,
    fallback: "retreat",
  },
};

const SENTINEL_FIGHTER: ReadinessFighterDefinition = {
  displayName: "Grid Sentinel",
  buildProposal: {
    machineName: "Grid Sentinel",
    chassisId: "medium",
    mobilityId: "tracks",
    weaponId: "hammer",
    utilityId: "reinforced_drive",
    armour: { front: 40, left: 25, right: 25, rear: 20, top: 10 },
    designSummary: "A fully defensive hammer sentinel that holds position.",
    designRationale:
      "Tracks, reinforced drive and heavy frontal armour for a static hold; hammer for counter-attacks.",
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
 * Focused deep-freeze helper (Phase 3E1.1). Clones every nested plain object
 * or array first, then freezes the clone, so caller-owned module state is
 * never frozen in place and no mutable nested references are shared between
 * two frozen values.
 */
export function deepFreezeReadinessValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => deepFreezeReadinessValue(item))) as T;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const clone: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
      clone[key] = deepFreezeReadinessValue(record[key]);
    }
    return Object.freeze(clone) as T;
  }
  return value;
}

/** Fighter source data keyed by a short identifier. */
const FIGHTER_SOURCES: Readonly<Record<string, ReadinessFighterDefinition>> = {
  bulwark: BULWARK_FIGHTER,
  flanker: FLANKER_FIGHTER,
  spinner: SPINNER_FIGHTER,
  grappler: GRAPPLER_FIGHTER,
  flipper: FLIPPER_FIGHTER,
  runner: RUNNER_FIGHTER,
  sentinel: SENTINEL_FIGHTER,
};

/**
 * Frozen scenario family definitions in canonical order (R1–R7). Each entry
 * references fighter source keys; the registry factory creates a distinct
 * deeply frozen copy of every fighter definition per occurrence, so equal
 * Bulwark definitions in different scenarios (and the mirror X and Y) never
 * share nested references.
 */
const SCENARIO_DEFS: ReadonlyArray<{
  scenarioId: string;
  familyName: string;
  fighterXSource: string;
  fighterYSource: string;
}> = [
  {
    scenarioId: "bulwark-mirror",
    familyName: "Bulwark Mirror",
    fighterXSource: "bulwark",
    fighterYSource: "bulwark",
  },
  {
    scenarioId: "flanker-bulwark",
    familyName: "Flanker versus Bulwark",
    fighterXSource: "flanker",
    fighterYSource: "bulwark",
  },
  {
    scenarioId: "spinner-bulwark",
    familyName: "Spinner versus Bulwark",
    fighterXSource: "spinner",
    fighterYSource: "bulwark",
  },
  {
    scenarioId: "grappler-bulwark",
    familyName: "Grappler versus Bulwark",
    fighterXSource: "grappler",
    fighterYSource: "bulwark",
  },
  {
    scenarioId: "flipper-bulwark",
    familyName: "Flipper versus Bulwark",
    fighterXSource: "flipper",
    fighterYSource: "bulwark",
  },
  {
    scenarioId: "runner-bulwark",
    familyName: "Runner versus Bulwark",
    fighterXSource: "runner",
    fighterYSource: "bulwark",
  },
  {
    scenarioId: "sentinel-bulwark",
    familyName: "Sentinel versus Bulwark",
    fighterXSource: "sentinel",
    fighterYSource: "bulwark",
  },
];

/** Frozen role assignments: one mirror + six role-swapped pairs. */
const SCENARIO_ASSIGNMENTS: readonly GridReadinessRoleAssignment[] = Object.freeze([
  Object.freeze({
    assignmentId: "bulwark-mirror-xa-yb",
    scenarioId: "bulwark-mirror",
    fighterACompetitor: "x",
    fighterBCompetitor: "y",
    roleSwapped: false,
  }),
  Object.freeze({
    assignmentId: "flanker-bulwark-xa-yb",
    scenarioId: "flanker-bulwark",
    fighterACompetitor: "x",
    fighterBCompetitor: "y",
    roleSwapped: false,
  }),
  Object.freeze({
    assignmentId: "flanker-bulwark-ya-xb",
    scenarioId: "flanker-bulwark",
    fighterACompetitor: "y",
    fighterBCompetitor: "x",
    roleSwapped: true,
  }),
  Object.freeze({
    assignmentId: "spinner-bulwark-xa-yb",
    scenarioId: "spinner-bulwark",
    fighterACompetitor: "x",
    fighterBCompetitor: "y",
    roleSwapped: false,
  }),
  Object.freeze({
    assignmentId: "spinner-bulwark-ya-xb",
    scenarioId: "spinner-bulwark",
    fighterACompetitor: "y",
    fighterBCompetitor: "x",
    roleSwapped: true,
  }),
  Object.freeze({
    assignmentId: "grappler-bulwark-xa-yb",
    scenarioId: "grappler-bulwark",
    fighterACompetitor: "x",
    fighterBCompetitor: "y",
    roleSwapped: false,
  }),
  Object.freeze({
    assignmentId: "grappler-bulwark-ya-xb",
    scenarioId: "grappler-bulwark",
    fighterACompetitor: "y",
    fighterBCompetitor: "x",
    roleSwapped: true,
  }),
  Object.freeze({
    assignmentId: "flipper-bulwark-xa-yb",
    scenarioId: "flipper-bulwark",
    fighterACompetitor: "x",
    fighterBCompetitor: "y",
    roleSwapped: false,
  }),
  Object.freeze({
    assignmentId: "flipper-bulwark-ya-xb",
    scenarioId: "flipper-bulwark",
    fighterACompetitor: "y",
    fighterBCompetitor: "x",
    roleSwapped: true,
  }),
  Object.freeze({
    assignmentId: "runner-bulwark-xa-yb",
    scenarioId: "runner-bulwark",
    fighterACompetitor: "x",
    fighterBCompetitor: "y",
    roleSwapped: false,
  }),
  Object.freeze({
    assignmentId: "runner-bulwark-ya-xb",
    scenarioId: "runner-bulwark",
    fighterACompetitor: "y",
    fighterBCompetitor: "x",
    roleSwapped: true,
  }),
  Object.freeze({
    assignmentId: "sentinel-bulwark-xa-yb",
    scenarioId: "sentinel-bulwark",
    fighterACompetitor: "x",
    fighterBCompetitor: "y",
    roleSwapped: false,
  }),
  Object.freeze({
    assignmentId: "sentinel-bulwark-ya-xb",
    scenarioId: "sentinel-bulwark",
    fighterACompetitor: "y",
    fighterBCompetitor: "x",
    roleSwapped: true,
  }),
]);

function validateFighterDefinition(
  scenarioId: string,
  competitor: GridReadinessCompetitor,
  definition: ReadinessFighterDefinition,
): void {
  const result = validateBuild(definition.buildProposal, CATALOGUE_V1);
  if (!result.ok) {
    throw new GridReadinessScenarioRegistryError(
      `Grid readiness scenario ${scenarioId} fighter ${competitor} (${definition.displayName}) is not a legal catalogue v1 build: ${result.errors.map((e) => e.message).join(", ")}`,
    );
  }
}

function assertRegistryInvariants(registry: GridReadinessScenarioRegistry): void {
  const scenarioIds = new Set<string>();
  for (const scenario of registry.scenarios) {
    if (scenarioIds.has(scenario.scenarioId)) {
      throw new GridReadinessScenarioRegistryError(
        `Duplicate scenario id in readiness scenario registry: ${scenario.scenarioId}`,
      );
    }
    scenarioIds.add(scenario.scenarioId);
  }
  if (scenarioIds.size !== GRID_READINESS_SCENARIO_COUNT) {
    throw new GridReadinessScenarioRegistryError(
      `Readiness scenario registry must contain exactly ${GRID_READINESS_SCENARIO_COUNT} scenarios; found ${scenarioIds.size}`,
    );
  }

  const assignmentIds = new Set<string>();
  for (const assignment of registry.assignments) {
    if (assignmentIds.has(assignment.assignmentId)) {
      throw new GridReadinessScenarioRegistryError(
        `Duplicate assignment id in readiness scenario registry: ${assignment.assignmentId}`,
      );
    }
    assignmentIds.add(assignment.assignmentId);
    if (!scenarioIds.has(assignment.scenarioId)) {
      throw new GridReadinessScenarioRegistryError(
        `Readiness assignment ${assignment.assignmentId} references unknown scenario ${assignment.scenarioId}`,
      );
    }
  }
  if (assignmentIds.size !== GRID_READINESS_ASSIGNMENT_COUNT) {
    throw new GridReadinessScenarioRegistryError(
      `Readiness scenario registry must contain exactly ${GRID_READINESS_ASSIGNMENT_COUNT} assignments; found ${assignmentIds.size}`,
    );
  }
}

/**
 * Builds and validates the deeply frozen scenario registry. Every returned
 * value — registry, scenarios, assignments, every scenario, every
 * assignment, every fighter definition, every build proposal, every armour
 * object and every policy — is a fresh deeply frozen clone. Equal Bulwark
 * definitions in different scenarios, and the mirror fighter X and Y, are
 * distinct deeply frozen values with equal content; no scenario shares
 * mutable nested references with another. The serialized bytes and canonical
 * checksum are unchanged because the values are unchanged. Callers must
 * obtain fighter values through `createGridReadinessFighterConfig`, which
 * always returns fresh mutable clones.
 */
export function createGridReadinessScenarioRegistry(): GridReadinessScenarioRegistry {
  const scenarios: GridReadinessScenarioFamily[] = SCENARIO_DEFS.map((def) => {
    const fighterXSource = FIGHTER_SOURCES[def.fighterXSource]!;
    const fighterYSource = FIGHTER_SOURCES[def.fighterYSource]!;
    validateFighterDefinition(def.scenarioId, "x", fighterXSource);
    validateFighterDefinition(def.scenarioId, "y", fighterYSource);
    return Object.freeze({
      scenarioId: def.scenarioId,
      familyName: def.familyName,
      fighterX: deepFreezeReadinessValue(fighterXSource),
      fighterY: deepFreezeReadinessValue(fighterYSource),
    });
  });
  const assignments = SCENARIO_ASSIGNMENTS.map((assignment) =>
    deepFreezeReadinessValue(assignment),
  );
  const registry: GridReadinessScenarioRegistry = Object.freeze({
    registryId: GRID_READINESS_SCENARIO_REGISTRY_ID,
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
 * Returns fresh deep-cloned build and policy values for one fighter of a
 * scenario. Never returns shared module state, so callers can mutate the
 * returned values freely without affecting the registry or other runs.
 */
export function createGridReadinessFighterConfig(
  scenario: GridReadinessScenarioFamily,
  competitor: GridReadinessCompetitor,
): { build: ValidatedBuild; policy: ActionPolicy } {
  const definition = competitor === "x" ? scenario.fighterX : scenario.fighterY;
  const result = validateBuild(definition.buildProposal, CATALOGUE_V1);
  if (!result.ok) {
    throw new GridReadinessScenarioRegistryError(
      `Grid readiness scenario ${scenario.scenarioId} fighter ${competitor} is not a legal catalogue v1 build: ${result.errors.map((e) => e.message).join(", ")}`,
    );
  }
  return {
    build: structuredClone(result.build),
    policy: { ...definition.policy },
  };
}

/**
 * Deterministic canonical scenario-registry checksum over the exact scenario
 * and assignment definitions in frozen order.
 */
export function gridReadinessScenarioRegistryChecksum(
  registry: GridReadinessScenarioRegistry,
): string {
  const canonical = JSON.stringify({
    registryId: registry.registryId,
    simulatorVersion: registry.simulatorVersion,
    positioningModel: registry.positioningModel,
    rulesetVersion: registry.rulesetVersion,
    catalogueVersion: registry.catalogueVersion,
    scenarios: registry.scenarios.map((scenario) => ({
      scenarioId: scenario.scenarioId,
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
