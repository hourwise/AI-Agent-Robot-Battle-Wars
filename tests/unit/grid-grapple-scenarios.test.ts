import { describe, expect, it } from "vitest";
import {
  createGridGrappleCoverageScenarioRegistry,
  createGridGrappleCoverageFighterConfig,
  gridGrappleCoverageScenarioRegistryChecksum,
  assertCanonicalGridGrappleCoverageScenarioRegistry,
  GRID_GRAPPLE_COVERAGE_SCENARIO_REGISTRY_ID,
  GRID_GRAPPLE_COVERAGE_SCENARIO_ID,
  GRID_GRAPPLE_COVERAGE_SCENARIO_COUNT,
  GRID_GRAPPLE_COVERAGE_ASSIGNMENT_COUNT,
  GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM,
  GridGrappleCoverageScenarioRegistryError,
} from "../../src/readiness/grid-grapple-scenarios.js";

describe("grid grapple coverage scenario registry (Phase 3E2)", () => {
  it("builds exactly one scenario and two role assignments", () => {
    const registry = createGridGrappleCoverageScenarioRegistry();
    expect(registry.registryId).toBe(GRID_GRAPPLE_COVERAGE_SCENARIO_REGISTRY_ID);
    expect(registry.purpose).toBe("supplemental-grapple-reposition-coverage");
    expect(registry.schemaVersion).toBe("1");
    expect(registry.scenarios.length).toBe(GRID_GRAPPLE_COVERAGE_SCENARIO_COUNT);
    expect(registry.assignments.length).toBe(GRID_GRAPPLE_COVERAGE_ASSIGNMENT_COUNT);
    expect(registry.scenarios[0]!.scenarioId).toBe(GRID_GRAPPLE_COVERAGE_SCENARIO_ID);
  });

  it("defines the Grapple Coverage Attacker and Stationary Coverage Target builds exactly", () => {
    const registry = createGridGrappleCoverageScenarioRegistry();
    const attacker = registry.scenarios[0]!.fighterX;
    const target = registry.scenarios[0]!.fighterY;

    expect(attacker.displayName).toBe("Grapple Coverage Attacker");
    expect(attacker.buildProposal).toMatchObject({
      machineName: "Grapple Coverage Attacker",
      chassisId: "medium",
      mobilityId: "legs",
      weaponId: "grappler",
      utilityId: "traction_boost",
      armour: { front: 30, left: 25, right: 25, rear: 25, top: 15 },
    });
    expect(attacker.policy).toMatchObject({
      opening: "rush",
      preferredRange: "close",
      aggression: 100,
      primaryTarget: "front",
      secondaryTarget: "left",
      retreatThreshold: 0,
      heatThreshold: 100,
      fallback: "desperate_attack",
    });

    expect(target.displayName).toBe("Stationary Coverage Target");
    expect(target.buildProposal).toMatchObject({
      machineName: "Stationary Coverage Target",
      chassisId: "light",
      mobilityId: "wheels",
      weaponId: "hammer",
      utilityId: "cooling",
      armour: { front: 20, left: 25, right: 25, rear: 35, top: 15 },
    });
    expect(target.policy).toMatchObject({
      opening: "hold",
      preferredRange: "medium",
      aggression: 0,
      primaryTarget: "front",
      secondaryTarget: "front",
      retreatThreshold: 0,
      heatThreshold: 100,
      fallback: "defend",
    });
  });

  it("implements exact role swapping across the two assignments", () => {
    const registry = createGridGrappleCoverageScenarioRegistry();
    const [assignment1, assignment2] = registry.assignments;
    expect(assignment1!.fighterACompetitor).toBe("x");
    expect(assignment1!.fighterBCompetitor).toBe("y");
    expect(assignment1!.roleSwapped).toBe(false);
    expect(assignment2!.fighterACompetitor).toBe("y");
    expect(assignment2!.fighterBCompetitor).toBe("x");
    expect(assignment2!.roleSwapped).toBe(true);
  });

  it("validates every build against catalogue v1 and every policy shape", () => {
    const registry = createGridGrappleCoverageScenarioRegistry();
    for (const competitor of ["x", "y"] as const) {
      const definition =
        competitor === "x"
          ? registry.scenarios[0]!.fighterX
          : registry.scenarios[0]!.fighterY;
      const config = createGridGrappleCoverageFighterConfig(
        registry.scenarios[0]!,
        competitor,
      );
      expect(config.build.proposal.weaponId).toBe(
        competitor === "x" ? "grappler" : "hammer",
      );
      expect(config.policy).toEqual(definition.policy);
    }
  });

  it("deeply freezes the registry with no shared mutable references", () => {
    const registry = createGridGrappleCoverageScenarioRegistry();
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.scenarios)).toBe(true);
    expect(Object.isFrozen(registry.assignments)).toBe(true);
    expect(Object.isFrozen(registry.scenarios[0])).toBe(true);
    expect(Object.isFrozen(registry.scenarios[0]!.fighterX)).toBe(true);
    expect(Object.isFrozen(registry.scenarios[0]!.fighterX.buildProposal)).toBe(true);
    expect(Object.isFrozen(registry.scenarios[0]!.fighterX.buildProposal.armour)).toBe(
      true,
    );
    expect(Object.isFrozen(registry.scenarios[0]!.fighterX.policy)).toBe(true);
    // Fresh registry instances never share nested references.
    const other = createGridGrappleCoverageScenarioRegistry();
    expect(registry.scenarios[0]!.fighterX).not.toBe(other.scenarios[0]!.fighterX);
    expect(registry.scenarios[0]!.fighterX.buildProposal).not.toBe(
      other.scenarios[0]!.fighterX.buildProposal,
    );
  });

  it("returns fresh mutable configuration values for each execution", () => {
    const registry = createGridGrappleCoverageScenarioRegistry();
    const a = createGridGrappleCoverageFighterConfig(registry.scenarios[0]!, "x");
    const b = createGridGrappleCoverageFighterConfig(registry.scenarios[0]!, "x");
    expect(a.build).not.toBe(b.build);
    expect(a.policy).not.toBe(b.policy);
    a.build.proposal.armour.front += 100;
    expect(b.build.proposal.armour.front).not.toBe(a.build.proposal.armour.front);
    expect(registry.scenarios[0]!.fighterX.buildProposal.armour.front).toBe(30);
  });

  it("freezes the deterministic canonical checksum", () => {
    const registry = createGridGrappleCoverageScenarioRegistry();
    const checksum = gridGrappleCoverageScenarioRegistryChecksum(registry);
    expect(checksum).toBe(GRID_GRAPPLE_COVERAGE_CANONICAL_SCENARIO_REGISTRY_CHECKSUM);
    // Repeated computation is stable.
    expect(gridGrappleCoverageScenarioRegistryChecksum(registry)).toBe(checksum);
    expect(() =>
      assertCanonicalGridGrappleCoverageScenarioRegistry(registry),
    ).not.toThrow();
  });

  it("rejects a structurally divergent registry", () => {
    const registry = createGridGrappleCoverageScenarioRegistry();
    const mutated = {
      ...registry,
      scenarios: registry.scenarios.map((s) => ({
        ...s,
        familyName: "Mutated",
      })),
    };
    expect(() =>
      assertCanonicalGridGrappleCoverageScenarioRegistry(mutated as never),
    ).toThrow(GridGrappleCoverageScenarioRegistryError);
  });
});
