import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import type { DesignRequest, OpponentSummary } from "../agents/arena-agent.js";
import type { MachineBuildProposal } from "../validation/validation.types.js";
import { formatReviewContextForPrompt } from "../reports/review-formatter.js";

export const DESIGN_PROMPT_VERSION = "design-v2";

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

function formatOpponent(opponent: OpponentSummary): string {
  const lines: string[] = [];
  lines.push("Opponent:");
  lines.push(`  Name: ${opponent.machineName}`);
  lines.push(
    `  Build: ${opponent.chassisId} chassis, ${opponent.mobilityId} mobility, ${opponent.weaponId} weapon, ${opponent.utilityId} utility`,
  );
  lines.push(
    `  Armour: F${opponent.armour.front} L${opponent.armour.left} R${opponent.armour.right} Ra${opponent.armour.rear} T${opponent.armour.top}`,
  );
  if (opponent.knownWeaknesses.length > 0) {
    lines.push(`  Known weaknesses: ${opponent.knownWeaknesses.join(", ")}`);
  }
  return lines.join("\n");
}

function formatPriorBuild(priorBuild: MachineBuildProposal): string {
  const lines: string[] = [];
  lines.push("Your previous design:");
  lines.push(`  Name: ${priorBuild.machineName}`);
  lines.push(
    `  Build: ${priorBuild.chassisId} chassis, ${priorBuild.mobilityId} mobility, ${priorBuild.weaponId} weapon, ${priorBuild.utilityId} utility`,
  );
  lines.push(
    `  Armour: F${priorBuild.armour.front} L${priorBuild.armour.left} R${priorBuild.armour.right} Ra${priorBuild.armour.rear} T${priorBuild.armour.top}`,
  );
  lines.push(`  Summary: ${priorBuild.designSummary}`);
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
    "Return exactly this JSON structure:",
    "",
    "{",
    '  "machineName": "string",',
    '  "chassisId": "light | medium | heavy",',
    '  "mobilityId": "wheels | tracks | legs",',
    '  "weaponId": "ram | hammer | horizontal_spinner | grappler | flipper",',
    '  "utilityId": "none | cooling | traction_boost | reinforced_drive",',
    '  "armour": {',
    '    "front": 0,',
    '    "left": 0,',
    '    "right": 0,',
    '    "rear": 0,',
    '    "top": 0',
    "  },",
    '  "designSummary": "string, maximum 500 characters",',
    '  "designRationale": "string, maximum 500 characters"',
    "}",
    "",
    "Return only the JSON object. Do not use Markdown fences.",
    "",
    formatCatalogue(),
  ].join("\n");
}

export function buildDesignUserPrompt(request: DesignRequest): string {
  const lines: string[] = [];

  if (request.reviewContext) {
    const { matchNumber, factualReport, review } = request.reviewContext;
    lines.push(
      `REBUILD: You are redesigning for match ${matchNumber} after a previous result.`,
    );
    lines.push("");
    lines.push(
      formatReviewContextForPrompt(
        factualReport,
        review.summary,
        review.suggestedChanges,
      ),
    );
    lines.push("");

    if (request.priorBuild) {
      lines.push(formatPriorBuild(request.priorBuild));
      lines.push("");
    }

    if (request.opponent) {
      lines.push(formatOpponent(request.opponent));
      lines.push("");
    }

    lines.push("Apply suggested changes where they improve the design. You may also");
    lines.push("make additional improvements not suggested by the review.");
  } else if (request.opponent) {
    lines.push("Design a combat robot to compete against the following opponent.");
    lines.push("");
    lines.push(formatOpponent(request.opponent));

    if (request.priorBuild) {
      lines.push("");
      lines.push(formatPriorBuild(request.priorBuild));
      lines.push("");
      lines.push("Improve upon this design based on what you know about the opponent.");
    } else {
      lines.push("");
      lines.push("Consider:");
      lines.push("- How to exploit the opponent's weaknesses");
      lines.push("- Heat management across 20 rounds");
      lines.push("- Armour distribution that balances offence and defence");
      lines.push("- Mobility to outmanoeuvre the opponent");
    }
  } else {
    lines.push("Design a combat robot that can compete against a heavy, front-armoured");
    lines.push(
      "opponent with a ram weapon and reinforced drive. The opponent's weakness",
    );
    lines.push("is its rear armour (0 points) and slow turning.");
    lines.push("");
    lines.push("Consider:");
    lines.push("- How to exploit the rear weakness");
    lines.push("- Heat management across 20 rounds");
    lines.push("- Armour distribution that balances offence and defence");
    lines.push("- Mobility to outmanoeuvre a slow, front-heavy opponent");
  }

  if (request.context) {
    lines.push("");
    lines.push(`Additional context: ${request.context}`);
  }

  lines.push("");
  lines.push("Return ONLY a JSON object matching the build proposal schema.");

  return lines.join("\n");
}

export function buildCorrectionPrompt(errors: readonly string[]): string {
  return [
    "Your previous build was invalid. Fix these errors:",
    ...errors.map((e) => `- ${e}`),
    "",
    "Return ONLY a corrected JSON object matching the build proposal schema.",
  ].join("\n");
}
