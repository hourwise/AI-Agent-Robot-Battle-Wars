import { describe, expect, it } from "vitest";
import {
  buildGridGrappleCoverageDecision,
  deriveGridGrappleCoverageDecision,
  buildGridActivationReadinessAddendum,
  deriveCombinedReadinessClassification,
  deserializeGridGrappleCoverageDecision,
  GRID_GRAPPLE_COVERAGE_DISCLAIMER,
  GRID_ACTIVATION_READINESS_ADDENDUM_DISCLAIMER,
  type GridGrappleCoverageDecisionV1,
  type GridGrappleCoverageHardChecks,
} from "../../src/readiness/grid-grapple-decision.js";
import type { GridGrappleCoverageMetrics } from "../../src/readiness/grid-grapple-metrics.js";
import {
  GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
  GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
} from "../../src/readiness/grid-grapple-supplement-bundle.js";

function baseMetrics(
  overrides?: Partial<GridGrappleCoverageMetrics["grapple"]>,
): GridGrappleCoverageMetrics {
  return {
    execution: {
      totalPlannedRuns: 48,
      totalCompletedRuns: 48,
      deterministicRuns: 48,
      schemaValidRecords: 48,
      schemaValidReports: 48,
      finalStateAgreements: 48,
      invalidEventCount: 0,
      mutationFailures: 0,
    },
    grapple: {
      totalGrapplerAttackAttempts: 480,
      totalGrapplerHits: 204,
      totalGrapplerMisses: 276,
      validGrappleRepositionEvents: 8,
      sameCellGrapplerHitsWithoutReposition: 186,
      distinctSeedsProducingReposition: 4,
      fighterAAttackerRepositionCount: 4,
      fighterBAttackerRepositionCount: 4,
      distinctSeedsProducingFighterAAttackerReposition: 4,
      distinctSeedsProducingFighterBAttackerReposition: 4,
      grappleSourceZoneCounts: { center: 4, north: 4 },
      grappleDestinationZoneCounts: { north: 4, south: 4 },
      grappleRoundMin: 2,
      grappleRoundMax: 8,
      grappleRoundMedian: 4,
      ...overrides,
    },
    isolation: {
      nonGrappleKnockbackEvents: 0,
      overturnEvents: 0,
      grappleEventsAttributedToWrongFighter: 0,
      malformedOrResolverDisagreeingGrappleEvents: 0,
    },
    timing: {
      totalElapsedMs: 0,
      meanMsPerMatch: 0,
      medianMsPerMatch: 0,
      p95MsPerMatch: 0,
    },
  };
}

function passingHardChecks(): GridGrappleCoverageHardChecks {
  return {
    allMatchesCompleted: true,
    determinismVerified: true,
    runtimeIdentityMatches: true,
    recordsValid: true,
    reportsValid: true,
    finalStateAgreementsComplete: true,
    chronologyValid: true,
    malformedGrappleEventsAbsent: true,
    resolverDisagreementsAbsent: true,
    inputsUnmodified: true,
    artifactIntegrityVerified: true,
    baseV3Valid: true,
    baseV3IdentityMatches: true,
    legacyIsolationVerified: true,
  };
}

