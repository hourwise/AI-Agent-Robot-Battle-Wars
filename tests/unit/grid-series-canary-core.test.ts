import { describe, expect, it } from "vitest";
import { executeGridSeriesCanary } from "../../src/canary/grid-series-canary-core.js";
import { isV3Record } from "../../src/schemas/match-record.schema.js";
import { isFactualReportV2 } from "../../src/schemas/factual-report.schema.js";

const IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];
const SERIES_ID = "44444444-4444-4444-8444-444444444444";

function runCore(baseSeed = 5) {
  return executeGridSeriesCanary({
    baseSeed,
    seriesId: SERIES_ID,
    matchIdentities: IDS.map((matchId) => ({
      matchId,
      createdAt: "2024-06-01T00:00:00.000Z",
    })),
  });
}

describe("grid series canary pure core (Phase 3D2B)", () => {
  it("executes exactly three matches with full evidence", () => {
    const outcome = runCore();
    expect(outcome.matches).toHaveLength(3);
    expect(outcome.evidence.matchCount).toBe(3);
    expect(outcome.evidence).toEqual({
      matchCount: 3,
      allMatchesTerminated: true,
      allMatchRecordsV3: true,
      allFactualReportsV2: true,
      allReportsBoundToRecords: true,
      allFallbackReviewsValid: true,
      allReplayFinalStatesAgree: true,
      allMovementZonesCanonical: true,
      translatedGridMovementObserved: true,
      combatAttemptObserved: true,
      policyAdaptationCount: 2,
      adaptationFactsAgree: true,
    });
  });

  it("uses the sequential seed plan", () => {
    const outcome = runCore(9);
    expect(outcome.matches.map((m) => m.seed)).toEqual([9, 10, 11]);
  });

  it("produces v3 records and v2 bound reports with injected identities", () => {
    const outcome = runCore();
    for (const [index, match] of outcome.matches.entries()) {
      expect(isV3Record(match.record)).toBe(true);
      expect(isFactualReportV2(match.report)).toBe(true);
      expect(match.record.matchId).toBe(IDS[index]);
      expect(match.record.createdAt).toBe("2024-06-01T00:00:00.000Z");
      expect(match.report.matchId).toBe(IDS[index]);
      expect(match.report.seed).toBe(match.seed);
      expect(match.record.result.winner).toBe(match.winner);
      expect(match.record.rounds).toBe(match.rounds);
      expect(match.record.events.length).toBe(match.eventCount);
    }
  });

  it("terminates every match within the round cap", () => {
    const outcome = runCore();
    for (const match of outcome.matches) {
      expect(match.rounds).toBeGreaterThanOrEqual(0);
      expect(match.rounds).toBeLessThanOrEqual(20);
    }
  });

  it("applies exactly two adaptations and chains policies", () => {
    const outcome = runCore();
    expect(outcome.adaptations).toHaveLength(2);
    expect(outcome.adaptations[0].sourceMatchNumber).toBe(1);
    expect(outcome.adaptations[1].sourceMatchNumber).toBe(2);
    // match 2 uses the adaptation-1 policy; match 3 uses the adaptation-2 policy.
    expect(outcome.matches[1].policyBefore).toEqual(outcome.adaptations[0].policyAfter);
    expect(outcome.matches[2].policyBefore).toEqual(outcome.adaptations[1].policyAfter);
    expect(outcome.matches[0].nextPolicy).toEqual(outcome.adaptations[0].policyAfter);
    expect(outcome.matches[1].nextPolicy).toEqual(outcome.adaptations[1].policyAfter);
    expect(outcome.matches[2].nextPolicy).toBeNull();
    // No build change: all builds are the Bulwark proposal.
    const firstBuild = JSON.stringify(
      outcome.matches[0].record.config.fighterA.build.proposal,
    );
    for (const match of outcome.matches) {
      expect(JSON.stringify(match.record.config.fighterA.build.proposal)).toBe(
        firstBuild,
      );
    }
  });

  it("is fully deterministic on re-execution", () => {
    const first = runCore(7);
    const second = runCore(7);
    expect(JSON.stringify(first.matches.map((m) => m.serializedRecord))).toBe(
      JSON.stringify(second.matches.map((m) => m.serializedRecord)),
    );
    expect(JSON.stringify(first.matches.map((m) => m.serializedReport))).toBe(
      JSON.stringify(second.matches.map((m) => m.serializedReport)),
    );
    expect(first.serializedAdaptationTrace).toBe(second.serializedAdaptationTrace);
    expect(JSON.stringify(first.evidence)).toBe(JSON.stringify(second.evidence));
  });

  it("does not mutate its input identities", () => {
    const identities = IDS.map((matchId) => ({
      matchId,
      createdAt: "2024-06-01T00:00:00.000Z",
    }));
    const before = JSON.stringify(identities);
    executeGridSeriesCanary({
      baseSeed: 5,
      seriesId: SERIES_ID,
      matchIdentities: identities,
    });
    expect(JSON.stringify(identities)).toBe(before);
  });

  it("rejects duplicate or invalid identities", () => {
    expect(() =>
      executeGridSeriesCanary({
        baseSeed: 5,
        seriesId: SERIES_ID,
        matchIdentities: [IDS[0], IDS[0], IDS[2]].map((matchId) => ({
          matchId,
          createdAt: "2024-06-01T00:00:00.000Z",
        })),
      }),
    ).toThrow(/unique/);

    expect(() =>
      executeGridSeriesCanary({
        baseSeed: 5,
        seriesId: SERIES_ID,
        matchIdentities: ["not-a-uuid", IDS[1], IDS[2]].map((matchId) => ({
          matchId,
          createdAt: "2024-06-01T00:00:00.000Z",
        })),
      }),
    ).toThrow(/valid UUID/);

    expect(() =>
      executeGridSeriesCanary({
        baseSeed: 5,
        seriesId: "not-a-uuid",
        matchIdentities: IDS.map((matchId) => ({
          matchId,
          createdAt: "2024-06-01T00:00:00.000Z",
        })),
      }),
    ).toThrow(/valid UUID/);
  });

  it("rejects an invalid base seed", () => {
    expect(() =>
      executeGridSeriesCanary({
        baseSeed: -1,
        seriesId: SERIES_ID,
        matchIdentities: IDS.map((matchId) => ({
          matchId,
          createdAt: "2024-06-01T00:00:00.000Z",
        })),
      }),
    ).toThrow(/non-negative/);
  });

  it("observes at least one translated grid movement and one attack", () => {
    // These evidence flags are derived from the real event streams; the core
    // fails closed if absent, so reaching a result proves both occurred.
    const outcome = runCore();
    expect(outcome.evidence.translatedGridMovementObserved).toBe(true);
    expect(outcome.evidence.combatAttemptObserved).toBe(true);
  });
});
