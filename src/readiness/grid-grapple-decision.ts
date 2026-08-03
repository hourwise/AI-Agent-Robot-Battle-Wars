import { z } from "zod";
import type { GridGrappleCoverageMetrics } from "./grid-grapple-metrics.js";

/**
 * Grid grapple-coverage supplement decision v1 and combined readiness
 * addendum (Milestone 0.2C Phase 3E2, Phases 10/11).
 *
 * The supplement decision is exactly one of `coverage_confirmed`,
 * `inconclusive` or `not_ready`. Any hard requirement failure produces
 * `not_ready`. `coverage_confirmed` is returned only when the frozen runtime
 * produced valid grapple-reposition events in BOTH fighter slots from
 * distinct seeds. The combined readiness addendum anchors to the official v3
 * evaluation and derives a `combinedReadinessClassification` — never an
 * activation decision.
 */
export type GridGrappleCoverageDecision =
  "coverage_confirmed" | "inconclusive" | "not_ready";

export type GridActivationReadinessCombinedClassification =
  "ready_for_opt_in_beta_review" | "inconclusive" | "not_ready";

export const GRID_GRAPPLE_COVERAGE_DISCLAIMER =
  "This additive development-only coverage evidence does not modify the official v3 evaluation, does not qualify combat balance, does not perform the opt-in beta decision and does not activate the grid runtime.";

export const GRID_ACTIVATION_READINESS_ADDENDUM_DISCLAIMER =
  "This additive development-only coverage evidence does not modify the official v3 evaluation, does not qualify combat balance, does not perform the opt-in beta decision and does not activate the grid runtime.";

/** Explicit hard-requirement check results (all must pass for coverage). */
export interface GridGrappleCoverageHardChecks {
  readonly allMatchesCompleted: boolean;
  readonly determinismVerified: boolean;
  readonly runtimeIdentityMatches: boolean;
  readonly recordsValid: boolean;
  readonly reportsValid: boolean;
  readonly finalStateAgreementsComplete: boolean;
  readonly chronologyValid: boolean;
  readonly malformedGrappleEventsAbsent: boolean;
  readonly resolverDisagreementsAbsent: boolean;
  readonly inputsUnmodified: boolean;
  readonly artifactIntegrityVerified: boolean;
  readonly baseV3Valid: boolean;
  readonly baseV3IdentityMatches: boolean;
  readonly legacyIsolationVerified: boolean;
}

export interface GridGrappleCoverageDecisionV1 {
  readonly schemaVersion: "1";
  readonly evaluationKind: "grid-grapple-coverage";
  readonly supplementId: string;
  readonly createdAt: string;
  readonly simulatorVersion: "0.3.0";
  readonly positioningModel: "grid-3x3-v1";
  readonly rulesetVersion: "0.2.0";
  readonly catalogueVersion: "1";
  readonly decision: GridGrappleCoverageDecision;
  readonly execution: {
    readonly plannedRuns: number;
    readonly completedRuns: number;
    readonly deterministicRuns: number;
    readonly validRecords: number;
    readonly validReports: number;
    readonly finalStateAgreements: number;
    readonly invalidEventCount: number;
    readonly mutationFailures: number;
  };
  readonly grapple: {
    readonly totalGrapplerAttackAttempts: number;
    readonly totalGrapplerHits: number;
    readonly totalGrapplerMisses: number;
    readonly validGrappleRepositionEvents: number;
    readonly sameCellGrapplerHitsWithoutReposition: number;
    readonly distinctSeedsProducingReposition: number;
    readonly fighterAAttackerRepositionCount: number;
    readonly fighterBAttackerRepositionCount: number;
    readonly distinctSeedsProducingFighterAAttackerReposition: number;
    readonly distinctSeedsProducingFighterBAttackerReposition: number;
  };
  readonly isolation: {
    readonly nonGrappleKnockbackEvents: number;
    readonly overturnEvents: number;
    readonly grappleEventsAttributedToWrongFighter: number;
    readonly malformedOrResolverDisagreeingGrappleEvents: number;
  };
  readonly hardChecks: GridGrappleCoverageHardChecks;
  readonly disclaimer: typeof GRID_GRAPPLE_COVERAGE_DISCLAIMER;
}

