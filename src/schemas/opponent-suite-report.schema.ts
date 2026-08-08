import { z } from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const safeCountSchema = z
  .number()
  .int()
  .nonnegative()
  .refine(Number.isSafeInteger, "must be a safe integer");
const opponentIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const runtimeSchema = z
  .object({
    simulatorVersion: z.string().min(1),
    positioningModel: z.string().min(1),
  })
  .strict();

const fixtureInventoryEntrySchema = z
  .object({
    opponentId: opponentIdSchema,
    fixtureVersion: z.number().int().positive().refine(Number.isSafeInteger),
    fixtureChecksum: sha256Schema,
    legacyCompatibility: z.enum(["supported", "incompatible"]),
  })
  .strict();

const matchFighterSchema = z
  .object({
    opponentId: opponentIdSchema,
    fixtureVersion: z.number().int().positive().refine(Number.isSafeInteger),
    fixtureChecksum: sha256Schema,
  })
  .strict();

const suiteMatchSchema = z
  .object({
    matchId: z.string().regex(/^opponent-suite-match-v1:[a-f0-9]{64}$/),
    planIndex: z.number().int().positive().refine(Number.isSafeInteger),
    fighterA: matchFighterSchema,
    fighterB: matchFighterSchema,
    runtime: runtimeSchema,
    seed: safeCountSchema,
    winner: opponentIdSchema.nullable(),
    method: z.enum(["destruction", "immobilisation", "judges", "draw"]),
    rounds: safeCountSchema,
    resultChecksum: sha256Schema,
  })
  .strict();

/** Machine-readable Phase 4 run contract consumed by the Phase 5 report. */
export const OpponentSuiteRunV1Schema = z
  .object({
    schemaVersion: z.literal("1"),
    suiteId: z.string().min(1),
    suiteVersion: z.number().int().positive().refine(Number.isSafeInteger),
    suiteChecksum: sha256Schema,
    runtime: runtimeSchema,
    seed: safeCountSchema,
    fixtureInventory: z.array(fixtureInventoryEntrySchema).readonly(),
    runnableOpponentIds: z.array(opponentIdSchema).readonly(),
    incompatibleOpponentIds: z.array(opponentIdSchema).readonly(),
    matches: z.array(suiteMatchSchema).readonly(),
  })
  .strict();

const opponentReportEntrySchema = z
  .object({
    opponentId: opponentIdSchema,
    fixtureVersion: z.number().int().positive().refine(Number.isSafeInteger),
    fixtureChecksum: sha256Schema,
    legacyCompatibility: z.enum(["supported", "incompatible"]),
    executionStatus: z.enum(["executed", "incompatible"]),
    matchesPlayed: safeCountSchema,
    wins: safeCountSchema,
    losses: safeCountSchema,
    draws: safeCountSchema,
    matchIds: z
      .array(z.string().regex(/^opponent-suite-match-v1:[a-f0-9]{64}$/))
      .readonly(),
    methods: z
      .array(z.enum(["destruction", "immobilisation", "judges", "draw"]))
      .readonly(),
    rounds: z.array(safeCountSchema).readonly(),
    resultChecksums: z.array(sha256Schema).readonly(),
  })
  .strict();

/** Versioned factual cross-opponent report contract. */
export const OpponentSuiteReportV1Schema = z
  .object({
    schemaVersion: z.literal("1"),
    reportType: z.literal("factual-opponent-suite"),
    sourceRun: OpponentSuiteRunV1Schema,
    opponents: z.array(opponentReportEntrySchema).readonly(),
  })
  .strict();

export type OpponentSuiteReportContractV1 = z.infer<typeof OpponentSuiteReportV1Schema>;
