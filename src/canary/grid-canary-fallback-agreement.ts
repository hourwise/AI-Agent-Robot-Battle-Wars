import type { FactualMatchReportV2 } from "../schemas/factual-report.schema.js";
import type { MatchReview } from "../schemas/review.schema.js";

/**
 * Shared fallback-review / factual-report outcome agreement
 * (Milestone 0.2C Phase 3D2B.1).
 *
 * A deterministic fallback review must agree completely with its authoritative
 * factual-report v2 before any adaptation decision or bundle cross-validation
 * may trust either artifact. The agreement covers:
 *
 *   - winner;
 *   - result method;
 *   - rounds;
 *   - own final integrity (fighter A);
 *   - opponent final integrity (fighter B);
 *   - own disabled-component list (fighter A);
 *   - opponent disabled-component list (fighter B).
 *
 * Disabled-component lists are derived from factual-report final states in the
 * canonical order `mobility`, `weapon`, `utility`, and compared as exact
 * canonical arrays — a missing claim, an extra component, a different
 * component, a duplicate or an incorrect canonical order is a disagreement.
 */

/**
 * Canonical disabled-component list from a fighter's factual-report final
 * state, in the order `mobility`, `weapon`, `utility`.
 */
export function normaliseDisabledComponents(state: {
  mobilityDisabled: boolean;
  weaponDisabled: boolean;
  utilityDisabled: boolean;
}): Array<"mobility" | "weapon" | "utility"> {
  const result: Array<"mobility" | "weapon" | "utility"> = [];
  if (state.mobilityDisabled) result.push("mobility");
  if (state.weaponDisabled) result.push("weapon");
  if (state.utilityDisabled) result.push("utility");
  return result;
}

function sameStringArray(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Returns the list of outcome disagreements between a factual-report v2 and a
 * fallback review, or an empty array when the review agrees completely. Pure
 * and non-mutating.
 */
export function gridFallbackReviewDisagreements(
  report: FactualMatchReportV2,
  review: MatchReview,
): string[] {
  const failures: string[] = [];
  const observed = review.observedOutcome;

  if (observed.winnerId !== report.winner) {
    failures.push(
      `fallback review winner ${String(observed.winnerId)} != factual report winner ${String(report.winner)}`,
    );
  }
  if (observed.method !== report.resultMethod) {
    failures.push(
      `fallback review method ${observed.method} != factual report result method ${report.resultMethod}`,
    );
  }
  if (observed.rounds !== report.rounds) {
    failures.push(
      `fallback review rounds ${observed.rounds} != factual report rounds ${report.rounds}`,
    );
  }
  if (observed.ownFinalIntegrity !== report.finalStates.fighterA.integrity) {
    failures.push(
      `fallback review ownFinalIntegrity ${observed.ownFinalIntegrity} != factual report fighterA integrity ${report.finalStates.fighterA.integrity}`,
    );
  }
  if (observed.opponentFinalIntegrity !== report.finalStates.fighterB.integrity) {
    failures.push(
      `fallback review opponentFinalIntegrity ${observed.opponentFinalIntegrity} != factual report fighterB integrity ${report.finalStates.fighterB.integrity}`,
    );
  }

  const expectedOwn = normaliseDisabledComponents(report.finalStates.fighterA);
  if (!sameStringArray(observed.ownDisabledComponents, expectedOwn)) {
    failures.push(
      `fallback review ownDisabledComponents [${observed.ownDisabledComponents.join(", ")}] != factual report fighterA disabled [${expectedOwn.join(", ")}]`,
    );
  }
  const expectedOpponent = normaliseDisabledComponents(report.finalStates.fighterB);
  if (!sameStringArray(observed.opponentDisabledComponents, expectedOpponent)) {
    failures.push(
      `fallback review opponentDisabledComponents [${observed.opponentDisabledComponents.join(", ")}] != factual report fighterB disabled [${expectedOpponent.join(", ")}]`,
    );
  }

  return failures;
}
