import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GRID_READINESS_BUNDLE_ENTRIES,
  validateGridActivationReadinessBundle,
} from "../../src/readiness/readiness-bundle.js";
import {
  GRID_READINESS_CANONICAL_SEED_REGISTRY_CHECKSUM,
  gridReadinessSeedRegistryChecksum,
} from "../../src/readiness/seed-registry.js";
import {
  GRID_READINESS_CANONICAL_SCENARIO_REGISTRY_CHECKSUM,
  gridReadinessScenarioRegistryChecksum,
} from "../../src/readiness/scenario-registry.js";
import {
  GRID_ACTIVATION_READINESS_SUITE_ID,
  gridActivationReadinessSuiteChecksum,
} from "../../src/readiness/run-plan.js";
import { readinessTestSeedRegistry } from "../helpers/grid-readiness-bundle-builder.js";
import { createGridReadinessScenarioRegistry } from "../../src/readiness/scenario-registry.js";
import { buildGridActivationReadinessRunPlan } from "../../src/readiness/run-plan.js";
import {
  GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
  GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
} from "../../src/readiness/grid-grapple-supplement-bundle.js";

const OFFICIAL_V3_DIR = join(
  process.cwd(),
  "data",
  "readiness",
  "grid",
  GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
);

describe("grid grapple coverage supplement regressions (Phase 3E2)", () => {
  it("keeps the official v3 evaluation unchanged and valid when present", () => {
    if (!existsSync(OFFICIAL_V3_DIR)) return;
    const contents: Record<string, string> = {};
    for (const name of GRID_READINESS_BUNDLE_ENTRIES) {
      contents[name] = readFileSync(join(OFFICIAL_V3_DIR, name), "utf-8");
    }
    // The official v3 bundle must still pass the stronger validator.
    expect(() => validateGridActivationReadinessBundle(contents)).not.toThrow();
  });

  it("keeps the 24 canonical readiness seeds unchanged", () => {
    const seedRegistry = readinessTestSeedRegistry();
    expect(seedRegistry.seeds.length).toBe(24);
    expect(gridReadinessSeedRegistryChecksum(seedRegistry)).toBe(
      GRID_READINESS_CANONICAL_SEED_REGISTRY_CHECKSUM,
    );
  });

  it("keeps the original seven readiness scenarios unchanged", () => {
    const scenarioRegistry = createGridReadinessScenarioRegistry();
    expect(scenarioRegistry.scenarios.length).toBe(7);
    expect(scenarioRegistry.assignments.length).toBe(13);
    expect(gridReadinessScenarioRegistryChecksum(scenarioRegistry)).toBe(
      GRID_READINESS_CANONICAL_SCENARIO_REGISTRY_CHECKSUM,
    );
  });

  it("keeps the original 312-run suite checksum unchanged", () => {
    const seedRegistry = readinessTestSeedRegistry();
    const scenarioRegistry = createGridReadinessScenarioRegistry();
    const plan = buildGridActivationReadinessRunPlan({
      seedRegistry,
      scenarioRegistry,
    });
    expect(plan.runCount).toBe(312);
    expect(gridActivationReadinessSuiteChecksum(plan)).toBe(
      GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
    );
    expect(plan.suiteId).toBe(GRID_ACTIVATION_READINESS_SUITE_ID);
  });

  it("keeps the official base constants frozen", () => {
    expect(GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID).toBe(
      "0d8487a8-939d-4f9a-a16a-544b71eaa869",
    );
    expect(GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM).toBe(
      "c3b8a16d407891d0a92966fb9d6ed20fe5e11776bf545624fb3dbcadb4e2503c",
    );
  });
});
