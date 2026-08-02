import { describe, expect, it } from "vitest";
import {
  createGridReadinessScenarioRegistry,
  createGridReadinessFighterConfig,
  gridReadinessScenarioRegistryChecksum,
  GRID_READINESS_SCENARIO_COUNT,
  GRID_READINESS_ASSIGNMENT_COUNT,
  GridReadinessScenarioRegistryError,
  type GridReadinessScenarioRegistry,
} from "../../src/readiness/scenario-registry.js";
import { validateBuild } from "../../src/validation/build-validator.js";
import { parseActionPolicy } from "../../src/schemas/policy.schema.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";

const FROZEN_SCENARIO_IDS = [
  "bulwark-mirror",
  "flanker-bulwark",
  "spinner-bulwark",
  "grappler-bulwark",
  "flipper-bulwark",
  "runner-bulwark",
  "sentinel-bulwark",
];

const FROZEN_SCENARIO_CHECKSUM =
  "b07270171f6e38efac2d1992f051d7bd881e323c00cee92b9caa9490ddb85b67";

function buildRegistry(): GridReadinessScenarioRegistry {
  return createGridReadinessScenarioRegistry();
}

describe("grid readiness scenario registry (Phase 3E1)", () => {
  it("contains exactly seven scenarios with the exact ids and order", () => {
    const registry = buildRegistry();
    expect(registry.scenarios.length).toBe(GRID_READINESS_SCENARIO_COUNT);
    expect(registry.scenarios.map((s) => s.scenarioId)).toEqual(FROZEN_SCENARIO_IDS);
  });

  it("contains exactly thirteen assignments", () => {
    const registry = buildRegistry();
    expect(registry.assignments.length).toBe(GRID_READINESS_ASSIGNMENT_COUNT);
    expect(new Set(registry.assignments.map((a) => a.assignmentId)).size).toBe(13);
  });

  it("has exactly one mirror assignment and six role-swapped pairs", () => {
    const registry = buildRegistry();
    const mirror = registry.assignments.filter((a) => a.scenarioId === "bulwark-mirror");
    expect(mirror.length).toBe(1);
    expect(mirror[0]!.roleSwapped).toBe(false);
    expect(mirror[0]!.fighterACompetitor).toBe("x");
    expect(mirror[0]!.fighterBCompetitor).toBe("y");

    const paired = registry.assignments.filter((a) => a.scenarioId !== "bulwark-mirror");
    expect(paired.length).toBe(12);
    const byScenario = new Map<string, typeof paired>();
    for (const assignment of paired) {
      const list = byScenario.get(assignment.scenarioId) ?? [];
      list.push(assignment);
      byScenario.set(assignment.scenarioId, list);
    }
    expect(byScenario.size).toBe(6);
    for (const [scenarioId, assignments] of byScenario) {
      expect(assignments.length).toBe(2);
      const swapped = assignments.find((a) => a.roleSwapped);
      const unswapped = assignments.find((a) => !a.roleSwapped);
      expect(scenarioId).not.toBe("bulwark-mirror");
      expect(unswapped!.fighterACompetitor).toBe("x");
      expect(unswapped!.fighterBCompetitor).toBe("y");
      expect(swapped!.fighterACompetitor).toBe("y");
      expect(swapped!.fighterBCompetitor).toBe("x");
    }
  });

  it("validates every build against catalogue v1 and every policy against the schema", () => {
    const registry = buildRegistry();
    for (const scenario of registry.scenarios) {
      for (const competitor of ["x", "y"] as const) {
        const definition = competitor === "x" ? scenario.fighterX : scenario.fighterY;
        const result = validateBuild(definition.buildProposal, CATALOGUE_V1);
        expect(
          result.ok,
          `${scenario.scenarioId} ${competitor} build must be legal`,
        ).toBe(true);
        const policy = parseActionPolicy(definition.policy);
        expect(
          policy.success,
          `${scenario.scenarioId} ${competitor} policy must be valid`,
        ).toBe(true);
      }
    }
  });

  it("returns fresh deep-cloned build and policy values", () => {
    const registry = buildRegistry();
    const scenario = registry.scenarios.find((s) => s.scenarioId === "flanker-bulwark")!;
    const a = createGridReadinessFighterConfig(scenario, "x");
    const b = createGridReadinessFighterConfig(scenario, "x");
    expect(a.build).not.toBe(b.build);
    expect(a.build.proposal).not.toBe(b.build.proposal);
    expect(a.policy).not.toBe(b.policy);
    expect(a.build).toEqual(b.build);
    expect(a.policy).toEqual(b.policy);
    // Mutating a returned value must not affect a later fresh clone.
    a.policy.aggression = 0;
    const c = createGridReadinessFighterConfig(scenario, "x");
    expect(c.policy.aggression).toBe(70);
  });

  it("freezes the registry and its nested values", () => {
    const registry = buildRegistry();
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.scenarios)).toBe(true);
    expect(Object.isFrozen(registry.assignments)).toBe(true);
  });

  it("uses the exact grid runtime identity", () => {
    const registry = buildRegistry();
    expect(registry.simulatorVersion).toBe("0.3.0");
    expect(registry.positioningModel).toBe("grid-3x3-v1");
    expect(registry.rulesetVersion).toBe("0.2.0");
    expect(registry.catalogueVersion).toBe("1");
    expect(registry.registryId).toBe("grid-readiness-scenarios-v1");
  });

  it("produces the frozen canonical scenario-registry checksum", () => {
    expect(gridReadinessScenarioRegistryChecksum(buildRegistry())).toBe(
      FROZEN_SCENARIO_CHECKSUM,
    );
  });

  it("rejects an illegal build in createGridReadinessFighterConfig", () => {
    const registry = buildRegistry();
    const scenario = registry.scenarios.find((s) => s.scenarioId === "flanker-bulwark")!;
    const bad = {
      ...scenario,
      fighterX: {
        ...scenario.fighterX,
        buildProposal: {
          ...scenario.fighterX.buildProposal,
          weaponId: "invalid" as never,
        },
      },
    };
    expect(() => createGridReadinessFighterConfig(bad, "x")).toThrow(
      GridReadinessScenarioRegistryError,
    );
  });
});