export const gridGrappleCoverageDecisionV1Schema = z
  .object({
    schemaVersion: z.literal("1"),
    evaluationKind: z.literal("grid-grapple-coverage"),
    supplementId: z.string().uuid(),
    createdAt: z.string().min(1),
    simulatorVersion: z.literal("0.3.0"),
    positioningModel: z.literal("grid-3x3-v1"),
    rulesetVersion: z.literal("0.2.0"),
    catalogueVersion: z.literal("1"),
    decision: z.enum(["coverage_confirmed", "inconclusive", "not_ready"]),
    execution: z.object({
      plannedRuns: z.number().int().nonnegative(),
      completedRuns: z.number().int().nonnegative(),
      deterministicRuns: z.number().int().nonnegative(),
      validRecords: z.number().int().nonnegative(),
      validReports: z.number().int().nonnegative(),
      finalStateAgreements: z.number().int().nonnegative(),
      invalidEventCount: z.number().int().nonnegative(),
      mutationFailures: z.number().int().nonnegative(),
    }),
    grapple: z.object({
      totalGrapplerAttackAttempts: z.number().int().nonnegative(),
      totalGrapplerHits: z.number().int().nonnegative(),
      totalGrapplerMisses: z.number().int().nonnegative(),
      validGrappleRepositionEvents: z.number().int().nonnegative(),
      sameCellGrapplerHitsWithoutReposition: z.number().int().nonnegative(),
      distinctSeedsProducingReposition: z.number().int().nonnegative(),
      fighterAAttackerRepositionCount: z.number().int().nonnegative(),
      fighterBAttackerRepositionCount: z.number().int().nonnegative(),
      distinctSeedsProducingFighterAAttackerReposition: z.number().int().nonnegative(),
      distinctSeedsProducingFighterBAttackerReposition: z.number().int().nonnegative(),
    }),
    isolation: z.object({
      nonGrappleKnockbackEvents: z.number().int().nonnegative(),
      overturnEvents: z.number().int().nonnegative(),
      grappleEventsAttributedToWrongFighter: z.number().int().nonnegative(),
      malformedOrResolverDisagreeingGrappleEvents: z.number().int().nonnegative(),
    }),
    hardChecks: z.object({
      allMatchesCompleted: z.boolean(),
      determinismVerified: z.boolean(),
      runtimeIdentityMatches: z.boolean(),
      recordsValid: z.boolean(),
      reportsValid: z.boolean(),
      finalStateAgreementsComplete: z.boolean(),
      chronologyValid: z.boolean(),
      malformedGrappleEventsAbsent: z.boolean(),
      resolverDisagreementsAbsent: z.boolean(),
      inputsUnmodified: z.boolean(),
      artifactIntegrityVerified: z.boolean(),
      baseV3Valid: z.boolean(),
      baseV3IdentityMatches: z.boolean(),
      legacyIsolationVerified: z.boolean(),
    }),
    disclaimer: z.literal(GRID_GRAPPLE_COVERAGE_DISCLAIMER),
  })
  .strict();

export type GridGrappleCoverageDecisionV1Artifact = z.infer<
  typeof gridGrappleCoverageDecisionV1Schema
>;

export class GridGrappleCoverageDecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridGrappleCoverageDecisionError";
  }
}

export interface BuildGridGrappleCoverageDecisionInput {
  supplementId: string;
  createdAt: string;
  metrics: GridGrappleCoverageMetrics;
  hardChecks: GridGrappleCoverageHardChecks;
}

/**
 * Derives the supplement decision from the hard checks and the grapple
 * feature evidence.
 */
