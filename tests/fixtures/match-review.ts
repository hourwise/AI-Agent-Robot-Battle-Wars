import type { MatchReview, ObservedOutcome } from "../../src/schemas/review.schema.js";

/**
 * Builds a minimal valid MatchReview around the given observed outcome.
 * Used by reporting/series compatibility tests to validate review-vs-facts
 * checks without coupling to a specific agent implementation.
 */
export function makeMatchReview(outcome: ObservedOutcome): MatchReview {
  return {
    schemaVersion: "1",
    summary: "Test review",
    keyMoments: [
      {
        round: 5,
        eventType: "component_disabled",
        description: "observed component disable",
      },
    ],
    strategyAssessment: {
      effectiveChoices: [],
      ineffectiveChoices: [],
      policyAssessment: "test",
      designAssessment: "test",
    },
    suggestedChanges: [],
    confidence: "medium",
    observedOutcome: outcome,
  };
}
