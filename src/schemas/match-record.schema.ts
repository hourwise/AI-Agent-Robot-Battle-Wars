import { z } from "zod";
import { machineBuildProposalSchema } from "./build.schema.js";
import { actionPolicySchema } from "./policy.schema.js";
import { MatchReviewSchema } from "./review.schema.js";
import { gridZoneSchema, POSITIONING_MODEL_GRID } from "./positioning.schema.js";
import { isGridZone } from "../simulator/arena-grid.js";

const componentQualificationIdSchema = z.enum([
  "component-impact-c1",
  "component-impact-c2",
  "component-impact-ab2",
]);
const armourBandSchema = z.object({
  id: z.string(),
  minArmourInclusive: z.number().int().nonnegative(),
  maxArmourInclusive: z.number().int().nonnegative().nullable(),
  criticalThreshold: z.number().nonnegative(),
  highImpactThreshold: z.number().nonnegative(),
});
const componentQualificationMetadataSchema = z.discriminatedUnion("model", [
  z.object({
    id: z.enum(["component-impact-c1", "component-impact-c2"]),
    configChecksum: z.string().regex(/^[a-f0-9]{16}$/),
    model: z.literal("linear-component-impact"),
  }),
  z.object({
    id: z.literal("component-impact-ab2"),
    configChecksum: z.string().regex(/^[a-f0-9]{16}$/),
    model: z.literal("armour-band-component-impact"),
    bands: z.array(armourBandSchema).min(1).readonly(),
  }),
]);

const validatedBuildSchema = z.object({
  proposal: machineBuildProposalSchema,
  totalCost: z.number().int().nonnegative(),
  armourCost: z.number().int().nonnegative(),
  totalArmourPoints: z.number().int().nonnegative(),
  catalogueVersion: z.string(),
});

const armourStateSchema = z.object({
  front: z.number().int().nonnegative(),
  left: z.number().int().nonnegative(),
  right: z.number().int().nonnegative(),
  rear: z.number().int().nonnegative(),
  top: z.number().int().nonnegative(),
});

const componentStateSchema = z.object({
  mobilityDisabled: z.boolean(),
  weaponDisabled: z.boolean(),
  utilityDisabled: z.boolean(),
});

// ── v2 component state schemas ──

const componentStatusSchema = z.enum(["healthy", "damaged", "disabled"]);

const runtimeComponentStateSchema = z.object({
  state: componentStatusSchema,
});

const utilityRuntimeStateSchema = z.object({
  state: componentStatusSchema,
  installed: z.boolean(),
  reinforcedDriveGuard: z.enum(["available", "spent", "lost"]).optional(),
});

const componentStatesSchema = z.object({
  mobility: runtimeComponentStateSchema,
  weapon: runtimeComponentStateSchema,
  utility: utilityRuntimeStateSchema,
});

const fighterStateSchema = z.object({
  fighterId: z.string(),
  build: validatedBuildSchema,
  integrity: z.number().int().nonnegative(),
  maxIntegrity: z.number().int().positive(),
  energy: z.number().int().nonnegative(),
  heat: z.number().int().nonnegative(),
  zone: z.enum(["center", "north_edge", "south_edge", "east_edge", "west_edge"]),
  facing: z.enum(["north", "south", "east", "west"]),
  weaponCooldown: z.number().int().nonnegative(),
  utilityCooldown: z.number().int().nonnegative(),
  armour: armourStateSchema,
  components: componentStateSchema,
  conditions: z.array(z.enum(["overturned", "immobilised", "overheated", "stunned"])),
});

const fighterStateV2Schema = fighterStateSchema.extend({
  comps: componentStatesSchema,
});

/** v3 fighter state: full v2 component representation with grid zones only. */
const fighterStateV3Schema = fighterStateV2Schema.extend({
  zone: gridZoneSchema,
});

const simulationEventSchema = z.object({
  schemaVersion: z.string(),
  sequence: z.number().int().nonnegative(),
  round: z.number().int().nonnegative(),
  timestampMs: z.number().int().nonnegative(),
  type: z.string(),
  actorId: z.string().optional(),
  targetId: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
});

const judgeScoreSchema = z.object({
  damageInflicted: z.number().nonnegative(),
  mobilityRemaining: z.number().nonnegative(),
  weaponFunctional: z.boolean(),
  aggression: z.number().nonnegative(),
  integrityRemaining: z.number().nonnegative(),
  normalised: z.object({
    damage: z.number(),
    mobility: z.number(),
    weapon: z.number(),
    aggression: z.number(),
    integrity: z.number(),
    total: z.number(),
  }),
});