export function deriveGridGrappleCoverageDecision(
  input: Pick<BuildGridGrappleCoverageDecisionInput, "metrics" | "hardChecks">,
): GridGrappleCoverageDecision {
  const { metrics, hardChecks } = input;
  const hardFailure =
    !hardChecks.allMatchesCompleted ||
    !hardChecks.determinismVerified ||
    !hardChecks.runtimeIdentityMatches ||
    !hardChecks.recordsValid ||
    !hardChecks.reportsValid ||
    !hardChecks.finalStateAgreementsComplete ||
    !hardChecks.chronologyValid ||
    !hardChecks.malformedGrappleEventsAbsent ||
    !hardChecks.resolverDisagreementsAbsent ||
    !hardChecks.inputsUnmodified ||
    !hardChecks.artifactIntegrityVerified ||
    !hardChecks.baseV3Valid ||
    !hardChecks.baseV3IdentityMatches ||
    !hardChecks.legacyIsolationVerified;
  if (hardFailure) return "not_ready";

  const g = metrics.grapple;
  const coverageConfirmed =
    g.validGrappleRepositionEvents >= 2 &&
    g.fighterAAttackerRepositionCount >= 1 &&
    g.fighterBAttackerRepositionCount >= 1 &&
    g.distinctSeedsProducingFighterAAttackerReposition >= 1 &&
    g.distinctSeedsProducingFighterBAttackerReposition >= 1;
  return coverageConfirmed ? "coverage_confirmed" : "inconclusive";
}

/**
 * Builds and validates the supplement decision v1 artifact.
 */
