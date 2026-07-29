import type { SimulationEvent } from "../../simulator/types.js";
import type { HighlightMoment, CompetitionState } from "./ascii.types.js";
import { renderArenaSnapshot } from "./arena-snapshot-renderer.js";
import {
  sanitizeName,
  resolveDisplayName,
  SEPARATOR,
  padCenter,
  ARENA_WIDTH,
  truncateLine,
  DEFAULT_MAX_WIDTH,
} from "./ascii-layout.js";

function describeEvent(event: SimulationEvent, state: CompetitionState): string {
  const actorName = getFighterName(event.actorId, state);
  const targetName = getFighterName(event.targetId, state);

  switch (event.type) {
    case "attack_hit": {
      const weapon = formatWeaponName(event.data.weapon as string);
      const hitZone = event.data.hitZone as string;
      const damage = event.data.effectiveDamage as number;
      const isCritical = event.data.isCritical as boolean;
      const critText = isCritical ? " critically" : "";
      return `${actorName}${critText} strikes ${targetName}'s ${hitZone} armour with ${weapon} for ${damage} damage.`;
    }

    case "integrity_damaged": {
      const damage = event.data.damage as number;
      const remaining = event.data.remaining as number;
      return `${targetName} takes ${damage} integrity damage. (${remaining} remaining)`;
    }

    case "component_damaged": {
      const component = event.data.component as string;
      if (event.data.componentImpact !== undefined) {
        return `${targetName}'s ${component} system is damaged at component impact ${event.data.componentImpact}.`;
      }
      return `${targetName}'s ${component} system is damaged.`;
    }

    case "component_damage_resisted": {
      if (event.data.componentImpact !== undefined) {
        return `${targetName}'s reinforced drive absorbs component impact ${event.data.componentImpact}.`;
      }
      return `${targetName}'s reinforced drive absorbs the impact.`;
    }

    case "component_disabled": {
      const component = event.data.component as string;
      if (event.data.componentImpact !== undefined) {
        return `${targetName}'s ${component} system is disabled at component impact ${event.data.componentImpact}.`;
      }
      return `${targetName}'s ${component} system is disabled.`;
    }

    case "robot_overturned": {
      return `${targetName} is overturned!`;
    }

    case "movement_resolved": {
      const action = event.data.action as string;
      const to = event.data.to as string;
      const from = event.data.from as string;
      if (action === "knockback") {
        return `${targetName} is knocked back to ${formatZone(to)}.`;
      }
      if (from === to) {
        return `${actorName} turns while holding ${formatZone(to)}.`;
      }
      return `${actorName} moves to ${formatZone(to)}.`;
    }

    case "attack_missed": {
      const weapon = formatWeaponName(event.data.weapon as string);
      return `${actorName}'s ${weapon} attack misses.`;
    }

    default:
      return "";
  }
}

function getFighterName(fighterId: string | undefined, state: CompetitionState): string {
  if (!fighterId) return "Unknown";
  const nameA = state.fighterA.build.proposal.machineName;
  const nameB = state.fighterB.build.proposal.machineName;
  const raw = resolveDisplayName(fighterId, nameA, nameB);
  return sanitizeName(raw, 20);
}

function formatZone(zone: string): string {
  return zone
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatWeaponName(weapon: string): string {
  return weapon
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function renderMoment(moment: HighlightMoment): string {
  const lines: string[] = [];

  lines.push(SEPARATOR);
  lines.push(padCenter(`ROUND ${moment.round} — ${moment.title}`, ARENA_WIDTH));
  lines.push(SEPARATOR);
  lines.push("");

  const arena = renderArenaSnapshot(
    moment.stateAfter.fighterA,
    moment.stateAfter.fighterB,
  );
  lines.push(arena);
  lines.push("");

  for (const event of moment.events) {
    const description = describeEvent(event, moment.stateAfter);
    if (description) {
      lines.push(truncateLine(description, DEFAULT_MAX_WIDTH));
    }
  }

  lines.push("");

  return lines.join("\n");
}

export function renderOpeningFrame(state: CompetitionState, seed: number): string {
  const lines: string[] = [];

  lines.push(SEPARATOR);
  lines.push(padCenter("OPENING POSITIONS", ARENA_WIDTH));
  lines.push(SEPARATOR);
  lines.push("");

  const arena = renderArenaSnapshot(state.fighterA, state.fighterB);
  lines.push(arena);
  lines.push("");

  const nameA = resolveDisplayName(
    "fighter_a",
    state.fighterA.build.proposal.machineName,
    state.fighterB.build.proposal.machineName,
  );
  const nameB = resolveDisplayName(
    "fighter_b",
    state.fighterA.build.proposal.machineName,
    state.fighterB.build.proposal.machineName,
  );

  lines.push(`${sanitizeName(nameA, 16)} starts at south edge.`);
  lines.push(`${sanitizeName(nameB, 16)} starts at north edge.`);
  lines.push(`Seed: ${seed}`);
  lines.push("");

  return lines.join("\n");
}
