import type { FighterState, ArenaZone, Direction, MovementAction } from "./types.js";

export function resolveMovement(
  state: FighterState,
  action: MovementAction,
): { zone: ArenaZone; facing: Direction } {
  switch (action) {
    case "advance":
      return resolveAdvance(state);
    case "retreat":
      return resolveRetreat(state);
    case "circle_left":
      return { zone: state.zone, facing: rotateLeft(state.facing) };
    case "circle_right":
      return { zone: state.zone, facing: rotateRight(state.facing) };
    case "hold":
      return { zone: state.zone, facing: state.facing };
  }
}

function resolveAdvance(state: FighterState): { zone: ArenaZone; facing: Direction } {
  if (state.zone === "center") {
    return { zone: state.zone, facing: state.facing };
  }

  const opponentEdge = getOppositeEdge(state.zone);
  if (state.zone === opponentEdge) {
    return { zone: "center", facing: state.facing };
  }

  return { zone: "center", facing: state.facing };
}

function resolveRetreat(state: FighterState): { zone: ArenaZone; facing: Direction } {
  if (state.zone === "center") {
    return { zone: state.zone, facing: state.facing };
  }

  return { zone: state.zone, facing: rotateBack(state.facing) };
}

function getOppositeEdge(zone: ArenaZone): ArenaZone {
  switch (zone) {
    case "north_edge":
      return "south_edge";
    case "south_edge":
      return "north_edge";
    case "east_edge":
      return "west_edge";
    case "west_edge":
      return "east_edge";
    case "center":
      return "center";
  }
}

function rotateLeft(facing: Direction): Direction {
  switch (facing) {
    case "north":
      return "west";
    case "west":
      return "south";
    case "south":
      return "east";
    case "east":
      return "north";
  }
}

function rotateRight(facing: Direction): Direction {
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

function rotateBack(facing: Direction): Direction {
  switch (facing) {
    case "north":
      return "south";
    case "south":
      return "north";
    case "east":
      return "west";
    case "west":
      return "east";
  }
}

export function canAdvance(zone: ArenaZone): boolean {
  return zone !== "center";
}
