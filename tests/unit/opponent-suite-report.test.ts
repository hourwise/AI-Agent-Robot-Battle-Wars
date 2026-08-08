import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildOpponentSuiteReportV1,
  deserializeOpponentSuiteReportV1,
  renderOpponentSuiteReportV1,
  serializeOpponentSuiteReportV1,
  validateOpponentSuiteReportV1,
} from "../../src/reports/opponent-suite-report.js";
import {
  runOpponentSuite,
  OPPONENT_SUITE_V1_LEGACY_PLAN,
  type OpponentSuiteRunV1,
} from "../../src/opponents/opponent-suite-runner.js";
import { CANONICAL_OPPONENT_SUITE_V1 } from "../../src/opponents/opponent-suite-v1.js";

const TEST_SEED = 44002;
let validRun: OpponentSuiteRunV1;

function cloneRun(run: OpponentSuiteRunV1): OpponentSuiteRunV1 {
  return JSON.parse(JSON.stringify(run)) as OpponentSuiteRunV1;
}

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeeplyFrozen(child);
}

beforeAll(async () => {
  validRun = await runOpponentSuite({ runtime: "legacy", seed: TEST_SEED });
});

describe("factual opponent-suite report v1 (0.2D Phase 5)", () => {
  it("generates the complete factual report from a valid Phase 4 run", () => {
    const report = buildOpponentSuiteReportV1(validRun);

    expect(report.schemaVersion).toBe("1");
    expect(report.reportType).toBe("factual-opponent-suite");
    expect(report.sourceRun).toEqual(validRun);
    expect(report.opponents.map((opponent) => opponent.opponentId)).toEqual(
      CANONICAL_OPPONENT_SUITE_V1.map((entry) => entry.opponentId),
    );
    expect(
      report.opponents.filter((opponent) => opponent.executionStatus === "executed"),
    ).toHaveLength(4);
    expect(
      report.opponents
        .filter((opponent) => opponent.executionStatus === "executed")
        .every((opponent) => opponent.matchesPlayed === 6),
    ).toBe(true);
    expect(() => validateOpponentSuiteReportV1(report)).not.toThrow();
  });

  it("binds all runner provenance and fails closed on malformed or inconsistent input", () => {
    const mutations: Array<(run: OpponentSuiteRunV1) => void> = [
      (run) => {
        run.suiteChecksum = "0".repeat(64);
      },
      (run) => {
        run.runtime.positioningModel = "wrong-runtime";
      },
      (run) => {
        run.fixtureInventory[0]!.fixtureChecksum = "1".repeat(64);
      },
      (run) => {
        run.matches[0]!.fighterA.fixtureChecksum = "2".repeat(64);
      },
      (run) => {
        run.matches[0]!.matchId = `opponent-suite-match-v1:${"3".repeat(64)}`;
      },
      (run) => {
        run.matches[0]!.seed = run.seed + 1;
      },
      (run) => {
        run.matches[0]!.winner = "spinner";
      },
      (run) => {
        run.matches[0]!.planIndex = OPPONENT_SUITE_V1_LEGACY_PLAN.length;
      },
    ];

    for (const mutate of mutations) {
      const malformed = cloneRun(validRun);
      mutate(malformed);
      expect(() => buildOpponentSuiteReportV1(malformed)).toThrow();
    }

    const withUnknownField = cloneRun(validRun) as OpponentSuiteRunV1 & {
      unexpected?: string;
    };
    withUnknownField.unexpected = "reject";
    expect(() => buildOpponentSuiteReportV1(withUnknownField)).toThrow();
  });

  it("maps fighter_a and fighter_b outcomes to factual W/L/D counts", () => {
    const synthetic = cloneRun(validRun);
    for (const match of synthetic.matches) {
      match.winner = null;
      match.method = "draw";
    }

    // Bulwark is fighter_a at plan 1/2/3 and fighter_b at plan 4/7/10.
    const outcomes: Record<number, string | null> = {
      1: "bulwark",
      2: "spinner",
      3: null,
      4: "bulwark",
      7: "spinner",
      10: null,
    };
    for (const match of synthetic.matches) {
      if (Object.prototype.hasOwnProperty.call(outcomes, match.planIndex)) {
        const winner = outcomes[match.planIndex]!;
        match.winner = winner;
        match.method = winner === null ? "draw" : "judges";
      }
    }

    const bulwark = buildOpponentSuiteReportV1(synthetic).opponents.find(
      (opponent) => opponent.opponentId === "bulwark",
    )!;
    expect({
      matchesPlayed: bulwark.matchesPlayed,
      wins: bulwark.wins,
      losses: bulwark.losses,
      draws: bulwark.draws,
    }).toEqual({ matchesPlayed: 6, wins: 2, losses: 2, draws: 2 });
    expect(bulwark.matchIds).toEqual(
      synthetic.matches
        .filter(
          (match) =>
            match.fighterA.opponentId === "bulwark" ||
            match.fighterB.opponentId === "bulwark",
        )
        .map((match) => match.matchId),
    );
  });

  it("keeps incompatible fixtures explicit and out of executed facts", () => {
    const report = buildOpponentSuiteReportV1(validRun);
    for (const id of ["skirmisher", "controller"]) {
      const opponent = report.opponents.find((entry) => entry.opponentId === id)!;
      expect(opponent.legacyCompatibility).toBe("incompatible");
      expect(opponent.executionStatus).toBe("incompatible");
      expect(opponent.matchesPlayed).toBe(0);
      expect(opponent.wins).toBe(0);
      expect(opponent.losses).toBe(0);
      expect(opponent.draws).toBe(0);
      expect(opponent.matchIds).toEqual([]);
      expect(opponent.methods).toEqual([]);
      expect(opponent.rounds).toEqual([]);
      expect(opponent.resultChecksums).toEqual([]);
    }
    expect(
      validRun.matches.every(
        (match) =>
          !["skirmisher", "controller"].includes(match.fighterA.opponentId) &&
          !["skirmisher", "controller"].includes(match.fighterB.opponentId),
      ),
    ).toBe(true);
  });

  it("produces byte-identical machine output and deterministic text output", () => {
    const first = buildOpponentSuiteReportV1(validRun);
    const second = buildOpponentSuiteReportV1(validRun);
    expect(serializeOpponentSuiteReportV1(first)).toBe(
      serializeOpponentSuiteReportV1(second),
    );
    expect(renderOpponentSuiteReportV1(first)).toBe(renderOpponentSuiteReportV1(second));
    const roundTrip = deserializeOpponentSuiteReportV1(
      serializeOpponentSuiteReportV1(first),
    );
    expect(roundTrip.ok).toBe(true);
    if (roundTrip.ok) expect(roundTrip.report).toEqual(first);
  });

  it("deeply freezes the report and its preserved run/result structures", () => {
    const report = buildOpponentSuiteReportV1(validRun);
    expectDeeplyFrozen(report);
    expect(() => {
      (report.opponents[0]!.matchIds as string[]).push("tampered");
    }).toThrow();
  });

  it("introduces no provider, runtime-expansion, evidence-access or persistence surface", () => {
    const root = join(__dirname, "..", "..");
    const files = [
      "src/schemas/opponent-suite-report.schema.ts",
      "src/reports/opponent-suite-report.ts",
    ];
    const source = files.map((file) => readFileSync(join(root, file), "utf8")).join("\n");
    for (const forbidden of [
      "runGridMatch",
      "runGridBetaMatch",
      "DeepSeek",
      "provider",
      "benchmark",
      "held-out",
      "readiness",
      "persistence",
      "leaderboard",
      "ranking",
      "tier",
      "balance",
      "difficulty",
      "meta",
      "optimal",
    ]) {
      expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