describe("grid grapple coverage decision (Phase 3E2 Phases 10/11)", () => {
  it("returns coverage_confirmed when both roles are observed from distinct seeds", () => {
    const decision = deriveGridGrappleCoverageDecision({
      metrics: baseMetrics(),
      hardChecks: passingHardChecks(),
    });
    expect(decision).toBe("coverage_confirmed");
  });

  it("returns inconclusive when only one role is observed", () => {
    const metrics = baseMetrics({
      fighterAAttackerRepositionCount: 8,
      distinctSeedsProducingFighterAAttackerReposition: 4,
      fighterBAttackerRepositionCount: 0,
      distinctSeedsProducingFighterBAttackerReposition: 0,
    });
    expect(
      deriveGridGrappleCoverageDecision({ metrics, hardChecks: passingHardChecks() }),
    ).toBe("inconclusive");
  });

  it("returns inconclusive when zero repositions are observed", () => {
    const metrics = baseMetrics({
      validGrappleRepositionEvents: 0,
      distinctSeedsProducingReposition: 0,
      fighterAAttackerRepositionCount: 0,
      fighterBAttackerRepositionCount: 0,
      distinctSeedsProducingFighterAAttackerReposition: 0,
      distinctSeedsProducingFighterBAttackerReposition: 0,
    });
    expect(
      deriveGridGrappleCoverageDecision({ metrics, hardChecks: passingHardChecks() }),
    ).toBe("inconclusive");
  });

  it("returns not_ready on any hard failure", () => {
    const cases: Array<Partial<GridGrappleCoverageHardChecks>> = [
      { allMatchesCompleted: false },
      { determinismVerified: false },
      { runtimeIdentityMatches: false },
      { recordsValid: false },
      { reportsValid: false },
      { finalStateAgreementsComplete: false },
      { chronologyValid: false },
      { malformedGrappleEventsAbsent: false },
      { resolverDisagreementsAbsent: false },
      { inputsUnmodified: false },
      { artifactIntegrityVerified: false },
      { baseV3Valid: false },
      { baseV3IdentityMatches: false },
      { legacyIsolationVerified: false },
    ];
    for (const override of cases) {
      const hardChecks = { ...passingHardChecks(), ...override };
      expect(
        deriveGridGrappleCoverageDecision({
          metrics: baseMetrics(),
          hardChecks,
        }),
      ).toBe("not_ready");
    }
  });

  it("builds and round-trips the decision artifact", () => {
    const decision: GridGrappleCoverageDecisionV1 = buildGridGrappleCoverageDecision({
      supplementId: "33333333-3333-4333-8333-333333333333",
      createdAt: "2026-08-03T00:00:00.000Z",
      metrics: baseMetrics(),
      hardChecks: passingHardChecks(),
    });
    expect(decision.decision).toBe("coverage_confirmed");
    expect(decision.disclaimer).toBe(GRID_GRAPPLE_COVERAGE_DISCLAIMER);
    const roundTrip = deserializeGridGrappleCoverageDecision(
      JSON.stringify(decision, null, 2),
    );
    expect(roundTrip.ok).toBe(true);
    if (roundTrip.ok) expect(roundTrip.decision.decision).toBe("coverage_confirmed");
  });

  it("derives ready_for_opt_in_beta_review from a valid C04-only base plus confirmed coverage", () => {
    const classification = deriveCombinedReadinessClassification({
      baseV3: {
        evaluationId: GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
        suiteChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
        manifestChecksum: "a".repeat(64),
        decisionChecksum: "b".repeat(64),
        metricsChecksum: "c".repeat(64),
        classification: "inconclusive",
        nonPassGates: ["C04"],
        knockbackEvents: 36,
        overturnEvents: 8,
        grappleRepositionEvents: 0,
      },
      supplement: {
        supplementId: "33333333-3333-4333-8333-333333333333",
        planChecksum: "d".repeat(64),
        scenarioRegistryChecksum: "e".repeat(64),
        decision: "coverage_confirmed",
        validGrappleRepositionEvents: 8,
        fighterAAttackerRepositionCount: 4,
        fighterBAttackerRepositionCount: 4,
        distinctSeedsProducingFighterAAttackerReposition: 4,
        distinctSeedsProducingFighterBAttackerReposition: 4,
      },
    });
    expect(classification).toBe("ready_for_opt_in_beta_review");
  });

  it("derives not_ready when the supplement has a hard failure", () => {
    const classification = deriveCombinedReadinessClassification({
      baseV3: {
        evaluationId: GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
        suiteChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
        manifestChecksum: "a".repeat(64),
        decisionChecksum: "b".repeat(64),
        metricsChecksum: "c".repeat(64),
        classification: "inconclusive",
        nonPassGates: ["C04"],
        knockbackEvents: 36,
        overturnEvents: 8,
        grappleRepositionEvents: 0,
      },
      supplement: {
        supplementId: "33333333-3333-4333-8333-333333333333",
        planChecksum: "d".repeat(64),
        scenarioRegistryChecksum: "e".repeat(64),
        decision: "not_ready",
        validGrappleRepositionEvents: 0,
        fighterAAttackerRepositionCount: 0,
        fighterBAttackerRepositionCount: 0,
        distinctSeedsProducingFighterAAttackerReposition: 0,
        distinctSeedsProducingFighterBAttackerReposition: 0,
      },
    });
    expect(classification).toBe("not_ready");
  });

  it("derives inconclusive when coverage is not confirmed", () => {
    const classification = deriveCombinedReadinessClassification({
      baseV3: {
        evaluationId: GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
        suiteChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
        manifestChecksum: "a".repeat(64),
        decisionChecksum: "b".repeat(64),
        metricsChecksum: "c".repeat(64),
        classification: "inconclusive",
        nonPassGates: ["C04"],
        knockbackEvents: 36,
        overturnEvents: 8,
        grappleRepositionEvents: 0,
      },
      supplement: {
        supplementId: "33333333-3333-4333-8333-333333333333",
        planChecksum: "d".repeat(64),
        scenarioRegistryChecksum: "e".repeat(64),
        decision: "inconclusive",
        validGrappleRepositionEvents: 1,
        fighterAAttackerRepositionCount: 1,
        fighterBAttackerRepositionCount: 0,
        distinctSeedsProducingFighterAAttackerReposition: 1,
        distinctSeedsProducingFighterBAttackerReposition: 0,
      },
    });
    expect(classification).toBe("inconclusive");
  });

  it("builds the addendum with the required disclaimer (never an activation decision)", () => {
    const addendum = buildGridActivationReadinessAddendum({
      baseV3: {
        evaluationId: GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
        suiteChecksum: GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
        manifestChecksum: "a".repeat(64),
        decisionChecksum: "b".repeat(64),
        metricsChecksum: "c".repeat(64),
        classification: "inconclusive",
        nonPassGates: ["C04"],
        knockbackEvents: 36,
        overturnEvents: 8,
        grappleRepositionEvents: 0,
      },
      supplement: {
        supplementId: "33333333-3333-4333-8333-333333333333",
        planChecksum: "d".repeat(64),
        scenarioRegistryChecksum: "e".repeat(64),
        decision: "coverage_confirmed",
        validGrappleRepositionEvents: 8,
        fighterAAttackerRepositionCount: 4,
        fighterBAttackerRepositionCount: 4,
        distinctSeedsProducingFighterAAttackerReposition: 4,
        distinctSeedsProducingFighterBAttackerReposition: 4,
      },
    });
    expect(addendum.combinedReadinessClassification).toBe("ready_for_opt_in_beta_review");
    expect(addendum.disclaimer).toBe(GRID_ACTIVATION_READINESS_ADDENDUM_DISCLAIMER);
    expect(addendum.baseV3.evaluationId).toBe(
      GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
    );
    expect(addendum.baseV3.suiteChecksum).toBe(
      GRID_GRAPPLE_COVERAGE_BASE_V3_SUITE_CHECKSUM,
    );
    // ready_for_opt_in_beta_review is never an activation decision.
    expect(addendum.disclaimer).toContain("does not activate the grid runtime");
  });
});
