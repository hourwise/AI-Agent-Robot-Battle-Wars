import { describe, expect, it } from "vitest";
import { renderGridArenaSnapshot } from "../../src/replay/ascii/grid-arena-snapshot-renderer.js";
import type { GridFighterVisualState } from "../../src/replay/ascii/grid-arena-snapshot-renderer.js";
import { GRID_ZONES, type GridDirection } from "../../src/simulator/arena-grid.js";

function makeFighter(
  overrides: Partial<GridFighterVisualState> = {},
): GridFighterVisualState {
  return {
    fighterId: "test",
    zone: "center",
    facing: "north",
    conditions: [],
    components: {
      mobilityDisabled: false,
      weaponDisabled: false,
      utilityDisabled: false,
      mobilityDamaged: false,
      weaponDamaged: false,
      utilityDamaged: false,
    },
    ...overrides,
  };
}

describe("renderGridArenaSnapshot", () => {
  it("visibly represents all nine cells with labels and markers", () => {
    const arena = renderGridArenaSnapshot(
      makeFighter({ zone: "north_west", fighterId: "a" }),
      makeFighter({ zone: "south_east", fighterId: "b" }),
    );
    for (const label of [
      "NORTH WEST",
      "NORTH",
      "NORTH EAST",
      "WEST",
      "CENTER",
      "EAST",
      "SOUTH WEST",
      "SOUTH",
      "SOUTH EAST",
    ]) {
      expect(arena).toContain(label);
    }
  });

  it("shows a fighter in each of the nine zones", () => {
    for (const zone of GRID_ZONES) {
      const arena = renderGridArenaSnapshot(
        makeFighter({ zone, fighterId: "a" }),
        makeFighter({ zone: "center", fighterId: "b" }),
      );
      expect(arena).toContain("A^");
    }
  });

  it("shows A and B in different cells", () => {
    const arena = renderGridArenaSnapshot(
      makeFighter({ zone: "west", fighterId: "a", facing: "north" }),
      makeFighter({ zone: "east", fighterId: "b", facing: "south" }),
    );
    expect(arena).toContain("A^");
    expect(arena).toContain("Bv");
  });

  it("shows both fighters in the same cell with A before B", () => {
    const arena = renderGridArenaSnapshot(
      makeFighter({ zone: "center", fighterId: "a", facing: "north" }),
      makeFighter({ zone: "center", fighterId: "b", facing: "south" }),
    );
    const markerIndexA = arena.indexOf("A^");
    const markerIndexB = arena.indexOf("Bv");
    expect(markerIndexA).toBeGreaterThanOrEqual(0);
    expect(markerIndexB).toBeGreaterThan(markerIndexA);
    expect(arena).toContain("[A^ Bv]");
  });

  it("renders all four facing arrows", () => {
    const facings: readonly { facing: GridDirection; arrow: string }[] = [
      { facing: "north", arrow: "^" },
      { facing: "south", arrow: "v" },
      { facing: "east", arrow: ">" },
      { facing: "west", arrow: "<" },
    ];
    for (const { facing, arrow } of facings) {
      const arena = renderGridArenaSnapshot(
        makeFighter({ zone: "center", fighterId: "a", facing }),
        makeFighter({ zone: "north", fighterId: "b" }),
      );
      expect(arena).toContain(`A${arrow}`);
    }
  });

  it("shows the mobility damaged marker", () => {
    const arena = renderGridArenaSnapshot(
      makeFighter({
        zone: "center",
        fighterId: "a",
        components: { ...makeFighter().components, mobilityDamaged: true },
      }),
      makeFighter({ zone: "north", fighterId: "b" }),
    );
    expect(arena).toContain("Ax");
  });

  it("shows the mobility disabled marker", () => {
    const arena = renderGridArenaSnapshot(
      makeFighter({
        zone: "center",
        fighterId: "a",
        components: { ...makeFighter().components, mobilityDisabled: true },
      }),
      makeFighter({ zone: "north", fighterId: "b" }),
    );
    expect(arena).toContain("AX");
  });

  it("gives overturned marker precedence over facing", () => {
    const arena = renderGridArenaSnapshot(
      makeFighter({ zone: "center", fighterId: "a", conditions: ["overturned"] }),
      makeFighter({ zone: "north", fighterId: "b" }),
    );
    expect(arena).toContain("A!");
  });

  it("gives overheated marker precedence over facing", () => {
    const arena = renderGridArenaSnapshot(
      makeFighter({ zone: "center", fighterId: "a", conditions: ["overheated"] }),
      makeFighter({ zone: "north", fighterId: "b" }),
    );
    expect(arena).toContain("A~");
  });

  it("uses a consistent marker for empty cells", () => {
    const arena = renderGridArenaSnapshot(
      makeFighter({ zone: "center", fighterId: "a" }),
      makeFighter({ zone: "center", fighterId: "b" }),
    );
    // With both fighters in center, the other eight cells show ".".
    expect(arena.split(".").length - 1).toBe(8);
  });

  it("produces fixed-width lines", () => {
    const arena = renderGridArenaSnapshot(
      makeFighter({ zone: "north_west", fighterId: "a" }),
      makeFighter({ zone: "south_east", fighterId: "b" }),
    );
    const widths = new Set(arena.split("\n").map((line) => line.length));
    expect(widths.size).toBe(1);
  });

  it("renders deterministically on repeated calls", () => {
    const a = makeFighter({ zone: "north_east", fighterId: "a" });
    const b = makeFighter({ zone: "south_west", fighterId: "b" });
    const first = renderGridArenaSnapshot(a, b);
    for (let run = 0; run < 10; run++) {
      expect(renderGridArenaSnapshot(a, b)).toBe(first);
    }
  });

  it("never leaks object or invalid-zone text", () => {
    const arena = renderGridArenaSnapshot(
      makeFighter({ zone: "west", fighterId: "a", facing: "east" }),
      makeFighter({ zone: "east", fighterId: "b", facing: "west" }),
    );
    expect(arena).not.toContain("[object Object]");
    expect(arena).not.toContain("undefined");
    expect(arena).not.toContain("NaN");
    expect(arena).not.toContain("north_edge");
    expect(arena).not.toContain("south_edge");
  });

  it("renders the exact frozen zone layout", () => {
    const arena = renderGridArenaSnapshot(
      makeFighter({ zone: "center", fighterId: "a" }),
      makeFighter({ zone: "center", fighterId: "b" }),
    );
    expect(arena).toContain(" NORTH WEST  |    NORTH     |  NORTH EAST ");
    expect(arena).toContain("    WEST     |    CENTER    |     EAST    ");
    expect(arena).toContain(" SOUTH WEST  |    SOUTH     |  SOUTH EAST ");
  });
});
