import {
  OpponentSuiteRunV1Schema,
  OpponentSuiteReportV1Schema,
} from "../schemas/opponent-suite-report.schema.js";
import type { OpponentSuiteRunV1 } from "../opponents/opponent-suite-runner.js";
import {
  OPPONENT_SUITE_V1_LEGACY_PLAN,
  opponentSuiteMatchId,
} from "../opponents/opponent-suite-runner.js";
import {
  CANONICAL_OPPONENT_SUITE_V1,
  OPPONENT_SUITE_ID,
  OPPONENT_SUITE_LEGACY_RUNTIME,
  OPPONENT_SUITE_V1_CHECKSUM,
  OPPONENT_SUITE_V1_INCOMPATIBLE_OPPONENT_IDS,
  OPPONENT_SUITE_V1_RUNNABLE_OPPONENT_IDS,
  OPPONENT_SUITE_VERSION,
} from "../opponents/opponent-suite-v1.js";
import { LEGACY_RUNTIME_IDENTITY } from "../simulator/runtime-identity.js";

export interface OpponentSuiteOpponentReportV1 {
  readonly opponentId: string;
  readonly fixtureVersion: number;
  readonly fixtureChecksum: string;
  readonly legacyCompatibility: "supported" | "incompatible";
  readonly executionStatus: "executed" | "incompatible";
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly matchIds: readonly string[];
  readonly methods: readonly string[];
  readonly rounds: readonly number[];
  readonly resultChecksums: readonly string[];
}

export interface OpponentSuiteReportV1 {
  readonly schemaVersion: "1";
  readonly reportType: "factual-opponent-suite";
  readonly sourceRun: OpponentSuiteRunV1;
  readonly opponents: readonly OpponentSuiteOpponentReportV1[];
}

export class OpponentSuiteReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpponentSuiteReportError";
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => deepEqual(value, b[index]));
  }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord).sort();
    const bKeys = Object.keys(bRecord).sort();
    return (
      aKeys.length === bKeys.length &&
      aKeys.every(
        (key, index) => key === bKeys[index] && deepEqual(aRecord[key], bRecord[key]),
      )
    );
  }
  return false;
}

function fail(message: string): never {
  throw new OpponentSuiteReportError(message);
}

function assertSame(label: string, actual: unknown, expected: unknown): void {
  if (!deepEqual(actual, expected)) {
    fail(`${label} disagrees with the canonical Phase 4 contract`);
  }
}

function cloneRun(run: OpponentSuiteRunV1): OpponentSuiteRunV1 {
  return {
    schemaVersion: run.schemaVersion,
    suiteId: run.suiteId,
    suiteVersion: run.suiteVersion,
    suiteChecksum: run.suiteChecksum,
    runtime: { ...run.runtime },
    seed: run.seed,
    fixtureInventory: run.fixtureInventory.map((entry) => ({ ...entry })),
    runnableOpponentIds: [...run.runnableOpponentIds],
    incompatibleOpponentIds: [...run.incompatibleOpponentIds],
    matches: run.matches.map((match) => ({
      matchId: match.matchId,
      planIndex: match.planIndex,
      fighterA: { ...match.fighterA },
      fighterB: { ...match.fighterB },
      runtime: { ...match.runtime },
      seed: match.seed,
      winner: match.winner,
      method: match.method,
      rounds: match.rounds,
      resultChecksum: match.resultChecksum,
    })),
  };
}

function canonicalInventory() {
  return CANONICAL_OPPONENT_SUITE_V1.map((entry) => ({
    opponentId: entry.opponentId,
    fixtureVersion: entry.fixtureVersion,
    fixtureChecksum: entry.fixtureChecksum,
    legacyCompatibility: entry.legacyCompatibility,
  }));
}

