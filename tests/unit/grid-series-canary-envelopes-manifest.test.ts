import { describe, expect, it } from "vitest";
import { executeGridSeriesCanary } from "../../src/canary/grid-series-canary-core.js";
import {
  deserializeGridSeriesCanaryFallbackReviewsEnvelope,
  deserializeGridSeriesCanaryMatchArtifactsEnvelope,
  deserializeGridSeriesCanaryMatchesEnvelope,
  deserializeGridSeriesCanaryFactualReportsEnvelope,
  serializeGridSeriesCanaryEnvelope,
} from "../../src/schemas/grid-series-canary-envelopes.schema.js";
import {
  GridSeriesCanaryManifestV1Schema,
  deserializeGridSeriesCanaryManifestV1,
} from "../../src/schemas/grid-series-canary-manifest.schema.js";
import { buildGridSeriesCanaryManifest } from "../../src/app/grid-series-canary.js";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";

const IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];
const SERIES_ID = "44444444-4444-4444-8444-444444444444";
const CANARY_ID = "55555555-5555-4555-8555-555555555555";
const CREATED_AT = "2024-06-01T00:00:00.000Z";
const BASE_SEED = 5;

function run() {
  return executeGridSeriesCanary({
    baseSeed: BASE_SEED,
    seriesId: SERIES_ID,
    matchIdentities: IDS.map((matchId) => ({
      matchId,
      createdAt: CREATED_AT,
    })),
  });
}

function envelopes(outcome = run()) {
  return {
    matches: {
      schemaVersion: "1",
      seriesId: SERIES_ID,
      items: outcome.matches.map((match) => match.record),
    },
    factualReports: {
      schemaVersion: "1",
      seriesId: SERIES_ID,
      items: outcome.matches.map((match) => match.report),
    },
    fallbackReviews: {
      schemaVersion: "1",
      seriesId: SERIES_ID,
      items: outcome.matches.map((match) => ({
        matchNumber: match.matchNumber,
        matchId: match.matchId,
        review: match.fallbackReview,
      })),
    },
    matchArtifacts: {
      schemaVersion: "1",
      seriesId: SERIES_ID,
      items: outcome.matches.map((match) => ({
        matchNumber: match.matchNumber,
        matchId: match.matchId,
        textReplay: match.textReplay,
        asciiReplay: match.asciiReplay,
        reviewPrompt: match.reviewPrompt,
      })),
    },
  };
}

describe("grid series canary envelopes (Phase 3D2B)", () => {
  it("validates all four envelopes produced from the core", () => {
    const env = envelopes();
    for (const parsed of [
      deserializeGridSeriesCanaryMatchesEnvelope(
        serializeGridSeriesCanaryEnvelope(env.matches),
      ),
      deserializeGridSeriesCanaryFactualReportsEnvelope(
        serializeGridSeriesCanaryEnvelope(env.factualReports),
      ),
      deserializeGridSeriesCanaryFallbackReviewsEnvelope(
        serializeGridSeriesCanaryEnvelope(env.fallbackReviews),
      ),
      deserializeGridSeriesCanaryMatchArtifactsEnvelope(
        serializeGridSeriesCanaryEnvelope(env.matchArtifacts),
      ),
    ]) {
      expect(parsed.ok).toBe(true);
    }
  });

  it("rejects a duplicate match ID in the matches envelope", () => {
    const env = envelopes();
    env.matches.items = [
      env.matches.items[0],
      { ...env.matches.items[1], matchId: IDS[0] },
      env.matches.items[2],
    ];
    const parsed = deserializeGridSeriesCanaryMatchesEnvelope(
      serializeGridSeriesCanaryEnvelope(env.matches),
    );
    expect(parsed.ok).toBe(false);
  });

  it("rejects a pending report in the factual-reports envelope", () => {
    const env = envelopes();
    env.factualReports.items = [
      { ...env.factualReports.items[0], matchId: "pending" },
      env.factualReports.items[1],
      env.factualReports.items[2],
    ];
    const parsed = deserializeGridSeriesCanaryFactualReportsEnvelope(
      serializeGridSeriesCanaryEnvelope(env.factualReports),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors).toMatch(/pending/);
  });

  it("rejects out-of-order fallback review entries", () => {
    const env = envelopes();
    env.fallbackReviews.items = [
      env.fallbackReviews.items[1],
      env.fallbackReviews.items[0],
      env.fallbackReviews.items[2],
    ];
    const parsed = deserializeGridSeriesCanaryFallbackReviewsEnvelope(
      serializeGridSeriesCanaryEnvelope(env.fallbackReviews),
    );
    expect(parsed.ok).toBe(false);
  });

  it("rejects a NUL character in a match artifact", () => {
    const env = envelopes();
    env.matchArtifacts.items = [
      {
        ...env.matchArtifacts.items[0],
        textReplay: `${env.matchArtifacts.items[0].textReplay}\u0000`,
      },
      env.matchArtifacts.items[1],
      env.matchArtifacts.items[2],
    ];
    const parsed = deserializeGridSeriesCanaryMatchArtifactsEnvelope(
      serializeGridSeriesCanaryEnvelope(env.matchArtifacts),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors).toMatch(/NUL/);
  });

  it("rejects an empty text artifact", () => {
    const env = envelopes();
    env.matchArtifacts.items = [
      { ...env.matchArtifacts.items[0], asciiReplay: "" },
      env.matchArtifacts.items[1],
      env.matchArtifacts.items[2],
    ];
    const parsed = deserializeGridSeriesCanaryMatchArtifactsEnvelope(
      serializeGridSeriesCanaryEnvelope(env.matchArtifacts),
    );
    expect(parsed.ok).toBe(false);
  });

  it("rejects a non-UUID series ID", () => {
    const env = envelopes();
    env.matches.seriesId = "not-a-uuid";
    const parsed = deserializeGridSeriesCanaryMatchesEnvelope(
      serializeGridSeriesCanaryEnvelope(env.matches),
    );
    expect(parsed.ok).toBe(false);
  });
});

