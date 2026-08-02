import { z } from "zod";
import type {
  ReadinessGateCategory,
  ReadinessGateOutcome,
  ReadinessGateResult,
} from "./gates.js";
import { GRID_ACTIVATION_READINESS_SUITE_ID } from "./run-plan.js";

/**
 * Grid activation-readiness decision v1 (Milestone 0.2C Phase 3E1).
 *
 * The decision classifies the current implementation as exactly one of
 * `ready_for_opt_in_beta_review`, `inconclusive` or `not_ready`. Even
 * `ready_for_opt_in_beta_review` is not permission to activate grid; default
 * activation remains a later, separately authorised decision. The decision
 * contains every gate with its category, outcome, frozen threshold, observed
 * value, concise evidence and blocking reason, and never contains a tuning
 * recommendation.
 */
export type GridActivationReadinessDecision =
  "ready_for_opt_in_beta_review" | "inconclusive" | "not_ready";

export const GRID_ACTIVATION_READINESS_DISCLAIMER =
  "This development-only evaluation does not activate the grid runtime, does not qualify combat balance and does not authorise default migration.";

export const gridActivationReadinessGateEntrySchema = z.object({
  gateId: z.string().min(1),
  category: z.enum(["hard-correctness", "coverage", "slot-order-stability", "progress"]),
  outcome: z.enum(["pass", "fail", "inconclusive"]),
  frozenThreshold: z.string().min(1),
  observedValue: z.string().min(1),
  evidence: z.string().min(1),
  blockingReason: z.string().nullable(),
});

export type GridActivationReadinessGateEntry = z.infer<
  typeof gridActivationReadinessGateEntrySchema
>;

export const gridActivationReadinessDecisionSchema = z
  .object({
    schemaVersion: z.literal("1"),
    evaluationKind: z.literal("grid-activation-readiness"),
    suiteId: z.literal(GRID_ACTIVATION_READINESS_SUITE_ID),
    status: z.literal("completed"),
    evaluationId: z.string().uuid(),
    createdAt: z.string().min(1),
    simulatorVersion: z.literal("0.3.0"),
    positioningModel: z.literal("grid-3x3-v1"),
    rulesetVersion: z.literal("0.2.0"),
    catalogueVersion: z.literal("1"),
    decision: z.enum(["ready_for_opt_in_beta_review", "inconclusive", "not_ready"]),
    gates: z.array(gridActivationReadinessGateEntrySchema),
    disclaimer: z.literal(GRID_ACTIVATION_READINESS_DISCLAIMER),
  })
  .strict();

export type GridActivationReadinessDecisionV1 = z.infer<
  typeof gridActivationReadinessDecisionSchema
>;

export class GridActivationReadinessDecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridActivationReadinessDecisionError";
  }
}

export interface BuildGridActivationReadinessDecisionInput {
  evaluationId: string;
  createdAt: string;
  gates: readonly ReadinessGateResult[];
  anyFail: boolean;
  anyInconclusive: boolean;
}

/**
 * Derives the decision: any hard, slot-stability or progress gate failure
 * produces `not_ready`; otherwise any inconclusive gate produces
 * `inconclusive`; otherwise `ready_for_opt_in_beta_review`.
 */
export function deriveGridActivationReadinessDecision(
  input: Pick<BuildGridActivationReadinessDecisionInput, "anyFail" | "anyInconclusive">,
): GridActivationReadinessDecision {
  if (input.anyFail) return "not_ready";
  if (input.anyInconclusive) return "inconclusive";
  return "ready_for_opt_in_beta_review";
}

/**
 * Builds and validates the decision v1 artifact. No tuning recommendation is
 * ever included.
 */
export function buildGridActivationReadinessDecision(
  input: BuildGridActivationReadinessDecisionInput,
): GridActivationReadinessDecisionV1 {
  const decision = deriveGridActivationReadinessDecision(input);
  const raw: GridActivationReadinessDecisionV1 = {
    schemaVersion: "1",
    evaluationKind: "grid-activation-readiness",
    suiteId: GRID_ACTIVATION_READINESS_SUITE_ID,
    status: "completed",
    evaluationId: input.evaluationId,
    createdAt: input.createdAt,
    simulatorVersion: "0.3.0",
    positioningModel: "grid-3x3-v1",
    rulesetVersion: "0.2.0",
    catalogueVersion: "1",
    decision,
    gates: input.gates.map((g) => ({
      gateId: g.gateId,
      category: g.category as ReadinessGateCategory,
      outcome: g.outcome as ReadinessGateOutcome,
      frozenThreshold: g.frozenThreshold,
      observedValue: g.observedValue,
      evidence: g.evidence,
      blockingReason: g.blockingReason,
    })),
    disclaimer: GRID_ACTIVATION_READINESS_DISCLAIMER,
  };
  const parsed = gridActivationReadinessDecisionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new GridActivationReadinessDecisionError(
      `Grid activation readiness decision failed its authoritative schema: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export function deserializeGridActivationReadinessDecision(
  json: string,
):
  | { ok: true; decision: GridActivationReadinessDecisionV1 }
  | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json) as unknown;
    const result = gridActivationReadinessDecisionSchema.safeParse(data);
    if (result.success) return { ok: true, decision: result.data };
    return { ok: false, errors: result.error.message };
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
  }
}
