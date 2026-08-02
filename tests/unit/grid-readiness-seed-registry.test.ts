import { describe, expect, it } from "vitest";
import registryJson from "../../config/readiness/grid-readiness-development-v1.json";
import {
  loadGridReadinessSeedRegistry,
  gridReadinessSeedRegistryChecksum,
  GRID_READINESS_RESERVED_RANGE,
  GRID_READINESS_SEED_COUNT,
  GRID_READINESS_REGISTRY_IDENTITY,
  GridReadinessSeedRegistryError,
} from "../../src/readiness/seed-registry.js";

const FROZEN_SEEDS = [
  1703000011, 1703000037, 1703000073, 1703000109, 1703000151, 1703000193, 1703000241,
  1703000299, 1703000361, 1703000427, 1703000499, 1703000573, 1703000651, 1703000737,
  1703000821, 1703000911, 1703001009, 1703001111, 1703001217, 1703001329, 1703001447,
  1703001571, 1703001699, 1703001833,
] as const;

/** Frozen canonical registry checksum (Milestone 0.2C Phase 3E1). */
const FROZEN_SEED_REGISTRY_CHECKSUM =
  "54acf0151360f59d429fd7b2a84f48b48f4a791e522cf58bc381b927d62b78a0";

describe("grid readiness seed registry (Phase 3E1)", () => {
  it("loads the exact metadata identity from the source-controlled registry", () => {
    const registry = loadGridReadinessSeedRegistry(registryJson);
    expect(registry.schemaVersion).toBe("1");
    expect(registry.registryId).toBe("grid-readiness-development-v1");
    expect(registry.purpose).toBe("development-only-activation-readiness");
    expect(registry.partition).toBe("development-only");
    expect(registry.seedDomain).toBe("reserved-grid-readiness-1703000000-1703099999");
    expect(registry.generatorVersion).toBe("explicit-list-v1");
    expect(registry.simulatorVersion).toBe("0.3.0");
    expect(registry.positioningModel).toBe("grid-3x3-v1");
    expect(registry.rulesetVersion).toBe("0.2.0");
    expect(registry.catalogueVersion).toBe("1");
    expect(GRID_READINESS_REGISTRY_IDENTITY).toMatchObject({
      schemaVersion: "1",
      registryId: "grid-readiness-development-v1",
    });
  });

  it("contains exactly 24 seeds in the frozen order", () => {
    const registry = loadGridReadinessSeedRegistry(registryJson);
    expect(registry.seeds).toEqual([...FROZEN_SEEDS]);
    expect(registry.seeds.length).toBe(GRID_READINESS_SEED_COUNT);
    expect(registry.seeds[0]).toBe(1703000011);
    expect(registry.seeds[23]).toBe(1703001833);
  });

  it("enforces positive safe integers", () => {
    expect(() =>
      loadGridReadinessSeedRegistry({
        ...registryJson,
        seeds: [...FROZEN_SEEDS.slice(1), -1],
      }),
    ).toThrow(GridReadinessSeedRegistryError);
    expect(() =>
      loadGridReadinessSeedRegistry({
        ...registryJson,
        seeds: [...FROZEN_SEEDS.slice(1), 1.5],
      }),
    ).toThrow(GridReadinessSeedRegistryError);
    expect(() =>
      loadGridReadinessSeedRegistry({
        ...registryJson,
        seeds: [...FROZEN_SEEDS.slice(1), Number.MAX_SAFE_INTEGER + 1],
      }),
    ).toThrow(GridReadinessSeedRegistryError);
  });

  it("enforces the reserved numeric range", () => {
    const below = GRID_READINESS_RESERVED_RANGE.minInclusive - 1;
    const above = GRID_READINESS_RESERVED_RANGE.maxInclusive + 1;
    expect(() =>
      loadGridReadinessSeedRegistry({
        ...registryJson,
        seeds: [...FROZEN_SEEDS.slice(1), below],
      }),
    ).toThrow(/outside the reserved range/);
    expect(() =>
      loadGridReadinessSeedRegistry({
        ...registryJson,
        seeds: [...FROZEN_SEEDS.slice(1), above],
      }),
    ).toThrow(/outside the reserved range/);
  });

  it("rejects duplicates and a wrong seed count", () => {
    const duplicated = [...FROZEN_SEEDS];
    duplicated[23] = duplicated[0]!;
    expect(() =>
      loadGridReadinessSeedRegistry({ ...registryJson, seeds: duplicated }),
    ).toThrow(/duplicate/);
    expect(() =>
      loadGridReadinessSeedRegistry({
        ...registryJson,
        seeds: FROZEN_SEEDS.slice(0, 23),
      }),
    ).toThrow(/exactly 24/);
  });

  it("keeps every seed distinct after the simulator's signed 32-bit conversion", () => {
    const registry = loadGridReadinessSeedRegistry(registryJson);
    const signed = registry.seeds.map((seed) => seed | 0);
    expect(new Set(signed).size).toBe(signed.length);
    for (const seed of registry.seeds) {
      expect(seed | 0).toBeGreaterThan(0);
    }
  });

  it("rejects identity-field drift", () => {
    expect(() =>
      loadGridReadinessSeedRegistry({ ...registryJson, registryId: "other" }),
    ).toThrow(GridReadinessSeedRegistryError);
    expect(() =>
      loadGridReadinessSeedRegistry({ ...registryJson, partition: "held-out" }),
    ).toThrow(GridReadinessSeedRegistryError);
  });

  it("returns a runtime-frozen registry with a frozen seed tuple", () => {
    const registry = loadGridReadinessSeedRegistry(registryJson);
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.seeds)).toBe(true);
    // @ts-expect-error strict-mode mutation of a frozen object is rejected
    expect(() => {
      registry.seeds[0] = 1;
    }).toThrow();
    expect(registry.seeds[0]).toBe(1703000011);
  });

  it("separate loads do not share mutable arrays", () => {
    const a = loadGridReadinessSeedRegistry(registryJson);
    const b = loadGridReadinessSeedRegistry(registryJson);
    expect(a.seeds).not.toBe(b.seeds);
    expect(a.seeds).toEqual(b.seeds);
  });

  it("produces the frozen canonical registry checksum", () => {
    const registry = loadGridReadinessSeedRegistry(registryJson);
    expect(gridReadinessSeedRegistryChecksum(registry)).toBe(
      FROZEN_SEED_REGISTRY_CHECKSUM,
    );
    const altered = loadGridReadinessSeedRegistry({
      ...registryJson,
      seeds: [...FROZEN_SEEDS.slice(1), 1703001841],
    });
    expect(gridReadinessSeedRegistryChecksum(altered)).not.toBe(
      FROZEN_SEED_REGISTRY_CHECKSUM,
    );
  });

  it("does not import or read any benchmark seed bank", () => {
    // The registry module must not reference the benchmark seed-bank path or
    // any benchmark seed file.
    expect(GRID_READINESS_RESERVED_RANGE.minInclusive).toBe(1_703_000_000);
    // Source-level guard: the reserved range is independent from the existing
    // benchmark seed files.
    expect(GRID_READINESS_REGISTRY_IDENTITY.seedDomain).toBe(
      "reserved-grid-readiness-1703000000-1703099999",
    );
  });
});
