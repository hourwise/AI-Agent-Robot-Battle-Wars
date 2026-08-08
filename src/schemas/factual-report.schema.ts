import { z } from "zod";
import {
  legacyArenaZoneSchema,
  gridZoneSchema,
  POSITIONING_MODEL_GRID,
} from "./positioning.schema.js";

const matchMomentSchema = z.object({
  round: z.number().int().nonnegative(),
  type: z.string(),
  description: z.string(),
  actorId: z.string(),
  targetId: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

/** Shared component-qualification metadata block used by both report versions. */
const componentQualificationMetadataSchema = z
  .discriminatedUnion("model", [
    z.object({
      id: z.enum(["component-impact-c1", "component-impact-c2"]),
      configChecksum: z.string().regex(/^[a-f0-9]{16}$/),
      model: z.literal("linear-component-impact"),
    }),
    z.object({
      id: z.literal("component-impact-ab2"),
      configChecksum: z.string().regex(/^[a-f0-9]{16}$/),
      model: z.literal("armour-band-component-impact"),
      bands: z
        .array(
          z.object({
            id: z.string(),
            minArmourInclusive: z.number().int().nonnegative(),
            maxArmourInclusive: z.number().int().nonnegative().nullable(),
            criticalThreshold: z.number().nonnegative(),
            highImpactThreshold: z.number().nonnegative(),
          }),
        )
        .readonly(),
    }),
  ])
  .optional();

/**
 * Fighter final-state facts shared by both report versions: identity, build
 * name, integrity, energy, heat, authoritative component damaged/disabled
 * facts and conditions. Positioning (zone) and cooldowns are version-specific:
 * the event stream cannot reconstruct precise final cooldowns, so the grid v2
 * state summary omits them rather than inventing values.
 */
const fighterStateSummaryCoreSchema = z.object({
  fighterId: z.string(),
  machineName: z.string(),
  integrity: z.number().int().nonnegative(),
  maxIntegrity: z.number().int().positive(),
  energy: z.number().int().nonnegative(),
  heat: z.number().int().nonnegative(),
  mobilityDisabled: z.boolean(),
  weaponDisabled: z.boolean(),
  utilityDisabled: z.boolean(),
  mobilityDamaged: z.boolean(),
  weaponDamaged: z.boolean(),
  utilityDamaged: z.boolean(),
  conditions: z.array(z.enum(["overturned", "immobilised", "overheated", "stunned"])),
});

/** v1 state summary: legacy five-zone values and persisted cooldowns. */
const fighterStateSummaryV1Schema = fighterStateSummaryCoreSchema.extend({
  zone: legacyArenaZoneSchema,
  facing: z.enum(["north", "south", "east", "west"]),
  weaponCooldown: z.number().int().nonnegative(),
  utilityCooldown: z.number().int().nonnegative(),
});

/**
 * v2 state summary: canonical grid zones only (legacy edge values rejected),
 * four cardinal facings, and no cooldown fields — cooldowns are not
 * reconstructable from the authoritative event stream.
 */
const fighterStateSummaryV2Schema = fighterStateSummaryCoreSchema.extend({
  zone: gridZoneSchema,
  facing: z.enum(["north", "south", "east", "west"]),
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

const reportCommonShape = {
  matchId: z.string(),
  componentQualification: componentQualificationMetadataSchema,
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
} as const;

/**
 * Factual match report schema v1 — the persisted legacy compatibility
 * contract. Its accepted JSON shape is frozen: schema version `"1"`, legacy
 * five-zone fighter states, and persisted cooldown fields. It rejects grid-only
 * corner zones. The zone schema is derived from the canonical legacy
 * positioning schema so the five-zone list cannot drift.
 */
export const FactualMatchReportV1Schema = z.object({
  schemaVersion: z.literal("1"),
  ...reportCommonShape,
  finalStates: z.object({
    fighterA: fighterStateSummaryV1Schema,
    fighterB: fighterStateSummaryV1Schema,
  }),
});

/**
 * Factual match report schema v2 — represents an opt-in grid match only. It
 * freezes the grid identity (`simulatorVersion` `0.3.0`, `positioningModel`
 * `grid-3x3-v1`, `rulesetVersion` `0.2.0`, `catalogueVersion` `1`) and accepts
 * only canonical grid zones in fighter-state summaries. Cooldowns are omitted
 * because the event stream cannot reconstruct them authoritatively.
 */
export const FactualMatchReportV2Schema = z.object({
  schemaVersion: z.literal("2"),
  simulatorVersion: z.literal("0.3.0"),
  positioningModel: z.literal(POSITIONING_MODEL_GRID),
  rulesetVersion: z.literal("0.2.0"),
  catalogueVersion: z.literal("1"),
  ...reportCommonShape,
  finalStates: z.object({
    fighterA: fighterStateSummaryV2Schema,
    fighterB: fighterStateSummaryV2Schema,
  }),
});

/**
 * @deprecated Use `FactualMatchReportV1Schema` explicitly. Retained for
 * compatibility with existing callers that treat the legacy report as the only
 * factual-report shape.
 */
export const FactualMatchReportSchema = FactualMatchReportV1Schema;

export type MatchMoment = z.infer<typeof matchMomentSchema>;
export type FighterStateSummary = z.infer<typeof fighterStateSummaryV1Schema>;
export type FighterStateSummaryV2 = z.infer<typeof fighterStateSummaryV2Schema>;
export type FighterMatchSummary = z.infer<typeof fighterMatchSummarySchema>;
export type FactualMatchReportV1 = z.infer<typeof FactualMatchReportV1Schema>;
export type FactualMatchReportV2 = z.infer<typeof FactualMatchReportV2Schema>;
export type AnyFactualMatchReport = FactualMatchReportV1 | FactualMatchReportV2;

/**
 * @deprecated Use `FactualMatchReportV1` explicitly. Retained for compatibility
 * with existing legacy callers.
 */
export type FactualMatchReport = FactualMatchReportV1;

export function isFactualReportV1(
  report: AnyFactualMatchReport,
): report is FactualMatchReportV1 {
  return report.schemaVersion === "1";
}

export function isFactualReportV2(
  report: AnyFactualMatchReport,
): report is FactualMatchReportV2 {
  return report.schemaVersion === "2";
}

export function validateFactualMatchReport(
  data: unknown,
): { ok: true; report: AnyFactualMatchReport } | { ok: false; errors: string } {
  if (typeof data !== "object" || data === null) {
    return { ok: false, errors: "Expected an object" };
  }
  const version = (data as Record<string, unknown>).schemaVersion;

  if (version === "1") {
    const result = FactualMatchReportV1Schema.safeParse(data);
    if (result.success) return { ok: true, report: result.data };
    return { ok: false, errors: result.error.message };
  }

  if (version === "2") {
    const result = FactualMatchReportV2Schema.safeParse(data);
    if (result.success) return { ok: true, report: result.data };
    return { ok: false, errors: result.error.message };
  }

  return {
    ok: false,
    errors: `Unsupported factual report schemaVersion: ${String(version)}`,
  };
}

export function serializeFactualMatchReport(report: AnyFactualMatchReport): string {
  return JSON.stringify(report, null, 2);
}

export function deserializeFactualMatchReport(
  json: string,
): { ok: true; report: AnyFactualMatchReport } | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json);
    return validateFactualMatchReport(data);
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
  }
}
