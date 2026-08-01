import type { AnyMatchResult, SimulationEvent } from "../simulator/types.js";
import { sanitizeTerminalText, resolveDisplayName } from "../shared/text-sanitise.js";
import { formatZoneName } from "./zone-format.js";

function getFighterName(fighterId: string | undefined, result: AnyMatchResult): string {
  if (!fighterId) return "Unknown";
  const nameA = sanitizeTerminalText(result.config.fighterA.build.proposal.machineName);
  const nameB = sanitizeTerminalText(result.config.fighterB.build.proposal.machineName);
  return resolveDisplayName(fighterId, nameA, nameB);
}

function formatZone(zone: string): string {
  return formatZoneName(zone);
}

function formatWeapon(weapon: string): string {
  return weapon
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function describeEvent(event: SimulationEvent, result: AnyMatchResult): string {
  const actor = getFighterName(event.actorId, result);
  const target = getFighterName(event.targetId, result);

  switch (event.type) {
    case "competition_started":
      return "The match begins.";

    case "round_started":
      return `\n--- Round ${event.round} ---`;

    case "movement_resolved": {
      const action = event.data.action as string;
      const to = event.data.to as string;
      const from = event.data.from as string;
      if (action === "knockback") {
        return `${actor} knocks ${target} back to ${formatZone(to)}.`;
      }
      if (from === to) {
        return `${actor} turns while holding ${formatZone(to)}.`;
      }
      return `${actor} moves to ${formatZone(to)}.`;
    }

    case "attack_attempted": {
      const weapon = formatWeapon(event.data.weapon as string);
      return `${actor} attacks with ${weapon}.`;
    }

    case "attack_missed": {
      const weapon = formatWeapon(event.data.weapon as string);
      return `${actor}'s ${weapon} attack misses.`;
    }

    case "attack_hit": {
      const weapon = formatWeapon(event.data.weapon as string);
      const hitZone = event.data.hitZone as string;
      const damage = event.data.effectiveDamage as number;
      const isCritical = event.data.isCritical as boolean;
      if (isCritical) {
        return `${actor} lands a critical hit on ${target}'s ${hitZone} armour with ${weapon} for ${damage} damage!`;
      }
      return `${actor} hits ${target}'s ${hitZone} armour with ${weapon} for ${damage} damage.`;
    }

    case "integrity_damaged": {
      const damage = event.data.damage as number;
      const remaining = event.data.remaining as number;
      return `${target} takes ${damage} integrity damage. (${remaining} remaining)`;
    }

    case "component_damaged": {
      const component = event.data.component as string;
      const prev = event.data.previousState as string;
      const next = event.data.newState as string;
      if (event.data.componentImpact !== undefined) {
        return `${target}'s ${component} is damaged at component impact ${event.data.componentImpact} (${String(event.data.qualificationReason ?? "unknown")}).`;
      }
      return `${target}'s ${component} is damaged (${prev} → ${next}).`;
    }

    case "component_damage_resisted": {
      const guardBefore = event.data.guardStateBefore as string;
      const guardAfter = event.data.guardStateAfter as string;
      if (event.data.componentImpact !== undefined) {
        return `${target}'s reinforced drive absorbs component impact ${event.data.componentImpact} (guard: ${guardBefore} to ${guardAfter}).`;
      }
      return `${target}'s reinforced drive absorbs the hit (guard: ${guardBefore} → ${guardAfter}).`;
    }

    case "component_disabled": {
      const component = event.data.component as string;
      if (event.data.componentImpact !== undefined) {
        return `${target}'s ${component} system is disabled at component impact ${event.data.componentImpact}!`;
      }
      return `${target}'s ${component} system is disabled!`;
    }

    case "robot_overturned":
      return `${target} is overturned!`;

    case "policy_triggered":
      return "";

    case "round_ended": {
      const data = event.data as {
        fighterA: { integrity: number; heat: number };
        fighterB: { integrity: number; heat: number };
      };
      const nameA = resolveDisplayName(
        "fighter_a",
        sanitizeTerminalText(result.config.fighterA.build.proposal.machineName),
        sanitizeTerminalText(result.config.fighterB.build.proposal.machineName),
      );
      const nameB = resolveDisplayName(
        "fighter_b",
        sanitizeTerminalText(result.config.fighterA.build.proposal.machineName),
        sanitizeTerminalText(result.config.fighterB.build.proposal.machineName),
      );
      return `End of round ${event.round}. ${nameA}: ${data.fighterA.integrity} integrity, ${data.fighterA.heat} heat. ${nameB}: ${data.fighterB.integrity} integrity, ${data.fighterB.heat} heat.`;
    }

    case "competition_ended": {
      const winner = event.data.winner as string | null;
      const method = event.data.method as string;
      if (!winner) return "The match ends in a draw.";
      const winnerName = getFighterName(winner, result);
      return `${winnerName} wins by ${method}!`;
    }

    default:
      return "";
  }
}

export function renderTextReplay(result: AnyMatchResult): string {
  const lines: string[] = [];

  const nameA = resolveDisplayName(
    "fighter_a",
    sanitizeTerminalText(result.config.fighterA.build.proposal.machineName),
    sanitizeTerminalText(result.config.fighterB.build.proposal.machineName),
  );
  const nameB = resolveDisplayName(
    "fighter_b",
    sanitizeTerminalText(result.config.fighterA.build.proposal.machineName),
    sanitizeTerminalText(result.config.fighterB.build.proposal.machineName),
  );

  lines.push("=".repeat(50));
  lines.push(`${nameA.toUpperCase()} vs ${nameB.toUpperCase()}`);
  lines.push("=".repeat(50));
  lines.push("");
  lines.push(`Seed: ${result.config.seed}`);
  lines.push(`Ruleset: ${result.config.rulesetVersion}`);
  lines.push(`Catalogue: ${result.config.catalogueVersion}`);
  lines.push("");

  for (const event of result.events) {
    const description = describeEvent(event, result);
    if (description) {
      lines.push(description);
    }
  }

  lines.push("");
  lines.push("=".repeat(50));
  lines.push("MATCH COMPLETE");
  lines.push("=".repeat(50));

  return lines.join("\n");
}
