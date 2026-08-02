import { z } from "zod";
import { actionPolicySchema } from "./policy.schema.js";
import { GRID_SERIES_CANARY_SCENARIO_VERSION } from "../canary/grid-series-canary-scenario.js";
import { GRID_SERIES_CANARY_ADAPTATION_RULE_VERSION } from "../canary/grid-series-canary-adaptation.js";

/**
 * Grid series canary adaptation trace schema v1 (Milestone 0.2C Phase 3D2B).
 *
 * The trace is the auditable record of the two deterministic policy
 * adaptations of one series canary run. It freezes the scenario and
 * adaptation-rule identities, the series UUID and base seed, and exactly two
 * transitions (after match 1 and after match 2). Each transition records the
 * policy before and after, the authoritative facts the rule consumed, and the
 * structured decision (integrity comparison, opening reason and aggression
 * before/after).
 *
 * Cross-field contract:
 *
 *   - transition 1 sources match 1; transition 2 sources match 2;
 *   - every policy change is real (`policyAfter !== policyBefore`);
 *   - aggression and opening follow the frozen `grid-canary-policy-
 *     adaptation-v1` rule given the recorded authoritative facts;
 *   - untouched policy fields (preferredRange, targets, thresholds, fallback)
 *     are preserved by the adaptation;
 *   - decision.aggressionBefore/After agree with policyBefore/After.
 *
 * The cross-series binding (`transition1.policyAfter` equals match 2's
 * policy-before and `transition2.policyAfter` equals match 3's policy-before)
 * is verified by the series canary bundle validator against the series-record
 * entries.
 */

const gridSeriesCanaryAdaptationTransitionSchema = z.object({
  sourceMatchNumber: z.union([z.literal(1), z.literal(2)]),
  sourceMatchId: z.string().uuid(),
  sourceSeed: z.number().int().nonnegative(),
  policyBefore: actionPolicySchema,
  policyAfter: actionPolicySchema,
  authoritativeFacts: z.object({
    winner: z.string().nullable(),
    resultMethod: z.string(),
    rounds: z.number().int().nonnegative(),
    ownFinalIntegrity: z.number().int().nonnegative(),
    opponentFinalIntegrity: z.number().int().nonnegative(),
    ownMobilityDisabled: z.boolean(),
    ownConditions: z.array(z.string()),
  }),
  decision: z.object({
    integrityComparison: z.enum(["ahead_or_equal", "behind"]),
    openingReason: z.enum(["impaired", "behind", "stable"]),
    aggressionBefore: z.number().int().min(0).max(100),
    aggressionAfter: z.number().int().min(0).max(100),
  }),
});

export type GridSeriesCanaryAdaptationTransition = z.infer<
  typeof gridSeriesCanaryAdaptationTransitionSchema
>;

const IMPAIRED_CONDITIONS = new Set(["immobilised", "overturned"]);

function expectedOpening(
  facts: GridSeriesCanaryAdaptationTransition["authoritativeFacts"],
): { opening: "hold" | "cautious" | "flank"; reason: "impaired" | "behind" | "stable" } {
  const impaired =
    facts.ownMobilityDisabled ||
    facts.ownConditions.some((c) => IMPAIRED_CONDITIONS.has(c));
  if (impaired) return { opening: "hold", reason: "impaired" };
  if (facts.ownFinalIntegrity < facts.opponentFinalIntegrity) {
    return { opening: "cautious", reason: "behind" };
  }
  return { opening: "flank", reason: "stable" };
}

function expectedAggressionAfter(
  sourceMatchNumber: 1 | 2,
  own: number,
  opponent: number,
): number {
  const aheadOrEqual = own >= opponent;
  if (sourceMatchNumber === 1) return aheadOrEqual ? 80 : 70;
  return aheadOrEqual ? 60 : 90;
}

