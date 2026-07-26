import { describe, it, expect } from "vitest";
import {
  MatchReviewSchema,
  validateMatchReview,
  serializeMatchReview,
  deserializeMatchReview,
} from "../../src/schemas/review.schema.js";

const validReview = {
  schemaVersion: "1" as const,
  summary: "Fighter A won by destruction in 12 rounds.",
  keyMoments: [
    { round: 5, eventType: "attack", description: "Critical hit for 18 damage" },
  ],
  strategyAssessment: {
    effectiveChoices: ["flanking"],
    ineffectiveChoices: ["over-aggression"],
    policyAssessment: "Opening flank was effective.",
    designAssessment: "Weapon choice was strong.",
  },
  suggestedChanges: [
    {
      target: "armour" as const,
      action: "Increase rear armour",
      rationale: "Prevent rear exploitation",
      priority: "medium" as const,
    },
  ],
  confidence: "high" as const,
};

describe("review schema", () => {
  it("validates a complete review", () => {
    const result = MatchReviewSchema.safeParse(validReview);
    expect(result.success).toBe(true);
  });

  it("validates a minimal review", () => {
    const result = MatchReviewSchema.safeParse({
      schemaVersion: "1",
      summary: "Short summary.",
      keyMoments: [],
      strategyAssessment: {
        effectiveChoices: [],
        ineffectiveChoices: [],
        policyAssessment: "",
        designAssessment: "",
      },
      suggestedChanges: [],
      confidence: "low",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing schemaVersion", () => {
    const result = MatchReviewSchema.safeParse({ ...validReview, schemaVersion: "2" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid confidence level", () => {
    const result = MatchReviewSchema.safeParse({
      ...validReview,
      confidence: "very_high",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid suggested change target", () => {
    const result = MatchReviewSchema.safeParse({
      ...validReview,
      suggestedChanges: [
        {
          target: "invalid",
          action: "do something",
          rationale: "because",
          priority: "high",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("serializes and deserializes correctly", () => {
    const validation = validateMatchReview(validReview);
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      const json = serializeMatchReview(validation.review);
      const loaded = deserializeMatchReview(json);
      expect(loaded.ok).toBe(true);
      if (loaded.ok) {
        expect(loaded.review.summary).toBe(validReview.summary);
        expect(loaded.review.confidence).toBe("high");
        expect(loaded.review.suggestedChanges).toHaveLength(1);
      }
    }
  });

  it("round-trips through JSON", () => {
    const validation = validateMatchReview(validReview);
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      const json = JSON.stringify(validation.review);
      const parsed = JSON.parse(json);
      const revalidated = validateMatchReview(parsed);
      expect(revalidated.ok).toBe(true);
    }
  });
});
