import { z } from "zod";
import { machineBuildProposalSchema } from "./build.schema.js";

const actionPolicySchema = z.object({
  opening: z.enum(["rush", "cautious", "flank", "hold"]),
  preferredRange: z.enum(["close", "medium", "far"]),
  aggression: z.number().nonnegative(),
  primaryTarget: z.enum(["front", "rear", "left", "right", "top"]),
  secondaryTarget: z.enum(["front", "rear", "left", "right", "top"]),
  retreatThreshold: z.number().int().min(0),
  heatThreshold: z.number().int().min(0).max(100),
  fallback: z.enum(["retreat", "defend", "desperate_attack"]),
});

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
});

export const MatchRecordSchema = z.object({
  schemaVersion: z.literal("1"),
  matchId: z.string().uuid(),
  createdAt: z.string().datetime(),
  rulesetVersion: z.string(),
  catalogueVersion: z.string(),
  simulatorVersion: z.string(),
  seed: z.number().int().nonnegative(),
  config: matchConfigSchema,
  initialState: z.object({
    fighterA: fighterStateSchema,
    fighterB: fighterStateSchema,
  }),
  events: z.array(simulationEventSchema),
  result: competitionResultSchema,
  rounds: z.number().int().nonnegative(),
});

export type MatchRecord = z.infer<typeof MatchRecordSchema>;

export function validateMatchRecord(data: unknown):
  | {
      ok: true;
      record: MatchRecord;
    }
  | {
      ok: false;
      errors: z.ZodError;
    } {
  const result = MatchRecordSchema.safeParse(data);
  if (result.success) {
    return { ok: true, record: result.data };
  }
  return { ok: false, errors: result.error };
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
      errors: z.ZodError | SyntaxError;
    } {
  try {
    const data = JSON.parse(json);
    const result = MatchRecordSchema.safeParse(data);
    if (result.success) {
      return { ok: true, record: result.data };
    }
    return { ok: false, errors: result.error };
  } catch (e) {
    return { ok: false, errors: e as SyntaxError };
  }
}
