import { z } from "zod";

export const MatchRecordSchema = z.object({
  schemaVersion: z.literal("1"),
  matchId: z.string().uuid(),
  createdAt: z.string().datetime(),
  rulesetVersion: z.string(),
  catalogueVersion: z.string(),
  simulatorVersion: z.string(),
  seed: z.number().int().min(0),
  config: z.object({
    fighterA: z.object({
      build: z.unknown(),
      policy: z.unknown(),
    }),
    fighterB: z.object({
      build: z.unknown(),
      policy: z.unknown(),
    }),
  }),
  initialState: z.object({
    fighterA: z.unknown(),
    fighterB: z.unknown(),
  }),
  events: z.array(z.unknown()),
  result: z.unknown(),
  rounds: z.number().int().min(0),
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