const competitionResultSchema = z.object({
  winner: z.string().nullable(),
  loser: z.string().nullable(),
  method: z.enum(["destruction", "immobilisation", "judges", "draw"]),
  judgeScores: z
    .object({ fighterA: judgeScoreSchema, fighterB: judgeScoreSchema })
    .optional(),
});

const matchConfigSchema = z.object({
  seed: z.number().int().nonnegative(),
  fighterA: z.object({ build: validatedBuildSchema, policy: actionPolicySchema }),
  fighterB: z.object({ build: validatedBuildSchema, policy: actionPolicySchema }),
  rulesetVersion: z.string(),
  catalogueVersion: z.string(),
  componentQualificationId: componentQualificationIdSchema.optional(),
  componentQualification: componentQualificationMetadataSchema.optional(),
});

const agentUsageRecordSchema = z.object({
  phase: z.enum(["design", "policy", "review", "rebuild"]),
  agentId: z.string(),
  provider: z.string(),
  model: z.string(),
  providerRequestId: z.string().nullable(),
  promptVersion: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cachedTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative().nullable(),
  costIsEstimated: z.boolean(),
  pricingVersion: z.string().nullable(),
  latencyMs: z.number().nonnegative(),
  attempts: z.number().int().positive(),
  fallbackUsed: z.boolean(),
  errorCategory: z.enum([
    "none",
    "timeout",
    "rate_limit",
    "provider_error",
    "invalid_json",
    "schema_violation",
    "semantic_violation",
    "authentication",
  ]),
});

export const MatchRecordV1Schema = z.object({
  schemaVersion: z.literal("1"),
  matchId: z.string().uuid(),
  createdAt: z.string().datetime(),
  rulesetVersion: z.string(),
  catalogueVersion: z.string(),
  simulatorVersion: z.string(),
  componentQualificationId: componentQualificationIdSchema.optional(),
  componentQualification: componentQualificationMetadataSchema.optional(),
  seed: z.number().int().nonnegative(),
  config: matchConfigSchema,
  initialState: z.object({
    fighterA: fighterStateSchema,
    fighterB: fighterStateSchema,
  }),
  events: z.array(simulationEventSchema),
  result: competitionResultSchema,
  rounds: z.number().int().nonnegative(),
  agentUsage: z.array(agentUsageRecordSchema).default([]),
  review: MatchReviewSchema.optional(),
});

export const MatchRecordV2Schema = z.object({
  schemaVersion: z.literal("2"),
  matchId: z.string().uuid(),
  createdAt: z.string().datetime(),
  rulesetVersion: z.string(),
  catalogueVersion: z.string(),
  simulatorVersion: z.string(),
  componentQualificationId: componentQualificationIdSchema.optional(),
  componentQualification: componentQualificationMetadataSchema.optional(),
  seed: z.number().int().nonnegative(),
  config: matchConfigSchema,
  initialState: z.object({
    fighterA: fighterStateV2Schema,
    fighterB: fighterStateV2Schema,
  }),
  events: z.array(simulationEventSchema),
  result: competitionResultSchema,
  rounds: z.number().int().nonnegative(),
  agentUsage: z.array(agentUsageRecordSchema).default([]),
  review: MatchReviewSchema.optional(),
});

/**
 * Validates positioning facts inside authoritative event data for grid (v3)
 * records. Only `movement_resolved` and `round_ended` carry arena zone facts
 * that must be canonical grid zones; other event payloads are left generic.
 * This is deliberately scoped and does not redesign the generic event schema.
 *
 * For v3 records every such payload must be complete: missing `data`,
 * missing movement `from`/`to`, missing round-end `fighterA`/`fighterB`, or a
 * missing zone fails validation exactly like an invalid legacy-edge value.
 */
