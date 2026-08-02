import { describe, expect, it } from "vitest";
import { executeGridSeriesCanary } from "../../src/canary/grid-series-canary-core.js";
import { buildGridSeriesCanarySeriesRecord } from "../../src/canary/grid-series-canary-series.js";
import { buildGridSeriesCanaryReport } from "../../src/canary/grid-series-canary-report.js";
import {
  validateGridSeriesCanaryBundle,
  GridSeriesCanaryBundleError,
  type GridSeriesCanaryBundleValidationInput,
} from "../../src/canary/grid-series-canary-bundle.js";
import { serializeGridSeriesCanaryEnvelope } from "../../src/schemas/grid-series-canary-envelopes.schema.js";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import { serializeGridSeriesCanarySeriesRecord } from "../../src/canary/grid-series-canary-series.js";
import { buildGridSeriesCanaryManifest } from "../../src/app/grid-series-canary.js";
import { formatSeriesCanaryScoreLine } from "../../src/canary/grid-series-canary-report.js";

const IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];
const SERIES_ID = "44444444-4444-4444-8444-444444444444";
const CANARY_ID = "55555555-5555-4555-8555-555555555555";
const CREATED_AT = "2024-06-01T00:00:00.000Z";
const BASE_SEED = 5;

function buildInput(): {
  input: GridSeriesCanaryBundleValidationInput;
  outcome: ReturnType<typeof executeGridSeriesCanary>;
} {
  const outcome = executeGridSeriesCanary({
    baseSeed: BASE_SEED,
    seriesId: SERIES_ID,
    matchIdentities: IDS.map((matchId) => ({
      matchId,
      createdAt: CREATED_AT,
    })),
  });
  const series = buildGridSeriesCanarySeriesRecord({
    seriesId: SERIES_ID,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    matches: outcome.matches,
  });
  const seriesReport = buildGridSeriesCanaryReport(series);

  const matchesEnvelope = {
    schemaVersion: "1",
    seriesId: SERIES_ID,
    items: outcome.matches.map((match) => match.record),
  };
  const factualReportsEnvelope = {
    schemaVersion: "1",
    seriesId: SERIES_ID,
    items: outcome.matches.map((match) => match.report),
  };
  const fallbackReviewsEnvelope = {
    schemaVersion: "1",
    seriesId: SERIES_ID,
    items: outcome.matches.map((match) => ({
      matchNumber: match.matchNumber,
      matchId: match.matchId,
      review: match.fallbackReview,
    })),
  };
  const matchArtifactsEnvelope = {
    schemaVersion: "1",
    seriesId: SERIES_ID,
    items: outcome.matches.map((match) => ({
      matchNumber: match.matchNumber,
      matchId: match.matchId,
      textReplay: match.textReplay,
      asciiReplay: match.asciiReplay,
      reviewPrompt: match.reviewPrompt,
    })),
  };

  const serializedSeries = serializeGridSeriesCanarySeriesRecord(series);
  const serializedMatches = serializeGridSeriesCanaryEnvelope(matchesEnvelope);
  const serializedFactualReports =
    serializeGridSeriesCanaryEnvelope(factualReportsEnvelope);
  const serializedFallbackReviews = serializeGridSeriesCanaryEnvelope(
    fallbackReviewsEnvelope,
  );
  const serializedMatchArtifacts =
    serializeGridSeriesCanaryEnvelope(matchArtifactsEnvelope);
  const serializedAdaptationTrace = outcome.serializedAdaptationTrace;

  const manifest = buildGridSeriesCanaryManifest({
    canaryId: CANARY_ID,
    seriesId: SERIES_ID,
    createdAt: CREATED_AT,
    baseSeed: BASE_SEED,
    seeds: [BASE_SEED, BASE_SEED + 1, BASE_SEED + 2],
    outcome,
    digests: {
      series: sha256Hex(serializedSeries),
      matches: sha256Hex(serializedMatches),
      factualReports: sha256Hex(serializedFactualReports),
      fallbackReviews: sha256Hex(serializedFallbackReviews),
      matchArtifacts: sha256Hex(serializedMatchArtifacts),
      adaptationTrace: sha256Hex(serializedAdaptationTrace),
      seriesReport: sha256Hex(seriesReport),
    },
  });

  return {
    outcome,
    input: {
      manifest,
      series,
      matchesEnvelope,
      factualReportsEnvelope,
      fallbackReviewsEnvelope,
      matchArtifactsEnvelope,
      adaptationTrace: outcome.adaptationTrace,
      seriesReport,
      serializedSeries,
      serializedMatches,
      serializedFactualReports,
      serializedFallbackReviews,
      serializedMatchArtifacts,
      serializedAdaptationTrace,
    },
  };
}

