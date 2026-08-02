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
    expect(() => validateGridSeriesCanaryBundle(input)).toThrow(/changed the build/);
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
