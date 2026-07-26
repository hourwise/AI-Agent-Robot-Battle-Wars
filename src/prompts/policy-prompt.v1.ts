import type { MachineBuildProposal } from "../validation/validation.types.js";
import type { OpponentSummary } from "../agents/arena-agent.js";

export const POLICY_PROMPT_VERSION = "policy-v2";

function formatBuild(proposal: MachineBuildProposal): string {
  const lines: string[] = [];
  lines.push(`Machine: ${proposal.machineName}`);
  lines.push(`Chassis: ${proposal.chassisId}`);
  lines.push(`Mobility: ${proposal.mobilityId}`);
  lines.push(`Weapon: ${proposal.weaponId}`);
  lines.push(`Utility: ${proposal.utilityId}`);
  lines.push(
    `Armour: front ${proposal.armour.front}, left ${proposal.armour.left}, right ${proposal.armour.right}, rear ${proposal.armour.rear}, top ${proposal.armour.top}`,
  );
  lines.push(`Design: ${proposal.designSummary}`);
  return lines.join("\n");
}

function formatOpponent(opponent: OpponentSummary): string {
  const lines: string[] = [];
  lines.push(`Opponent: ${opponent.machineName}`);
  lines.push(`Chassis: ${opponent.chassisId}`);
  lines.push(`Mobility: ${opponent.mobilityId}`);
  lines.push(`Weapon: ${opponent.weaponId}`);
  lines.push(`Utility: ${opponent.utilityId}`);
  lines.push(
    `Armour: front ${opponent.armour.front}, left ${opponent.armour.left}, right ${opponent.armour.right}, rear ${opponent.armour.rear}, top ${opponent.armour.top}`,
  );
  if (opponent.knownWeaknesses.length > 0) {
    lines.push(`Known weaknesses: ${opponent.knownWeaknesses.join("; ")}`);
  }
  return lines.join("\n");
}

function formatPriorMatches(summaries: readonly string[]): string {
  if (summaries.length === 0) return "";
  const lines: string[] = [];
  lines.push("Prior match results:");
  for (const s of summaries) {
    lines.push(`  - ${s}`);
  }
  return lines.join("\n");
}

function formatArena(): string {
  const lines: string[] = [];
  lines.push("Arena: 5 zones arranged as a ring");
  lines.push("  center — equidistant from all edges");
  lines.push("  north_edge, south_edge, east_edge, west_edge");
  lines.push("Distance bands: close, medium, far (derived from zones)");
  lines.push("Combat actions: attack, defend, idle");
  lines.push("Movement actions: advance, retreat, circle_left, circle_right, hold");
  return lines.join("\n");
}

function formatPolicySchema(): string {
  const lines: string[] = [];
  lines.push("Policy fields:");
  lines.push("  opening: rush | cautious | flank | hold");
  lines.push("    rush = close distance immediately");
  lines.push("    cautious = maintain distance, wait for opening");
  lines.push("    flank = circle to opponent's weak side");
  lines.push("    hold = stay in position, force opponent to come to you");
  lines.push("");
  lines.push("  preferredRange: close | medium | far");
  lines.push("");
  lines.push("  aggression: 0-100 (higher = more attacks, fewer defends)");
  lines.push("");
  lines.push("  primaryTarget: front | rear | left | right | top");
  lines.push("  secondaryTarget: front | rear | left | right | top");
  lines.push("");
  lines.push("  retreatThreshold: 0-100 (integrity % to trigger retreat)");
  lines.push("  heatThreshold: 0-100 (heat % to trigger caution)");
  lines.push("");
  lines.push("  fallback: retreat | defend | desperate_attack");
  lines.push("    Used when retreatThreshold or heatThreshold is exceeded.");
  return lines.join("\n");
}

export function buildPolicySystemPrompt(): string {
  return [
    "You are an expert combat tactician for Forge Arena.",
    "You choose tactical policies for combat robots based on their design.",
    "You analyse the opponent's strengths and weaknesses to select the best strategy.",
    "You always return valid JSON matching the required schema exactly.",
    "Never add comments, explanations or extra fields to the JSON.",
    "",
    formatArena(),
    "",
    formatPolicySchema(),
  ].join("\n");
}

export function buildPolicyUserPrompt(
  proposal: MachineBuildProposal,
  opponent: OpponentSummary,
  priorMatchSummaries: readonly string[] = [],
): string {
  const sections: string[] = [
    "Choose a tactical policy for your robot:",
    "",
    formatBuild(proposal),
    "",
    formatOpponent(opponent),
  ];

  const prior = formatPriorMatches(priorMatchSummaries);
  if (prior) {
    sections.push("", prior);
  }

  sections.push(
    "",
    "Select a policy that:",
    `- Exploits the opponent's weaknesses`,
    "- Matches your robot's capabilities",
    "- Manages heat across 20 rounds",
    "- Has a clear retreat plan if things go wrong",
    "",
    "Return ONLY a JSON object matching the policy schema.",
  );

  return sections.join("\n");
}

export function buildPolicyCorrectionPrompt(errors: readonly string[]): string {
  return [
    "Your previous policy was invalid. Fix these errors:",
    ...errors.map((e) => `- ${e}`),
    "",
    "Return ONLY a corrected JSON object matching the policy schema.",
  ].join("\n");
}
