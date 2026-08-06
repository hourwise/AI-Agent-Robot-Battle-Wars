/**
 * Bounded opt-in grid beta governance decision (Milestone 0.2C Phase 3F,
 * Phases 1 and 4).
 *
 * The decision contract records the exact official evidence reviewed, the
 * frozen hashes, every governance criterion, the authorised and forbidden
 * scope, required safeguards, rollback/suspension triggers, unresolved risks
 * and the outcome. The outcome is derived by a pure function from explicit
 * governance inputs — never hard-coded independently of the evidence facts.
 *
 * A positive outcome authorises at most implementation of a bounded and
 * explicitly selected grid beta in a later, separately reviewed phase. It is
 * not runtime activation.
 */

import { sha256Hex } from "../canary/grid-canary-digest.js";

export type GridOptInBetaGovernanceOutcome =
  "approved_for_bounded_opt_in_beta_implementation" | "deferred" | "rejected";

/** The exact authorised source commit for this evidence review. */
export const GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT =
  "5173fd0f287465e1181969dbad2f37cee10fd47e" as const;

export const GRID_OPT_IN_BETA_GOVERNANCE_REPOSITORY_NAME =
  "hourwise/AI-Agent-Robot-Battle-Wars" as const;

export const GRID_OPT_IN_BETA_GOVERNANCE_DISCLAIMER =
  "This decision authorises, at most, implementation of a bounded and explicitly selected grid beta. It does not enable the grid runtime, change the default runtime, qualify combat balance, authorise a public rollout or begin Milestone 0.2D." as const;

export interface GridOptInBetaBaseV3EvidenceReference {
  readonly evaluationId: string;
  readonly suiteId: "grid-activation-readiness-v3";
  readonly suiteChecksum: string;
  readonly seedRegistryChecksum: string;
  readonly scenarioRegistryChecksum: string;
  readonly classification: "inconclusive";
  readonly nonPassGates: readonly string[];
  readonly manifestChecksum: string;
  readonly decisionChecksum: string;
  readonly metricsChecksum: string;
}

export interface GridOptInBetaSupplementGrappleCoverage {
  readonly validGrappleRepositionEvents: number;
  readonly fighterAAttackerRepositionCount: number;
  readonly fighterBAttackerRepositionCount: number;
  readonly distinctSeedsProducingFighterAAttackerReposition: number;
  readonly distinctSeedsProducingFighterBAttackerReposition: number;
}

export interface GridOptInBetaSupplementEvidenceReference {
  readonly supplementId: string;
  readonly suiteId: "grid-grapple-coverage-supplement-v1";
  readonly scenarioRegistryChecksum: string;
  readonly planChecksum: string;
  readonly decision: "coverage_confirmed";
  readonly combinedReadinessClassification: "ready_for_opt_in_beta_review";
  readonly manifestChecksum: string;
  readonly baseReferenceChecksum: string;
  readonly metricsChecksum: string;
  readonly decisionChecksum: string;
  readonly reportChecksum: string;
  readonly grappleCoverage: GridOptInBetaSupplementGrappleCoverage;
}

export interface GridOptInBetaGovernanceCriteria {
  readonly baseV3ValidAndAnchored: boolean;
  readonly supplementValidAndAnchored: boolean;
  readonly hardReadinessGatesPassed: boolean;
  readonly soleNonPassGateIsC04: boolean;
  readonly supplementDecisionCoverageConfirmed: boolean;
  readonly combinedClassificationReadyForOptInBetaReview: boolean;
  readonly bothAttackerSlotsProducedReposition: boolean;
  readonly distinctSeedsProducedReposition: boolean;
  readonly legacyIsActiveDefault: boolean;
  readonly schemaV3PersistenceAndReplayAvailable: boolean;
  readonly deterministicRollbackPossible: boolean;
  readonly contractComplete: boolean;
  readonly safeguardsComplete: boolean;
  readonly noDefaultOrPublicActivationRequested: boolean;
  readonly noForbiddenClaimsIncluded: boolean;
  readonly frozenConstraintsUnchanged: boolean;
  readonly unresolvedRiskBlocksApproval: boolean;
}

