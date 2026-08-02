import type { FactualMatchReportV2 } from "../schemas/factual-report.schema.js";
import type { MatchReview } from "../schemas/review.schema.js";
import { validateMatchReview } from "../schemas/review.schema.js";
import { buildFallbackReview } from "../prompts/review-prompt.v1.js";
import { normaliseDisabledComponents } from "./grid-canary-fallback-agreement.js";

/**
 * The existing deterministic fallback review (reused from the deepseek agent's
 * fallback shape) produced without instantiating any provider (Milestone 0.2C
 * Phase 3D2A / 3D2B). Shared by the single-match grid canary and the grid
 * adaptive-series canary. Disabled-component lists use the shared canonical
 * order `mobility`, `weapon`, `utility` from the fallback-agreement module.
 */
export function buildDeterministicFallbackReview(
  report: FactualMatchReportV2,
): MatchReview {
  const fallbackReview: MatchReview = {
    schemaVersion: "1",
    summary: buildFallbackReview(report),
    keyMoments: [],
    strategyAssessment: {
      effectiveChoices: [],
      ineffectiveChoices: [],
      policyAssessment: "AI review unavailable.",
      designAssessment: "AI review unavailable.",
    },
    suggestedChanges: [],
    confidence: "low",
    observedOutcome: {
      winnerId: report.winner,
      method: report.resultMethod,
      rounds: report.rounds,
      ownFinalIntegrity: report.finalStates.fighterA.integrity,
      opponentFinalIntegrity: report.finalStates.fighterB.integrity,
      ownDisabledComponents: normaliseDisabledComponents(report.finalStates.fighterA),
      opponentDisabledComponents: normaliseDisabledComponents(
        report.finalStates.fighterB,
      ),
    },
  };
  const validated = validateMatchReview(fallbackReview);
  if (!validated.ok) {
    throw new Error(
      `Grid canary fallback review failed its schema: ${validated.errors.message}`,
    );
  }
  return validated.review;
}
