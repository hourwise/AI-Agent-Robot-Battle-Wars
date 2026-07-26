import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";

export const DESIGN_PROMPT_VERSION = "design-v1";

function formatCatalogue(): string {
  const lines: string[] = [];
  lines.push(`Budget: ${CATALOGUE_V1.budget} points`);
  lines.push(`Catalogue version: ${CATALOGUE_V1.version}`);
  lines.push("");

  lines.push("Chassis:");
  for (const c of CATALOGUE_V1.chassis) {
    lines.push(
      `  ${c.id} — cost ${c.cost}, integrity ${c.integrity}, agility ${c.agility}, stability ${c.stability}`,
    );
  }
  lines.push("");

  lines.push("Mobility:");
  for (const m of CATALOGUE_V1.mobility) {
    lines.push(
      `  ${m.id} — cost ${m.cost}, speed ${m.speed}, traction ${m.traction}, turning ${m.turning}`,
    );
  }
  lines.push("");

  lines.push("Weapons:");
  for (const w of CATALOGUE_V1.weapons) {
    lines.push(
      `  ${w.id} — cost ${w.cost}, base damage ${w.baseDamage}, accuracy ${w.accuracy}, cooldown ${w.cooldown} rounds, trait: ${w.trait}`,
    );
  }
  lines.push("");

  lines.push("Utilities:");
  for (const u of CATALOGUE_V1.utilities) {
    lines.push(`  ${u.id} — cost ${u.cost}, effect: ${u.effect}`);
  }
  lines.push("");

  lines.push("Armour rules:");
  lines.push(
    `  ${CATALOGUE_V1.armour.costPerTenPoints} budget point per 10 armour points (rounded up)`,
  );
  lines.push(`  Max per zone: ${CATALOGUE_V1.armour.maxPerZone}`);
  lines.push(`  Max total: ${CATALOGUE_V1.armour.maxTotal}`);
  lines.push("");

  lines.push("Cost example: 40 front armour = 4 budget points (ceil(40/10)*1)");

  return lines.join("\n");
}

export function buildDesignSystemPrompt(): string {
  return [
    "You are an expert combat robot designer for Forge Arena.",
    "You design robots under strict budget and component constraints.",
    "You think strategically about facing, heat management, mobility, and trade-offs.",
    "You always return valid JSON matching the required schema exactly.",
    "Never add comments, explanations or extra fields to the JSON.",
    "",
    formatCatalogue(),
  ].join("\n");
}

export function buildDesignUserPrompt(): string {
  return [
    "Design a combat robot that can compete against a heavy, front-armoured",
    "opponent with a ram weapon and reinforced drive. The opponent's weakness",
    "is its rear armour (0 points) and slow turning.",
    "",
    "Consider:",
    "- How to exploit the rear weakness",
    "- Heat management across 20 rounds",
    "- Armour distribution that balances offence and defence",
    "- Mobility to outmanoeuvre a slow, front-heavy opponent",
    "",
    "Return ONLY a JSON object matching the build proposal schema.",
  ].join("\n");
}

export function buildCorrectionPrompt(errors: readonly string[]): string {
  return [
    "Your previous build was invalid. Fix these errors:",
    ...errors.map((e) => `- ${e}`),
    "",
    "Return ONLY a corrected JSON object matching the build proposal schema.",
  ].join("\n");
}
