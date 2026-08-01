import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runGridMatchCanary } from "../../src/app/grid-match-canary.js";
import { validateMatchRecord } from "../../src/schemas/match-record.schema.js";
import { validateFactualMatchReport } from "../../src/schemas/factual-report.schema.js";
import { validateMatchReview } from "../../src/schemas/review.schema.js";
import { validateGridMatchCanaryManifestV2 } from "../../src/schemas/grid-match-canary.schema.js";

const tempRoots: string[] = [];

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "canary-integration-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("grid match canary service (Phase 3D2A.1)", () => {
  it("runs the full pipeline and returns a structured success result", async () => {
    const root = await makeTempRoot();
    const outcome = await runGridMatchCanary({ seed: 11, outputRoot: root });

    expect(outcome.canaryId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(outcome.scenarioVersion).toBe("grid-canary-flank-v1");
    expect(outcome.seed).toBe(11);
    expect(outcome.simulatorVersion).toBe("0.3.0");
    expect(outcome.positioningModel).toBe("grid-3x3-v1");
    expect(outcome.matchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(outcome.rounds).toBe(20);
    expect(outcome.winner).toBeNull();
    expect(outcome.resultMethod).toBe("judges");
    expect(outcome.evidence.translatedCircleEvents).toBeGreaterThan(0);
    expect(outcome.evidence.cornerZonesVisited).toBeGreaterThan(0);
    expect(outcome.evidence.lateralFlankObserved).toBe(true);
    expect(outcome.evidence.observedFlankBearings).toContain("right");
    expect(outcome.evidence.strictRearExposureObserved).toBe(false);
    expect(outcome.evidence.stationaryFighterCellUnchanged).toBe(true);
    expect(outcome.evidence.combatEvents).toEqual([]);
    expect(outcome.artifacts).toHaveLength(7);
    expect(outcome.manifest.schemaVersion).toBe("2");
  });

  it("produces match-record v3 and factual-report v2 bound to the real match UUID", async () => {
    const root = await makeTempRoot();
    const outcome = await runGridMatchCanary({ seed: 11, outputRoot: root });

    const matchJson = await readFile(
      join(outcome.artifactDirectory, "match.json"),
      "utf-8",
    );
    const recordValidation = validateMatchRecord(JSON.parse(matchJson));
    expect(recordValidation.ok).toBe(true);
    if (recordValidation.ok) {
      expect(recordValidation.record.schemaVersion).toBe("3");
      expect(recordValidation.record.matchId).toBe(outcome.matchId);
    }

    const reportJson = await readFile(
      join(outcome.artifactDirectory, "factual-report.json"),
      "utf-8",
    );
    const reportValidation = validateFactualMatchReport(JSON.parse(reportJson));
    expect(reportValidation.ok).toBe(true);
    if (reportValidation.ok) {
      expect(reportValidation.report.schemaVersion).toBe("2");
      expect(reportValidation.report.matchId).toBe(outcome.matchId);
    }

    // Manifest agrees on record/report schema versions and IDs.
    expect(outcome.manifest.matchRecordSchemaVersion).toBe("3");
    expect(outcome.manifest.factualReportSchemaVersion).toBe("2");
    expect(outcome.manifest.matchId).toBe(outcome.matchId);
  });

  it("renders text and ASCII replays successfully", async () => {
    const root = await makeTempRoot();
    const outcome = await runGridMatchCanary({ seed: 11, outputRoot: root });

    const textReplay = await readFile(
      join(outcome.artifactDirectory, "text-replay.txt"),
      "utf-8",
    );
    expect(textReplay.length).toBeGreaterThan(0);
    expect(textReplay).toContain("MATCH COMPLETE");

    const asciiReplay = await readFile(
      join(outcome.artifactDirectory, "ascii-replay.txt"),
      "utf-8",
    );
    expect(asciiReplay.length).toBeGreaterThan(0);
    expect(asciiReplay).toContain("ASCII REPLAY");
  });

  it("produces a review prompt with human-readable grid zones", async () => {
    const root = await makeTempRoot();
    const outcome = await runGridMatchCanary({ seed: 11, outputRoot: root });

    const prompt = await readFile(
      join(outcome.artifactDirectory, "review-prompt.txt"),
      "utf-8",
    );
    expect(prompt).toContain("Simulator: 0.3.0 (grid-3x3-v1)");
    // Final states render human-readable grid zone names, never raw values.
    expect(prompt).toContain("Zone: West");
    expect(prompt).toContain("Zone: North");
    expect(prompt).not.toContain("north_west");
    expect(prompt).toContain("Review the following match result");
  });

  it("generates the deterministic fallback review without any provider", async () => {
    const root = await makeTempRoot();
    const outcome = await runGridMatchCanary({ seed: 11, outputRoot: root });

    const reviewJson = await readFile(
      join(outcome.artifactDirectory, "fallback-review.json"),
      "utf-8",
    );
    const reviewValidation = validateMatchReview(JSON.parse(reviewJson));
    expect(reviewValidation.ok).toBe(true);
    if (reviewValidation.ok) {
      const review = reviewValidation.review;
      expect(review.schemaVersion).toBe("1");
      expect(review.confidence).toBe("low");
      expect(review.strategyAssessment.policyAssessment).toBe("AI review unavailable.");
      expect(review.observedOutcome.winnerId).toBeNull();
      expect(review.observedOutcome.method).toBe("judges");
      expect(review.observedOutcome.rounds).toBe(20);
      expect(review.observedOutcome.ownFinalIntegrity).toBe(
        review.observedOutcome.opponentFinalIntegrity,
      );
    }
  });

  it("validates the completed v2 manifest", async () => {
    const root = await makeTempRoot();
    const outcome = await runGridMatchCanary({ seed: 11, outputRoot: root });

    const manifestValidation = validateGridMatchCanaryManifestV2(outcome.manifest);
    expect(manifestValidation.ok).toBe(true);
    if (manifestValidation.ok) {
      expect(manifestValidation.manifest.schemaVersion).toBe("2");
      expect(manifestValidation.manifest.status).toBe("passed");
      expect(manifestValidation.manifest.evidence.recordRoundTripPassed).toBe(true);
      expect(manifestValidation.manifest.evidence.reportRoundTripPassed).toBe(true);
      expect(manifestValidation.manifest.evidence.replayFinalStateAgreement).toBe(true);
      expect(manifestValidation.manifest.evidence.fallbackReviewGenerated).toBe(true);
      expect(manifestValidation.manifest.evidence.allArtifactsReadBack).toBe(true);
      expect(manifestValidation.manifest.evidence.bundleCrossAgreementPassed).toBe(true);
      // Every non-manifest artifact has a SHA-256 digest.
      for (const digest of Object.values(manifestValidation.manifest.digests)) {
        expect(digest).toMatch(/^[a-f0-9]{64}$/);
      }
    }
  });

  it("records truthful flank evidence in the manifest", async () => {
    const root = await makeTempRoot();
    const outcome = await runGridMatchCanary({ seed: 11, outputRoot: root });

    expect(outcome.manifest.evidence.observedFlankBearings).toEqual(["right"]);
    expect(outcome.manifest.evidence.lateralFlankObserved).toBe(true);
    expect(outcome.manifest.evidence.strictRearExposureObserved).toBe(false);
    expect(outcome.manifest.evidence.stationaryFighterCellUnchanged).toBe(true);
    expect(JSON.stringify(outcome.manifest)).not.toContain("rearExposureObserved");
  });

  it("keeps the final positioning agreement across record, report and replay", async () => {
    const root = await makeTempRoot();
    const outcome = await runGridMatchCanary({ seed: 11, outputRoot: root });

    const recordValidation = validateMatchRecord(
      JSON.parse(await readFile(join(outcome.artifactDirectory, "match.json"), "utf-8")),
    );
    const reportValidation = validateFactualMatchReport(
      JSON.parse(
        await readFile(join(outcome.artifactDirectory, "factual-report.json"), "utf-8"),
      ),
    );
    expect(recordValidation.ok && reportValidation.ok).toBe(true);
    if (recordValidation.ok && reportValidation.ok) {
      expect(reportValidation.report.finalStates.fighterA.zone).toBe(
        outcome.evidence.finalZoneA,
      );
      expect(reportValidation.report.finalStates.fighterB.zone).toBe(
        outcome.evidence.finalZoneB,
      );
    }
  });

  it("rejects an invalid seed", async () => {
    const root = await makeTempRoot();
    await expect(runGridMatchCanary({ seed: -1, outputRoot: root })).rejects.toThrow(
      /non-negative integer/,
    );
    await expect(runGridMatchCanary({ seed: 1.5, outputRoot: root })).rejects.toThrow(
      /non-negative integer/,
    );
  });

  it("rejects protected normal-storage output roots before execution or writes", async () => {
    const matchesRoot = join(process.cwd(), "data", "matches");
    const seriesRoot = join(process.cwd(), "data", "series");
    await expect(
      runGridMatchCanary({ seed: 11, outputRoot: matchesRoot }),
    ).rejects.toThrow(/match storage/);
    await expect(
      runGridMatchCanary({ seed: 11, outputRoot: seriesRoot }),
    ).rejects.toThrow(/series storage/);
    await expect(
      runGridMatchCanary({ seed: 11, outputRoot: join(process.cwd(), "data") }),
    ).rejects.toThrow(/must be/);
  });

  it("never writes to normal match or series storage", async () => {
    const dataDir = join(process.cwd(), "data");
    const matchesBefore = await readdir(join(dataDir, "matches")).catch(() => []);
    const seriesBefore = await readdir(join(dataDir, "series")).catch(() => []);

    const root = await makeTempRoot();
    await runGridMatchCanary({ seed: 11, outputRoot: root });

    const matchesAfter = await readdir(join(dataDir, "matches")).catch(() => []);
    const seriesAfter = await readdir(join(dataDir, "series")).catch(() => []);
    expect(matchesAfter).toEqual(matchesBefore);
    expect(seriesAfter).toEqual(seriesBefore);
  });
});
