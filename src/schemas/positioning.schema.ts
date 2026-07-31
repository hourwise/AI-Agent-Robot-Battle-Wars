import { z } from "zod";
import { GRID_ZONES, type GridZone } from "../simulator/arena-grid.js";

/**
 * Canonical positioning schemas (Milestone 0.2C).
 *
 * The grid zone list is derived from the single authoritative source in
 * `src/simulator/arena-grid.ts` (`GRID_ZONES`) so it cannot drift. The legacy
 * five-zone list is the persisted 0.1/0.2 arena model and is kept visibly
 * distinct from the grid model; the shared `center` value must never be used
 * to infer the positioning model of a record.
 */

export const LEGACY_ARENA_ZONES = [
  "center",
  "north_edge",
  "south_edge",
  "east_edge",
  "west_edge",
] as const;
export type LegacyArenaZoneValue = (typeof LEGACY_ARENA_ZONES)[number];

export const legacyArenaZoneSchema = z.enum(LEGACY_ARENA_ZONES);

export const gridZoneSchema = z.enum(GRID_ZONES as [GridZone, ...GridZone[]]);

/** Explicit persisted positioning identifiers. */
export const POSITIONING_MODEL_LEGACY = "legacy-five-zone-v1" as const;
export const POSITIONING_MODEL_GRID = "grid-3x3-v1" as const;

export const positioningModelSchema = z.enum([
  POSITIONING_MODEL_LEGACY,
  POSITIONING_MODEL_GRID,
]);

export type PositioningModel = z.infer<typeof positioningModelSchema>;
