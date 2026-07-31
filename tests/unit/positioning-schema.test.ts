import { describe, expect, it } from "vitest";
import { GRID_ZONES, type GridZone } from "../../src/simulator/arena-grid.js";
import {
  LEGACY_ARENA_ZONES,
  legacyArenaZoneSchema,
  gridZoneSchema,
  positioningModelSchema,
  POSITIONING_MODEL_GRID,
  POSITIONING_MODEL_LEGACY,
} from "../../src/schemas/positioning.schema.js";

describe("positioning schemas", () => {
  it("grid zone schema accepts exactly the values exposed by GRID_ZONES", () => {
    expect(GRID_ZONES).toHaveLength(9);
    for (const zone of GRID_ZONES) {
      expect(gridZoneSchema.safeParse(zone).success).toBe(true);
    }
    // Every accepted value is a member of GRID_ZONES (no drift).
    for (const zone of GRID_ZONES) {
      const result = gridZoneSchema.safeParse(zone);
      if (result.success) {
        expect(GRID_ZONES).toContain(result.data);
      }
    }
  });

  it("grid zone schema rejects values outside the canonical nine", () => {
    for (const value of [
      "north_edge",
      "south_edge",
      "east_edge",
      "west_edge",
      "diagonal",
      "",
      "North",
    ]) {
      expect(gridZoneSchema.safeParse(value).success).toBe(false);
    }
  });

  it("legacy zone schema accepts exactly the five legacy values", () => {
    expect(LEGACY_ARENA_ZONES).toEqual([
      "center",
      "north_edge",
      "south_edge",
      "east_edge",
      "west_edge",
    ]);
    for (const zone of LEGACY_ARENA_ZONES) {
      expect(legacyArenaZoneSchema.safeParse(zone).success).toBe(true);
    }
    for (const value of ["north", "north_west", "south_east", ""]) {
      expect(legacyArenaZoneSchema.safeParse(value).success).toBe(false);
    }
  });

  it("keeps legacy and grid models visibly distinct despite shared center", () => {
    expect(LEGACY_ARENA_ZONES).toContain("center");
    expect(GRID_ZONES).toContain("center");
    // center alone cannot identify the model; the positioning identifier does.
    const model = positioningModelSchema.safeParse(POSITIONING_MODEL_GRID);
    expect(model.success).toBe(true);
    const legacy = positioningModelSchema.safeParse(POSITIONING_MODEL_LEGACY);
    expect(legacy.success).toBe(true);
  });

  it("exposes the explicit persisted positioning identifiers", () => {
    expect(POSITIONING_MODEL_GRID).toBe("grid-3x3-v1");
    expect(POSITIONING_MODEL_LEGACY).toBe("legacy-five-zone-v1");
    expect(positioningModelSchema.safeParse("grid-3x3-v1").success).toBe(true);
    expect(positioningModelSchema.safeParse("legacy-five-zone-v1").success).toBe(true);
    expect(positioningModelSchema.safeParse("grid-4x4-v1").success).toBe(false);
    expect(positioningModelSchema.safeParse("center").success).toBe(false);
  });

  it("grid zone list in the schema is identical to the canonical grid list", () => {
    const accepted = GRID_ZONES.filter(
      (zone: GridZone) => gridZoneSchema.safeParse(zone).success,
    );
    expect(accepted).toEqual(GRID_ZONES);
  });
});