export function buildGridGrappleCoverageDecision(
  input: BuildGridGrappleCoverageDecisionInput,
): GridGrappleCoverageDecisionV1 {
  const { supplementId, createdAt, metrics, hardChecks } = input;
  const decision = deriveGridGrappleCoverageDecision({ metrics, hardChecks });
  const raw: GridGrappleCoverageDecisionV1 = {
    schemaVersion: "1",
    evaluationKind: "grid-grapple-coverage",
    supplementId,
    createdAt,
    simulatorVersion: "0.3.0",
    positioningModel: "grid-3x3-v1",
    rulesetVersion: "0.2.0",
    catalogueVersion: "1",
    decision,
    execution: {
      plannedRuns: metrics.execution.totalPlannedRuns,
      completedRuns: metrics.execution.totalCompletedRuns,
      deterministicRuns: metrics.execution.deterministicRuns,
      validRecords: metrics.execution.schemaValidRecords,
      validReports: metrics.execution.schemaValidReports,
      finalStateAgreements: metrics.execution.finalStateAgreements,
      invalidEventCount: metrics.execution.invalidEventCount,
      mutationFailures: metrics.execution.mutationFailures,
    },
    grapple: {
      totalGrapplerAttackAttempts: metrics.grapple.totalGrapplerAttackAttempts,
      totalGrapplerHits: metrics.grapple.totalGrapplerHits,
      totalGrapplerMisses: metrics.grapple.totalGrapplerMisses,
      validGrappleRepositionEvents: metrics.grapple.validGrappleRepositionEvents,
      sameCellGrapplerHitsWithoutReposition:
        metrics.grapple.sameCellGrapplerHitsWithoutReposition,
      distinctSeedsProducingReposition: metrics.grapple.distinctSeedsProducingReposition,
      fighterAAttackerRepositionCount: metrics.grapple.fighterAAttackerRepositionCount,
      fighterBAttackerRepositionCount: metrics.grapple.fighterBAttackerRepositionCount,
      distinctSeedsProducingFighterAAttackerReposition:
        metrics.grapple.distinctSeedsProducingFighterAAttackerReposition,
      distinctSeedsProducingFighterBAttackerReposition:
        metrics.grapple.distinctSeedsProducingFighterBAttackerReposition,
    },
    isolation: {
      nonGrappleKnockbackEvents: metrics.isolation.nonGrappleKnockbackEvents,
      overturnEvents: metrics.isolation.overturnEvents,
      grappleEventsAttributedToWrongFighter:
        metrics.isolation.grappleEventsAttributedToWrongFighter,
      malformedOrResolverDisagreeingGrappleEvents:
        metrics.isolation.malformedOrResolverDisagreeingGrappleEvents,
    },
    hardChecks,
    disclaimer: GRID_GRAPPLE_COVERAGE_DISCLAIMER,
  };
  const parsed = gridGrappleCoverageDecisionV1Schema.safeParse(raw);
  if (!parsed.success) {
    throw new GridGrappleCoverageDecisionError(
      `Grid grapple coverage decision failed its authoritative schema: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export function deserializeGridGrappleCoverageDecision(
  json: string,
): { ok: true; decision: GridGrappleCoverageDecisionV1 } | { ok: false; errors: string } {
  try {
    const result = gridGrappleCoverageDecisionV1Schema.safeParse(JSON.parse(json));
    if (!result.success) return { ok: false, errors: result.error.message };
    return { ok: true, decision: result.data };
  } catch (e) {
    return { ok: false, errors: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * The combined readiness addendum v1. Explicitly references the official v3
 * evaluation, its anchored artifact checksums and its evidence, plus the
 * supplemental plan/scenario checksums and grapple evidence, and derives the
 * combined readiness classification.
 */
export interface GridActivationReadinessAddendumV1 {
  readonly schemaVersion: "1";
  readonly evaluationKind: "grid-activation-readiness-addendum";
  readonly baseV3: {
    readonly evaluationId: string;
    readonly suiteId: "grid-activation-readiness-v3";
    readonly suiteChecksum: string;
    readonly manifestChecksum: string;
    readonly decisionChecksum: string;
    readonly metricsChecksum: string;
    readonly classification: "inconclusive";
    readonly nonPassGates: string[];
    readonly knockbackEvents: number;
    readonly overturnEvents: number;
    readonly grappleRepositionEvents: number;
  };
  readonly supplement: {
    readonly supplementId: string;
    readonly planChecksum: string;
    readonly scenarioRegistryChecksum: string;
    readonly decision: GridGrappleCoverageDecision;
    readonly validGrappleRepositionEvents: number;
    readonly fighterAAttackerRepositionCount: number;
    readonly fighterBAttackerRepositionCount: number;
    readonly distinctSeedsProducingFighterAAttackerReposition: number;
    readonly distinctSeedsProducingFighterBAttackerReposition: number;
  };
  readonly combinedReadinessClassification: GridActivationReadinessCombinedClassification;
  readonly disclaimer: typeof GRID_ACTIVATION_READINESS_ADDENDUM_DISCLAIMER;
}

export const gridActivationReadinessAddendumV1Schema = z
  .object({
    schemaVersion: z.literal("1"),
    evaluationKind: z.literal("grid-activation-readiness-addendum"),
    baseV3: z.object({
      evaluationId: z.string().uuid(),
      suiteId: z.literal("grid-activation-readiness-v3"),
      suiteChecksum: z.string().regex(/^[a-f0-9]{64}$/),
      manifestChecksum: z.string().regex(/^[a-f0-9]{64}$/),
      decisionChecksum: z.string().regex(/^[a-f0-9]{64}$/),
      metricsChecksum: z.string().regex(/^[a-f0-9]{64}$/),
      classification: z.literal("inconclusive"),
      nonPassGates: z.array(z.string().min(1)),
      knockbackEvents: z.number().int().nonnegative(),
      overturnEvents: z.number().int().nonnegative(),
      grappleRepositionEvents: z.number().int().nonnegative(),
    }),
    supplement: z.object({
      supplementId: z.string().uuid(),
      planChecksum: z.string().regex(/^[a-f0-9]{64}$/),
      scenarioRegistryChecksum: z.string().regex(/^[a-f0-9]{64}$/),
      decision: z.enum(["coverage_confirmed", "inconclusive", "not_ready"]),
      validGrappleRepositionEvents: z.number().int().nonnegative(),
      fighterAAttackerRepositionCount: z.number().int().nonnegative(),
      fighterBAttackerRepositionCount: z.number().int().nonnegative(),
      distinctSeedsProducingFighterAAttackerReposition: z.number().int().nonnegative(),
      distinctSeedsProducingFighterBAttackerReposition: z.number().int().nonnegative(),
    }),
    combinedReadinessClassification: z.enum([
      "ready_for_opt_in_beta_review",
      "inconclusive",
      "not_ready",
    ]),
    disclaimer: z.literal(GRID_ACTIVATION_READINESS_ADDENDUM_DISCLAIMER),
  })
  .strict();

export type GridActivationReadinessAddendumV1Artifact = z.infer<
  typeof gridActivationReadinessAddendumV1Schema
>;

export interface BuildGridActivationReadinessAddendumInput {
  baseV3: {
    evaluationId: string;
    suiteChecksum: string;
    manifestChecksum: string;
    decisionChecksum: string;
    metricsChecksum: string;
    classification: "inconclusive";
    nonPassGates: readonly string[];
    knockbackEvents: number;
    overturnEvents: number;
    grappleRepositionEvents: number;
  };
  supplement: {
    supplementId: string;
    planChecksum: string;
    scenarioRegistryChecksum: string;
    decision: GridGrappleCoverageDecision;
    validGrappleRepositionEvents: number;
    fighterAAttackerRepositionCount: number;
    fighterBAttackerRepositionCount: number;
    distinctSeedsProducingFighterAAttackerReposition: number;
    distinctSeedsProducingFighterBAttackerReposition: number;
  };
}

/**
 * Derives the combined readiness classification:
 *
 *   base v3 valid and inconclusive solely on C04
 *   AND base knockback > 0 AND base overturn > 0
 *   AND supplement decision is coverage_confirmed
 *       → ready_for_opt_in_beta_review
 *   else if either base or supplement has a hard failure → not_ready
 *   else → inconclusive
 */
export function deriveCombinedReadinessClassification(
  input: BuildGridActivationReadinessAddendumInput,
): GridActivationReadinessCombinedClassification {
  const { baseV3, supplement } = input;
  const baseValidAndInconclusiveOnC04 =
    baseV3.classification === "inconclusive" &&
    baseV3.nonPassGates.length === 1 &&
    baseV3.nonPassGates[0] === "C04" &&
    baseV3.knockbackEvents > 0 &&
    baseV3.overturnEvents > 0;
  if (baseValidAndInconclusiveOnC04 && supplement.decision === "coverage_confirmed") {
    return "ready_for_opt_in_beta_review";
  }
  if (supplement.decision === "not_ready") return "not_ready";
  return "inconclusive";
}

/**
 * Builds and validates the combined readiness addendum v1.
 */
export function buildGridActivationReadinessAddendum(
  input: BuildGridActivationReadinessAddendumInput,
): GridActivationReadinessAddendumV1 {
  const addendum: GridActivationReadinessAddendumV1 = {
    schemaVersion: "1",
    evaluationKind: "grid-activation-readiness-addendum",
    baseV3: {
      evaluationId: input.baseV3.evaluationId,
      suiteId: "grid-activation-readiness-v3",
      suiteChecksum: input.baseV3.suiteChecksum,
      manifestChecksum: input.baseV3.manifestChecksum,
      decisionChecksum: input.baseV3.decisionChecksum,
      metricsChecksum: input.baseV3.metricsChecksum,
      classification: input.baseV3.classification,
      nonPassGates: [...input.baseV3.nonPassGates],
      knockbackEvents: input.baseV3.knockbackEvents,
      overturnEvents: input.baseV3.overturnEvents,
      grappleRepositionEvents: input.baseV3.grappleRepositionEvents,
    },
    supplement: {
      supplementId: input.supplement.supplementId,
      planChecksum: input.supplement.planChecksum,
      scenarioRegistryChecksum: input.supplement.scenarioRegistryChecksum,
      decision: input.supplement.decision,
      validGrappleRepositionEvents: input.supplement.validGrappleRepositionEvents,
      fighterAAttackerRepositionCount: input.supplement.fighterAAttackerRepositionCount,
      fighterBAttackerRepositionCount: input.supplement.fighterBAttackerRepositionCount,
      distinctSeedsProducingFighterAAttackerReposition:
        input.supplement.distinctSeedsProducingFighterAAttackerReposition,
      distinctSeedsProducingFighterBAttackerReposition:
        input.supplement.distinctSeedsProducingFighterBAttackerReposition,
    },
    combinedReadinessClassification: deriveCombinedReadinessClassification(input),
    disclaimer: GRID_ACTIVATION_READINESS_ADDENDUM_DISCLAIMER,
  };
  const parsed = gridActivationReadinessAddendumV1Schema.safeParse(addendum);
  if (!parsed.success) {
    throw new GridGrappleCoverageDecisionError(
      `Grid activation readiness addendum failed its authoritative schema: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}
