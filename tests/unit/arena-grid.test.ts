import { describe, expect, it } from "vitest";
import {
  GRID_COORDINATES,
  GRID_ZONES,
  findShortestGridPath,
  getCombatProximity,
  getGridCoordinate,
  getGridZoneAt,
  getOrthogonalNeighbours,
  getOrthogonalPathDistance,
  getPlanarExposedArmourZones,
  getRelativeBearing,
  isGridZone,
  mapLegacyZoneToGridZone,
  stepGridZone,
  type CombatProximity,
  type GridCoordinate,
  type GridDirection,
  type GridZone,
  type PlanarArmourZone,
  type RelativeBearing,
} from "../../src/simulator/arena-grid.js";

const DIRECTIONS: readonly GridDirection[] = ["north", "east", "south", "west"];

const ALL_BEARINGS: readonly RelativeBearing[] = [
  "same",
  "front",
  "front_right",
  "right",
  "rear_right",
  "rear",
  "rear_left",
  "left",
  "front_left",
];

describe("3×3 grid zone and coordinate integrity", () => {
  it("contains exactly nine unique zones", () => {
    expect(GRID_ZONES).toHaveLength(9);
    expect(new Set(GRID_ZONES).size).toBe(9);
  });

  it("contains exactly nine unique coordinates", () => {
    expect(GRID_COORDINATES).toHaveLength(9);
    const seen = new Set(
      GRID_COORDINATES.map((coordinate) => `${coordinate.x},${coordinate.y}`),
    );
    expect(seen.size).toBe(9);
  });

  it("keeps all coordinates inside the -1..1 range", () => {
    for (const coordinate of GRID_COORDINATES) {
      expect(coordinate.x).toBeGreaterThanOrEqual(-1);
      expect(coordinate.x).toBeLessThanOrEqual(1);
      expect(coordinate.y).toBeGreaterThanOrEqual(-1);
      expect(coordinate.y).toBeLessThanOrEqual(1);
    }
  });

  it("round-trips every zone through its coordinate", () => {
    for (const zone of GRID_ZONES) {
      expect(getGridZoneAt(getGridCoordinate(zone))).toBe(zone);
    }
  });

  it("round-trips every coordinate through its zone", () => {
    for (const coordinate of GRID_COORDINATES) {
      const zone = getGridZoneAt(coordinate);
      expect(zone).not.toBeNull();
      const roundTrip = getGridCoordinate(zone as GridZone);
      expect(roundTrip.x).toBe(coordinate.x);
      expect(roundTrip.y).toBe(coordinate.y);
    }
  });

  it("rejects invalid zone strings", () => {
    expect(isGridZone("north")).toBe(true);
    expect(isGridZone("center")).toBe(true);
    expect(isGridZone("south_east")).toBe(true);
    expect(isGridZone("north_edge")).toBe(false);
    expect(isGridZone("south_edge")).toBe(false);
    expect(isGridZone("east_edge")).toBe(false);
    expect(isGridZone("west_edge")).toBe(false);
    expect(isGridZone("diagonal")).toBe(false);
    expect(isGridZone("")).toBe(false);
    expect(isGridZone(42)).toBe(false);
    expect(isGridZone(null)).toBe(false);
    expect(isGridZone(undefined)).toBe(false);
  });

  it("rejects invalid coordinates", () => {
    expect(getGridZoneAt({ x: 2, y: 0 })).toBeNull();
    expect(getGridZoneAt({ x: 0, y: 2 })).toBeNull();
    expect(getGridZoneAt({ x: -2, y: 0 })).toBeNull();
    expect(getGridZoneAt({ x: 0, y: -2 })).toBeNull();
    expect(getGridZoneAt({ x: 0.5, y: 0 })).toBeNull();
    expect(getGridZoneAt({ x: 0, y: -0.5 })).toBeNull();
    expect(getGridZoneAt({ x: -1, y: -1 })).toBe("south_west");
    expect(getGridZoneAt({ x: 1, y: 1 })).toBe("north_east");
    expect(getGridZoneAt({ x: 0, y: 0 })).toBe("center");
  });

  it("exposes frozen shared constants and fresh per-call results", () => {
    expect(Object.isFrozen(GRID_ZONES)).toBe(true);
    expect(Object.isFrozen(GRID_COORDINATES)).toBe(true);
    for (const coordinate of GRID_COORDINATES) {
      expect(Object.isFrozen(coordinate)).toBe(true);
    }
    const first = getOrthogonalNeighbours("center");
    first.push("south_east");
    expect(getOrthogonalNeighbours("center")).toEqual(["north", "east", "south", "west"]);
  });
});