describe("grid series canary bundle validator (Phase 3D2B)", () => {
  it("accepts a complete, self-consistent bundle", () => {
    const { input } = buildInput();
    const result = validateGridSeriesCanaryBundle(input);
    expect(result.seriesId).toBe(SERIES_ID);
    expect(result.baseSeed).toBe(BASE_SEED);
    expect(result.matchIds).toEqual(IDS);
    expect(result.digestAgreement).toBe(true);
  });

  it("rejects a digest mismatch", () => {
    const { input } = buildInput();
    input.manifest.digests.series = "0".repeat(64);
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/digest mismatch/);
  });

  it("rejects a corrupted series record that no longer matches the matches", () => {
    const { input } = buildInput();
    input.series.score = { aiWins: 99, bulwarkWins: 0, draws: 0 };
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/score/);
  });

  it("rejects a mismatched winner between record and report", () => {
    const { input } = buildInput();
    input.factualReportsEnvelope.items = [
      input.factualReportsEnvelope.items[0],
      {
        ...input.factualReportsEnvelope.items[1],
        winner:
          input.factualReportsEnvelope.items[1].winner === "fighter_a"
            ? "fighter_b"
            : "fighter_a",
      },
      input.factualReportsEnvelope.items[2],
    ];
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/winner/);
  });

  it("rejects a broken next-policy chain", () => {
    const { input } = buildInput();
    const entry = input.series.entries[0];
    if (entry.nextPolicy) entry.nextPolicy.aggression = 50;
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/nextPolicy/);
  });

  it("rejects an adaptation source mismatch", () => {
    const { input } = buildInput();
    input.adaptationTrace.transitions[0].sourceMatchId = IDS[2];
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/source match/);
  });

  it("rejects a series report missing the canary/non-benchmark markers", () => {
    const { input } = buildInput();
    input.seriesReport = "Record: x 2 — The Bulwark 1 (0 draws)\n3 matches";
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/canary/);
    input.seriesReport = "FORGE CANARY REPORT\nRecord: x 2 — The Bulwark 1\n3 matches";
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/non-benchmark/);
  });

  it("rejects a series report containing a win rate", () => {
    const { input } = buildInput();
    input.seriesReport = `${input.seriesReport}\nWin rate: 66.7%`;
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/win rates/);
  });

  it("rejects non-zero usage", () => {
    const { input } = buildInput();
    input.series.totalUsage.recordCount = 1;
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/totalUsage/);
  });

  it("rejects a build change across the series", () => {
    const { input } = buildInput();
    const entry = input.series.entries[1];
    entry.designBeforeMatch = {
      ...entry.designBeforeMatch,
      machineName: "Changed",
    };
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/designBeforeMatch/);
  });

  it("rejects a mismatched match ID ordering across envelopes", () => {
    const { input } = buildInput();
    const item = input.matchesEnvelope.items[1];
    item.matchId = "99999999-9999-4999-8999-999999999999";
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(
      GridSeriesCanaryBundleError,
    );
  });

  it("rejects text replay missing its completion marker", () => {
    const { input } = buildInput();
    input.matchArtifactsEnvelope.items[0].textReplay = "incomplete replay";
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(
      /lacks the required content marker/,
    );
  });

  it("never mutates its inputs", () => {
    const { input } = buildInput();
    const before = JSON.stringify(input);
    validateGridSeriesCanaryBundle(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("grid series canary bundle provenance hardening (Phase 3D2B.1)", () => {
  it("rejects an entry factual report that differs from the report envelope", () => {
    const { input } = buildInput();
    const entry = input.series.entries[1];
    entry.factualReport = { ...entry.factualReport, seed: entry.factualReport.seed + 1 };
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(
      /does not equal the factual-reports envelope report/,
    );
  });

  it("rejects an entry review that differs from the fallback-review envelope", () => {
    const { input } = buildInput();
    const entry = input.series.entries[1];
    if (entry.review) {
      entry.review = { ...entry.review, confidence: "medium" };
    }
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(
      /does not equal the fallback-reviews envelope review/,
    );
  });

  it("rejects an entry match summary timestamp that differs from the record", () => {
    const { input } = buildInput();
    input.series.entries[1].match.createdAt = "2020-01-01T00:00:00.000Z";
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/createdAt/);
  });

  it("rejects an entry design that differs from the actual record build", () => {
    const { input } = buildInput();
    const entry = input.series.entries[1];
    entry.designBeforeMatch = {
      ...entry.designBeforeMatch,
      machineName: "Changed",
    };
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/designBeforeMatch/);
  });

  it("rejects an entry policy that differs from the actual record policy", () => {
    const { input } = buildInput();
    const entry = input.series.entries[1];
    entry.policyBeforeMatch = { ...entry.policyBeforeMatch, aggression: 42 };
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/policyBeforeMatch/);
  });

  it("rejects an opponent policy that differs from BULWARK_POLICY", () => {
    const { input } = buildInput();
    const record = input.matchesEnvelope.items[1];
    record.config.fighterB.policy = { ...record.config.fighterB.policy, aggression: 1 };
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/BULWARK_POLICY/);
  });

  it("rejects an absent or changed review-failure marker", () => {
    const { input } = buildInput();
    input.series.entries[1].reviewFailure = undefined;
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/reviewFailure/);
    const { input: input2 } = buildInput();
    input2.series.entries[1].reviewFailure = {
      category: "provider_error",
      message: "nope",
    };
    expect(() => validateGridSeriesCanaryBundle(input2)).toThrow(/reviewFailure/);
  });

  it("rejects a transition policy that differs from the next actual match-record policy", () => {
    const { input } = buildInput();
    input.adaptationTrace.transitions[0].policyAfter = {
      ...input.adaptationTrace.transitions[0].policyAfter,
      aggression: 55,
    };
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/policyAfter/);
  });

  it("rejects an own disabled-component mismatch in a fallback review", () => {
    const { input } = buildInput();
    const review = input.fallbackReviewsEnvelope.items[0].review;
    input.fallbackReviewsEnvelope.items[0].review = {
      ...review,
      observedOutcome: {
        ...review.observedOutcome,
        ownDisabledComponents: [
          ...review.observedOutcome.ownDisabledComponents,
          "weapon",
        ],
      },
    };
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/ownDisabledComponents/);
  });

  it("rejects an opponent disabled-component mismatch in a fallback review", () => {
    const { input } = buildInput();
    const review = input.fallbackReviewsEnvelope.items[0].review;
    input.fallbackReviewsEnvelope.items[0].review = {
      ...review,
      observedOutcome: {
        ...review.observedOutcome,
        opponentDisabledComponents: [
          ...review.observedOutcome.opponentDisabledComponents,
          "mobility",
        ],
      },
    };
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(
      /opponentDisabledComponents/,
    );
  });

  it("rejects a non-safe seed anywhere in the bundle", () => {
    const { input } = buildInput();
    input.matchesEnvelope.items[0].seed = Number.MAX_SAFE_INTEGER + 1;
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/safe integer/);
  });
});

