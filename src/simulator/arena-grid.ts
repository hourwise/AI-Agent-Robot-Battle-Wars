/**
 * Pure 3×3 arena grid geometry (Milestone 0.2C Phase 1).
 *
 * This module is deliberately isolated from the authoritative simulator. It
 * imports no engine, fighter state, seeded random generator, damage logic,
 * policy logic or replay code, and is imported only by tests and non-runtime
 * documentation tooling during this phase.
 *
 * The live five-zone `ArenaZone` used by the simulator is NOT this module's
 * `GridZone`; the two representations coexist. `GridZone` is the frozen 3×3
 * representation accepted by ADR-001.
 */

export type GridZone =
  | "north_west"
  | "north"
  | "north_east"
  | "west"
  | "center"
  | "east"
  | "south_west"
  | "south"
  | "south_east";

export interface GridCoordinate {
  readonly x: -1 | 0 | 1;
  readonly y: -1 | 0 | 1;
}

export type GridDirection = "north" | "east" | "south" | "west";

export type RelativeBearing =
  | "same"
  | "front"
  | "front_right"
  | "right"
  | "rear_right"
  | "rear"
  | "rear_left"
  | "left"
  | "front_left";

export type CombatProximity = "close" | "medium" | "far";

export type PlanarArmourZone = "front" | "left" | "right" | "rear";

/** The five authoritative 0.1/0.2 arena zones, captured for migration mapping. */
export type LegacyArenaZone =
  "north_edge" | "south_edge" | "east_edge" | "west_edge" | "center";

const COORDINATES: Readonly<Record<GridZone, GridCoordinate>> = {
  north_west: { x: -1, y: 1 },
  north: { x: 0, y: 1 },
  north_east: { x: 1, y: 1 },
  west: { x: -1, y: 0 },
  center: { x: 0, y: 0 },
  east: { x: 1, y: 0 },
  south_west: { x: -1, y: -1 },
  south: { x: 0, y: -1 },
  south_east: { x: 1, y: -1 },
};

/**
 * All nine grid zones in canonical row-major order
 * (north row, then middle row, then south row).
 */
export const GRID_ZONES: readonly GridZone[] = Object.freeze([
  "north_west",
  "north",
  "north_east",
  "west",
  "center",
  "east",
  "south_west",
  "south",
  "south_east",
]);

/** All nine immutable grid coordinates in the same canonical order. */
export const GRID_COORDINATES: readonly GridCoordinate[] = Object.freeze(
  GRID_ZONES.map((zone) => Object.freeze({ ...COORDINATES[zone] })),
);

/** Frozen orthogonal neighbour order used for traversal and pathfinding. */
const NEIGHBOUR_DIRECTIONS: readonly GridDirection[] = Object.freeze([
  "north",
  "east",
  "south",
  "west",
]);

const GRID_ZONE_SET: ReadonlySet<string> = new Set<string>(GRID_ZONES);

export function isGridZone(value: unknown): value is GridZone {
  return typeof value === "string" && GRID_ZONE_SET.has(value);
}

export function getGridCoordinate(zone: GridZone): GridCoordinate {
  return Object.freeze({ ...COORDINATES[zone] });
}

export function getGridZoneAt(coordinate: GridCoordinate): GridZone | null {
  if (
    !Number.isInteger(coordinate.x) ||
    !Number.isInteger(coordinate.y) ||
    coordinate.x < -1 ||
    coordinate.x > 1 ||
    coordinate.y < -1 ||
    coordinate.y > 1
  ) {
    return null;
  }
  return (
    GRID_ZONES.find(
      (zone) =>
        COORDINATES[zone].x === coordinate.x && COORDINATES[zone].y === coordinate.y,
    ) ?? null
  );
}

export function getOrthogonalNeighbours(zone: GridZone): readonly GridZone[] {
  return NEIGHBOUR_DIRECTIONS.flatMap((direction) => {
    const neighbour = stepGridZone(zone, direction);
    return neighbour === null ? [] : [neighbour];
  });
}

export function stepGridZone(zone: GridZone, direction: GridDirection): GridZone | null {
  const coordinate = COORDINATES[zone];
  const target = { x: coordinate.x, y: coordinate.y };
  switch (direction) {
    case "north":
      target.y += 1;
      break;
    case "east":
      target.x += 1;
      break;
    case "south":
      target.y -= 1;
      break;
    case "west":
      target.x -= 1;
      break;
  }
  return getGridZoneAt(target);
}

