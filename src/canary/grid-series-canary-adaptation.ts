import type { ActionPolicy } from "../simulator/types.js";
import type { FactualMatchReportV2 } from "../schemas/factual-report.schema.js";
import type { MatchReview } from "../schemas/review.schema.js";
import { actionPolicySchema } from "../schemas/policy.schema.js";
import { gridFallbackReviewDisagreements } from "./grid-canary-fallback-agreement.js";

/**
 * Deterministic grid series canary policy adaptation (Milestone 0.2C Phase
 * 3D2B).
 *
 * `grid-canary-policy-adaptation-v1` — a frozen, pure, rule-based adaptation
 * applied after series matches 1 and 2. It consumes the authoritative
 * factual-report v2 and the deterministic fallback review of the completed
 * match (which must agree first), produces the next competitor policy and a
 * structured, auditable explanation of every decision.
 *
 * Frozen rules:
 *
 *   - Aggression after match 1: own ≥ opponent → 80, else 70.
 *   - Aggression after match 2: own ≥ opponent → 60, else 90.
 *   - Opening: fighter A mobility-disabled or immobilised/overturned → hold;
 *     otherwise own < opponent → cautious; otherwise flank.
 *   - preferredRange, primaryTarget, secondaryTarget, retreatThreshold,
 *     heatThreshold and fallback are always preserved from the current policy.
 *
 * The adaptation uses no RNG, no provider, no clock and no filesystem, never
 * mutates its inputs and always validates the resulting policy against the
 * authoritative `actionPolicySchema`. It is deliberately never described as
 * intelligent or AI-generated.
 */
export const GRID_SERIES_CANARY_ADAPTATION_RULE_VERSION =
  "grid-canary-policy-adaptation-v1" as const;

export type GridSeriesCanaryIntegrityComparison = "ahead_or_equal" | "behind";
export type GridSeriesCanaryOpeningReason = "impaired" | "behind" | "stable";

export interface GridSeriesCanaryAdaptationDecision {
  integrityComparison: GridSeriesCanaryIntegrityComparison;
  openingReason: GridSeriesCanaryOpeningReason;
  aggressionBefore: number;
  aggressionAfter: number;
}

export interface GridSeriesCanaryAuthoritativeFacts {
  winner: string | null;
  resultMethod: string;
  rounds: number;
  ownFinalIntegrity: number;
  opponentFinalIntegrity: number;
  ownMobilityDisabled: boolean;
  ownConditions: string[];
}

export interface GridSeriesCanaryAdaptation {
  sourceMatchNumber: 1 | 2;
  sourceMatchId: string;
  sourceSeed: number;
  policyBefore: ActionPolicy;
  policyAfter: ActionPolicy;
  authoritativeFacts: GridSeriesCanaryAuthoritativeFacts;
  decision: GridSeriesCanaryAdaptationDecision;
}

export interface GridSeriesCanaryAdaptationInput {
  /** The match just completed (1 or 2); the adaptation feeds the next match. */
  matchNumber: 1 | 2;
  sourceMatchId: string;
  sourceSeed: number;
  currentPolicy: ActionPolicy;
  factualReport: FactualMatchReportV2;
  fallbackReview: MatchReview;
}

export class GridSeriesCanaryAdaptationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridSeriesCanaryAdaptationError";
  }
}

/** Condition names that count as an impaired (cannot flank) competitor. */
const IMPAIRED_CONDITIONS = new Set(["immobilised", "overturned"]);

function aggressionAfter(matchNumber: 1 | 2, own: number, opponent: number): number {
  const aheadOrEqual = own >= opponent;
  if (matchNumber === 1) return aheadOrEqual ? 80 : 70;
  return aheadOrEqual ? 60 : 90;
}

/**
 * Pure frozen adaptation rule. `matchNumber` must be 1 or 2 (adaptation only
 * ever runs after matches 1 and 2 of the three-match series).
 */
export function adaptGridCanaryPolicy(
  input: GridSeriesCanaryAdaptationInput,
): GridSeriesCanaryAdaptation {
  const { matchNumber, currentPolicy, factualReport, fallbackReview } = input;

  if (matchNumber !== 1 && matchNumber !== 2) {
    throw new GridSeriesCanaryAdaptationError(
      `Policy adaptation only runs after series matches 1 and 2; received match ${String(matchNumber)}`,
    );
  }

  // The report and the deterministic fallback review must agree completely
  // (winner, method, rounds, both final integrity values and both canonical
  // disabled-component lists) before the adaptation trusts either one. This
  // completes before any impairment fact is read for opening selection, and
  // conditions remain authoritative factual-report facts (never inferred from
  // the review).
  const disagreements = gridFallbackReviewDisagreements(factualReport, fallbackReview);
  if (disagreements.length > 0) {
    throw new GridSeriesCanaryAdaptationError(
      `Fallback review does not completely agree with the factual report: ${disagreements.join("; ")}`,
    );
  }

  const fighterA = factualReport.finalStates.fighterA;
  const fighterB = factualReport.finalStates.fighterB;
  const own = fighterA.integrity;
  const opponent = fighterB.integrity;
  const ownAheadOrEqual = own >= opponent;

  const impaired =
    fighterA.mobilityDisabled ||
    fighterA.conditions.some((condition) => IMPAIRED_CONDITIONS.has(condition));

  let openingReason: GridSeriesCanaryOpeningReason;
  let opening: ActionPolicy["opening"];
  if (impaired) {
    openingReason = "impaired";
    opening = "hold";
  } else if (own < opponent) {
    openingReason = "behind";
    opening = "cautious";
  } else {
    openingReason = "stable";
    opening = "flank";
  }

  const aggressionBefore = currentPolicy.aggression;
  const aggressionAfterValue = aggressionAfter(matchNumber, own, opponent);

  const policyAfter: ActionPolicy = {
    opening,
    preferredRange: currentPolicy.preferredRange,
    aggression: aggressionAfterValue,
    primaryTarget: currentPolicy.primaryTarget,
    secondaryTarget: currentPolicy.secondaryTarget,
    retreatThreshold: currentPolicy.retreatThreshold,
    heatThreshold: currentPolicy.heatThreshold,
    fallback: currentPolicy.fallback,
  };

  const validated = actionPolicySchema.safeParse(policyAfter);
  if (!validated.success) {
    throw new GridSeriesCanaryAdaptationError(
      `Adapted policy failed the authoritative action policy schema: ${validated.error.message}`,
    );
  }

  return {
    sourceMatchNumber: matchNumber,
    sourceMatchId: input.sourceMatchId,
    sourceSeed: input.sourceSeed,
    policyBefore: { ...currentPolicy },
    policyAfter: validated.data,
    authoritativeFacts: {
      winner: factualReport.winner,
      resultMethod: factualReport.resultMethod,
      rounds: factualReport.rounds,
      ownFinalIntegrity: own,
      opponentFinalIntegrity: opponent,
      ownMobilityDisabled: fighterA.mobilityDisabled,
      ownConditions: [...fighterA.conditions],
    },
    decision: {
      integrityComparison: ownAheadOrEqual ? "ahead_or_equal" : "behind",
      openingReason,
      aggressionBefore,
      aggressionAfter: aggressionAfterValue,
    },
  };
}
