import { describe, expect, it } from "vitest";
import { runGridMatch } from "../../src/simulator/grid-runtime.js";
import { RULESET_VERSION } from "../../src/simulator/constants.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { createGridCanaryScenario } from "../../src/canary/grid-canary-scenario.js";
import { matchResultToRecord } from "../../src/persistence/match-converter.js";
import { buildGridFactualReport } from "../../src/reports/factual-match-report.js";
import { bindGridFactualReportToMatchRecord } from "../../src/reports/grid-factual-report-binding.js";
import { buildDeterministicFallbackReview } from "../../src/app/grid-match-canary.js";
import { renderTextReplay } from "../../src/replay/text-replay-renderer.js";
import { renderAsciiReplay } from "../../src/replay/ascii/ascii-replay-renderer.js";
import { buildReviewUserPrompt } from "../../src/prompts/review-prompt.v1.js";
import { POSITIONING_MODEL_GRID } from "../../src/schemas/positioning.schema.js";
import {
  serializeMatchRecord,
  type MatchRecordV3,
} from "../../src/schemas/match-record.schema.js";
import { serializeFactualMatchReport } from "../../src/schemas/factual-report.schema.js";
import {
  serializeMatchReview,
  type MatchReview,
} from "../../src/schemas/review.schema.js";
import {
  GridCanaryBundleError,
  validateGridMatchCanaryBundle,
  type GridCanaryBundleValidationInput,
} from "../../src/canary/grid-match-canary-bundle.js";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import type { GridMatchCanaryManifestV2 } from "../../src/schemas/grid-match-canary.schema.js";
import type { GridMatchResult } from "../../src/simulator/types.js";

function runResult(seed: number): GridMatchResult {
  const scenario = createGridCanaryScenario();
  return runGridMatch({
    seed,
    fighterA: scenario.fighterA,
    fighterB: scenario.fighterB,
    rulesetVersion: RULESET_VERSION,
    catalogueVersion: CATALOGUE_V1.version,
  });
}

function validBundle(seed = 5): GridCanaryBundleValidationInput {
  const result = runResult(seed);
  const record = matchResultToRecord(result, []) as MatchRecordV3;
  const report = bindGridFactualReportToMatchRecord(
    buildGridFactualReport(result),
    record,
  );
  const review = buildDeterministicFallbackReview(report);
  const textReplay = renderTextReplay(result);
  const asciiReplay = renderAsciiReplay(
    result,
    { mode: "ascii" },
    POSITIONING_MODEL_GRID,
  );
  const reviewPrompt = buildReviewUserPrompt(report);
  const serializedMatch = serializeMatchRecord(record);
  const serializedFactualReport = serializeFactualMatchReport(report);
  const serializedFallbackReview = serializeMatchReview(review);

  const manifest: GridMatchCanaryManifestV2 = {
    schemaVersion: "2",
    canaryKind: "grid-match",
    scenarioVersion: "grid-canary-flank-v1",
    status: "passed",
    canaryId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    createdAt: "2026-08-01T00:00:00.000Z",
    seed: result.config.seed,
    simulatorVersion: "0.3.0",
    positioningModel: "grid-3x3-v1",
    rulesetVersion: "0.2.0",
    catalogueVersion: "1",
    matchId: record.matchId,
    matchRecordSchemaVersion: "3",
    factualReportSchemaVersion: "2",
    rounds: result.rounds,
    winner: result.result.winner,
    resultMethod: result.result.method,
    eventCount: result.events.length,
    evidence: {
      translatedCircleEvents: 19,
      cornerZonesVisited: 1,
      lateralFlankObserved: true,
      observedFlankBearings: ["right"],
      strictRearExposureObserved: false,
      stationaryFighterCellUnchanged: true,
      allMovementZonesCanonical: true,
      recordRoundTripPassed: true,
      reportRoundTripPassed: true,
      replayFinalStateAgreement: true,
      fallbackReviewGenerated: true,
      allArtifactsReadBack: true,
      bundleCrossAgreementPassed: true,
    },
    digests: {
      match: sha256Hex(serializedMatch),
      factualReport: sha256Hex(serializedFactualReport),
      textReplay: sha256Hex(textReplay),
      asciiReplay: sha256Hex(asciiReplay),
      reviewPrompt: sha256Hex(reviewPrompt),
      fallbackReview: sha256Hex(serializedFallbackReview),
    },
    artifacts: {
      match: "match.json",
      factualReport: "factual-report.json",
      textReplay: "text-replay.txt",
      asciiReplay: "ascii-replay.txt",
      reviewPrompt: "review-prompt.txt",
      fallbackReview: "fallback-review.json",
      manifest: "manifest.json",
    },
  };

  return {
    manifest,
    record,
    report,
    fallbackReview: review,
    textReplay,
    asciiReplay,
    reviewPrompt,
    serializedMatch,
    serializedFactualReport,
    serializedFallbackReview,
  };
}