function validateV3PositioningFacts(events: readonly unknown[]): string[] {
  const errors: string[] = [];
  for (const event of events) {
    if (typeof event !== "object" || event === null) continue;
    const envelope = event as { type?: unknown; data?: unknown };

    if (envelope.type === "movement_resolved") {
      const data = envelope.data;
      if (typeof data !== "object" || data === null) {
        errors.push("movement_resolved.data must be an object");
        continue;
      }
      const fields = data as { from?: unknown; to?: unknown };
      if (!isGridZone(fields.from)) {
        errors.push(
          `movement_resolved.data.from must be a canonical grid zone; received ${String(fields.from)}`,
        );
      }
      if (!isGridZone(fields.to)) {
        errors.push(
          `movement_resolved.data.to must be a canonical grid zone; received ${String(fields.to)}`,
        );
      }
    }

    if (envelope.type === "round_ended") {
      const data = envelope.data;
      if (typeof data !== "object" || data === null) {
        errors.push("round_ended.data must be an object");
        continue;
      }
      const record = data as { fighterA?: unknown; fighterB?: unknown };
      for (const side of ["fighterA", "fighterB"] as const) {
        const fighter = record[side];
        if (typeof fighter !== "object" || fighter === null) {
          errors.push(`round_ended.data.${side} must be an object`);
          continue;
        }
        const zone = (fighter as { zone?: unknown }).zone;
        if (!isGridZone(zone)) {
          errors.push(
            `round_ended.data.${side}.zone must be a canonical grid zone; received ${String(zone)}`,
          );
        }
      }
    }
  }
  return errors;
}

export const MatchRecordV3Schema = z
  .object({
    schemaVersion: z.literal("3"),
    positioningModel: z.literal(POSITIONING_MODEL_GRID),
    matchId: z.string().uuid(),
    createdAt: z.string().datetime(),
    rulesetVersion: z.string(),
    catalogueVersion: z.string(),
    simulatorVersion: z.string(),
    componentQualificationId: componentQualificationIdSchema.optional(),
    componentQualification: componentQualificationMetadataSchema.optional(),
    seed: z.number().int().nonnegative(),
    config: matchConfigSchema,
    initialState: z.object({
      fighterA: fighterStateV3Schema,
      fighterB: fighterStateV3Schema,
    }),
    events: z.array(simulationEventSchema),
    result: competitionResultSchema,
    rounds: z.number().int().nonnegative(),
    agentUsage: z.array(agentUsageRecordSchema).default([]),
    review: MatchReviewSchema.optional(),
  })
  .superRefine((record, ctx) => {
    for (const message of validateV3PositioningFacts(record.events)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }
  });

export type MatchRecordV1 = z.infer<typeof MatchRecordV1Schema>;
export type MatchRecordV2 = z.infer<typeof MatchRecordV2Schema>;
export type MatchRecordV3 = z.infer<typeof MatchRecordV3Schema>;
export type MatchRecord = MatchRecordV1 | MatchRecordV2 | MatchRecordV3;

/** Legacy alias — prefer MatchRecordV1 / MatchRecordV2 discriminated. */
/** @deprecated Use MatchRecordV1 explicitly. */
export const MatchRecordSchema = MatchRecordV1Schema;

export type AgentUsageRecordSchema = z.infer<typeof agentUsageRecordSchema>;

export function validateMatchRecord(data: unknown):
  | {
      ok: true;
      record: MatchRecord;
    }
  | {
      ok: false;
      errors: string;
    } {
  if (typeof data !== "object" || data === null) {
    return { ok: false, errors: "Expected an object" };
  }
  const version = (data as Record<string, unknown>).schemaVersion;

  if (version === "1") {
    const result = MatchRecordV1Schema.safeParse(data);
    if (result.success) {
      return { ok: true, record: result.data };
    }
    return { ok: false, errors: result.error.message };
  }

  if (version === "2") {
    const result = MatchRecordV2Schema.safeParse(data);
    if (result.success) {
      return { ok: true, record: result.data };
    }
    return { ok: false, errors: result.error.message };
  }

  if (version === "3") {
    const result = MatchRecordV3Schema.safeParse(data);
    if (result.success) {
      return { ok: true, record: result.data };
    }
    return { ok: false, errors: result.error.message };
  }

  return {
    ok: false,
    errors: `Unsupported or missing schemaVersion: ${String(version)}`,
  };
}

export function isV2Record(record: MatchRecord): record is MatchRecordV2 {
  return record.schemaVersion === "2";
}

export function isV1Record(record: MatchRecord): record is MatchRecordV1 {
  return record.schemaVersion === "1";
}

export function isV3Record(record: MatchRecord): record is MatchRecordV3 {
  return record.schemaVersion === "3";
}

export function serializeMatchRecord(record: MatchRecord): string {
  return JSON.stringify(record, null, 2);
}

export function deserializeMatchRecord(json: string):
  | {
      ok: true;
      record: MatchRecord;
    }
  | {
      ok: false;
      errors: string;
    } {
  try {
    const data = JSON.parse(json);
    return validateMatchRecord(data);
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
  }
}
