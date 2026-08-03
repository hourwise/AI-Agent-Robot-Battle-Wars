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
  GRID_GRAPPLE_COVERAGE_BASE_V3_IDENTITY,
  GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_PLAN_CHECKSUM,
} from "../../src/readiness/grid-grapple-supplement-bundle.js";
import {
  GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM,
  gridGrappleCoverageScenarioRegistryChecksum,
} from "../../src/readiness/grid-grapple-scenarios.js";
import { createGridGrappleCoverageScenarioRegistry } from "../../src/readiness/grid-grapple-scenarios.js";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";

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

  it("keeps the official v3 base artifact hashes frozen and matching the on-disk bytes", () => {
    if (!existsSync(OFFICIAL_V3_DIR)) return;
    expect(GRID_GRAPPLE_COVERAGE_BASE_V3_IDENTITY.manifestChecksum).toBe(
      "46b1b888dd66021fc811451c1db8f22f21c912621fc85a90a4cc52980ff06f85",
    );
    expect(GRID_GRAPPLE_COVERAGE_BASE_V3_IDENTITY.decisionChecksum).toBe(
      "d4bf61e1e5c74bbb9181f95d22889fdae263e1520e58e8720e2bfe8cfeb07b9a",
    );
    expect(GRID_GRAPPLE_COVERAGE_BASE_V3_IDENTITY.metricsChecksum).toBe(
      "113bfa2cc66e364eab637f3d7c00b8f05602c355133fe21eb2aae6d79467eee4",
    );
    expect(sha256Hex(readFileSync(join(OFFICIAL_V3_DIR, "manifest.json"), "utf-8"))).toBe(
      GRID_GRAPPLE_COVERAGE_BASE_V3_IDENTITY.manifestChecksum,
    );
    expect(sha256Hex(readFileSync(join(OFFICIAL_V3_DIR, "decision.json"), "utf-8"))).toBe(
      GRID_GRAPPLE_COVERAGE_BASE_V3_IDENTITY.decisionChecksum,
    );
    expect(sha256Hex(readFileSync(join(OFFICIAL_V3_DIR, "metrics.json"), "utf-8"))).toBe(
      GRID_GRAPPLE_COVERAGE_BASE_V3_IDENTITY.metricsChecksum,
    );
  });

  it("keeps the supplemental scenario-registry and plan checksums frozen", () => {
    const scenarioRegistry = createGridGrappleCoverageScenarioRegistry();
    expect(gridGrappleCoverageScenarioRegistryChecksum(scenarioRegistry)).toBe(
      GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM,
    );
    expect(GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM).toBe(
      "1aba546d5e0aa3ef3c95ee5bb45b2c412480a3822543999b291227a22a8c503f",
    );
    expect(GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_PLAN_CHECKSUM).toBe(
      "e30dda08253c3cdaba771a5c4af810fcb17cd7a7669a1efcc2b86e5d9df01a26",
    );
  });
});
