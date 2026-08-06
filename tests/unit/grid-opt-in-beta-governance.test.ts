import { describe, expect, it } from "vitest";
import {
  buildGridOptInBetaGovernanceDecision,
  deriveGridOptInBetaGovernanceOutcome,
  GRID_OPT_IN_BETA_AUTHORISED_SCOPE,
  GRID_OPT_IN_BETA_GOVERNANCE_DISCLAIMER,
  GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT,
  gridOptInBetaGovernanceDecisionChecksum,
  type GridOptInBetaGovernanceDerivationInput,
  type GridOptInBetaGovernanceEvidence,
} from "../../src/readiness/grid-opt-in-beta-governance.js";
import {
  GRID_OPT_IN_BETA_OFFICIAL_BASE_V3_REFERENCE,
  GRID_OPT_IN_BETA_OFFICIAL_SUPPLEMENT_REFERENCE,
} from "../../src/readiness/grid-opt-in-beta-governance-bundle.js";

function passingDerivation(): GridOptInBetaGovernanceDerivationInput {
  return {
    baseV3ValidAndAnchored: true,
    supplementValidAndAnchored: true,
    hardReadinessGatesPassed: true,
    soleNonPassGateIsC04: true,
    supplementDecision: "coverage_confirmed",
    combinedClassification: "ready_for_opt_in_beta_review",
    bothAttackerSlotsProducedReposition: true,
    distinctSeedsProducedReposition: true,
    legacyIsActiveDefault: true,
    schemaV3PersistenceAndReplayAvailable: true,
    deterministicRollbackPossible: true,
    contractComplete: true,
    safeguardsComplete: true,
    requestedScopeIncludesDefaultOrPublicActivation: false,
    requestedScopeIncludesForbiddenClaims: false,
    frozenConstraintsUnchanged: true,
    unresolvedRiskBlocksApproval: false,
  };
}

function evidence(): GridOptInBetaGovernanceEvidence {
  return {
    baseV3: GRID_OPT_IN_BETA_OFFICIAL_BASE_V3_REFERENCE,
    supplement: GRID_OPT_IN_BETA_OFFICIAL_SUPPLEMENT_REFERENCE,
    validationStatus: "validated",
  };
}

describe("grid opt-in beta governance decision (Phase 3F Phases 1 and 4)", () => {
  it("approves for bounded implementation when every criterion passes", () => {
    const outcome = deriveGridOptInBetaGovernanceOutcome(passingDerivation());
    expect(outcome).toBe("approved_for_bounded_opt_in_beta_implementation");
  });

  it("rejects on a base hard failure", () => {
    const input = passingDerivation();
    input.baseV3ValidAndAnchored = false;
    expect(deriveGridOptInBetaGovernanceOutcome(input)).toBe("rejected");
  });

  it("rejects when the supplement is not_ready", () => {
    const input = passingDerivation();
    input.supplementDecision = "not_ready";
    expect(deriveGridOptInBetaGovernanceOutcome(input)).toBe("rejected");
  });

  it("rejects when the combined classification is not_ready", () => {
    const input = passingDerivation();
    input.combinedClassification = "not_ready";
    expect(deriveGridOptInBetaGovernanceOutcome(input)).toBe("rejected");
  });

  it("defers when the combined classification is inconclusive", () => {
    const input = passingDerivation();
    input.combinedClassification = "inconclusive";
    expect(deriveGridOptInBetaGovernanceOutcome(input)).toBe("deferred");
  });

  it("defers when the supplement coverage remains inconclusive", () => {
    const input = passingDerivation();
    input.supplementDecision = "inconclusive";
    expect(deriveGridOptInBetaGovernanceOutcome(input)).toBe("deferred");
  });

  it("defers when the bounded-beta contract is incomplete", () => {
    const input = passingDerivation();
    input.contractComplete = false;
    expect(deriveGridOptInBetaGovernanceOutcome(input)).toBe("deferred");
  });

  it("defers when the kill-switch/safeguard requirements are absent", () => {
    const input = passingDerivation();
    input.safeguardsComplete = false;
    expect(deriveGridOptInBetaGovernanceOutcome(input)).toBe("deferred");
  });

  it("defers when an unresolved risk blocks approval", () => {
    const input = passingDerivation();
    input.unresolvedRiskBlocksApproval = true;
    expect(deriveGridOptInBetaGovernanceOutcome(input)).toBe("deferred");
  });

  it("rejects when default or public activation is requested", () => {
    const input = passingDerivation();
    input.requestedScopeIncludesDefaultOrPublicActivation = true;
    expect(deriveGridOptInBetaGovernanceOutcome(input)).toBe("rejected");
  });

  it("rejects when a balance, ranked, tournament or held-out claim is requested", () => {
    const input = passingDerivation();
    input.requestedScopeIncludesForbiddenClaims = true;
    expect(deriveGridOptInBetaGovernanceOutcome(input)).toBe("rejected");
  });

  it("rejects when legacy is not the active default", () => {
    const input = passingDerivation();
    input.legacyIsActiveDefault = false;
    expect(deriveGridOptInBetaGovernanceOutcome(input)).toBe("rejected");
  });

  it("rejects when a frozen constraint changed", () => {
    const input = passingDerivation();
    input.frozenConstraintsUnchanged = false;
    expect(deriveGridOptInBetaGovernanceOutcome(input)).toBe("rejected");
  });

  it("approval wording never implies activation", () => {
    expect(GRID_OPT_IN_BETA_GOVERNANCE_DISCLAIMER).not.toMatch(
      /activates the grid|enables the grid|released|production_ready/i,
    );
    const decision = buildGridOptInBetaGovernanceDecision({
      decisionId: "11111111-1111-4111-8111-111111111111",
      createdAt: "2026-08-03T00:00:00.000Z",
      sourceCommit: GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT,
      evidence: evidence(),
      derivation: passingDerivation(),
    });
    expect(decision.outcome).toBe("approved_for_bounded_opt_in_beta_implementation");
    expect(decision.outcome).not.toMatch(/activated|enabled|released|production_ready/);
    for (const scope of GRID_OPT_IN_BETA_AUTHORISED_SCOPE) {
      expect(scope).not.toMatch(/activated|enabled|released|production_ready/);
    }
    expect(decision.disclaimer).toContain(
      "It does not enable the grid runtime, change the default runtime",
    );
  });

  it("builds a decision that round-trips through its checksum", () => {
    const decision = buildGridOptInBetaGovernanceDecision({
      decisionId: "22222222-2222-4222-8222-222222222222",
      createdAt: "2026-08-03T00:00:00.000Z",
      sourceCommit: GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT,
      evidence: evidence(),
      derivation: passingDerivation(),
    });
    expect(decision.schemaVersion).toBe("1");
    expect(decision.decisionKind).toBe("grid-opt-in-beta-governance");
    expect(decision.sourceCommit).toBe(GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT);
    expect(decision.evidence.baseV3).toEqual(GRID_OPT_IN_BETA_OFFICIAL_BASE_V3_REFERENCE);
    expect(decision.evidence.supplement).toEqual(
      GRID_OPT_IN_BETA_OFFICIAL_SUPPLEMENT_REFERENCE,
    );
    expect(decision.criteria.baseV3ValidAndAnchored).toBe(true);
    expect(decision.criteria.contractComplete).toBe(true);
    expect(gridOptInBetaGovernanceDecisionChecksum(decision)).toMatch(/^[0-9a-f]{64}$/);
  });
});
