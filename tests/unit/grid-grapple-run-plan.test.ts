import { describe, expect, it } from "vitest";
import { readinessTestSeedRegistry } from "../helpers/grid-readiness-bundle-builder.js";
import { createGridGrappleCoverageScenarioRegistry } from "../../src/readiness/grid-grapple-scenarios.js";
import {
  buildGridGrappleCoverageRunPlan,
  gridGrappleCoveragePlanChecksum,
  GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
  GRID_GRAPPLE_COVERAGE_SUPPLEMENT_SUITE_ID,
  GridGrappleCoverageRunPlanError,
} from "../../src/readiness/grid-grapple-run-plan.js";
import {
  GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
  GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
  GRID_GRAPPLE_COVERAGE_BASE_V3_SEED_REGISTRY_CHECKSUM,
} from "../../src/readiness/grid-grapple-supplement-bundle.js";
import { GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM } from "../../src/readiness/grid-grapple-scenarios.js";

const OFFICIAL_PLAN_CHECKSUM =
  "e30dda08253c3cdaba771a5c4af810fcb17cd7a7669a1efcc2b86e5d9df01a26";

function buildFixturePlan() {
  const seedRegistry = readinessTestSeedRegistry();
  const scenarioRegistry = createGridGrappleCoverageScenarioRegistry();
  return buildGridGrappleCoverageRunPlan({
    seedRegistry,
    scenarioRegistry,
    baseV3EvaluationId: GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
    baseV3SuiteChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
  });
}

describe("grid grapple coverage run plan (Phase 3E2)", () => {
  it("builds exactly 48 runs with unique (assignmentId, seed) tuples", () => {
    const plan = buildFixturePlan();
    expect(plan.runCount).toBe(GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT);
    expect(plan.runs.length).toBe(GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT);
    const tuples = new Set<string>();
    for (const run of plan.runs) {
      expect(run.runNumber).toBeGreaterThanOrEqual(1);
      expect(run.runNumber).toBeLessThanOrEqual(
        GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
      );
      tuples.add(`${run.assignmentId}|${run.seed}`);
    }
    expect(tuples.size).toBe(GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT);
  });

  it("uses all 24 canonical seeds exactly twice, in registry order", () => {
    const plan = buildFixturePlan();
    const seedRegistry = readinessTestSeedRegistry();
    const counts = new Map<number, number>();
    for (const run of plan.runs) {
      counts.set(run.seed, (counts.get(run.seed) ?? 0) + 1);
    }
    expect(counts.size).toBe(seedRegistry.seeds.length);
    for (const seed of seedRegistry.seeds) {
      expect(counts.get(seed)).toBe(2);
    }
    // Exact ordering: assignment order → seed registry order.
    const firstAssignmentSeeds = plan.runs
      .filter((r) => r.runNumber <= 24)
      .map((r) => r.seed);
    expect(firstAssignmentSeeds).toEqual([...seedRegistry.seeds]);
  });

  it("freezes the plan and every entry", () => {
    const plan = buildFixturePlan();
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.runs)).toBe(true);
    for (const run of plan.runs) expect(Object.isFrozen(run)).toBe(true);
  });

  it("anchors the supplement suite ID, base v3 identity and runtime identity", () => {
    const plan = buildFixturePlan();
    expect(plan.suiteId).toBe(GRID_GRAPPLE_COVERAGE_SUPPLEMENT_SUITE_ID);
    expect(plan.baseV3EvaluationId).toBe(GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID);
    expect(plan.baseV3SuiteChecksum).toBe(GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM);
    expect(plan.seedRegistryId).toBe("grid-readiness-development-v1");
    expect(plan.seedRegistryChecksum).toBe(
      GRID_GRAPPLE_COVERAGE_BASE_V3_SEED_REGISTRY_CHECKSUM,
    );
    expect(plan.scenarioRegistryId).toBe("grid-grapple-coverage-scenarios-v1");
    expect(plan.scenarioRegistryChecksum).toBe(
      GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM,
    );
    expect(plan.simulatorVersion).toBe("0.3.0");
    expect(plan.positioningModel).toBe("grid-3x3-v1");
    expect(plan.rulesetVersion).toBe("0.2.0");
    expect(plan.catalogueVersion).toBe("1");
  });

  it("produces a deterministic plan checksum that changes with the base anchor", () => {
    const plan = buildFixturePlan();
    const checksum = gridGrappleCoveragePlanChecksum(plan);
    expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(gridGrappleCoveragePlanChecksum(plan)).toBe(checksum);
    expect(checksum).toBe(OFFICIAL_PLAN_CHECKSUM);

    const seedRegistry = readinessTestSeedRegistry();
    const scenarioRegistry = createGridGrappleCoverageScenarioRegistry();
    const different = buildGridGrappleCoverageRunPlan({
      seedRegistry,
      scenarioRegistry,
      baseV3EvaluationId: "99999999-9999-4999-8999-999999999999",
      baseV3SuiteChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
    });
    expect(gridGrappleCoveragePlanChecksum(different)).not.toBe(checksum);
  });

  it("rejects duplicate tuples and wrong run counts", () => {
    const seedRegistry = readinessTestSeedRegistry();
    const scenarioRegistry = createGridGrappleCoverageScenarioRegistry();
    // A scenario registry with a duplicated assignment must fail the plan.
    const duplicated = {
      ...scenarioRegistry,
      assignments: [
        scenarioRegistry.assignments[0],
        scenarioRegistry.assignments[0],
      ] as never,
    };
    expect(() =>
      buildGridGrappleCoverageRunPlan({
        seedRegistry,
        scenarioRegistry: duplicated,
        baseV3EvaluationId: GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
        baseV3SuiteChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
      }),
    ).toThrow(GridGrappleCoverageRunPlanError);
  });
});
