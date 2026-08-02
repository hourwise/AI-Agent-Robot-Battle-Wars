import { z } from "zod";
import { MatchRecordV3Schema } from "../schemas/match-record.schema.js";
import { FactualMatchReportV2Schema } from "../schemas/factual-report.schema.js";
import {
  GRID_ACTIVATION_READINESS_RUN_COUNT,
  GRID_ACTIVATION_READINESS_SUITE_ID,
  GRID_ACTIVATION_READINESS_SUITE_ID_V1,
  GRID_ACTIVATION_READINESS_SUITE_ID_V2,
} from "./run-plan.js";

/**
 * Grid activation-readiness artifact envelope schemas (Milestone 0.2C Phase
 * 3E1 / 3E1.1 / 3E1.2).
 *
 * Three JSON envelopes carry the authoritative evaluation artifacts:
 *
 *   - `run-index.json` — exactly 312 ordered run entries (canonical per-run
 *     evidence, checksums and result facts; no replay or prompt text). The
 *     current v3 contract (Phase 3E1.2) adds explicit
 *     `selectedMovementActionCounts` and `selectedCombatActionCounts` derived
 *     from `policy_triggered` events; `actionCounts` explicitly represents
 *     selected movement actions. v2 had the same entry fields under suite
 *     `grid-activation-readiness-v2`; v1 lacked the selected-action fields.
 *   - `match-records.json` — exactly 312 match-record v3 values in run order
 *     (schema v1; artifact meaning unchanged).
 *   - `factual-reports.json` — exactly 312 factual-report v2 values in run
 *     order (schema v1; artifact meaning unchanged).
 *
 * Order and uniqueness are part of the contract: index 0 is run 1, index 311
 * is run 312. Cross-envelope agreement (index, match ID, seed, runtime,
 * scenario/assignment identity, result, rounds, record/report binding) is
 * enforced by the bundle validator.
 *
 * Historical v1 and v2 run-index artifacts remain readable through the
 * version-aware deserializer, but only v3 is accepted as current
 * activation-readiness evidence. Historical selected-action semantics are
 * never silently reinterpreted.
 */
export const GRID_READINESS_RUN_INDEX_FILE = "run-index.json" as const;
export const GRID_READINESS_MATCH_RECORDS_FILE = "match-records.json" as const;
export const GRID_READINESS_FACTUAL_REPORTS_FILE = "factual-reports.json" as const;

const runIndexCommonEntryFields = {
  runNumber: z.number().int().min(1).max(GRID_ACTIVATION_READINESS_RUN_COUNT),
  scenarioId: z.string().min(1),
  assignmentId: z.string().min(1),
  seed: z.number().int().nonnegative().safe(),
  fighterACompetitor: z.enum(["x", "y"]),
  fighterBCompetitor: z.enum(["x", "y"]),
  roleSwapped: z.boolean(),
  matchId: z.string().uuid(),
  recordIndex: z.number().int().min(0),
  reportIndex: z.number().int().min(0),
  winner: z.string().nullable(),
  resultMethod: z.enum(["destruction", "immobilisation", "judges", "draw"]),
  rounds: z.number().int().min(1),
  eventCount: z.number().int().nonnegative(),
  /** v2 contract: selected movement actions from `policy_triggered`. */
  actionCounts: z.record(z.string(), z.number().int().nonnegative()),
  translatedActionCounts: z.record(z.string(), z.number().int().nonnegative()),
  zoneVisits: z.record(z.string(), z.number().int().nonnegative()),
  bearingCounts: z.record(z.string(), z.number().int().nonnegative()),
  exposedPlanarArmourZoneCounts: z.record(z.string(), z.number().int().nonnegative()),
  eventTypeCounts: z.record(z.string(), z.number().int().nonnegative()),
  maximumConsecutiveNoProgressRounds: z.number().int().nonnegative(),
  recordChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  reportChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  textReplayChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  asciiReplayChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  reviewPromptChecksum: z.string().regex(/^[a-f0-9]{64}$/),
};

/** Current v2 run-index entry: adds selected action evidence. */
export const gridActivationReadinessRunIndexEntryV2Schema = z.object({
  ...runIndexCommonEntryFields,
  selectedMovementActionCounts: z.record(z.string(), z.number().int().nonnegative()),
  selectedCombatActionCounts: z.record(z.string(), z.number().int().nonnegative()),
});

/** Historical v1 run-index entry (no selected-action fields). */
export const gridActivationReadinessRunIndexEntryV1Schema = z.object({
  ...runIndexCommonEntryFields,
});

