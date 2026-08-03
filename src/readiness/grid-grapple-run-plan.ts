import { sha256Hex } from "../canary/grid-canary-digest.js";
import {
  gridReadinessSeedRegistryChecksum,
  type GridReadinessSeedRegistry,
} from "./seed-registry.js";
import type { GridReadinessCompetitor } from "./scenario-registry.js";
import {
  gridGrappleCoverageScenarioRegistryChecksum,
  type GridGrappleCoverageScenarioRegistry,
} from "./grid-grapple-scenarios.js";

/**
 * Frozen grid grapple-coverage supplemental run plan (Milestone 0.2C Phase
 * 3E2).
 *
 * The exact supplement is 24 canonical readiness seeds × 2 role assignments =
 * 48 matches. Ordering is frozen: assignment order → canonical readiness-seed
 * order. There is no shuffling and no seed cherry-picking; every entry is
 * frozen at runtime and the deterministic plan checksum includes the
 * supplement suite ID, the anchored base v3 evaluation ID and suite checksum,
 * the seed-registry checksum, the supplemental scenario-registry checksum,
 * the runtime identity and the ordered run tuples.
 */
export const GRID_GRAPPLE_COVERAGE_SUPPLEMENT_SUITE_ID =
  "grid-grapple-coverage-supplement-v1" as const;

export const GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT = 48 as const;
export const GRID_GRAPPLE_COVERAGE_SEED_COUNT = 24 as const;
export const GRID_GRAPPLE_COVERAGE_SCENARIO_COUNT = 1 as const;
export const GRID_GRAPPLE_COVERAGE_ASSIGNMENT_COUNT = 2 as const;

export interface GridGrappleCoverageRun {
  readonly runNumber: number;
  readonly scenarioId: "grid-grapple-coverage";
  readonly assignmentId: string;
  readonly seed: number;
  readonly roleSwapped: boolean;
  readonly fighterACompetitor: GridReadinessCompetitor;
  readonly fighterBCompetitor: GridReadinessCompetitor;
}

export interface GridGrappleCoverageRunPlan {
  readonly suiteId: "grid-grapple-coverage-supplement-v1";
  readonly baseV3EvaluationId: string;
  readonly baseV3SuiteChecksum: string;
  readonly runCount: 48;
  readonly seedCount: 24;
  readonly scenarioCount: 1;
  readonly assignmentCount: 2;
  readonly seedRegistryId: "grid-readiness-development-v1";
  readonly seedRegistryChecksum: string;
  readonly scenarioRegistryId: "grid-grapple-coverage-scenarios-v1";
  readonly scenarioRegistryChecksum: string;
  readonly simulatorVersion: "0.3.0";
  readonly positioningModel: "grid-3x3-v1";
  readonly rulesetVersion: "0.2.0";
  readonly catalogueVersion: "1";
  readonly runs: readonly GridGrappleCoverageRun[];
}

export class GridGrappleCoverageRunPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridGrappleCoverageRunPlanError";
  }
}

export interface BuildGridGrappleCoverageRunPlanParams {
  seedRegistry: GridReadinessSeedRegistry;
  scenarioRegistry: GridGrappleCoverageScenarioRegistry;
  /** The official v3 evaluation ID the supplement is anchored to. */
  baseV3EvaluationId: string;
  /** The official v3 suite checksum the supplement is anchored to. */
  baseV3SuiteChecksum: string;
}

/**
 * Pure supplemental run-plan builder. Produces exactly 48 frozen runs with a
 * unique `(assignmentId, seed)` tuple, ordered assignment → seed, and a
 * deterministic plan checksum.
 */
export function buildGridGrappleCoverageRunPlan(
  params: BuildGridGrappleCoverageRunPlanParams,
): GridGrappleCoverageRunPlan {
  const { seedRegistry, scenarioRegistry, baseV3EvaluationId, baseV3SuiteChecksum } =
    params;

  const seedRegistryChecksum = gridReadinessSeedRegistryChecksum(seedRegistry);
  const scenarioRegistryChecksum =
    gridGrappleCoverageScenarioRegistryChecksum(scenarioRegistry);

  const scenario = scenarioRegistry.scenarios[0]!;
  const runs: GridGrappleCoverageRun[] = [];
  let runNumber = 0;
  const seenTuples = new Set<string>();
  for (const assignment of scenarioRegistry.assignments) {
    for (const seed of seedRegistry.seeds) {
      runNumber += 1;
      const tuple = `${assignment.assignmentId}|${seed}`;
      if (seenTuples.has(tuple)) {
        throw new GridGrappleCoverageRunPlanError(
          `Grid grapple coverage run plan produced a duplicate (assignmentId, seed) tuple: ${tuple}`,
        );
      }
      seenTuples.add(tuple);
      runs.push(
        Object.freeze({
          runNumber,
          scenarioId: scenario.scenarioId,
          assignmentId: assignment.assignmentId,
          seed,
          roleSwapped: assignment.roleSwapped,
          fighterACompetitor: assignment.fighterACompetitor,
          fighterBCompetitor: assignment.fighterBCompetitor,
        }),
      );
    }
  }

  if (runs.length !== GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT) {
    throw new GridGrappleCoverageRunPlanError(
      `Grid grapple coverage run plan must contain exactly ${GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT} runs; built ${runs.length}`,
    );
  }

  const plan: GridGrappleCoverageRunPlan = Object.freeze({
    suiteId: GRID_GRAPPLE_COVERAGE_SUPPLEMENT_SUITE_ID,
    baseV3EvaluationId,
    baseV3SuiteChecksum,
    runCount: GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
    seedCount: seedRegistry.seeds.length as 24,
    scenarioCount: scenarioRegistry.scenarios.length as 1,
    assignmentCount: scenarioRegistry.assignments.length as 2,
    seedRegistryId: seedRegistry.registryId,
    seedRegistryChecksum,
    scenarioRegistryId: scenarioRegistry.registryId,
    scenarioRegistryChecksum,
    simulatorVersion: seedRegistry.simulatorVersion,
    positioningModel: seedRegistry.positioningModel,
    rulesetVersion: seedRegistry.rulesetVersion,
    catalogueVersion: seedRegistry.catalogueVersion,
    runs: Object.freeze(runs),
  });
  return plan;
}

/**
 * Deterministic supplemental plan checksum over the supplement suite ID, the
 * anchored base v3 evaluation ID and suite checksum, the registry IDs and
 * checksums, the runtime identity and the ordered run tuples.
 */
export function gridGrappleCoveragePlanChecksum(
  plan: GridGrappleCoverageRunPlan,
): string {
  const canonical = JSON.stringify({
    suiteId: plan.suiteId,
    baseV3EvaluationId: plan.baseV3EvaluationId,
    baseV3SuiteChecksum: plan.baseV3SuiteChecksum,
    seedRegistryId: plan.seedRegistryId,
    seedRegistryChecksum: plan.seedRegistryChecksum,
    scenarioRegistryId: plan.scenarioRegistryId,
    scenarioRegistryChecksum: plan.scenarioRegistryChecksum,
    simulatorVersion: plan.simulatorVersion,
    positioningModel: plan.positioningModel,
    rulesetVersion: plan.rulesetVersion,
    catalogueVersion: plan.catalogueVersion,
    runs: plan.runs.map((run) => ({
      runNumber: run.runNumber,
      scenarioId: run.scenarioId,
      assignmentId: run.assignmentId,
      seed: run.seed,
      roleSwapped: run.roleSwapped,
      fighterACompetitor: run.fighterACompetitor,
      fighterBCompetitor: run.fighterBCompetitor,
    })),
  });
  return sha256Hex(canonical);
}