describe("orthogonal adjacency", () => {
  it("gives center exactly four orthogonal neighbours in frozen order", () => {
    expect(getOrthogonalNeighbours("center")).toEqual(["north", "east", "south", "west"]);
  });

  it("gives corners exactly two neighbours", () => {
    for (const corner of [
      "north_west",
      "north_east",
      "south_west",
      "south_east",
    ] as const) {
      expect(getOrthogonalNeighbours(corner)).toHaveLength(2);
    }
  });

  it("gives non-corner edges exactly three neighbours", () => {
    for (const edge of ["north", "east", "south", "west"] as const) {
      expect(getOrthogonalNeighbours(edge)).toHaveLength(3);
    }
  });

  it("is symmetric for all ordered zone pairs", () => {
    for (const a of GRID_ZONES) {
      for (const b of GRID_ZONES) {
        expect(getOrthogonalNeighbours(a).includes(b)).toBe(
          getOrthogonalNeighbours(b).includes(a),
        );
      }
    }
  });

  it("never lists a zone as its own neighbour", () => {
    for (const zone of GRID_ZONES) {
      expect(getOrthogonalNeighbours(zone)).not.toContain(zone);
    }
  });

  it("never treats a diagonal as an ordinary one-step neighbour", () => {
    for (const a of GRID_ZONES) {
      for (const b of GRID_ZONES) {
        const chebyshev = getCombatProximity(a, b);
        const manhattan = getOrthogonalPathDistance(a, b);
        const isDiagonal = manhattan === 2 && chebyshev === "medium";
        if (isDiagonal) {
          expect(getOrthogonalNeighbours(a)).not.toContain(b);
        }
      }
    }
  });

  it("returns neighbours in the frozen north/east/south/west order", () => {
    const expected: Record<GridZone, readonly GridZone[]> = {
      north_west: ["north", "west"],
      north: ["north_east", "center", "north_west"],
      north_east: ["east", "north"],
      west: ["north_west", "center", "south_west"],
      center: ["north", "east", "south", "west"],
      east: ["north_east", "south_east", "center"],
      south_west: ["west", "south"],
      south: ["center", "south_east", "south_west"],
      south_east: ["east", "south"],
    };
    for (const zone of GRID_ZONES) {
      expect(getOrthogonalNeighbours(zone)).toEqual(expected[zone]);
    }
  });

  it("steps out of bounds explicitly without wrapping", () => {
    // North boundary.
    expect(stepGridZone("north", "north")).toBeNull();
    expect(stepGridZone("north_west", "north")).toBeNull();
    expect(stepGridZone("north_east", "north")).toBeNull();
    // South boundary.
    expect(stepGridZone("south", "south")).toBeNull();
    expect(stepGridZone("south_west", "south")).toBeNull();
    expect(stepGridZone("south_east", "south")).toBeNull();
    // East boundary.
    expect(stepGridZone("east", "east")).toBeNull();
    expect(stepGridZone("north_east", "east")).toBeNull();
    expect(stepGridZone("south_east", "east")).toBeNull();
    // West boundary.
    expect(stepGridZone("west", "west")).toBeNull();
    expect(stepGridZone("north_west", "west")).toBeNull();
    expect(stepGridZone("south_west", "west")).toBeNull();
  });

  it("steps every zone in every direction consistently with neighbours", () => {
    for (const zone of GRID_ZONES) {
      for (const direction of DIRECTIONS) {
        const stepped = stepGridZone(zone, direction);
        if (stepped === null) {
          // Out-of-bounds steps are documented as null and never wrap.
          expect(stepped).toBeNull();
        } else {
          expect(getOrthogonalNeighbours(zone)).toContain(stepped);
          expect(getOrthogonalPathDistance(zone, stepped)).toBe(1);
        }
      }
    }
  });
});

