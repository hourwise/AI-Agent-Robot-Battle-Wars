import { describe, expect, it } from "vitest";
import {
  GRID_RUNTIME_IDENTITY,
  LEGACY_RUNTIME_IDENTITY,
} from "../../src/simulator/runtime-identity.js";
import {
  OpponentRuntimeCompatibilityError,
  assertOpponentFixtureSupportsRuntime,
  loadOpponentFixtureForRuntime,
} from "../../src/opponents/opponent-runtime-compatibility.js";
import {
  opponentFixtureChecksum,
  serializeOpponentFixture,
} from "../../src/opponents/opponent-fixture.js";
import { loadOpponentFixture } from "../../src/opponents/opponent-fixture-loader.js";

/**
 * Milestone 0.2D Phase 3 (Commit M) — explicit runtime compatibility matrix.
 *
 * Loads the six real canonical fixtures through the production loader without
 * simulation and asserts the structural compatibility declarations. These are
 * compatibility facts only — never performance or balance facts.
 */

const LEGACY_SUPPORTED = ["bulwark", "crusher", "spinner", "generalist"];
const LEGACY_INCOMPATIBLE = ["skirmisher", "controller"];
const ALL_SIX = [
  "bulwark",
  "skirmisher",
  "crusher",
  "spinner",
  "controller",
  "generalist",
];

describe("opponent runtime compatibility (0.2D Phase 3 Commit M)", () => {
  it("declares the exact legacy/grid compatibility matrix for all six canonical fixtures", async () => {
    for (const id of ALL_SIX) {
      const fixture = await loadOpponentFixture(id, 1);
      // Grid supported: all six.
      expect(fixture.runtimeCompatibility.grid.status, id).toBe("supported");
      // Legacy supported: exactly bulwark, crusher, spinner, generalist.
      expect(fixture.runtimeCompatibility.legacy.status, id).toBe(
        LEGACY_SUPPORTED.includes(id) ? "supported" : "incompatible",
      );
    }
  });

  it("asserts legacy compatibility: four supported, two rejected", async () => {
    for (const id of LEGACY_SUPPORTED) {
      const fixture = await loadOpponentFixture(id, 1);
      expect(() => assertOpponentFixtureSupportsRuntime(fixture, "legacy")).not.toThrow();
    }
    for (const id of LEGACY_INCOMPATIBLE) {
      const fixture = await loadOpponentFixture(id, 1);
      expect(() => assertOpponentFixtureSupportsRuntime(fixture, "legacy")).toThrow(
        OpponentRuntimeCompatibilityError,
      );
      expect(() => assertOpponentFixtureSupportsRuntime(fixture, "legacy")).toThrow(
        /does not support runtime "legacy"/,
      );
    }
  });

  it("asserts grid compatibility for all six canonical fixtures", async () => {
    for (const id of ALL_SIX) {
      const fixture = await loadOpponentFixture(id, 1);
      expect(() => assertOpponentFixtureSupportsRuntime(fixture, "grid")).not.toThrow();
    }
  });

  it("fails closed on an invalid runtime even if TypeScript is bypassed", async () => {
    const fixture = await loadOpponentFixture("bulwark", 1);
    for (const bad of ["legacy2", "GRID", "", "grid "]) {
      expect(() => assertOpponentFixtureSupportsRuntime(fixture, bad as never)).toThrow(
        OpponentRuntimeCompatibilityError,
      );
      expect(() => assertOpponentFixtureSupportsRuntime(fixture, bad as never)).toThrow(
        /must be "legacy" or "grid"/,
      );
    }
  });

  it("does not mutate fixtures and keeps checksums and deep freeze intact", async () => {
    for (const id of ALL_SIX) {
      const fixture = await loadOpponentFixture(id, 1);
      const beforeBytes = serializeOpponentFixture(fixture);
      const beforeChecksum = fixture.fixtureChecksum;
      const expectedChecksum = opponentFixtureChecksum(fixture);

      // Exercise both assertions (including an incompatible legacy call for
      // the two grid-only fixtures, which must throw without mutation).
      if (LEGACY_SUPPORTED.includes(id)) {
        assertOpponentFixtureSupportsRuntime(fixture, "legacy");
      } else {
        expect(() => assertOpponentFixtureSupportsRuntime(fixture, "legacy")).toThrow(
          OpponentRuntimeCompatibilityError,
        );
      }
      assertOpponentFixtureSupportsRuntime(fixture, "grid");

      expect(serializeOpponentFixture(fixture)).toBe(beforeBytes);
      expect(fixture.fixtureChecksum).toBe(beforeChecksum);
      expect(fixture.fixtureChecksum).toBe(expectedChecksum);
      expect(Object.isFrozen(fixture)).toBe(true);
      expect(Object.isFrozen(fixture.build)).toBe(true);
      expect(Object.isFrozen(fixture.build.armour)).toBe(true);
      expect(Object.isFrozen(fixture.validatedBuild)).toBe(true);
      expect(Object.isFrozen(fixture.validatedBuild.proposal)).toBe(true);
      expect(Object.isFrozen(fixture.policy)).toBe(true);
      expect(Object.isFrozen(fixture.runtimeCompatibility)).toBe(true);
    }
  });

  it("binds runtime keys to the canonical frozen runtime identities only", async () => {
    const fixture = await loadOpponentFixture("bulwark", 1);
    expect(fixture.runtimeCompatibility.legacy.simulatorVersion).toBe(
      LEGACY_RUNTIME_IDENTITY.simulatorVersion,
    );
    expect(fixture.runtimeCompatibility.legacy.positioningModel).toBe(
      LEGACY_RUNTIME_IDENTITY.positioningModel,
    );
    expect(fixture.runtimeCompatibility.grid.simulatorVersion).toBe(
      GRID_RUNTIME_IDENTITY.simulatorVersion,
    );
    expect(fixture.runtimeCompatibility.grid.positioningModel).toBe(
      GRID_RUNTIME_IDENTITY.positioningModel,
    );
  });

  it("loadOpponentFixtureForRuntime returns the deeply frozen fixture and fails closed on incompatible or invalid runtime", async () => {
    const legacy = await loadOpponentFixtureForRuntime("bulwark", 1, "legacy");
    expect(legacy.opponentId).toBe("bulwark");
    expect(Object.isFrozen(legacy)).toBe(true);
    expect(legacy.fixtureChecksum).toBe(opponentFixtureChecksum(legacy));

    const grid = await loadOpponentFixtureForRuntime("skirmisher", 1, "grid");
    expect(grid.opponentId).toBe("skirmisher");
    expect(Object.isFrozen(grid)).toBe(true);

    await expect(
      loadOpponentFixtureForRuntime("skirmisher", 1, "legacy"),
    ).rejects.toThrow(OpponentRuntimeCompatibilityError);
    await expect(
      loadOpponentFixtureForRuntime("bulwark", 1, "other" as never),
    ).rejects.toThrow(OpponentRuntimeCompatibilityError);
  });

  it("checking grid compatibility never executes or activates grid (pure data assertion)", async () => {
    // The gate is a pure data check: it returns without side effects, does not
    // run a simulator and cannot change the application default (grid default
    // remains `no`; legacy default remains `yes`). This test asserts the gate
    // is pure for every canonical fixture.
    for (const id of ALL_SIX) {
      const fixture = await loadOpponentFixture(id, 1);
      const beforeBytes = serializeOpponentFixture(fixture);
      assertOpponentFixtureSupportsRuntime(fixture, "grid");
      expect(serializeOpponentFixture(fixture)).toBe(beforeBytes);
    }
  });
});
