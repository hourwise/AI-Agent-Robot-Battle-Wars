import type { AnyFactualMatchReport } from "../schemas/factual-report.schema.js";
import { formatFactualReportForPrompt } from "../reports/review-formatter.js";

export const REVIEW_PROMPT_VERSION = "review-v1";

export function buildReviewSystemPrompt(): string {
  return [
    "You are an expert combat robot analyst for Forge Arena.",
    "You review match results and provide factual, actionable analysis.",
    "You identify effective and ineffective choices in both design and policy.",
    "You suggest specific, targeted changes with clear rationale.",
    "You always return valid JSON matching the required schema exactly.",
    "Never add comments, explanations or extra fields to the JSON.",
    "",
    "Your analysis must reference specific events, rounds, and component states.",
    "Avoid vague advice. Each suggested change must name a specific component,",
    "policy parameter, or tactical decision.",
  ].join("\n");
}

export function buildReviewUserPrompt(report: AnyFactualMatchReport): string {
  const factualText = formatFactualReportForPrompt(report);

  return [
    "Review the following match result. Provide a factual summary, identify",
    "key moments, assess the strategy, and suggest specific changes.",
    "",
    factualText,
    "",
    "Return ONLY a JSON object matching the match review schema:",
    "{",
    '  "schemaVersion": "1",',
    '  "summary": "1-2 sentence factual summary",',
    '  "keyMoments": [{ "round": number|null, "eventType": string, "description": string }],',
    '  "strategyAssessment": {',
    '    "effectiveChoices": [string],',
    '    "ineffectiveChoices": [string],',
    '    "policyAssessment": string,',
    '    "designAssessment": string',
    "  },",
    '  "suggestedChanges": [{',
    '    "target": "chassis|mobility|weapon|utility|armour|policy",',
    '    "action": string,',
    '    "rationale": string,',
    '    "priority": "low|medium|high",',
    '    "replacementChassisId": "light|medium|heavy",',
    '    "replacementMobilityId": "wheels|tracks|legs",',
    '    "replacementWeaponId": "ram|hammer|horizontal_spinner|grappler|flipper",',
    '    "replacementUtilityId": "none|cooling|traction_boost|reinforced_drive",',
    '    "armourAdjustment": { "front": 0, "left": 0, "right": 0, "rear": 0, "top": 0 },',
    '    "policyAdjustment": { "opening": "rush|cautious|flank|hold", ... }',
    "  }],",
    '  "confidence": "low|medium|high",',
    '  "observedOutcome": {',
    '    "winnerId": "fighter_a|fighter_b|null",',
    '    "method": "destruction|immobilisation|judges|draw",',
    '    "rounds": 0,',
    '    "ownFinalIntegrity": 0,',
    '    "opponentFinalIntegrity": 0,',
    '    "ownDisabledComponents": ["mobility"],',
    '    "opponentDisabledComponents": ["mobility"]',
    "  }",
    "}",
    "",
    "Important: For suggestedChanges, replacement IDs must be valid catalogue values",
    "(e.g. 'ram', 'hammer', 'horizontal_spinner', 'grappler', 'flipper' for weapons).",
    "Do not invent component names like 'lifter' or 'self-righting mechanism'.",
    "The observedOutcome must match the exact facts from the match report above.",
  ].join("\n");
}

export function buildReviewCorrectionPrompt(errors: readonly string[]): string {
  return [
    "Your previous review was invalid. Fix these exact errors:",
    ...errors.map((e) => `- ${e}`),
    "",
    "Return ONLY a corrected JSON object matching the match review schema.",
  ].join("\n");
}

export function buildFallbackReview(report: AnyFactualMatchReport): string {
  const winner = report.winner ?? "Draw";
  return `${winner} by ${report.resultMethod} in ${report.rounds} rounds.`;
}