describe("grid canary bundle cross-agreement validator (Phase 3D2A.1)", () => {
  it("accepts a fully consistent bundle", () => {
    const input = validBundle();
    const result = validateGridMatchCanaryBundle(input);
    expect(result.matchId).toBe(input.record.matchId);
    expect(result.seed).toBe(input.record.seed);
    expect(result.rounds).toBe(20);
    expect(result.winner).toBeNull();
    expect(result.resultMethod).toBe("judges");
    expect(result.digestAgreement).toBe(true);
  });

  it("rejects a record/report match ID mismatch", () => {
    const input = validBundle();
    const record: MatchRecordV3 = {
      ...input.record,
      matchId: "22222222-3333-4444-8555-666666666666",
    };
    expect(() => validateGridMatchCanaryBundle({ ...input, record })).toThrow(
      GridCanaryBundleError,
    );
    expect(() => validateGridMatchCanaryBundle({ ...input, record })).toThrow(/matchId/);
  });

  it("rejects a manifest/record match ID mismatch", () => {
    const input = validBundle();
    const manifest = {
      ...input.manifest,
      matchId: "22222222-3333-4444-8555-666666666666",
    };
    expect(() => validateGridMatchCanaryBundle({ ...input, manifest })).toThrow(
      /matchId/,
    );
  });

  it("rejects a seed mismatch", () => {
    const input = validBundle();
    const manifest = { ...input.manifest, seed: input.manifest.seed + 1 };
    expect(() => validateGridMatchCanaryBundle({ ...input, manifest })).toThrow(/seed/);
  });

  it("rejects a rounds mismatch", () => {
    const input = validBundle();
    const manifest = { ...input.manifest, rounds: input.manifest.rounds - 1 };
    expect(() => validateGridMatchCanaryBundle({ ...input, manifest })).toThrow(/rounds/);
  });

  it("rejects a winner mismatch", () => {
    const input = validBundle();
    const manifest = { ...input.manifest, winner: "fighter_a" };
    expect(() => validateGridMatchCanaryBundle({ ...input, manifest })).toThrow(/winner/);
  });

  it("rejects a result-method mismatch", () => {
    const input = validBundle();
    const manifest = { ...input.manifest, resultMethod: "destruction" };
    expect(() => validateGridMatchCanaryBundle({ ...input, manifest })).toThrow(
      /resultMethod/,
    );
  });

  it("rejects an event-count mismatch", () => {
    const input = validBundle();
    const manifest = { ...input.manifest, eventCount: input.manifest.eventCount + 1 };
    expect(() => validateGridMatchCanaryBundle({ ...input, manifest })).toThrow(
      /eventCount/,
    );
  });

  it("rejects a fallback-review outcome mismatch", () => {
    const input = validBundle();
    const fallbackReview: MatchReview = {
      ...input.fallbackReview,
      observedOutcome: { ...input.fallbackReview.observedOutcome, rounds: 19 },
    };
    expect(() => validateGridMatchCanaryBundle({ ...input, fallbackReview })).toThrow(
      /fallback review rounds/,
    );
  });

  it("rejects an artifact digest mismatch", () => {
    const input = validBundle();
    const manifest = {
      ...input.manifest,
      digests: { ...input.manifest.digests, match: "b".repeat(64) },
    };
    expect(() => validateGridMatchCanaryBundle({ ...input, manifest })).toThrow(
      /digest mismatch/,
    );
  });

  it("rejects an empty text artifact", () => {
    const input = validBundle();
    expect(() => validateGridMatchCanaryBundle({ ...input, textReplay: "" })).toThrow(
      /text replay must be non-empty/,
    );
  });

  it("rejects a NUL in a text artifact", () => {
    const input = validBundle();
    expect(() =>
      validateGridMatchCanaryBundle({
        ...input,
        reviewPrompt: `${input.reviewPrompt}\u0000`,
      }),
    ).toThrow(/NUL/);
  });

  it("rejects a text artifact missing its content marker", () => {
    const input = validBundle();
    expect(() =>
      validateGridMatchCanaryBundle({ ...input, textReplay: "garbage" }),
    ).toThrow(/text replay lacks the required content marker/);
    expect(() =>
      validateGridMatchCanaryBundle({ ...input, asciiReplay: "garbage" }),
    ).toThrow(/ASCII replay lacks the required content marker/);
    expect(() =>
      validateGridMatchCanaryBundle({ ...input, reviewPrompt: "garbage" }),
    ).toThrow(/review prompt lacks the required content marker/);
  });

  it("never mutates its inputs", () => {
    const input = validBundle();
    const snapshot = JSON.stringify({
      manifest: input.manifest,
      record: input.record,
      report: input.report,
      fallbackReview: input.fallbackReview,
    });
    validateGridMatchCanaryBundle(input);
    expect(
      JSON.stringify({
        manifest: input.manifest,
        record: input.record,
        report: input.report,
        fallbackReview: input.fallbackReview,
      }),
    ).toBe(snapshot);
  });
});