describe("orthogonal distance and combat proximity", () => {
  it("is non-negative and symmetric for all 81 ordered pairs", () => {
    for (const a of GRID_ZONES) {
      for (const b of GRID_ZONES) {
        expect(getOrthogonalPathDistance(a, b)).toBeGreaterThanOrEqual(0);
        expect(getOrthogonalPathDistance(a, b)).toBe(getOrthogonalPathDistance(b, a));
      }
    }
  });

  it("gives zero distance to self", () => {
    for (const zone of GRID_ZONES) {
      expect(getOrthogonalPathDistance(zone, zone)).toBe(0);
    }
  });

  it("satisfies the triangle inequality for all zone triples", () => {
    for (const a of GRID_ZONES) {
      for (const b of GRID_ZONES) {
        for (const c of GRID_ZONES) {
          expect(getOrthogonalPathDistance(a, c)).toBeLessThanOrEqual(
            getOrthogonalPathDistance(a, b) + getOrthogonalPathDistance(b, c),
          );
        }
      }
    }
  });

  it("matches the frozen Chebyshev combat-proximity bands for all 81 pairs", () => {
    for (const a of GRID_ZONES) {
      for (const b of GRID_ZONES) {
        const ca = getGridCoordinate(a);
        const cb = getGridCoordinate(b);
        const chebyshev = Math.max(Math.abs(ca.x - cb.x), Math.abs(ca.y - cb.y));
        const expected: CombatProximity =
          chebyshev === 0 ? "close" : chebyshev === 1 ? "medium" : "far";
        expect(getCombatProximity(a, b)).toBe(expected);
      }
    }
  });

  it("makes combat proximity symmetric", () => {
    for (const a of GRID_ZONES) {
      for (const b of GRID_ZONES) {
        expect(getCombatProximity(a, b)).toBe(getCombatProximity(b, a));
      }
    }
  });

  it("gives explicit corner-to-opposite-corner distances", () => {
    expect(getOrthogonalPathDistance("north_west", "south_east")).toBe(4);
    expect(getCombatProximity("north_west", "south_east")).toBe("far");
    expect(getOrthogonalPathDistance("north_east", "south_west")).toBe(4);
    expect(getCombatProximity("north_east", "south_west")).toBe("far");
  });

  it("gives explicit north-to-south and west-to-east distances", () => {
    expect(getOrthogonalPathDistance("north", "south")).toBe(2);
    expect(getCombatProximity("north", "south")).toBe("far");
    expect(getOrthogonalPathDistance("west", "east")).toBe(2);
    expect(getCombatProximity("west", "east")).toBe("far");
  });

  it("treats center as medium proximity to every surrounding cell", () => {
    // Orthogonal neighbours are one Manhattan step away.
    for (const zone of ["north", "east", "south", "west"] as const) {
      expect(getOrthogonalPathDistance("center", zone)).toBe(1);
      expect(getCombatProximity("center", zone)).toBe("medium");
    }
    // Diagonal neighbours are two Manhattan steps but one Chebyshev step away.
    for (const zone of [
      "north_west",
      "north_east",
      "south_west",
      "south_east",
    ] as const) {
      expect(getOrthogonalPathDistance("center", zone)).toBe(2);
      expect(getCombatProximity("center", zone)).toBe("medium");
    }
  });

  it("classifies diagonal neighbours as medium combat proximity", () => {
    // Cells sharing a corner (differing in both axes) are Chebyshev distance 1.
    expect(getCombatProximity("north_west", "center")).toBe("medium");
    expect(getCombatProximity("north", "east")).toBe("medium");
    expect(getCombatProximity("south_west", "south")).toBe("medium");
    expect(getCombatProximity("west", "south_west")).toBe("medium");
    expect(getCombatProximity("center", "south_east")).toBe("medium");
  });
});