export interface GridOptInBetaGovernanceEvidence {
  readonly baseV3: GridOptInBetaBaseV3EvidenceReference;
  readonly supplement: GridOptInBetaSupplementEvidenceReference;
  readonly validationStatus: "validated" | "invalid";
}

export interface GridOptInBetaGovernanceDecisionV1 {
  readonly schemaVersion: "1";
  readonly decisionKind: "grid-opt-in-beta-governance";
  readonly decisionId: string;
  readonly createdAt: string;
  readonly sourceCommit: string;
  readonly repositoryName: string;
  readonly evidence: GridOptInBetaGovernanceEvidence;
  readonly criteria: GridOptInBetaGovernanceCriteria;
  readonly authorisedScope: readonly string[];
  readonly forbiddenScope: readonly string[];
  readonly requiredSafeguards: readonly string[];
  readonly rollbackAndSuspensionTriggers: readonly string[];
  readonly unresolvedRisks: readonly string[];
  readonly outcome: GridOptInBetaGovernanceOutcome;
  readonly disclaimer: string;
}

/** The authorised scope of a positive decision (implementation authorisation only). */
export const GRID_OPT_IN_BETA_AUTHORISED_SCOPE: readonly string[] = Object.freeze([
  "implementation of a bounded, explicitly selected, internal/development grid beta",
  "explicitly beta-labelled single matches only",
  "deterministic local scripted fighters only",
  "schema-v3 persistence with the complete frozen grid identity",
  "existing grid text and ASCII replay, factual reports and review prompts",
]);

export const GRID_OPT_IN_BETA_FORBIDDEN_SCOPE: readonly string[] = Object.freeze([
  "public default selection",
  "ranked matches",
  "prizes, rewards or monetised outcomes",
  "tournaments",
  "adaptation evaluation",
  "held-out evaluation",
  "mixed-runtime series",
  "automatic migration of legacy matches",
  "provider-driven autonomous runtime selection",
  "production matchmaking",
  "balance claims",
  "public rollout",
  "default activation",
  "changing the default runtime",
]);

export const GRID_OPT_IN_BETA_REQUIRED_SAFEGUARDS: readonly string[] = Object.freeze([
  "explicit beta-labelled selection only; absence resolves to legacy and invalid selection fails closed",
  "legacy remains the default; normal match, battle and series commands unchanged",
  "no silent grid/legacy fallback under the same match identity",
  "one immediate deterministic kill switch that stops new grid-beta matches without affecting legacy or deleting v3 records",
  "migration-free rollback that leaves legacy records unchanged",
  "complete frozen grid identity on every v3 record, report and replay",
  "suspension triggers enforced as listed in the bounded-beta contract",
  "grid entered only through an explicit runGridMatch path, never inferred or defaulted",
]);

export const GRID_OPT_IN_BETA_ROLLBACK_TRIGGERS: readonly string[] = Object.freeze([
  "nondeterministic result for identical inputs",
  "schema-v3 validation failure",
  "record/report final-state disagreement",
  "replay reconstruction disagreement",
  "incorrect runtime identity",
  "legacy-default regression",
  "cross-root persistence or isolation failure",
  "silent runtime fallback",
  "corrupt or unreplayable v3 record",
  "canary regression",
  "evidence-anchor failure",
]);

/** The documented unresolved risks carried by a positive decision. */
export const GRID_OPT_IN_BETA_UNRESOLVED_RISKS: readonly string[] = Object.freeze([
  "combat balance of the grid runtime has not been evaluated and is not claimed",
  "the beta surface, CLI and selection contract do not exist yet and are not implemented in this phase",
  "long-running persistence, replay and mixed-storage behaviour of v3 records is not production-observed",
  "performance characteristics are development-observed only and may trigger review without changing thresholds",
]);