describe("grid series canary manifest v1 (Phase 3D2B)", () => {
  function buildManifest() {
    const outcome = run();
    const digests = {
      series: sha256Hex("series"),
      matches: sha256Hex("matches"),
      factualReports: sha256Hex("reports"),
      fallbackReviews: sha256Hex("reviews"),
      matchArtifacts: sha256Hex("artifacts"),
      adaptationTrace: sha256Hex("trace"),
      seriesReport: sha256Hex("report"),
    };
    return buildGridSeriesCanaryManifest({
      canaryId: CANARY_ID,
      seriesId: SERIES_ID,
      createdAt: CREATED_AT,
      baseSeed: BASE_SEED,
      seeds: [BASE_SEED, BASE_SEED + 1, BASE_SEED + 2],
      outcome,
      digests,
    });
  }

  it("builds a schema-valid v1 manifest", () => {
    const manifest = buildManifest();
    const parsed = GridSeriesCanaryManifestV1Schema.safeParse(manifest);
    expect(parsed.success).toBe(true);
  });

  it("freezes identity, runtime and the 16 evidence flags", () => {
    const manifest = buildManifest();
    expect(manifest.schemaVersion).toBe("1");
    expect(manifest.canaryKind).toBe("grid-series");
    expect(manifest.scenarioVersion).toBe("grid-series-canary-adaptive-v1");
    expect(manifest.status).toBe("passed");
    expect(manifest.simulatorVersion).toBe("0.3.0");
    expect(manifest.positioningModel).toBe("grid-3x3-v1");
    expect(manifest.matchCount).toBe(3);
    expect(Object.keys(manifest.evidence)).toHaveLength(16);
    expect(manifest.evidence.policyAdaptationCount).toBe(2);
    expect(manifest.evidence.translatedGridMovementObserved).toBe(true);
    expect(manifest.evidence.combatAttemptObserved).toBe(true);
    expect(manifest.evidence.deterministicReexecutionPassed).toBe(true);
    expect(manifest.evidence.bundleCrossAgreementPassed).toBe(true);
  });

  it("freezes the exact artifact names and seven digests", () => {
    const manifest = buildManifest();
    expect(manifest.artifacts).toEqual({
      series: "series.json",
      matches: "matches.json",
      factualReports: "factual-reports.json",
      fallbackReviews: "fallback-reviews.json",
      matchArtifacts: "match-artifacts.json",
      adaptationTrace: "adaptation-trace.json",
      seriesReport: "series-report.txt",
      manifest: "manifest.json",
    });
    expect(Object.keys(manifest.digests)).toHaveLength(7);
  });

  it("round trips through serialization", () => {
    const manifest = buildManifest();
    const json = JSON.stringify(manifest);
    const parsed = deserializeGridSeriesCanaryManifestV1(json);
    expect(parsed.ok).toBe(true);
  });

  it("rejects non-sequential seeds", () => {
    const manifest = buildManifest();
    manifest.seeds = [5, 6, 99];
    const parsed = GridSeriesCanaryManifestV1Schema.safeParse(manifest);
    expect(parsed.success).toBe(false);
  });
});
