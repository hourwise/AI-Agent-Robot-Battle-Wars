import type { FighterVisualState } from "./ascii.types.js";
import {
  FACING_ARROWS,
  CONDITION_MARKERS,
  padCenter,
  padRight,
  ARENA_WIDTH,
} from "./ascii-layout.js";

function getMarker(fighter: FighterVisualState, label: string): string {
  const facing = FACING_ARROWS[fighter.facing] ?? "?";
  let marker = label;

  if (fighter.components.mobilityDisabled) {
    marker += "X";
  } else if (fighter.conditions.includes("overturned")) {
    marker += CONDITION_MARKERS.overturned;
  } else if (fighter.conditions.includes("overheated")) {
    marker += CONDITION_MARKERS.overheated;
  } else {
    marker += facing;
  }

  return marker;
}

export function renderArenaSnapshot(
  fighterA: FighterVisualState,
  fighterB: FighterVisualState,
): string {
  const markerA = getMarker(fighterA, "A");
  const markerB = getMarker(fighterB, "B");

  const zoneA = fighterA.zone;
  const zoneB = fighterB.zone;

  const lines: string[] = [];

  const northContent = zoneB === "north_edge" ? padRight(markerB, 10) : " ".repeat(10);
  lines.push(padCenter("[NORTH]", ARENA_WIDTH));
  lines.push(padCenter(northContent.trim() || ".", ARENA_WIDTH));
  lines.push("");

  const westContent =
    zoneA === "west_edge"
      ? padRight(markerA, 8)
      : zoneB === "west_edge"
        ? padRight(markerB, 8)
        : " ".repeat(8);

  const centerContent = [];
  if (zoneA === "center") centerContent.push(markerA);
  if (zoneB === "center") centerContent.push(markerB);
  const centerStr = centerContent.length > 0 ? centerContent.join(" ") : ".";
  const centerPadded = padRight(`[${centerStr}]`, 14);

  const eastContent =
    zoneA === "east_edge"
      ? padRight(markerA, 8)
      : zoneB === "east_edge"
        ? padRight(markerB, 8)
        : " ".repeat(8);

  const midLine = `${padRight("[WEST]", 10)} ${centerPadded} ${padRight("[EAST]", 10)}`;
  lines.push(midLine);

  const midDetail = `${padRight(westContent.trim() || ".", 10)} ${padRight(centerStr, 14)} ${eastContent.trim() || "."}`;
  lines.push(midDetail);
  lines.push("");

  const southContent = zoneA === "south_edge" ? padRight(markerA, 10) : " ".repeat(10);
  lines.push(padCenter(southContent.trim() || ".", ARENA_WIDTH));
  lines.push(padCenter("[SOUTH]", ARENA_WIDTH));

  return lines.join("\n");
}

export function renderArenaWithStatus(
  fighterA: FighterVisualState,
  fighterB: FighterVisualState,
): string {
  const arena = renderArenaSnapshot(fighterA, fighterB);
  const statusA = renderCompactStatus(fighterA, "A");
  const statusB = renderCompactStatus(fighterB, "B");

  return [arena, "", statusA, statusB].join("\n");
}

function renderCompactStatus(fighter: FighterVisualState, label: string): string {
  const parts: string[] = [`${label}: ${fighter.zone}`];

  if (fighter.components.mobilityDisabled) parts.push("mobility disabled");
  if (fighter.components.weaponDisabled) parts.push("weapon disabled");
  if (fighter.components.utilityDisabled) parts.push("utility disabled");
  if (fighter.conditions.includes("overturned")) parts.push("overturned");
  if (fighter.conditions.includes("overheated")) parts.push("overheated");

  return parts.join(", ");
}