export interface GridOptInBetaGovernanceDerivationInput {
  readonly baseV3ValidAndAnchored: boolean;
  readonly supplementValidAndAnchored: boolean;
  readonly hardReadinessGatesPassed: boolean;
  readonly soleNonPassGateIsC04: boolean;
  readonly supplementDecision: "coverage_confirmed" | "inconclusive" | "not_ready";
  readonly combinedClassification:
    "ready_for_opt_in_beta_review" | "inconclusive" | "not_ready";
  readonly bothAttackerSlotsProducedReposition: boolean;
  readonly distinctSeedsProducedReposition: boolean;
  readonly legacyIsActiveDefault: boolean;
  readonly schemaV3PersistenceAndReplayAvailable: boolean;
  readonly deterministicRollbackPossible: boolean;
  readonly contractComplete: boolean;
  readonly safeguardsComplete: boolean;
  readonly requestedScopeIncludesDefaultOrPublicActivation: boolean;
  readonly requestedScopeIncludesForbiddenClaims: boolean;
  readonly frozenConstraintsUnchanged: boolean;
  readonly unresolvedRiskBlocksApproval: boolean;
}

/**
 * Pure governance outcome derivation (Phase 4). Rejection wins, then
 * deferral, then approval. Approval is never hard-coded independently of
 * these facts.
 */
export function deriveGridOptInBetaGovernanceOutcome(
  input: GridOptInBetaGovernanceDerivationInput,
): GridOptInBetaGovernanceOutcome {
  const rejected =
    !input.baseV3ValidAndAnchored ||
    !input.supplementValidAndAnchored ||
    !input.hardReadinessGatesPassed ||
    input.supplementDecision === "not_ready" ||
    input.combinedClassification === "not_ready" ||
    !input.legacyIsActiveDefault ||
    !input.schemaV3PersistenceAndReplayAvailable ||
    !input.deterministicRollbackPossible ||
    input.requestedScopeIncludesDefaultOrPublicActivation ||
    input.requestedScopeIncludesForbiddenClaims ||
    !input.frozenConstraintsUnchanged;
  if (rejected) return "rejected";

  const deferred =
    input.combinedClassification !== "ready_for_opt_in_beta_review" ||
    input.supplementDecision === "inconclusive" ||
    !input.contractComplete ||
    !input.safeguardsComplete ||
    input.unresolvedRiskBlocksApproval;
  if (deferred) return "deferred";

  const approved =
    input.baseV3ValidAndAnchored &&
    input.supplementValidAndAnchored &&
    input.hardReadinessGatesPassed &&
    input.soleNonPassGateIsC04 &&
    input.supplementDecision === "coverage_confirmed" &&
    input.combinedClassification === "ready_for_opt_in_beta_review" &&
    input.bothAttackerSlotsProducedReposition &&
    input.distinctSeedsProducedReposition &&
    input.legacyIsActiveDefault &&
    input.contractComplete &&
    input.safeguardsComplete &&
    !input.requestedScopeIncludesDefaultOrPublicActivation &&
    !input.requestedScopeIncludesForbiddenClaims &&
    input.frozenConstraintsUnchanged;
  return approved ? "approved_for_bounded_opt_in_beta_implementation" : "deferred";
}

export interface BuildGridOptInBetaGovernanceDecisionInput {
  readonly decisionId: string;
  readonly createdAt: string;
  readonly sourceCommit: string;
  readonly evidence: GridOptInBetaGovernanceEvidence;
  readonly derivation: GridOptInBetaGovernanceDerivationInput;
}

