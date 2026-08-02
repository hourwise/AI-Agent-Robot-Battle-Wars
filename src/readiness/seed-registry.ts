import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { sha256Hex } from "../canary/grid-canary-digest.js";

/**
 * Development-only grid activation-readiness seed registry (Milestone 0.2C
 * Phase 3E1).
 *
 * A source-controlled, explicit-list registry of exactly 24 frozen seeds for
 * the bounded development-only activation-readiness evaluation. The numeric
 * range `1703000000..1703099999` is reserved for grid-readiness development
 * and must not be used by future benchmark or held-out registries.
 *
 * The registry is logically independent from every existing benchmark
 * partition (development / held-out / all). It is never read through a
 * benchmark seed bank, never opened by any benchmark command, and the
 * readiness command never reads any existing benchmark seed bank.
 */
export const GRID_READINESS_SEED_REGISTRY_FILE =
  "grid-readiness-development-v1.json" as const;

export const GRID_READINESS_SEED_REGISTRY_RELATIVE_PATH = join(
  "config",
  "readiness",
  GRID_READINESS_SEED_REGISTRY_FILE,
);

/** The reserved numeric range for grid-readiness development seeds. */
export const GRID_READINESS_RESERVED_RANGE = {
  minInclusive: 1_703_000_000,
  maxInclusive: 1_703_099_999,
} as const;

/** Exactly 24 frozen seeds. */
export const GRID_READINESS_SEED_COUNT = 24 as const;

/** Identity contract for the development-only registry. */
export const GRID_READINESS_REGISTRY_IDENTITY = Object.freeze({
  schemaVersion: "1",
  registryId: "grid-readiness-development-v1",
  purpose: "development-only-activation-readiness",
  partition: "development-only",
  seedDomain: "reserved-grid-readiness-1703000000-1703099999",
  generatorVersion: "explicit-list-v1",
  simulatorVersion: "0.3.0",
  positioningModel: "grid-3x3-v1",
  rulesetVersion: "0.2.0",
  catalogueVersion: "1",
} as const);

export interface GridReadinessSeedRegistry {
  readonly schemaVersion: "1";
  readonly registryId: "grid-readiness-development-v1";
  readonly purpose: "development-only-activation-readiness";
  readonly partition: "development-only";
  readonly seedDomain: "reserved-grid-readiness-1703000000-1703099999";
  readonly generatorVersion: "explicit-list-v1";
  readonly simulatorVersion: "0.3.0";
  readonly positioningModel: "grid-3x3-v1";
  readonly rulesetVersion: "0.2.0";
  readonly catalogueVersion: "1";
  readonly seeds: readonly number[];
}

const gridReadinessSeedRegistrySchema = z
  .object({
    schemaVersion: z.literal("1"),
    registryId: z.literal("grid-readiness-development-v1"),
    purpose: z.literal("development-only-activation-readiness"),
    partition: z.literal("development-only"),
    seedDomain: z.literal("reserved-grid-readiness-1703000000-1703099999"),
    generatorVersion: z.literal("explicit-list-v1"),
    simulatorVersion: z.literal("0.3.0"),
    positioningModel: z.literal("grid-3x3-v1"),
    rulesetVersion: z.literal("0.2.0"),
    catalogueVersion: z.literal("1"),
    seeds: z.array(z.number().int().nonnegative().safe()),
  })
  .strict();

export class GridReadinessSeedRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridReadinessSeedRegistryError";
  }
}

/**
 * Pure parser and validator. Never mutates or shares input state; returns a
 * fresh runtime-frozen registry with a frozen seed tuple on every load.
 */
export function loadGridReadinessSeedRegistry(json: unknown): GridReadinessSeedRegistry {
  const parsed = gridReadinessSeedRegistrySchema.safeParse(json);
  if (!parsed.success) {
    throw new GridReadinessSeedRegistryError(
      `Grid readiness seed registry failed its authoritative schema: ${parsed.error.message}`,
    );
  }
  const registry = parsed.data;

  if (registry.seeds.length !== GRID_READINESS_SEED_COUNT) {
    throw new GridReadinessSeedRegistryError(
      `Grid readiness seed registry must contain exactly ${GRID_READINESS_SEED_COUNT} seeds; received ${registry.seeds.length}`,
    );
  }

  const seen = new Set<number>();
  const seenSigned32 = new Set<number>();
  for (const seed of registry.seeds) {
    if (!Number.isSafeInteger(seed) || seed <= 0) {
      throw new GridReadinessSeedRegistryError(
        `Grid readiness seed must be a positive safe integer; received ${String(seed)}`,
      );
    }
    if (
      seed < GRID_READINESS_RESERVED_RANGE.minInclusive ||
      seed > GRID_READINESS_RESERVED_RANGE.maxInclusive
    ) {
      throw new GridReadinessSeedRegistryError(
        `Grid readiness seed ${seed} lies outside the reserved range ${GRID_READINESS_RESERVED_RANGE.minInclusive}-${GRID_READINESS_RESERVED_RANGE.maxInclusive}`,
      );
    }
    if (seen.has(seed)) {
      throw new GridReadinessSeedRegistryError(
        `Grid readiness seed registry contains a duplicate seed: ${seed}`,
      );
    }
    seen.add(seed);
    const signed32 = seed | 0;
    if (seenSigned32.has(signed32)) {
      throw new GridReadinessSeedRegistryError(
        `Grid readiness seeds must remain distinct after the simulator's signed 32-bit conversion; duplicate ${signed32}`,
      );
    }
    seenSigned32.add(signed32);
  }

  return Object.freeze({
    ...GRID_READINESS_REGISTRY_IDENTITY,
    seeds: Object.freeze([...registry.seeds]),
  });
}

/**
 * Reads and parses the source-controlled seed registry file from disk. Used by
 * the application service; tests import the fixture JSON directly.
 */
export function readGridReadinessSeedRegistryFile(): GridReadinessSeedRegistry {
  const path = join(process.cwd(), GRID_READINESS_SEED_REGISTRY_RELATIVE_PATH);
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (e) {
    throw new GridReadinessSeedRegistryError(
      `Failed to read the grid readiness seed registry at ${path}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(raw) as unknown;
  } catch (e) {
    throw new GridReadinessSeedRegistryError(
      `Grid readiness seed registry is not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  return loadGridReadinessSeedRegistry(json);
}

/**
 * Deterministic canonical registry checksum. Computed from a canonical
 * serialization of every registry field in fixed order, so byte-identical
 * registries always produce the same digest and any field change is detected.
 */
export function gridReadinessSeedRegistryChecksum(
  registry: GridReadinessSeedRegistry,
): string {
  const canonical = JSON.stringify({
    schemaVersion: registry.schemaVersion,
    registryId: registry.registryId,
    purpose: registry.purpose,
    partition: registry.partition,
    seedDomain: registry.seedDomain,
    generatorVersion: registry.generatorVersion,
    simulatorVersion: registry.simulatorVersion,
    positioningModel: registry.positioningModel,
    rulesetVersion: registry.rulesetVersion,
    catalogueVersion: registry.catalogueVersion,
    seeds: [...registry.seeds],
  });
  return sha256Hex(canonical);
}