export type GridActivationReadinessRunIndexEntryV2 = z.infer<
  typeof gridActivationReadinessRunIndexEntryV2Schema
>;

export type GridActivationReadinessRunIndexEntryV1 = z.infer<
  typeof gridActivationReadinessRunIndexEntryV1Schema
>;

export type GridActivationReadinessRunIndexEntry =
  GridActivationReadinessRunIndexEntryV2 | GridActivationReadinessRunIndexEntryV1;

function validateRunIndex(
  envelope: {
    schemaVersion: string;
    suiteId: string;
    evaluationId: string;
    items: Array<{
      runNumber: number;
      recordIndex: number;
      reportIndex: number;
      matchId: string;
    }>;
  },
  ctx: z.RefinementCtx,
): void {
  if (envelope.items.length !== GRID_ACTIVATION_READINESS_RUN_COUNT) {
    ctx.addIssue({
      code: "custom",
      message: `run-index must contain exactly ${GRID_ACTIVATION_READINESS_RUN_COUNT} items; found ${envelope.items.length}`,
    });
    return;
  }
  const seenMatchIds = new Set<string>();
  for (const [index, entry] of envelope.items.entries()) {
    if (entry.runNumber !== index + 1) {
      ctx.addIssue({
        code: "custom",
        message: `run-index item ${index} must have runNumber ${index + 1}; found ${entry.runNumber}`,
      });
    }
    if (entry.recordIndex !== index) {
      ctx.addIssue({
        code: "custom",
        message: `run-index item ${index} must have recordIndex ${index}; found ${entry.recordIndex}`,
      });
    }
    if (entry.reportIndex !== index) {
      ctx.addIssue({
        code: "custom",
        message: `run-index item ${index} must have reportIndex ${index}; found ${entry.reportIndex}`,
      });
    }
    if (seenMatchIds.has(entry.matchId)) {
      ctx.addIssue({
        code: "custom",
        message: `run-index duplicate matchId ${entry.matchId} at index ${index}`,
      });
    }
    seenMatchIds.add(entry.matchId);
  }
}

export const GridActivationReadinessRunIndexEnvelopeV3Schema = z
  .object({
    schemaVersion: z.literal("3"),
    suiteId: z.literal(GRID_ACTIVATION_READINESS_SUITE_ID),
    evaluationId: z.string().uuid(),
    items: z.array(gridActivationReadinessRunIndexEntryV2Schema),
  })
  .superRefine(validateRunIndex);

export type GridActivationReadinessRunIndexEnvelopeV3 = z.infer<
  typeof GridActivationReadinessRunIndexEnvelopeV3Schema
>;

/** Historical v2 run-index envelope, retained for historical parsers only. */
export const GridActivationReadinessRunIndexEnvelopeV2Schema = z
  .object({
    schemaVersion: z.literal("2"),
    suiteId: z.literal(GRID_ACTIVATION_READINESS_SUITE_ID_V2),
    evaluationId: z.string().uuid(),
    items: z.array(gridActivationReadinessRunIndexEntryV2Schema),
  })
  .superRefine(validateRunIndex);

export type GridActivationReadinessRunIndexEnvelopeV2 = z.infer<
  typeof GridActivationReadinessRunIndexEnvelopeV2Schema
>;

/** Historical v1 run-index envelope, retained for historical parsers only. */
export const GridActivationReadinessRunIndexEnvelopeV1Schema = z
  .object({
    schemaVersion: z.literal("1"),
    suiteId: z.literal(GRID_ACTIVATION_READINESS_SUITE_ID_V1),
    evaluationId: z.string().uuid(),
    items: z.array(gridActivationReadinessRunIndexEntryV1Schema),
  })
  .superRefine(validateRunIndex);

export type GridActivationReadinessRunIndexEnvelopeV1 = z.infer<
  typeof GridActivationReadinessRunIndexEnvelopeV1Schema
>;

export type GridActivationReadinessRunIndexEnvelope =
  | GridActivationReadinessRunIndexEnvelopeV3
  | GridActivationReadinessRunIndexEnvelopeV2
  | GridActivationReadinessRunIndexEnvelopeV1;

function validateMatchRecordsEnvelope(
  envelope: z.infer<typeof GridActivationReadinessMatchRecordsEnvelopeSchema>,
  ctx: z.RefinementCtx,
): void {
  if (envelope.items.length !== GRID_ACTIVATION_READINESS_RUN_COUNT) {
    ctx.addIssue({
      code: "custom",
      message: `match-records must contain exactly ${GRID_ACTIVATION_READINESS_RUN_COUNT} items; found ${envelope.items.length}`,
    });
    return;
  }
  const seen = new Set<string>();
  for (const [index, record] of envelope.items.entries()) {
    if (seen.has(record.matchId)) {
      ctx.addIssue({
        code: "custom",
        message: `match-records duplicate matchId ${record.matchId} at index ${index}`,
      });
    }
    seen.add(record.matchId);
  }
}