function criteriaFromDerivation(
  input: GridOptInBetaGovernanceDerivationInput,
): GridOptInBetaGovernanceCriteria {
  return {
    baseV3ValidAndAnchored: input.baseV3ValidAndAnchored,
    supplementValidAndAnchored: input.supplementValidAndAnchored,
    hardReadinessGatesPassed: input.hardReadinessGatesPassed,
    soleNonPassGateIsC04: input.soleNonPassGateIsC04,
    supplementDecisionCoverageConfirmed:
      input.supplementDecision === "coverage_confirmed",
    combinedClassificationReadyForOptInBetaReview:
      input.combinedClassification === "ready_for_opt_in_beta_review",
    bothAttackerSlotsProducedReposition: input.bothAttackerSlotsProducedReposition,
    distinctSeedsProducedReposition: input.distinctSeedsProducedReposition,
    legacyIsActiveDefault: input.legacyIsActiveDefault,
    schemaV3PersistenceAndReplayAvailable: input.schemaV3PersistenceAndReplayAvailable,
    deterministicRollbackPossible: input.deterministicRollbackPossible,
    contractComplete: input.contractComplete,
    safeguardsComplete: input.safeguardsComplete,
    noDefaultOrPublicActivationRequested:
      !input.requestedScopeIncludesDefaultOrPublicActivation,
    noForbiddenClaimsIncluded: !input.requestedScopeIncludesForbiddenClaims,
    frozenConstraintsUnchanged: input.frozenConstraintsUnchanged,
    unresolvedRiskBlocksApproval: input.unresolvedRiskBlocksApproval,
  };
}

/**
 * Builds the complete governance decision v1 from the frozen evidence
 * references, the explicit criteria and the pure outcome derivation. The
 * outcome is always derived by the pure function from the supplied facts.
 */
export function buildGridOptInBetaGovernanceDecision(
  input: BuildGridOptInBetaGovernanceDecisionInput,
): GridOptInBetaGovernanceDecisionV1 {
  const outcome = deriveGridOptInBetaGovernanceOutcome(input.derivation);
  const decision: GridOptInBetaGovernanceDecisionV1 = {
    schemaVersion: "1",
    decisionKind: "grid-opt-in-beta-governance",
    decisionId: input.decisionId,
    createdAt: input.createdAt,
    sourceCommit: input.sourceCommit,
    repositoryName: GRID_OPT_IN_BETA_GOVERNANCE_REPOSITORY_NAME,
    evidence: input.evidence,
    criteria: criteriaFromDerivation(input.derivation),
    authorisedScope: GRID_OPT_IN_BETA_AUTHORISED_SCOPE,
    forbiddenScope: GRID_OPT_IN_BETA_FORBIDDEN_SCOPE,
    requiredSafeguards: GRID_OPT_IN_BETA_REQUIRED_SAFEGUARDS,
    rollbackAndSuspensionTriggers: GRID_OPT_IN_BETA_ROLLBACK_TRIGGERS,
    unresolvedRisks: GRID_OPT_IN_BETA_UNRESOLVED_RISKS,
    outcome,
    disclaimer: GRID_OPT_IN_BETA_GOVERNANCE_DISCLAIMER,
  };
  return decision;
}

export function serializeGridOptInBetaGovernanceDecision(
  decision: GridOptInBetaGovernanceDecisionV1,
): string {
  return JSON.stringify(decision, null, 2);
}

export function deserializeGridOptInBetaGovernanceDecision(
  json: string,
):
  | { ok: true; decision: GridOptInBetaGovernanceDecisionV1 }
  | { ok: false; errors: string } {
  try {
    const parsed = JSON.parse(json) as GridOptInBetaGovernanceDecisionV1;
    if (parsed.schemaVersion !== "1") {
      return { ok: false, errors: `unsupported schemaVersion ${parsed.schemaVersion}` };
    }
    if (parsed.decisionKind !== "grid-opt-in-beta-governance") {
      return {
        ok: false,
        errors: `unsupported decisionKind ${parsed.decisionKind}`,
      };
    }
    return { ok: true, decision: parsed };
  } catch (e) {
    return { ok: false, errors: e instanceof Error ? e.message : String(e) };
  }
}

/** SHA-256 of the serialized decision (used as the decision artifact checksum). */
export function gridOptInBetaGovernanceDecisionChecksum(
  decision: GridOptInBetaGovernanceDecisionV1,
): string {
  return sha256Hex(serializeGridOptInBetaGovernanceDecision(decision));
}