function validateRunContract(run: OpponentSuiteRunV1): void {
  if (run.suiteId !== OPPONENT_SUITE_ID) {
    fail(`source run suiteId ${JSON.stringify(run.suiteId)} is not the canonical suite`);
  }
  if (run.suiteVersion !== OPPONENT_SUITE_VERSION) {
    fail(`source run suiteVersion ${run.suiteVersion} is not the canonical version`);
  }
  if (run.suiteChecksum !== OPPONENT_SUITE_V1_CHECKSUM) {
    fail("source run suiteChecksum is not the canonical suite checksum");
  }
  assertSame("source run runtime", run.runtime, LEGACY_RUNTIME_IDENTITY);
  assertSame("source run fixture inventory", run.fixtureInventory, canonicalInventory());
  assertSame("source run runnableOpponentIds", run.runnableOpponentIds, [
    ...OPPONENT_SUITE_V1_RUNNABLE_OPPONENT_IDS,
  ]);
  assertSame("source run incompatibleOpponentIds", run.incompatibleOpponentIds, [
    ...OPPONENT_SUITE_V1_INCOMPATIBLE_OPPONENT_IDS,
  ]);

  const inventoryById = new Map(
    run.fixtureInventory.map((entry) => [entry.opponentId, entry]),
  );
  if (run.matches.length !== OPPONENT_SUITE_V1_LEGACY_PLAN.length) {
    fail(
      `source run reports ${run.matches.length} matches; expected ${OPPONENT_SUITE_V1_LEGACY_PLAN.length}`,
    );
  }

  for (const [index, match] of run.matches.entries()) {
    const plan = OPPONENT_SUITE_V1_LEGACY_PLAN[index]!;
    const inventoryA = inventoryById.get(plan.fighterA);
    const inventoryB = inventoryById.get(plan.fighterB);
    if (!inventoryA || !inventoryB) {
      fail(`source run plan ${plan.planIndex} references an unknown fixture`);
    }
    if (match.planIndex !== plan.planIndex) {
      fail(`source run match ${index} has an inconsistent planIndex`);
    }
    assertSame(`source run match ${index} fighterA`, match.fighterA, {
      opponentId: inventoryA.opponentId,
      fixtureVersion: inventoryA.fixtureVersion,
      fixtureChecksum: inventoryA.fixtureChecksum,
    });
    assertSame(`source run match ${index} fighterB`, match.fighterB, {
      opponentId: inventoryB.opponentId,
      fixtureVersion: inventoryB.fixtureVersion,
      fixtureChecksum: inventoryB.fixtureChecksum,
    });
    assertSame(
      `source run match ${index} runtime`,
      match.runtime,
      LEGACY_RUNTIME_IDENTITY,
    );
    if (match.seed !== run.seed) {
      fail(`source run match ${index} seed disagrees with the run seed`);
    }
    const expectedMatchId = opponentSuiteMatchId({
      suiteId: run.suiteId,
      suiteVersion: run.suiteVersion,
      runtime: OPPONENT_SUITE_LEGACY_RUNTIME,
      seed: run.seed,
      planIndex: match.planIndex,
      fighterA: match.fighterA,
      fighterB: match.fighterB,
    });
    if (match.matchId !== expectedMatchId) {
      fail(`source run match ${index} matchId is not bound to its provenance`);
    }
    if (match.winner !== null && !run.runnableOpponentIds.includes(match.winner)) {
      fail(`source run match ${index} winner is not a runnable opponent identity`);
    }
    if (
      match.winner !== null &&
      match.winner !== match.fighterA.opponentId &&
      match.winner !== match.fighterB.opponentId
    ) {
      fail(`source run match ${index} winner is not one of its fighter identities`);
    }
    if (match.winner === null && match.method !== "judges" && match.method !== "draw") {
      fail(`source run match ${index} has a null winner with method ${match.method}`);
    }
    if (match.winner !== null && match.method === "draw") {
      fail(`source run match ${index} has a winner with draw method`);
    }
  }
}

/** Validates a Phase 4 run and returns an independent deeply frozen copy. */
export function validateOpponentSuiteRunV1(input: unknown): OpponentSuiteRunV1 {
  const parsed = OpponentSuiteRunV1Schema.safeParse(input);
  if (!parsed.success) {
    fail(`Phase 4 run schema validation failed: ${parsed.error.message}`);
  }
  const run = parsed.data as unknown as OpponentSuiteRunV1;
  validateRunContract(run);
  return deepFreeze(cloneRun(run));
}

function resultForOpponent(
  opponentId: string,
  match: OpponentSuiteRunV1["matches"][number],
): "win" | "loss" | "draw" {
  if (match.winner === null) return "draw";
  return match.winner === opponentId ? "win" : "loss";
}

function buildOpponentFacts(
  run: OpponentSuiteRunV1,
): readonly OpponentSuiteOpponentReportV1[] {
  return CANONICAL_OPPONENT_SUITE_V1.map((fixture) => {
    if (fixture.legacyCompatibility === "incompatible") {
      return {
        opponentId: fixture.opponentId,
        fixtureVersion: fixture.fixtureVersion,
        fixtureChecksum: fixture.fixtureChecksum,
        legacyCompatibility: fixture.legacyCompatibility,
        executionStatus: "incompatible",
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        matchIds: [],
        methods: [],
        rounds: [],
        resultChecksums: [],
      };
    }

    const matches = run.matches.filter(
      (match) =>
        match.fighterA.opponentId === fixture.opponentId ||
        match.fighterB.opponentId === fixture.opponentId,
    );
    const results = matches.map((match) => resultForOpponent(fixture.opponentId, match));
    return {
      opponentId: fixture.opponentId,
      fixtureVersion: fixture.fixtureVersion,
      fixtureChecksum: fixture.fixtureChecksum,
      legacyCompatibility: fixture.legacyCompatibility,
      executionStatus: "executed",
      matchesPlayed: matches.length,
      wins: results.filter((result) => result === "win").length,
      losses: results.filter((result) => result === "loss").length,
      draws: results.filter((result) => result === "draw").length,
      matchIds: matches.map((match) => match.matchId),
      methods: matches.map((match) => match.method),
      rounds: matches.map((match) => match.rounds),
      resultChecksums: matches.map((match) => match.resultChecksum),
    };
  });
}