/** Absolute offset of a relative bearing in the defender's facing frame. */
function frameOffset(bearing: RelativeBearing): GridCoordinate {
  switch (bearing) {
    case "same":
      return { x: 0, y: 0 };
    case "front":
      return { x: 0, y: 1 };
    case "front_right":
      return { x: 1, y: 1 };
    case "right":
      return { x: 1, y: 0 };
    case "rear_right":
      return { x: 1, y: -1 };
    case "rear":
      return { x: 0, y: -1 };
    case "rear_left":
      return { x: -1, y: -1 };
    case "left":
      return { x: -1, y: 0 };
    case "front_left":
      return { x: -1, y: 1 };
  }
}

/** Rotate a frame offset into absolute coordinates for a given defender facing. */
function absoluteOffset(facing: GridDirection, bearing: RelativeBearing): GridCoordinate {
  const frame = frameOffset(bearing);
  switch (facing) {
    case "north":
      return { x: frame.x as -1 | 0 | 1, y: frame.y as -1 | 0 | 1 };
    case "east":
      return { x: frame.y as -1 | 0 | 1, y: -frame.x as -1 | 0 | 1 };
    case "south":
      return { x: -frame.x as -1 | 0 | 1, y: -frame.y as -1 | 0 | 1 };
    case "west":
      return { x: -frame.y as -1 | 0 | 1, y: frame.x as -1 | 0 | 1 };
  }
}

function zoneAtAbsoluteOffset(offset: GridCoordinate): GridZone {
  const zone = getGridZoneAt(offset);
  if (zone === null) {
    throw new Error(`No grid zone at offset ${offset.x},${offset.y}`);
  }
  return zone;
}

function rotateOffsetClockwise(offset: GridCoordinate): GridCoordinate {
  return { x: offset.y as -1 | 0 | 1, y: -offset.x as -1 | 0 | 1 };
}

function rotateFacingClockwise(facing: GridDirection): GridDirection {
  switch (facing) {
    case "north":
      return "east";
    case "east":
      return "south";
    case "south":
      return "west";
    case "west":
      return "north";
  }
}

describe("defender-relative bearing", () => {
  it("returns same for fighters sharing a cell under every facing", () => {
    for (const facing of DIRECTIONS) {
      expect(getRelativeBearing("center", "center", facing)).toBe("same");
      expect(getRelativeBearing("north", "north", facing)).toBe("same");
      expect(getRelativeBearing("south_east", "south_east", facing)).toBe("same");
    }
  });

  it("produces every bearing for every defender facing (defender at center)", () => {
    for (const facing of DIRECTIONS) {
      for (const bearing of ALL_BEARINGS) {
        const attacker = zoneAtAbsoluteOffset(absoluteOffset(facing, bearing));
        expect(getRelativeBearing(attacker, "center", facing)).toBe(bearing);
      }
    }
  });

  it("computes bearing from relative cell positions (defender not at center)", () => {
    // Defender at east facing north; attacker at north_east is straight ahead.
    expect(getRelativeBearing("north_east", "east", "north")).toBe("front");
    // Defender at east facing north; attacker at east is same-cell.
    expect(getRelativeBearing("east", "east", "north")).toBe("same");
    // Defender at west facing east; attacker at center is straight ahead.
    expect(getRelativeBearing("center", "west", "east")).toBe("front");
    // Defender at west facing east; world-north is to the defender's left.
    expect(getRelativeBearing("north_west", "west", "east")).toBe("left");
    // Defender at west facing east; world-south is to the defender's right.
    expect(getRelativeBearing("south_west", "west", "east")).toBe("right");
    // Defender at south facing west; attacker at south_west is straight ahead.
    expect(getRelativeBearing("south_west", "south", "west")).toBe("front");
    // Defender at center facing north; attacker directly south is at the rear.
    expect(getRelativeBearing("south", "center", "north")).toBe("rear");
    // Defender at center facing north; attacker at south_east is rear-right.
    expect(getRelativeBearing("south_east", "center", "north")).toBe("rear_right");
    // Defender at north facing south; attacker at south is straight ahead.
    expect(getRelativeBearing("south", "north", "south")).toBe("front");
    // Defender at center facing south; world-north is behind the defender.
    expect(getRelativeBearing("north", "center", "south")).toBe("rear");
    // Defender at center facing west; world-east is behind the defender.
    expect(getRelativeBearing("east", "center", "west")).toBe("rear");
  });

  it("preserves relative bearing when both geometry and facing rotate", () => {
    const baseCases: readonly { facing: GridDirection; offset: GridCoordinate }[] = [
      { facing: "north", offset: { x: 0, y: 1 } },
      { facing: "north", offset: { x: 1, y: 1 } },
      { facing: "north", offset: { x: 1, y: 0 } },
      { facing: "north", offset: { x: 1, y: -1 } },
      { facing: "north", offset: { x: 0, y: -1 } },
      { facing: "north", offset: { x: -1, y: -1 } },
      { facing: "north", offset: { x: -1, y: 0 } },
      { facing: "north", offset: { x: -1, y: 1 } },
      { facing: "east", offset: { x: 1, y: 0 } },
      { facing: "south", offset: { x: -1, y: 1 } },
      { facing: "west", offset: { x: 0, y: -1 } },
    ];
    for (const { facing, offset } of baseCases) {
      const attacker = zoneAtAbsoluteOffset(offset);
      const base = getRelativeBearing(attacker, "center", facing);
      let currentFacing = facing;
      let currentOffset: GridCoordinate = { ...offset };
      for (let rotation = 1; rotation <= 4; rotation++) {
        currentFacing = rotateFacingClockwise(currentFacing);
        currentOffset = rotateOffsetClockwise(currentOffset);
        const rotatedAttacker = zoneAtAbsoluteOffset(currentOffset);
        expect(getRelativeBearing(rotatedAttacker, "center", currentFacing)).toBe(base);
      }
    }
  });
});

