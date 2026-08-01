import { describe, expect, it } from "vitest";
import {
  deserializeGridMatchCanaryManifest,
  serializeGridMatchCanaryManifest,
  validateGridMatchCanaryManifest,
  type GridMatchCanaryManifestV1,
} from "../../src/schemas/grid-match-canary.schema.js";

function validManifest(): GridMatchCanaryManifestV1 {
  return {
    schemaVersion: "1",
    canaryKind: "grid-match",
    scenarioVersion: "grid-canary-flank-v1",
    status: "passed",
    canaryId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    createdAt: "2026-08-01T00:00:00.000Z",
    seed: 7,
    simulatorVersion: "0.3.0",
    positioningModel: "grid-3x3-v1",
    rulesetVersion: "0.2.0",
    catalogueVersion: "1",
    matchId: "11111111-2222-4333-8444-555555555555",
    matchRecordSchemaVersion: "3",
    factualReportSchemaVersion: "2",
    rounds: 20,
    winner: null,
    resultMethod: "judges",
    eventCount: 102,
    evidence: {
      translatedCircleEvents: 19,
      cornerZonesVisited: 1,
      rearExposureObserved: true,
      allMovementZonesCanonical: true,
      recordRoundTripPassed: true,
      reportRoundTripPassed: true,
      replayFinalStateAgreement: true,
      fallbackReviewGenerated: true,
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
}

describe("grid match canary manifest schema v1 (Phase 3D2A)", () => {
  it("validates a complete valid manifest", () => {
    const result = validateGridMatchCanaryManifest(validManifest());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.status).toBe("passed");
    }
  });

  it("serializes and deserializes in a round trip", () => {
    const manifest = validManifest();
    const json = serializeGridMatchCanaryManifest(manifest);
    const parsed = deserializeGridMatchCanaryManifest(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(JSON.stringify(parsed.manifest)).toBe(JSON.stringify(manifest));
    }
  });

  it("rejects malformed JSON on deserialize", () => {
    const parsed = deserializeGridMatchCanaryManifest("{ not json");
    expect(parsed.ok).toBe(false);
  });

  it("rejects a wrong schemaVersion", () => {
    const bad = { ...validManifest(), schemaVersion: "2" };
    expect(validateGridMatchCanaryManifest(bad).ok).toBe(false);
  });

  it("rejects a wrong canaryKind", () => {
    const bad = { ...validManifest(), canaryKind: "grid-series" };
    expect(validateGridMatchCanaryManifest(bad).ok).toBe(false);
  });

  it("rejects a wrong scenarioVersion", () => {
    const bad = { ...validManifest(), scenarioVersion: "grid-canary-flank-v2" };
    expect(validateGridMatchCanaryManifest(bad).ok).toBe(false);
  });

  it("rejects a non-passed status", () => {
    const bad = { ...validManifest(), status: "failed" };
    expect(validateGridMatchCanaryManifest(bad).ok).toBe(false);
  });

  it("rejects wrong grid identity fields", () => {
    const wrongSim = { ...validManifest(), simulatorVersion: "0.2.0" };
    expect(validateGridMatchCanaryManifest(wrongSim).ok).toBe(false);
    const wrongModel = { ...validManifest(), positioningModel: "legacy-five-zone-v1" };
    expect(validateGridMatchCanaryManifest(wrongModel).ok).toBe(false);
    const wrongRuleset = { ...validManifest(), rulesetVersion: "0.3.0" };
    expect(validateGridMatchCanaryManifest(wrongRuleset).ok).toBe(false);
    const wrongCatalogue = { ...validManifest(), catalogueVersion: "2" };
    expect(validateGridMatchCanaryManifest(wrongCatalogue).ok).toBe(false);
  });

  it("rejects a non-UUID canaryId or matchId", () => {
    const badCanary = { ...validManifest(), canaryId: "not-a-uuid" };
    expect(validateGridMatchCanaryManifest(badCanary).ok).toBe(false);
    const badMatch = { ...validManifest(), matchId: "not-a-uuid" };
    expect(validateGridMatchCanaryManifest(badMatch).ok).toBe(false);
  });

  it("rejects a negative seed or event count", () => {
    const badSeed = { ...validManifest(), seed: -1 };
    expect(validateGridMatchCanaryManifest(badSeed).ok).toBe(false);
    const badCount = { ...validManifest(), eventCount: -1 };
    expect(validateGridMatchCanaryManifest(badCount).ok).toBe(false);
  });

  it("rejects false evidence flags", () => {
    const badEvidence = {
      ...validManifest(),
      evidence: { ...validManifest().evidence, rearExposureObserved: false },
    };
    expect(validateGridMatchCanaryManifest(badEvidence).ok).toBe(false);
  });

  it("rejects a zero corner or circle evidence count", () => {
    const badCircles = {
      ...validManifest(),
      evidence: { ...validManifest().evidence, translatedCircleEvents: 0 },
    };
    expect(validateGridMatchCanaryManifest(badCircles).ok).toBe(false);
    const badCorners = {
      ...validManifest(),
      evidence: { ...validManifest().evidence, cornerZonesVisited: 0 },
    };
    expect(validateGridMatchCanaryManifest(badCorners).ok).toBe(false);
  });

  it("rejects a wrong artifact-name block", () => {
    const badArtifact = {
      ...validManifest(),
      artifacts: { ...validManifest().artifacts, match: "other.json" },
    };
    expect(validateGridMatchCanaryManifest(badArtifact).ok).toBe(false);
  });
});