describe("grid series canary manifest evidence recomputation (Phase 3D2B.1)", () => {
  it("rejects translated movement absent from records while the manifest claims success", () => {
    const { input } = buildInput();
    for (const record of input.matchesEnvelope.items) {
      for (const event of record.events) {
        if (event.type === "movement_resolved") {
          event.data = { ...event.data, to: event.data.from };
        }
      }
    }
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(
      /translatedGridMovementObserved/,
    );
  });

  it("rejects an attack attempt absent from records while the manifest claims success", () => {
    const { input } = buildInput();
    for (const record of input.matchesEnvelope.items) {
      record.events = record.events.filter((e) => e.type !== "attack_attempted");
    }
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/combatAttemptObserved/);
  });

  it("rejects non-canonical movement zones while the manifest claims success", () => {
    const { input } = buildInput();
    const record = input.matchesEnvelope.items[0];
    for (const event of record.events) {
      if (event.type === "movement_resolved") {
        event.data = { ...event.data, to: "off_grid" };
        break;
      }
    }
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(
      /allMovementZonesCanonical/,
    );
  });

  it("rejects a record beyond the round cap while the manifest claims success", () => {
    const { input } = buildInput();
    input.matchesEnvelope.items[0].rounds = 21;
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/allMatchesTerminated/);
  });
});