export const GridActivationReadinessMatchRecordsEnvelopeSchema = z
  .object({
    schemaVersion: z.literal("1"),
    evaluationId: z.string().uuid(),
    items: z.array(MatchRecordV3Schema),
  })
  .superRefine(validateMatchRecordsEnvelope);

export type GridActivationReadinessMatchRecordsEnvelope = z.infer<
  typeof GridActivationReadinessMatchRecordsEnvelopeSchema
>;

function validateFactualReportsEnvelope(
  envelope: z.infer<typeof GridActivationReadinessFactualReportsEnvelopeSchema>,
  ctx: z.RefinementCtx,
): void {
  if (envelope.items.length !== GRID_ACTIVATION_READINESS_RUN_COUNT) {
    ctx.addIssue({
      code: "custom",
      message: `factual-reports must contain exactly ${GRID_ACTIVATION_READINESS_RUN_COUNT} items; found ${envelope.items.length}`,
    });
    return;
  }
  const seen = new Set<string>();
  for (const [index, report] of envelope.items.entries()) {
    if (report.matchId === "pending") {
      ctx.addIssue({
        code: "custom",
        message: `factual-reports index ${index} still uses matchId "pending"`,
      });
    }
    if (seen.has(report.matchId)) {
      ctx.addIssue({
        code: "custom",
        message: `factual-reports duplicate matchId ${report.matchId} at index ${index}`,
      });
    }
    seen.add(report.matchId);
  }
}

export const GridActivationReadinessFactualReportsEnvelopeSchema = z
  .object({
    schemaVersion: z.literal("1"),
    evaluationId: z.string().uuid(),
    items: z.array(FactualMatchReportV2Schema),
  })
  .superRefine(validateFactualReportsEnvelope);

export type GridActivationReadinessFactualReportsEnvelope = z.infer<
  typeof GridActivationReadinessFactualReportsEnvelopeSchema
>;

export function serializeGridActivationReadinessEnvelope(envelope: unknown): string {
  return JSON.stringify(envelope, null, 2);
}

/**
 * Version-aware run-index deserializer. Reads the current v3 contract and the
 * historical v2 and v1 contracts. `schemaVersion` distinguishes them; only
 * v3 is accepted as current activation-readiness evidence.
 */
export function deserializeGridActivationReadinessRunIndex(json: string):
  | {
      ok: true;
      envelope: GridActivationReadinessRunIndexEnvelope;
      schemaVersion: "1" | "2" | "3";
    }
  | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json) as unknown;
    const v3 = GridActivationReadinessRunIndexEnvelopeV3Schema.safeParse(data);
    if (v3.success) return { ok: true, envelope: v3.data, schemaVersion: "3" };
    const v2 = GridActivationReadinessRunIndexEnvelopeV2Schema.safeParse(data);
    if (v2.success) return { ok: true, envelope: v2.data, schemaVersion: "2" };
    const v1 = GridActivationReadinessRunIndexEnvelopeV1Schema.safeParse(data);
    if (v1.success) return { ok: true, envelope: v1.data, schemaVersion: "1" };
    return {
      ok: false,
      errors: `run-index matched neither v3 (${v3.error.message}) nor v2 (${v2.error.message}) nor v1 (${v1.error.message})`,
    };
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
  }
}

export function deserializeGridActivationReadinessMatchRecords(
  json: string,
):
  | { ok: true; envelope: GridActivationReadinessMatchRecordsEnvelope }
  | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json) as unknown;
    const result = GridActivationReadinessMatchRecordsEnvelopeSchema.safeParse(data);
    if (result.success) return { ok: true, envelope: result.data };
    return { ok: false, errors: result.error.message };
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
  }
}

export function deserializeGridActivationReadinessFactualReports(
  json: string,
):
  | { ok: true; envelope: GridActivationReadinessFactualReportsEnvelope }
  | { ok: false; errors: string } {
  try {
    const data = JSON.parse(json) as unknown;
    const result = GridActivationReadinessFactualReportsEnvelopeSchema.safeParse(data);
    if (result.success) return { ok: true, envelope: result.data };
    return { ok: false, errors: result.error.message };
  } catch (e) {
    return { ok: false, errors: e instanceof SyntaxError ? e.message : String(e) };
  }
}
