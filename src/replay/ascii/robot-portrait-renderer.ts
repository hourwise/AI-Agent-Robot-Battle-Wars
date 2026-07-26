import type { ValidatedBuild } from "../../validation/validation.types.js";
import type { FighterVisualState, PortraitData } from "./ascii.types.js";
import {
  sanitizeName,
  formatArmourLine,
  formatConditionList,
  formatComponentStatus,
  padCenter,
  PORTRAIT_WIDTH,
} from "./ascii-layout.js";

const CHASSIS_TEMPLATES: Record<string, string[]> = {
  light: ["   /===\\", "  |     |", "  |_____|"],
  medium: ["  /=====\\", " |       |", " |_______|"],
  heavy: [" /=======\\", "|         |", "|_________|"],
};

const MOBILITY_LINES: Record<string, string[]> = {
  wheels: ["  O       O", " (o)     (o)"],
  tracks: [" []=     =[]", " []=     =[]"],
  legs: ["  /|       |\\", " / |       | \\"],
};

const WEAPON_LINES: Record<string, string[]> = {
  ram: ["--=>"],
  hammer: ["  ___", "  | |"],
  horizontal_spinner: [" =O="],
  grappler: ["/   \\"],
  flipper: ["_____|", "     |"],
};

function getWeaponDisplay(weaponId: string): string[] {
  return WEAPON_LINES[weaponId] ?? [" [?] "];
}

export function extractPortraitData(build: ValidatedBuild): PortraitData {
  return {
    machineName: build.proposal.machineName,
    chassisId: build.proposal.chassisId,
    mobilityId: build.proposal.mobilityId,
    weaponId: build.proposal.weaponId,
    utilityId: build.proposal.utilityId,
    totalCost: build.totalCost,
    armour: { ...build.proposal.armour },
  };
}

export function renderPortrait(
  build: ValidatedBuild,
  state?: FighterVisualState,
): string {
  const data = extractPortraitData(build);
  const lines: string[] = [];

  const name = sanitizeName(data.machineName, 24);
  lines.push(padCenter(name.toUpperCase(), PORTRAIT_WIDTH));
  lines.push(
    padCenter(
      `${capitalize(data.chassisId)} chassis | ${capitalize(data.mobilityId)} | ${formatWeaponName(data.weaponId)}`,
      PORTRAIT_WIDTH,
    ),
  );
  lines.push("");

  const weaponLines = getWeaponDisplay(data.weaponId);
  for (const wl of weaponLines) {
    lines.push(padCenter(wl, PORTRAIT_WIDTH));
  }

  const chassisLines = CHASSIS_TEMPLATES[data.chassisId] ?? CHASSIS_TEMPLATES.medium!;
  for (const cl of chassisLines) {
    lines.push(padCenter(cl, PORTRAIT_WIDTH));
  }

  const mobilityLines = MOBILITY_LINES[data.mobilityId] ?? MOBILITY_LINES.wheels!;
  for (const ml of mobilityLines) {
    lines.push(padCenter(ml, PORTRAIT_WIDTH));
  }

  lines.push("");

  if (data.utilityId !== "none") {
    lines.push(padCenter(`Utility: ${formatWeaponName(data.utilityId)}`, PORTRAIT_WIDTH));
  }
  lines.push(padCenter(`Cost: ${data.totalCost} / 100`, PORTRAIT_WIDTH));
  lines.push(padCenter(`Armour: ${formatArmourLine(data.armour)}`, PORTRAIT_WIDTH));

  if (state) {
    lines.push(
      padCenter(`Integrity: ${state.integrity} / ${state.maxIntegrity}`, PORTRAIT_WIDTH),
    );
    lines.push(
      padCenter(`Conditions: ${formatConditionList(state.conditions)}`, PORTRAIT_WIDTH),
    );
    lines.push(
      padCenter(`Components: ${formatComponentStatus(state.components)}`, PORTRAIT_WIDTH),
    );
  }

  return lines.join("\n");
}

export function renderCompactPortrait(
  build: ValidatedBuild,
  state?: FighterVisualState,
): string {
  const data = extractPortraitData(build);
  const name = sanitizeName(data.machineName, 16);
  const parts = [name.toUpperCase()];

  if (state) {
    if (state.components.mobilityDisabled) parts.push("[MOB OFF]");
    if (state.components.weaponDisabled) parts.push("[WPN OFF]");
    if (state.conditions.includes("overturned")) parts.push("[OVERTURNED]");
    if (state.conditions.includes("overheated")) parts.push("[OVERHEAT]");
    parts.push(`${state.integrity}/${state.maxIntegrity}`);
  }

  return parts.join(" ");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

function formatWeaponName(id: string): string {
  return id
    .split("_")
    .map((w) => capitalize(w))
    .join(" ");
}