describe("grid series canary rendered-artifact validation (Phase 3D2B.1)", () => {
  it("rejects a text replay with a generic marker but the wrong result", () => {
    const { input } = buildInput();
    const record = input.matchesEnvelope.items[0];
    const artifact = input.matchArtifactsEnvelope.items[0];
    if (record.result.winner) {
      artifact.textReplay = artifact.textReplay.replace(/judges/g, "destruction");
    } else {
      artifact.textReplay = artifact.textReplay.replace(
        "The match ends in a draw.",
        "The Bulwark [A] wins by judges!",
      );
    }
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(
      /authoritative completion line/,
    );
  });

  it("rejects a review prompt generated from another match", () => {
    const { input } = buildInput();
    input.matchArtifactsEnvelope.items[1].reviewPrompt =
      input.matchArtifactsEnvelope.items[0].reviewPrompt;
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/exactly reproducible/);
  });

  it("rejects a series report with correct markers but the wrong raw score", () => {
    const { input } = buildInput();
    input.seriesReport = input.seriesReport.replace(
      /Record: [^\n]+/,
      `Record: Grid Canary Competitor ${input.series.score.aiWins + 1} — The Bulwark ${input.series.score.bulwarkWins} (${input.series.score.draws} draw${input.series.score.draws !== 1 ? "s" : ""})`,
    );
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(
      /exact authoritative raw score line/,
    );
  });

  it("rejects a series report that swaps competitor and Bulwark scores", () => {
    const { input } = buildInput();
    input.seriesReport = input.seriesReport.replace(
      /Record: [^\n]+/,
      `Record: Grid Canary Competitor ${input.series.score.bulwarkWins} — The Bulwark ${input.series.score.aiWins} (${input.series.score.draws} draw${input.series.score.draws !== 1 ? "s" : ""})`,
    );
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(
      /exact authoritative raw score line/,
    );
  });

  it("rejects a series report with the wrong draw count or match count", () => {
    const { input } = buildInput();
    input.seriesReport = input.seriesReport.replace(
      /Record: [^\n]+/,
      formatSeriesCanaryScoreLine(
        {
          aiWins: input.series.score.aiWins,
          bulwarkWins: input.series.score.bulwarkWins,
          draws: input.series.score.draws + 1,
        },
        input.series.competitor.displayName,
      ),
    );
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(
      /exact authoritative raw score line/,
    );

    const { input: input2 } = buildInput();
    input2.seriesReport = input2.seriesReport.replace(
      "3 matches completed",
      "2 matches completed",
    );
    expect(() => validateGridSeriesCanaryBundle(input2)).toThrow(
      /three matches completed/,
    );
  });
});
