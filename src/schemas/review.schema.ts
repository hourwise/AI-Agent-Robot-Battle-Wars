import { z } from "zod";

const keyMomentReviewSchema = z.object({
  round: z.number().int().nonnegative().nullable(),
  eventType: z.string(),
  description: z.string(),
});

const strategyAssessmentSchema = z.object({
  effectiveChoices: z.array(z.string()),
  ineffectiveChoices: z.array(z.string()),
  policyAssessment: z.string(),
  designAssessment: z.string(),
});

const observedOutcomeSchema = z.object({
  winnerId: z.string().nullable(),
  method: z.string(),
  rounds: z.number().int().nonnegative(),
  ownFinalIntegrity: z.number().int().nonnegative(),
  opponentFinalIntegrity: z.number().int().nonnegative(),
  ownDisabledComponents: z.array(z.string()),
  opponentDisabledComponents: z.array(z.string()),
});

const suggestedChangeSchema = z.object({
  target: z.enum(["chassis", "mobility", "weapon", "utility", "armour", "policy"]),
  action: z.string(),
  rationale: z.string(),
  priority: z.enum(["low", "medium", "high"]),
  // Canonical catalogue IDs — must be valid catalogue values, not invented names.
  replacementChassisId: z.enum(["light", "medium", "heavy"]).optional(),
  replacementMobilityId: z.enum(["wheels", "tracks", "legs"]).optional(),
  replacementWeaponId: z
    .enum(["ram", "hammer", "horizontal_spinner", "grappler", "flipper"])
    .optional(),
  replacementUtilityId: z
    .enum(["none", "cooling", "traction_boost", "reinforced_drive"])
    .optional(),
  armourAdjustment: z
    .object({
      front: z.number().int().min(0).max(60).optional(),
      left: z.number().int().min(0).max(60).optional(),
      right: z.number().int().min(0).max(60).optional(),
      rear: z.number().int().min(0).max(60).optional(),
      top: z.number().int().min(0).max(60).optional(),
    })
    .optional(),
  policyAdjustment: z
    .object({
      opening: z.enum(["rush", "cautious", "flank", "hold"]).optional(),
      preferredRange: z.enum(["close", "medium", "far"]).optional(),
      aggression: z.number().int().min(0).max(100).optional(),
      primaryTarget: z.enum(["front", "rear", "left", "right", "top"]).optional(),
      secondaryTarget: z.enum(["front", "rear", "left", "right", "top"]).optional(),
      retreatThreshold: z.number().int().min(0).max(100).optional(),
      heatThreshold: z.number().int().min(0).max(100).optional(),
      fallback: z.enum(["retreat", "defend", "desperate_attack"]).optional(),
    })
    .optional(),
});

export const MatchReviewSchema = z.object({
  schemaVersion: z.literal("1"),
  summary: z.string(),
  keyMoments: z.array(keyMomentReviewSchema),
  strategyAssessment: strategyAssessmentSchema,
  suggestedChanges: z.array(suggestedChangeSchema),
  confidence: z.enum(["low", "medium", "high"]),
  observedOutcome: observedOutcomeSchema.optional(),
});

export type KeyMomentReview = z.infer<typeof keyMomentReviewSchema>;
export type StrategyAssessment = z.infer<typeof strategyAssessmentSchema>;
export type SuggestedChange = z.infer<typeof suggestedChangeSchema>;
export type ObservedOutcome = z.infer<typeof observedOutcomeSchema>;
export type MatchReview = z.infer<typeof MatchReviewSchema>;

export function validateMatchReview(
  data: unknown,
): { ok: true; review: MatchReview } | { ok: false; errors: z.ZodError } {
  const result = MatchReviewSchema.safeParse(data);
  if (result.success) {
    return { ok: true, review: result.data };
  }
  return { ok: false, errors: result.error };
}

export function serializeMatchReview(review: MatchReview): string {
  return JSON.stringify(review, null, 2);
}

export function deserializeMatchReview(
  json: string,
): { ok: true; review: MatchReview } | { ok: false; errors: z.ZodError | SyntaxError } {
  try {
    const data = JSON.parse(json);
    const result = MatchReviewSchema.safeParse(data);
    if (result.success) {
      return { ok: true, review: result.data };
    }
    return { ok: false, errors: result.error };
  } catch (e) {
    return { ok: false, errors: e as SyntaxError };
  }
}