describe("planar armour exposure mapping", () => {
  it("exposes rear only for strict rear bearings", () => {
    expect(getPlanarExposedArmourZones("rear")).toEqual(["rear"]);
  });

  it("exposes one side only for strict side bearings", () => {
    expect(getPlanarExposedArmourZones("left")).toEqual(["left"]);
    expect(getPlanarExposedArmourZones("right")).toEqual(["right"]);
  });

  it("exposes front only for a strict front bearing", () => {
    expect(getPlanarExposedArmourZones("front")).toEqual(["front"]);
  });

  it("exposes exactly two planar zones for every diagonal bearing", () => {
    expect(getPlanarExposedArmourZones("front_left")).toEqual(["front", "left"]);
    expect(getPlanarExposedArmourZones("front_right")).toEqual(["front", "right"]);
    expect(getPlanarExposedArmourZones("rear_left")).toEqual(["rear", "left"]);
    expect(getPlanarExposedArmourZones("rear_right")).toEqual(["rear", "right"]);
  });

  it("preserves the front/left/right overlap for same-cell exposure", () => {
    expect(getPlanarExposedArmourZones("same")).toEqual(["front", "left", "right"]);
  });

  it("never returns top armour from the planar geometry function", () => {
    for (const bearing of ALL_BEARINGS) {
      expect(getPlanarExposedArmourZones(bearing)).not.toContain(
        "top" as PlanarArmourZone,
      );
    }
  });
});

