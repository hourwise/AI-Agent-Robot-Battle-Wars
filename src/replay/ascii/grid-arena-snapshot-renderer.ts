import type { GridZone, GridDirection } from "../../simulator/arena-grid.js";
import { buildFighterMarker } from "./fighter-marker.js";

/**
 * Typed visual state consumed by the 3×3 grid arena renderer. Zone and facing
 * are the canonical grid types; the renderer never accepts arbitrary untyped
 * zone strings.
 */
export interface GridFighterVisualState {
  readonly fighterId: string;
  readonly zone: GridZone;
  readonly facing: GridDirection;
  readonly conditions: readonly string[];
  readonly components: {
    readonly mobilityDisabled: boolean;
    readonly weaponDisabled: boolean;
    readonly utilityDisabled: boolean;
    readonly mobilityDamaged: boolean;
    readonly weaponDamaged: boolean;
    readonly utilityDamaged: boolean;
  };
}

const CELL_WIDTH = 12;
const COLUMN_SEPARATOR = " | ";
const ROW_SEPARATOR = "-".repeat(CELL_WIDTH * 3 + COLUMN_SEPARATOR.length * 2);

const GRID_ROWS: readonly (readonly [GridZone, GridZone, GridZone])[] = [
  ["north_west", "north", "north_east"],
  ["west", "center", "east"],
  ["south_west", "south", "south_east"],
];

function zoneLabel(zone: GridZone): string {
  return zone.replace(/_/g, " ").toUpperCase();
}

function padCentered(text: string, width: number): string {
  if (text.length >= width) return text;
  const totalPad = width - text.length;
  const left = Math.floor(totalPad / 2);
  return " ".repeat(left) + text + " ".repeat(totalPad - left);
}

function buildCellMarkers(
  fighterA: GridFighterVisualState,
  fighterB: GridFighterVisualState,
): Map<GridZone, string[]> {
  const markers = new Map<GridZone, string[]>();
  markers.set(fighterA.zone, [buildFighterMarker(fighterA, "A")]);
  const markerB = buildFighterMarker(fighterB, "B");
  if (fighterB.zone === fighterA.zone) {
    // Deterministic same-cell order: fighter A before fighter B.
    markers.get(fighterA.zone)!.push(markerB);
  } else {
    markers.set(fighterB.zone, [markerB]);
  }
  return markers;
}

/**
 * Renders the frozen 3×3 arena:
 *
 * ```
 * north_west | north | north_east
 * west       | center | east
 * south_west | south | south_east
 * ```
 *
 * Deterministic fixed-width layout; both fighters may share a cell (A before
 * B); empty cells use "."; facing arrows and component/condition marker
 * precedence are preserved. No colour or terminal-specific behaviour.
 */
export function renderGridArenaSnapshot(
  fighterA: GridFighterVisualState,
  fighterB: GridFighterVisualState,
): string {
  const markers = buildCellMarkers(fighterA, fighterB);
  const lines: string[] = [];

  for (let rowIndex = 0; rowIndex < GRID_ROWS.length; rowIndex++) {
    const row = GRID_ROWS[rowIndex]!;

    const labelLine = row
      .map((zone) => padCentered(zoneLabel(zone), CELL_WIDTH))
      .join(COLUMN_SEPARATOR);
    lines.push(labelLine);

    const contentLine = row
      .map((zone) => {
        const cellMarkers = markers.get(zone);
        const content = cellMarkers ? cellMarkers.join(" ") : ".";
        return padCentered(`[${content}]`, CELL_WIDTH);
      })
      .join(COLUMN_SEPARATOR);
    lines.push(contentLine);

    if (rowIndex < GRID_ROWS.length - 1) {
      lines.push(ROW_SEPARATOR);
    }
  }

  return lines.join("\n");
}
