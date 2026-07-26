import type { MachineBuildProposal } from "../validation/validation.types.js";

export const POLICY_PROMPT_VERSION = "policy-v1";

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

function formatOpponent(): string {
  const lines: string[] = [];
  lines.push("Opponent: The Bulwark");
  lines.push("Chassis: heavy (150 integrity)");
  lines.push("Mobility: tracks (speed 5, traction 9, turning 5)");
  lines.push("Weapon: ram (scales with speed, low base damage)");
  lines.push("Utility: reinforced_drive (reduced mobility damage)");
  lines.push("Armour: front 60, left 15, right 15, rear 0, top 0");
  lines.push("Known weakness: zero rear armour, slow turning");
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

export function buildPolicyUserPrompt(proposal: MachineBuildProposal): string {
  return [
    "Choose a tactical policy for your robot:",
    "",
    formatBuild(proposal),
    "",
    formatOpponent(),
    "",
    "Select a policy that:",
    "- Exploits the opponent's rear weakness",
    "- Matches your robot's capabilities",
    "- Manages heat across 20 rounds",
    "- Has a clear retreat plan if things go wrong",
    "",
    "Return ONLY a JSON object matching the policy schema.",
  ].join("\n");
}

export function buildPolicyCorrectionPrompt(errors: readonly string[]): string {
  return [
    "Your previous policy was invalid. Fix these errors:",
    ...errors.map((e) => `- ${e}`),
    "",
    "Return ONLY a corrected JSON object matching the policy schema.",
  ].join("\n");
}
