import { describe, expect, it } from "vitest";
import {
  createGridReadinessScenarioRegistry,
  createGridReadinessFighterConfig,
  gridReadinessScenarioRegistryChecksum,
  assertCanonicalGridReadinessScenarioRegistry,
  GRID_READINESS_CANONICAL_SCENARIO_REGISTRY_CHECKSUM,
  GRID_READINESS_SCENARIO_COUNT,
  GRID_READINESS_ASSIGNMENT_COUNT,
  GridReadinessScenarioRegistryError,
  type GridReadinessScenarioRegistry,
} from "../../src/readiness/scenario-registry.js";
import {
  deserializeGridActivationReadinessScenarioRegistry,
  serializeGridReadinessScenarioRegistry,
} from "../../src/readiness/readiness-bundle.js";
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

  it("deep-freezes every nested fighter definition, build proposal, armour and policy", () => {
    const registry = buildRegistry();
    for (const scenario of registry.scenarios) {
      expect(Object.isFrozen(scenario)).toBe(true);
      for (const competitor of ["fighterX", "fighterY"] as const) {
        const definition = scenario[competitor];
        expect(Object.isFrozen(definition)).toBe(true);
        expect(Object.isFrozen(definition.buildProposal)).toBe(true);
        expect(Object.isFrozen(definition.buildProposal.armour)).toBe(true);
        expect(Object.isFrozen(definition.policy)).toBe(true);
      }
    }
    for (const assignment of registry.assignments) {
      expect(Object.isFrozen(assignment)).toBe(true);
    }
  });

  it("gives every Bulwark definition a distinct identity with equal content (no shared references)", () => {
    const registry = buildRegistry();
    const bulwarkValues = registry.scenarios
      .flatMap((scenario) =>
        ["fighterX", "fighterY"].map((c) => scenario[c as "fighterX" | "fighterY"]),
      )
      .filter((d) => d.displayName === "The Bulwark");
    // The mirror contributes two Bulwarks; every other scenario contributes one.
    expect(bulwarkValues.length).toBe(8);
    const seen = new Set<object>();
    let distinct = 0;
    for (const definition of bulwarkValues) {
      if (!seen.has(definition)) {
        seen.add(definition);
        distinct += 1;
      }
    }
    // All eight Bulwark definitions are distinct objects.
    expect(distinct).toBe(8);
    // But every Bulwark is structurally equal.
    const content = JSON.stringify(bulwarkValues[0]);
    for (const definition of bulwarkValues) {
      expect(JSON.stringify(definition)).toBe(content);
    }
  });

  it("keeps the mirror fighter X and Y distinct while equal (no shared references)", () => {
    const registry = buildRegistry();
    const mirror = registry.scenarios.find((s) => s.scenarioId === "bulwark-mirror")!;
    expect(mirror.fighterX).not.toBe(mirror.fighterY);
    expect(mirror.fighterX.buildProposal).not.toBe(mirror.fighterY.buildProposal);
    expect(mirror.fighterX.policy).not.toBe(mirror.fighterY.policy);
    expect(mirror.fighterX).toEqual(mirror.fighterY);
  });

  it("shares no nested references between any two fighter definitions", () => {
    const registry = buildRegistry();
    const definitions = registry.scenarios.flatMap((scenario) => [
      scenario.fighterX,
      scenario.fighterY,
    ]);
    for (let i = 0; i < definitions.length; i++) {
      for (let j = i + 1; j < definitions.length; j++) {
        const a = definitions[i]!;
        const b = definitions[j]!;
        expect(a.buildProposal).not.toBe(b.buildProposal);
        expect(a.buildProposal.armour).not.toBe(b.buildProposal.armour);
        expect(a.policy).not.toBe(b.policy);
      }
    }
  });

  it("reconstructs the same deep-freeze and no-shared-reference guarantees after serialization", () => {
    const registry = buildRegistry();
    const serialized = serializeGridReadinessScenarioRegistry(registry);
    const parsed = deserializeGridActivationReadinessScenarioRegistry(serialized);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const restored = parsed.registry;
    expect(gridReadinessScenarioRegistryChecksum(restored)).toBe(
      gridReadinessScenarioRegistryChecksum(registry),
    );
    for (const scenario of restored.scenarios) {
      expect(Object.isFrozen(scenario)).toBe(true);
      expect(Object.isFrozen(scenario.fighterX)).toBe(true);
      expect(Object.isFrozen(scenario.fighterX.buildProposal)).toBe(true);
      expect(Object.isFrozen(scenario.fighterX.buildProposal.armour)).toBe(true);
      expect(Object.isFrozen(scenario.fighterX.policy)).toBe(true);
      expect(Object.isFrozen(scenario.fighterY)).toBe(true);
    }
    for (const assignment of restored.assignments) {
      expect(Object.isFrozen(assignment)).toBe(true);
    }
    const mirror = restored.scenarios.find((s) => s.scenarioId === "bulwark-mirror")!;
    expect(mirror.fighterX).not.toBe(mirror.fighterY);
    expect(mirror.fighterX).toEqual(mirror.fighterY);
    expect(mirror.fighterX.buildProposal).not.toBe(mirror.fighterY.buildProposal);
    expect(mirror.fighterX.policy).not.toBe(mirror.fighterY.policy);
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

describe("canonical scenario registry assertion (Phase 3E1.2)", () => {
  it("accepts the exact canonical registry and checksum", () => {
    const registry = buildRegistry();
    expect(() => assertCanonicalGridReadinessScenarioRegistry(registry)).not.toThrow();
    expect(gridReadinessScenarioRegistryChecksum(registry)).toBe(
      GRID_READINESS_CANONICAL_SCENARIO_REGISTRY_CHECKSUM,
    );
  });

  it("rejects a changed scenario build", () => {
    const registry = buildRegistry();
    const altered = mutateScenarioRegistry(registry, (scenario) => ({
      ...scenario,
      fighterX: {
        ...scenario.fighterX,
        buildProposal: {
          ...scenario.fighterX.buildProposal,
          armour: { ...scenario.fighterX.buildProposal.armour, front: 41 },
        },
      },
    }));
    expect(() => assertCanonicalGridReadinessScenarioRegistry(altered)).toThrow(
      /not structurally equal/,
    );
  });

  it("rejects a changed scenario policy", () => {
    const registry = buildRegistry();
    const altered = mutateScenarioRegistry(registry, (scenario) => ({
      ...scenario,
      fighterY: {
        ...scenario.fighterY,
        policy: { ...scenario.fighterY.policy, aggression: 1 },
      },
    }));
    expect(() => assertCanonicalGridReadinessScenarioRegistry(altered)).toThrow(
      /not structurally equal/,
    );
  });

  it("rejects a changed assignment", () => {
    const registry = buildRegistry();
    const altered = {
      ...registry,
      assignments: registry.assignments.map((a, i) =>
        i === 0 ? { ...a, roleSwapped: true } : a,
      ),
    };
    expect(() => assertCanonicalGridReadinessScenarioRegistry(altered)).toThrow(
      /not structurally equal/,
    );
  });

  it("rejects a changed family name", () => {
    const registry = buildRegistry();
    const altered = mutateScenarioRegistry(registry, (scenario) => ({
      ...scenario,
      familyName: `${scenario.familyName} X`,
    }));
    expect(() => assertCanonicalGridReadinessScenarioRegistry(altered)).toThrow(
      /not structurally equal/,
    );
  });

  it("rejects a reordered scenario or assignment", () => {
    const registry = buildRegistry();
    const reordered = {
      ...registry,
      scenarios: [...registry.scenarios].reverse(),
    };
    expect(() => assertCanonicalGridReadinessScenarioRegistry(reordered)).toThrow(
      /not structurally equal/,
    );
  });

  it("does not accept a self-consistent alternate registry", () => {
    // A structurally valid alternate registry (all seven scenarios present but
    // a changed display name) must be rejected even though it is internally
    // consistent.
    const registry = buildRegistry();
    const altered = mutateScenarioRegistry(registry, (scenario) => ({
      ...scenario,
      fighterX: {
        ...scenario.fighterX,
        displayName: `${scenario.fighterX.displayName} Alt`,
      },
    }));
    expect(() => assertCanonicalGridReadinessScenarioRegistry(altered)).toThrow(
      /not structurally equal/,
    );
  });
});

/** Clones the registry and applies `mutate` to every scenario. */
function mutateScenarioRegistry(
  registry: GridReadinessScenarioRegistry,
  mutate: (
    scenario: GridReadinessScenarioRegistry["scenarios"][number],
  ) => GridReadinessScenarioRegistry["scenarios"][number],
): GridReadinessScenarioRegistry {
  return {
    ...registry,
    scenarios: registry.scenarios.map(mutate),
    assignments: [...registry.assignments],
  };
}