function normalizeReport(
  sourceRun: OpponentSuiteRunV1,
  opponents: readonly OpponentSuiteOpponentReportV1[],
): OpponentSuiteReportV1 {
  return {
    schemaVersion: "1",
    reportType: "factual-opponent-suite",
    sourceRun: cloneRun(sourceRun),
    opponents: opponents.map((opponent) => ({
      ...opponent,
      matchIds: [...opponent.matchIds],
      methods: [...opponent.methods],
      rounds: [...opponent.rounds],
      resultChecksums: [...opponent.resultChecksums],
    })),
  };
}

/** Validates a report and all of its derived facts, returning an immutable copy. */
export function validateOpponentSuiteReportV1(input: unknown): OpponentSuiteReportV1 {
  const parsed = OpponentSuiteReportV1Schema.safeParse(input);
  if (!parsed.success) {
    fail(`opponent-suite report schema validation failed: ${parsed.error.message}`);
  }
  const report = parsed.data as unknown as OpponentSuiteReportV1;
  const sourceRun = validateOpponentSuiteRunV1(report.sourceRun);
  const expectedOpponents = buildOpponentFacts(sourceRun);
  assertSame("report opponent facts", report.opponents, expectedOpponents);
  return deepFreeze(normalizeReport(sourceRun, expectedOpponents));
}

/** Builds the Phase 5 factual report from one valid Phase 4 run only. */
export function buildOpponentSuiteReportV1(
  run: OpponentSuiteRunV1,
): OpponentSuiteReportV1 {
  const sourceRun = validateOpponentSuiteRunV1(run);
  const opponents = buildOpponentFacts(sourceRun);
  const report = normalizeReport(sourceRun, opponents);
  const parsed = OpponentSuiteReportV1Schema.safeParse(report);
  if (!parsed.success) {
    fail(`generated opponent-suite report failed its schema: ${parsed.error.message}`);
  }
  return deepFreeze(report);
}

/** Stable pretty-printed JSON bytes for the machine-readable report contract. */
export function serializeOpponentSuiteReportV1(report: OpponentSuiteReportV1): string {
  return JSON.stringify(validateOpponentSuiteReportV1(report), null, 2);
}

export function deserializeOpponentSuiteReportV1(text: string):
  | { readonly ok: true; readonly report: OpponentSuiteReportV1 }
  | {
      readonly ok: false;
      readonly errors: string;
    } {
  try {
    return { ok: true, report: validateOpponentSuiteReportV1(JSON.parse(text)) };
  } catch (error) {
    return {
      ok: false,
      errors: error instanceof Error ? error.message : String(error),
    };
  }
}

export function isOpponentSuiteReportV1(input: unknown): input is OpponentSuiteReportV1 {
  try {
    validateOpponentSuiteReportV1(input);
    return true;
  } catch {
    return false;
  }
}

/** Deterministic human-readable rendering of the same factual report. */
export function renderOpponentSuiteReportV1(report: OpponentSuiteReportV1): string {
  const valid = validateOpponentSuiteReportV1(report);
  const lines = [
    "FACTUAL OPPONENT SUITE REPORT V1",
    `Suite: ${valid.sourceRun.suiteId} v${valid.sourceRun.suiteVersion}`,
    `Suite checksum: ${valid.sourceRun.suiteChecksum}`,
    `Runtime: ${valid.sourceRun.runtime.simulatorVersion} (${valid.sourceRun.runtime.positioningModel})`,
    `Seed: ${valid.sourceRun.seed}`,
    "",
    "OPPONENTS (canonical suite order):",
  ];

  for (const opponent of valid.opponents) {
    lines.push(
      `- ${opponent.opponentId}: fixture v${opponent.fixtureVersion} ${opponent.fixtureChecksum} | compatibility=${opponent.legacyCompatibility} | status=${opponent.executionStatus}`,
    );
    lines.push(
      `  matches=${opponent.matchesPlayed} wins=${opponent.wins} losses=${opponent.losses} draws=${opponent.draws}`,
    );
    for (let index = 0; index < opponent.matchIds.length; index++) {
      lines.push(
        `  match=${opponent.matchIds[index]} method=${opponent.methods[index]} rounds=${opponent.rounds[index]} resultChecksum=${opponent.resultChecksums[index]}`,
      );
    }
  }

  lines.push("", "MATCH RECORDS (runner order):");
  for (const match of valid.sourceRun.matches) {
    lines.push(
      `- plan=${match.planIndex} match=${match.matchId} ${match.fighterA.opponentId} (fighter_a) vs ${match.fighterB.opponentId} (fighter_b) winner=${match.winner ?? "draw"} method=${match.method} rounds=${match.rounds} resultChecksum=${match.resultChecksum}`,
    );
  }
  return lines.join("\n");
}
