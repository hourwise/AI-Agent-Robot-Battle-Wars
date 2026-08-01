import { describe, expect, it } from "vitest";
import {
  GridMatchCanaryManifestV1Schema,
  deserializeGridMatchCanaryManifestAny,
  deserializeGridMatchCanaryManifestV2,
  isGridMatchCanaryManifestV1,
  isGridMatchCanaryManifestV2,
  serializeGridMatchCanaryManifest,
  validateGridMatchCanaryManifestV1,
  validateGridMatchCanaryManifestV2,
  type GridMatchCanaryManifestV1,
  type GridMatchCanaryManifestV2,
} from "../../src/schemas/grid-match-canary.schema.js";

const SHA = "a".repeat(64);

function validManifestV2(): GridMatchCanaryManifestV2 {
  return {
    schemaVersion: "2",
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
      match: SHA,
      factualReport: SHA,
      textReplay: SHA,
      asciiReplay: SHA,
      reviewPrompt: SHA,
      fallbackReview: SHA,
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

function validManifestV1(): GridMatchCanaryManifestV1 {
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

describe("grid match canary manifest v2 (Phase 3D2A.1)", () => {
  it("validates a complete valid v2 manifest", () => {
    const result = validateGridMatchCanaryManifestV2(validManifestV2());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.schemaVersion).toBe("2");
      expect(result.manifest.status).toBe("passed");
      expect(result.manifest.evidence.lateralFlankObserved).toBe(true);
      expect(result.manifest.evidence.observedFlankBearings).toEqual(["right"]);
      expect(result.manifest.evidence.strictRearExposureObserved).toBe(false);
    }
  });

  it("serializes and deserializes in a v2 round trip", () => {
    const manifest = validManifestV2();
    const json = serializeGridMatchCanaryManifest(manifest);
    const parsed = deserializeGridMatchCanaryManifestV2(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(JSON.stringify(parsed.manifest)).toBe(JSON.stringify(manifest));
    }
  });

  it("rejects malformed JSON on deserialize", () => {
    expect(deserializeGridMatchCanaryManifestV2("{ not json").ok).toBe(false);
  });

  it("rejects a wrong schemaVersion", () => {
    const bad = { ...validManifestV2(), schemaVersion: "3" };
    expect(validateGridMatchCanaryManifestV2(bad).ok).toBe(false);
  });

  it("rejects a wrong canaryKind or scenarioVersion", () => {
    expect(
      validateGridMatchCanaryManifestV2({
        ...validManifestV2(),
        canaryKind: "grid-series",
      }).ok,
    ).toBe(false);
    expect(
      validateGridMatchCanaryManifestV2({
        ...validManifestV2(),
        scenarioVersion: "grid-canary-flank-v2",
      }).ok,
    ).toBe(false);
  });

  it("rejects a non-passed status", () => {
    expect(
      validateGridMatchCanaryManifestV2({ ...validManifestV2(), status: "failed" }).ok,
    ).toBe(false);
  });

  it("rejects wrong grid identity fields", () => {
    expect(
      validateGridMatchCanaryManifestV2({
        ...validManifestV2(),
        simulatorVersion: "0.2.0",
      }).ok,
    ).toBe(false);
    expect(
      validateGridMatchCanaryManifestV2({
        ...validManifestV2(),
        positioningModel: "legacy-five-zone-v1",
      }).ok,
    ).toBe(false);
    expect(
      validateGridMatchCanaryManifestV2({ ...validManifestV2(), rulesetVersion: "0.3.0" })
        .ok,
    ).toBe(false);
    expect(
      validateGridMatchCanaryManifestV2({ ...validManifestV2(), catalogueVersion: "2" })
        .ok,
    ).toBe(false);
  });

  it("rejects a non-UUID canaryId or matchId", () => {
    expect(
      validateGridMatchCanaryManifestV2({ ...validManifestV2(), canaryId: "not-a-uuid" })
        .ok,
    ).toBe(false);
    expect(
      validateGridMatchCanaryManifestV2({ ...validManifestV2(), matchId: "not-a-uuid" })
        .ok,
    ).toBe(false);
  });

  it("rejects a negative seed or event count", () => {
    expect(validateGridMatchCanaryManifestV2({ ...validManifestV2(), seed: -1 }).ok).toBe(
      false,
    );
    expect(
      validateGridMatchCanaryManifestV2({ ...validManifestV2(), eventCount: -1 }).ok,
    ).toBe(false);
  });

  it("rejects lateralFlankObserved false", () => {
    const bad = {
      ...validManifestV2(),
      evidence: { ...validManifestV2().evidence, lateralFlankObserved: false },
    };
    expect(validateGridMatchCanaryManifestV2(bad).ok).toBe(false);
  });

  it("rejects empty or non-unique observedFlankBearings", () => {
    const empty = {
      ...validManifestV2(),
      evidence: { ...validManifestV2().evidence, observedFlankBearings: [] },
    };
    expect(validateGridMatchCanaryManifestV2(empty).ok).toBe(false);

    const duplicated = {
      ...validManifestV2(),
      evidence: {
        ...validManifestV2().evidence,
        observedFlankBearings: ["right", "right"],
      },
    };
    expect(validateGridMatchCanaryManifestV2(duplicated).ok).toBe(false);
  });

  it("rejects a non-flank bearing value", () => {
    const bad = {
      ...validManifestV2(),
      evidence: {
        ...validManifestV2().evidence,
        observedFlankBearings: ["front_right"],
      },
    };
    expect(validateGridMatchCanaryManifestV2(bad).ok).toBe(false);
  });

  it("accepts either strictRearExposureObserved boolean (derived, not hard-coded)", () => {
    expect(validateGridMatchCanaryManifestV2(validManifestV2()).ok).toBe(true);
    const withRear = {
      ...validManifestV2(),
      evidence: { ...validManifestV2().evidence, strictRearExposureObserved: true },
    };
    expect(validateGridMatchCanaryManifestV2(withRear).ok).toBe(true);
  });

  it("rejects false invariant evidence flags", () => {
    for (const key of [
      "stationaryFighterCellUnchanged",
      "allMovementZonesCanonical",
      "recordRoundTripPassed",
      "reportRoundTripPassed",
      "replayFinalStateAgreement",
      "fallbackReviewGenerated",
      "allArtifactsReadBack",
      "bundleCrossAgreementPassed",
    ] as const) {
      const bad = {
        ...validManifestV2(),
        evidence: { ...validManifestV2().evidence, [key]: false },
      };
      expect(validateGridMatchCanaryManifestV2(bad).ok).toBe(false);
    }
  });

  it("rejects a zero corner or circle evidence count", () => {
    const badCircles = {
      ...validManifestV2(),
      evidence: { ...validManifestV2().evidence, translatedCircleEvents: 0 },
    };
    expect(validateGridMatchCanaryManifestV2(badCircles).ok).toBe(false);
    const badCorners = {
      ...validManifestV2(),
      evidence: { ...validManifestV2().evidence, cornerZonesVisited: 0 },
    };
    expect(validateGridMatchCanaryManifestV2(badCorners).ok).toBe(false);
  });

  it("requires a 64-char lowercase SHA-256 hex digest for every artifact", () => {
    for (const key of [
      "match",
      "factualReport",
      "textReplay",
      "asciiReplay",
      "reviewPrompt",
      "fallbackReview",
    ] as const) {
      const short = {
        ...validManifestV2(),
        digests: { ...validManifestV2().digests, [key]: "abc" },
      };
      expect(validateGridMatchCanaryManifestV2(short).ok).toBe(false);
      const upper = {
        ...validManifestV2(),
        digests: { ...validManifestV2().digests, [key]: "A".repeat(64) },
      };
      expect(validateGridMatchCanaryManifestV2(upper).ok).toBe(false);
    }
  });

  it("rejects a wrong artifact-name block", () => {
    const bad = {
      ...validManifestV2(),
      artifacts: { ...validManifestV2().artifacts, match: "other.json" },
    };
    expect(validateGridMatchCanaryManifestV2(bad).ok).toBe(false);
  });

  it("does not include rearExposureObserved in v2", () => {
    const manifest = validManifestV2();
    expect(JSON.stringify(manifest)).not.toContain("rearExposureObserved");
  });
});

describe("grid match canary manifest v1 historical (Phase 3D2A)", () => {
  it("still validates a v1 artifact for historical inspection", () => {
    const result = validateGridMatchCanaryManifestV1(validManifestV1());
    expect(result.ok).toBe(true);
  });

  it("is not accepted as current passing canary evidence (v2 deserialize rejects it)", () => {
    const json = serializeGridMatchCanaryManifest(validManifestV1());
    const parsed = deserializeGridMatchCanaryManifestV2(json);
    expect(parsed.ok).toBe(false);
    expect(parsed.ok ? "" : parsed.errors).toMatch(/schemaVersion "2"/);
  });

  it("version-aware deserialization reads both versions", () => {
    const v1 = deserializeGridMatchCanaryManifestAny(
      serializeGridMatchCanaryManifest(validManifestV1()),
    );
    expect(v1.ok).toBe(true);
    if (v1.ok) expect(isGridMatchCanaryManifestV1(v1.manifest)).toBe(true);

    const v2 = deserializeGridMatchCanaryManifestAny(
      serializeGridMatchCanaryManifest(validManifestV2()),
    );
    expect(v2.ok).toBe(true);
    if (v2.ok) expect(isGridMatchCanaryManifestV2(v2.manifest)).toBe(true);
  });

  it("guards distinguish v1 from v2", () => {
    expect(isGridMatchCanaryManifestV1(validManifestV1())).toBe(true);
    expect(isGridMatchCanaryManifestV1(validManifestV2())).toBe(false);
    expect(isGridMatchCanaryManifestV2(validManifestV2())).toBe(true);
    expect(isGridMatchCanaryManifestV2(validManifestV1())).toBe(false);
  });

  it("rejects a v1 artifact through the v1 schema with a wrong evidence value", () => {
    const bad = {
      ...validManifestV1(),
      evidence: { ...validManifestV1().evidence, rearExposureObserved: false },
    };
    expect(GridMatchCanaryManifestV1Schema.safeParse(bad).success).toBe(false);
  });
});