describe("shortest grid pathfinding", () => {
  it("returns the cell itself for a path to the same zone", () => {
    for (const zone of GRID_ZONES) {
      expect(findShortestGridPath(zone, zone)).toEqual([zone]);
    }
  });

  it("finds length-2 paths between orthogonally adjacent zones", () => {
    for (const zone of GRID_ZONES) {
      for (const neighbour of getOrthogonalNeighbours(zone)) {
        expect(findShortestGridPath(zone, neighbour)).toEqual([zone, neighbour]);
      }
    }
  });

  it("finds a corner-to-opposite-corner path of the correct length", () => {
    const path = findShortestGridPath("north_west", "south_east");
    expect(path[0]).toBe("north_west");
    expect(path[path.length - 1]).toBe("south_east");
    expect(path).toHaveLength(5);
    expect(path).toEqual(["north_west", "north", "north_east", "east", "south_east"]);
  });

  it("resolves ties deterministically using the frozen neighbour order", () => {
    // Multiple shortest paths exist between these corners; BFS with the frozen
    // north/east/south/west order must always pick the same one.
    const first = findShortestGridPath("north_east", "south_west");
    expect(first).toEqual(["north_east", "east", "south_east", "south", "south_west"]);
    expect(findShortestGridPath("north_east", "south_west")).toEqual(first);
    for (let run = 0; run < 10; run++) {
      expect(findShortestGridPath("north_east", "south_west")).toEqual(first);
    }
  });

  it("makes every consecutive path entry orthogonally adjacent", () => {
    for (const a of GRID_ZONES) {
      for (const b of GRID_ZONES) {
        const path = findShortestGridPath(a, b);
        for (let index = 0; index + 1 < path.length; index++) {
          expect(getOrthogonalPathDistance(path[index]!, path[index + 1]!)).toBe(1);
        }
      }
    }
  });

  it("produces paths whose length agrees with the orthogonal distance", () => {
    for (const a of GRID_ZONES) {
      for (const b of GRID_ZONES) {
        const path = findShortestGridPath(a, b);
        expect(path).toHaveLength(getOrthogonalPathDistance(a, b) + 1);
      }
    }
  });

  it("never returns an invalid zone in a path", () => {
    for (const a of GRID_ZONES) {
      for (const b of GRID_ZONES) {
        for (const zone of findShortestGridPath(a, b)) {
          expect(isGridZone(zone)).toBe(true);
        }
      }
    }
  });

  it("produces a valid deterministic path for all 81 start/destination pairs", () => {
    for (const start of GRID_ZONES) {
      for (const destination of GRID_ZONES) {
        const path = findShortestGridPath(start, destination);
        expect(path[0]).toBe(start);
        expect(path[path.length - 1]).toBe(destination);
        expect(findShortestGridPath(start, destination)).toEqual(path);
      }
    }
  });

  it("documents travel around an occupied cell to reach a rear-relative cell", () => {
    // Defender holds `center` facing north. An attacker starting at
    // `north_west` wants to reach `south_west` (the defender's rear-left)
    // without passing through the defender's cell. The grid's extra space
    // permits the orthogonal route north_west -> west -> south_west, which
    // detours around `center`. No occupancy blocking or combat behaviour is
    // introduced to force this route; it is purely geometric.
    const path = findShortestGridPath("north_west", "south_west");
    expect(path).toEqual(["north_west", "west", "south_west"]);
    expect(path).not.toContain("center");
    expect(getRelativeBearing("south_west", "center", "north")).toBe("rear_left");
  });
});

describe("legacy zone migration mapping", () => {
  it("maps all five legacy values explicitly and exhaustively", () => {
    expect(mapLegacyZoneToGridZone("north_edge")).toBe("north");
    expect(mapLegacyZoneToGridZone("south_edge")).toBe("south");
    expect(mapLegacyZoneToGridZone("east_edge")).toBe("east");
    expect(mapLegacyZoneToGridZone("west_edge")).toBe("west");
    expect(mapLegacyZoneToGridZone("center")).toBe("center");
  });

  it("never maps legacy values to the new corner cells", () => {
    const corners = ["north_west", "north_east", "south_west", "south_east"];
    const mapped = (
      ["north_edge", "south_edge", "east_edge", "west_edge", "center"] as const
    ).map(mapLegacyZoneToGridZone);
    for (const zone of mapped) {
      expect(corners).not.toContain(zone);
    }
  });

  it("is a pure function with no side effects on shared state", () => {
    const zonesBefore = [...GRID_ZONES];
    const coordinatesBefore = GRID_COORDINATES.map((coordinate) => ({
      x: coordinate.x,
      y: coordinate.y,
    }));
    for (const legacy of [
      "north_edge",
      "south_edge",
      "east_edge",
      "west_edge",
      "center",
    ] as const) {
      mapLegacyZoneToGridZone(legacy);
    }
    expect([...GRID_ZONES]).toEqual(zonesBefore);
    expect(
      GRID_COORDINATES.map((coordinate) => ({ x: coordinate.x, y: coordinate.y })),
    ).toEqual(coordinatesBefore);
  });
});