export function getOrthogonalPathDistance(a: GridZone, b: GridZone): number {
  const ca = COORDINATES[a];
  const cb = COORDINATES[b];
  return Math.abs(ca.x - cb.x) + Math.abs(ca.y - cb.y);
}

export function getCombatProximity(a: GridZone, b: GridZone): CombatProximity {
  const ca = COORDINATES[a];
  const cb = COORDINATES[b];
  const chebyshev = Math.max(Math.abs(ca.x - cb.x), Math.abs(ca.y - cb.y));
  if (chebyshev === 0) return "close";
  if (chebyshev === 1) return "medium";
  return "far";
}

/**
 * Absolute eight-way bearing of the attacker relative to the defender,
 * derived from the sign-normalised coordinate delta.
 */
function getAbsoluteBearing(signedX: -1 | 0 | 1, signedY: -1 | 0 | 1): RelativeBearing {
  if (signedX === 0 && signedY === 0) return "same";
  if (signedX === 0 && signedY === 1) return "front";
  if (signedX === 1 && signedY === 1) return "front_right";
  if (signedX === 1 && signedY === 0) return "right";
  if (signedX === 1 && signedY === -1) return "rear_right";
  if (signedX === 0 && signedY === -1) return "rear";
  if (signedX === -1 && signedY === -1) return "rear_left";
  if (signedX === -1 && signedY === 0) return "left";
  return "front_left";
}

/**
 * Rotate a coordinate delta into the defender's facing frame and map it to a
 * defender-relative bearing.
 *
 * Facing rotation (world → defender frame):
 *   north: (x, y)
 *   east:  (-y, x)
 *   south: (-x, -y)
 *   west:  (y, -x)
 */
export function getRelativeBearing(
  attackerZone: GridZone,
  defenderZone: GridZone,
  defenderFacing: GridDirection,
): RelativeBearing {
  const attacker = COORDINATES[attackerZone];
  const defender = COORDINATES[defenderZone];
  const deltaX = Math.sign(attacker.x - defender.x) as -1 | 0 | 1;
  const deltaY = Math.sign(attacker.y - defender.y) as -1 | 0 | 1;

  let frameX: number;
  let frameY: number;
  switch (defenderFacing) {
    case "north":
      frameX = deltaX;
      frameY = deltaY;
      break;
    case "east":
      frameX = -deltaY;
      frameY = deltaX;
      break;
    case "south":
      frameX = -deltaX;
      frameY = -deltaY;
      break;
    case "west":
      frameX = deltaY;
      frameY = -deltaX;
      break;
  }

  return getAbsoluteBearing(
    Math.sign(frameX) as -1 | 0 | 1,
    Math.sign(frameY) as -1 | 0 | 1,
  );
}

export function getPlanarExposedArmourZones(
  bearing: RelativeBearing,
): readonly PlanarArmourZone[] {
  switch (bearing) {
    case "same":
      return ["front", "left", "right"];
    case "front":
      return ["front"];
    case "front_left":
      return ["front", "left"];
    case "front_right":
      return ["front", "right"];
    case "left":
      return ["left"];
    case "right":
      return ["right"];
    case "rear":
      return ["rear"];
    case "rear_left":
      return ["rear", "left"];
    case "rear_right":
      return ["rear", "right"];
  }
}

export function findShortestGridPath(
  start: GridZone,
  destination: GridZone,
): readonly GridZone[] {
  if (start === destination) {
    return [start];
  }

  const visited = new Set<GridZone>([start]);
  const queue: GridZone[] = [start];
  const parent = new Map<GridZone, GridZone>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === destination) break;
    for (const neighbour of getOrthogonalNeighbours(current)) {
      if (visited.has(neighbour)) continue;
      visited.add(neighbour);
      parent.set(neighbour, current);
      queue.push(neighbour);
    }
  }

  if (!parent.has(destination)) {
    // The 3×3 grid is fully connected orthogonally, so this is unreachable.
    return [];
  }

  const path: GridZone[] = [];
  let cursor: GridZone | undefined = destination;
  while (cursor !== undefined) {
    path.push(cursor);
    cursor = parent.get(cursor);
  }
  return path.reverse();
}

export function mapLegacyZoneToGridZone(legacyZone: LegacyArenaZone): GridZone {
  switch (legacyZone) {
    case "north_edge":
      return "north";
    case "south_edge":
      return "south";
    case "east_edge":
      return "east";
    case "west_edge":
      return "west";
    case "center":
      return "center";
  }
}
