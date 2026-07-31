import { FACING_ARROWS, CONDITION_MARKERS } from "./ascii-layout.js";

/**
 * A fighter view with just the fields needed to build an ASCII marker.
 * Both the legacy five-zone renderer and the 3×3 grid renderer use this so
 * marker precedence is identical across arena models.
 */
export interface MarkerFighterLike {
  readonly facing: string;
  readonly conditions: readonly string[];
  readonly components: {
    readonly mobilityDisabled: boolean;
    readonly mobilityDamaged: boolean;
  };
}

/**
 * Builds the deterministic fighter marker for arena cells.
 *
 * Precedence (matching the legacy renderer):
 *   1. mobility disabled  → "X"
 *   2. mobility damaged   → "x"
 *   3. overturned         → "!"
 *   4. overheated         → "~"
 *   5. otherwise          → facing arrow (^ v > <)
 */
export function buildFighterMarker(fighter: MarkerFighterLike, label: string): string {
  const facing = FACING_ARROWS[fighter.facing] ?? "?";
  let marker = label;

  if (fighter.components.mobilityDisabled) {
    marker += "X";
  } else if (fighter.components.mobilityDamaged) {
    marker += "x";
  } else if (fighter.conditions.includes("overturned")) {
    marker += CONDITION_MARKERS.overturned ?? "!";
  } else if (fighter.conditions.includes("overheated")) {
    marker += CONDITION_MARKERS.overheated ?? "~";
  } else {
    marker += facing;
  }

  return marker;
}
