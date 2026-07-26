import { z } from "zod";

const matchMomentSchema = z.object({
  round: z.number().int().nonnegative(),
  type: z.string(),
  description: z.string(),
  actorId: z.string(),
  targetId: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

const fighterStateSummarySchema = z.object({
  fighterId: z.string(),
  machineName: z.string(),
  integrity: z.number().int().nonnegative(),
  maxIntegrity: z.number().int().positive(),
  energy: z.number().int().nonnegative(),
  heat: z.number().int().nonnegative(),
  zone: z.enum(["center", "north_edge", "south_edge", "east_edge", "west_edge"]),
  facing: z.enum(["north", "south", "east", "west"]),
  weaponCooldown: z.number().int().nonnegative(),
  utilityCooldown: z.number().int().nonnegative(),
  mobilityDisabled: z.boolean(),
  weaponDisabled: z.boolean(),
  utilityDisabled: z.boolean(),
  conditions: z.array(z.enum(["overturned", "immobilised", "overheated", "stunned"])),
});

const fighterMatchSummarySchema = z.object({
  fighterId: z.string(),
  machineName: z.string(),
  chassisId: z.string(),
  mobilityId: z.string(),
  weaponId: z.string(),
  utilityId: z.string(),
  armour: z.object({
    front: z.number().int().nonnegative(),
    left: z.number().int().nonnegative(),
    right: z.number().int().nonnegative(),
    rear: z.number().int().nonnegative(),
    top: z.number().int().nonnegative(),
  }),
  totalCost: z.number().int().nonnegative(),
  opening: z.string(),
  preferredRange: z.string(),
  aggression: z.number().int().nonnegative(),
  primaryTarget: z.string(),
  secondaryTarget: z.string(),
});

export const FactualMatchReportSchema = z.object({
  schemaVersion: z.literal("1"),
  matchId: z.string(),
  seed: z.number().int().nonnegative(),
  rounds: z.number().int().nonnegative(),
  winner: z.string().nullable(),
  resultMethod: z.string(),
  fighterA: fighterMatchSummarySchema,
  fighterB: fighterMatchSummarySchema,
  firstHit: matchMomentSchema.optional(),
  criticalHits: z.array(matchMomentSchema),
  componentFailures: z.array(matchMomentSchema),
  overturns: z.array(matchMomentSchema),
  finalStates: z.object({
    fighterA: fighterStateSummarySchema,
    fighterB: fighterStateSummarySchema,
  }),
});

export type MatchMoment = z.infer<typeof matchMomentSchema>;
export type FighterStateSummary = z.infer<typeof fighterStateSummarySchema>;
export type FighterMatchSummary = z.infer<typeof fighterMatchSummarySchema>;
export type FactualMatchReport = z.infer<typeof FactualMatchReportSchema>;

export function validateFactualMatchReport(
  data: unknown,
): { ok: true; report: FactualMatchReport } | { ok: false; errors: z.ZodError } {
  const result = FactualMatchReportSchema.safeParse(data);
  if (result.success) {
    return { ok: true, report: result.data };
  }
  return { ok: false, errors: result.error };
}

export function serializeFactualMatchReport(report: FactualMatchReport): string {
  return JSON.stringify(report, null, 2);
}

export function deserializeFactualMatchReport(
  json: string,
):
  | { ok: true; report: FactualMatchReport }
  | { ok: false; errors: z.ZodError | SyntaxError } {
  try {
    const data = JSON.parse(json);
    const result = FactualMatchReportSchema.safeParse(data);
    if (result.success) {
      return { ok: true, report: result.data };
    }
    return { ok: false, errors: result.error };
  } catch (e) {
    return { ok: false, errors: e as SyntaxError };
  }
}