function validateAdaptationTraceContract(
  trace: z.infer<typeof GridSeriesCanaryAdaptationTraceV1Schema>,
  ctx: z.RefinementCtx,
): void {
  const [first, second] = trace.transitions;

  if (first.sourceMatchNumber !== 1) {
    ctx.addIssue({
      code: "custom",
      message: "Adaptation trace transition 1 must source series match 1",
    });
  }
  if (second.sourceMatchNumber !== 2) {
    ctx.addIssue({
      code: "custom",
      message: "Adaptation trace transition 2 must source series match 2",
    });
  }

  for (const [index, transition] of trace.transitions.entries()) {
    const label = `transition ${index + 1}`;
    const before = transition.policyBefore;
    const after = transition.policyAfter;
    const facts = transition.authoritativeFacts;

    if (
      before.opening === after.opening &&
      before.preferredRange === after.preferredRange &&
      before.aggression === after.aggression &&
      before.primaryTarget === after.primaryTarget &&
      before.secondaryTarget === after.secondaryTarget &&
      before.retreatThreshold === after.retreatThreshold &&
      before.heatThreshold === after.heatThreshold &&
      before.fallback === after.fallback
    ) {
      ctx.addIssue({
        code: "custom",
        message: `${label} must change the policy (policyAfter must differ from policyBefore)`,
      });
    }

    if (transition.decision.aggressionBefore !== before.aggression) {
      ctx.addIssue({
        code: "custom",
        message: `${label} decision.aggressionBefore must equal policyBefore.aggression`,
      });
    }
    if (transition.decision.aggressionAfter !== after.aggression) {
      ctx.addIssue({
        code: "custom",
        message: `${label} decision.aggressionAfter must equal policyAfter.aggression`,
      });
    }

    const expectedAggression = expectedAggressionAfter(
      transition.sourceMatchNumber,
      facts.ownFinalIntegrity,
      facts.opponentFinalIntegrity,
    );
    if (after.aggression !== expectedAggression) {
      ctx.addIssue({
        code: "custom",
        message: `${label} aggression ${after.aggression} does not follow the frozen rule (expected ${expectedAggression} for match ${transition.sourceMatchNumber})`,
      });
    }

    const expected = expectedOpening(facts);
    if (after.opening !== expected.opening) {
      ctx.addIssue({
        code: "custom",
        message: `${label} opening ${after.opening} does not follow the frozen rule (expected ${expected.opening})`,
      });
    }
    if (transition.decision.openingReason !== expected.reason) {
      ctx.addIssue({
        code: "custom",
        message: `${label} openingReason ${transition.decision.openingReason} does not follow the frozen rule (expected ${expected.reason})`,
      });
    }

    const aheadOrEqual = facts.ownFinalIntegrity >= facts.opponentFinalIntegrity;
    const expectedComparison = aheadOrEqual ? "ahead_or_equal" : "behind";
    if (transition.decision.integrityComparison !== expectedComparison) {
      ctx.addIssue({
        code: "custom",
        message: `${label} integrityComparison ${transition.decision.integrityComparison} does not follow the frozen rule (expected ${expectedComparison})`,
      });
    }

    // Untouched fields are preserved by the adaptation rule.
    for (const field of [
      "preferredRange",
      "primaryTarget",
      "secondaryTarget",
      "retreatThreshold",
      "heatThreshold",
      "fallback",
    ] as const) {
      if (before[field] !== after[field]) {
        ctx.addIssue({
          code: "custom",
          message: `${label} must preserve ${field} across the adaptation`,
        });
      }
    }
  }
}

export const GridSeriesCanaryAdaptationTraceV1Schema = z
  .object({
    schemaVersion: z.literal("1"),
    scenarioVersion: z.literal(GRID_SERIES_CANARY_SCENARIO_VERSION),
    adaptationRuleVersion: z.literal(GRID_SERIES_CANARY_ADAPTATION_RULE_VERSION),
    seriesId: z.string().uuid(),
    baseSeed: z.number().int().nonnegative(),
    transitions: z.tuple([
      gridSeriesCanaryAdaptationTransitionSchema,
      gridSeriesCanaryAdaptationTransitionSchema,
    ]),
  })
  .superRefine(validateAdaptationTraceContract);

export type GridSeriesCanaryAdaptationTraceV1 = z.infer<
  typeof GridSeriesCanaryAdaptationTraceV1Schema
>;

export function isGridSeriesCanaryAdaptationTraceV1(
  value: unknown,
): value is GridSeriesCanaryAdaptationTraceV1 {
  return GridSeriesCanaryAdaptationTraceV1Schema.safeParse(value).success;
}

export function validateGridSeriesCanaryAdaptationTraceV1(
  value: unknown,
):
  { ok: true; trace: GridSeriesCanaryAdaptationTraceV1 } | { ok: false; errors: string } {
  const result = GridSeriesCanaryAdaptationTraceV1Schema.safeParse(value);
  if (result.success) return { ok: true, trace: result.data };
  return { ok: false, errors: result.error.message };
}

export function serializeGridSeriesCanaryAdaptationTrace(
  trace: GridSeriesCanaryAdaptationTraceV1,
): string {
  return JSON.stringify(trace, null, 2);
}

export function deserializeGridSeriesCanaryAdaptationTrace(
  json: string,
):
  { ok: true; trace: GridSeriesCanaryAdaptationTraceV1 } | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json);
    return validateGridSeriesCanaryAdaptationTraceV1(data);
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
  }
}
