import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { deserializeSeriesRecord, isSeriesRecordV2 } from "../schemas/series.schema.js";
import {
  deserializeGridSeriesCanaryMatchesEnvelope,
  deserializeGridSeriesCanaryFactualReportsEnvelope,
  deserializeGridSeriesCanaryFallbackReviewsEnvelope,
  deserializeGridSeriesCanaryMatchArtifactsEnvelope,
  serializeGridSeriesCanaryEnvelope,
  GRID_SERIES_CANARY_MATCHES_FILE,
  GRID_SERIES_CANARY_FACTUAL_REPORTS_FILE,
  GRID_SERIES_CANARY_FALLBACK_REVIEWS_FILE,
  GRID_SERIES_CANARY_MATCH_ARTIFACTS_FILE,
  GRID_SERIES_CANARY_ADAPTATION_TRACE_FILE,
  GRID_SERIES_CANARY_SERIES_FILE,
  GRID_SERIES_CANARY_SERIES_REPORT_FILE,
  GRID_SERIES_CANARY_MANIFEST_FILE,
} from "../schemas/grid-series-canary-envelopes.schema.js";
import { deserializeGridSeriesCanaryAdaptationTrace } from "../schemas/grid-series-canary-adaptation-trace.schema.js";
import {
  deserializeGridSeriesCanaryManifestV1,
  serializeGridSeriesCanaryManifest,
  type GridSeriesCanaryManifestV1,
} from "../schemas/grid-series-canary-manifest.schema.js";
import {
  assertCanaryOutputRootIsolation,
  assertCanaryPhysicalRoot,
} from "../canary/canary-output-root.js";
import {
  defaultCanaryFs,
  fsEntryKind,
  publishImmutableBundle,
  type CanaryFileSystem,
} from "../canary/immutable-canary-bundle.js";
import { sha256Hex } from "../canary/grid-canary-digest.js";
import {
  executeGridSeriesCanary,
  type GridSeriesCanaryCoreOutcome,
} from "../canary/grid-series-canary-core.js";
import { createGridSeriesCanarySeedPlan } from "../canary/grid-series-canary-seed-plan.js";
import {
  buildGridSeriesCanarySeriesRecord,
  serializeGridSeriesCanarySeriesRecord,
} from "../canary/grid-series-canary-series.js";
import { buildGridSeriesCanaryReport } from "../canary/grid-series-canary-report.js";
import { validateGridSeriesCanaryBundle } from "../canary/grid-series-canary-bundle.js";
import { GRID_SERIES_CANARY_SCENARIO_VERSION } from "../canary/grid-series-canary-scenario.js";

/**
 * Isolated deterministic grid adaptive-series canary service (Milestone 0.2C
 * Phase 3D2B).
 *
 * A deliberately isolated, deterministic, local-only three-match adaptive
 * series that proves the complete grid series pipeline works operationally:
 *
 *   three frozen grid matches
 *   → match-record v3 × 3
 *   → factual-report v2 × 3
 *   → replay × 3
 *   → deterministic fallback review × 3
 *   → two deterministic policy adaptations
 *   → series-record v2
 *   → four JSON envelopes + adaptation trace + series report
 *   → validated atomic artifact bundle
 *
 * It never calls the legacy `runSeries` / `runMatch` commands, repositories, an
 * `ArenaAgent`, a provider or benchmark code, and writes exclusively under its
 * dedicated output root. All UUIDs and timestamps are injected through
 * dependencies so tests are fully deterministic.
 */
export const GRID_SERIES_CANARY_DEFAULT_ROOT = join(
  process.cwd(),
  "data",
  "canary",
  "grid-series",
);

/** Exact eight-entry bundle inventory (regular files only, no symlinks). */
export const GRID_SERIES_CANARY_BUNDLE_ENTRIES: readonly string[] = Object.freeze([
  GRID_SERIES_CANARY_MANIFEST_FILE,
  GRID_SERIES_CANARY_SERIES_FILE,
  GRID_SERIES_CANARY_MATCHES_FILE,
  GRID_SERIES_CANARY_FACTUAL_REPORTS_FILE,
  GRID_SERIES_CANARY_FALLBACK_REVIEWS_FILE,
  GRID_SERIES_CANARY_MATCH_ARTIFACTS_FILE,
  GRID_SERIES_CANARY_ADAPTATION_TRACE_FILE,
  GRID_SERIES_CANARY_SERIES_REPORT_FILE,
]);

export interface GridSeriesCanaryRequest {
  baseSeed: number;
  outputRoot: string;
}

export interface GridSeriesCanaryDependencies {
  createUuid?: () => string;
  now?: () => Date;
  fs?: CanaryFileSystem;
}

export interface GridSeriesCanaryMatchSummary {
  matchNumber: 1 | 2 | 3;
  matchId: string;
  seed: number;
  rounds: number;
  winner: string | null;
  resultMethod: string;
  eventCount: number;
}

export interface GridSeriesCanaryAdaptationSummary {
  sourceMatchNumber: 1 | 2;
  aggressionBefore: number;
  aggressionAfter: number;
  openingBefore: string;
  openingAfter: string;
  integrityComparison: string;
  openingReason: string;
}

export interface GridSeriesCanaryResult {
  canaryId: string;
  scenarioVersion: string;
  seriesId: string;
  baseSeed: number;
  seeds: readonly [number, number, number];
  simulatorVersion: "0.3.0";
  positioningModel: "grid-3x3-v1";
  matchCount: 3;
  matches: readonly GridSeriesCanaryMatchSummary[];
  score: { aiWins: number; bulwarkWins: number; draws: number };
  winner: "ai" | "bulwark" | null;
  adaptations: readonly GridSeriesCanaryAdaptationSummary[];
  artifactDirectory: string;
  artifacts: Array<{ name: string; path: string }>;
  manifest: GridSeriesCanaryManifestV1;
}

export interface GridSeriesCanaryManifestBuildInput {
  canaryId: string;
  seriesId: string;
  createdAt: string;
  baseSeed: number;
  seeds: readonly [number, number, number];
  outcome: GridSeriesCanaryCoreOutcome;
  digests: GridSeriesCanaryManifestV1["digests"];
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function buildGridSeriesCanaryManifest(
  input: GridSeriesCanaryManifestBuildInput,
): GridSeriesCanaryManifestV1 {
  const manifest: GridSeriesCanaryManifestV1 = {
    schemaVersion: "1",
    canaryKind: "grid-series",
    scenarioVersion: GRID_SERIES_CANARY_SCENARIO_VERSION,
    status: "passed",
    canaryId: input.canaryId,
    seriesId: input.seriesId,
    createdAt: input.createdAt,
    baseSeed: input.baseSeed,
    seeds: [...input.seeds],
    simulatorVersion: "0.3.0",
    positioningModel: "grid-3x3-v1",
    rulesetVersion: "0.2.0",
    catalogueVersion: "1",
    seriesRecordSchemaVersion: "2",
    matchRecordSchemaVersion: "3",
    factualReportSchemaVersion: "2",
    matchCount: 3,
    evidence: {
      allMatchesTerminated: input.outcome.evidence.allMatchesTerminated,
      allMatchRecordsV3: input.outcome.evidence.allMatchRecordsV3,
      allFactualReportsV2: input.outcome.evidence.allFactualReportsV2,
      allReportsBoundToRecords: input.outcome.evidence.allReportsBoundToRecords,
      allFallbackReviewsValid: input.outcome.evidence.allFallbackReviewsValid,
      allReplayFinalStatesAgree: input.outcome.evidence.allReplayFinalStatesAgree,
      allMovementZonesCanonical: input.outcome.evidence.allMovementZonesCanonical,
      translatedGridMovementObserved:
        input.outcome.evidence.translatedGridMovementObserved,
      combatAttemptObserved: input.outcome.evidence.combatAttemptObserved,
      policyAdaptationCount: input.outcome.evidence.policyAdaptationCount,
      adaptationFactsAgree: input.outcome.evidence.adaptationFactsAgree,
      seriesRoundTripPassed: true,
      adaptationTraceRoundTripPassed: true,
      deterministicReexecutionPassed: true,
      allArtifactsReadBack: true,
      bundleCrossAgreementPassed: true,
    },
    artifacts: {
      series: GRID_SERIES_CANARY_SERIES_FILE,
      matches: GRID_SERIES_CANARY_MATCHES_FILE,
      factualReports: GRID_SERIES_CANARY_FACTUAL_REPORTS_FILE,
      fallbackReviews: GRID_SERIES_CANARY_FALLBACK_REVIEWS_FILE,
      matchArtifacts: GRID_SERIES_CANARY_MATCH_ARTIFACTS_FILE,
      adaptationTrace: GRID_SERIES_CANARY_ADAPTATION_TRACE_FILE,
      seriesReport: GRID_SERIES_CANARY_SERIES_REPORT_FILE,
      manifest: GRID_SERIES_CANARY_MANIFEST_FILE,
    },
    digests: input.digests,
  };
  const parsed = deserializeGridSeriesCanaryManifestV1(
    serializeGridSeriesCanaryManifest(manifest),
  );
  if (!parsed.ok) {
    throw new Error(
      `Grid series canary manifest failed its authoritative schema: ${parsed.errors}`,
    );
  }
  return parsed.manifest;
}

export async function runGridSeriesCanary(
  request: GridSeriesCanaryRequest,
  dependencies: GridSeriesCanaryDependencies = {},
): Promise<GridSeriesCanaryResult> {
  const createUuid = dependencies.createUuid ?? randomUUID;
  const now = dependencies.now ?? (() => new Date());
  const fs = dependencies.fs ?? defaultCanaryFs;

  // 0. Output-root isolation guard (grid-series kind) before any directory is
  // created or any match is executed.
  assertCanaryOutputRootIsolation(request.outputRoot, "grid-series");

  // 1. Seed plan before any filesystem activity.
  const plan = createGridSeriesCanarySeedPlan(request.baseSeed);

  // 2. Physical-root guard before combat/series execution.
  await assertCanaryPhysicalRoot(request.outputRoot, "grid-series", fs);

  // 3. Generate five distinct UUIDs (canary, series, and three matches).
  const canaryId = createUuid();
  const seriesId = createUuid();
  const matchIds = [createUuid(), createUuid(), createUuid()];
  const allIds = [canaryId, seriesId, ...matchIds];
  for (const id of allIds) {
    if (!isUuid(id)) {
      throw new Error(
        `Grid series canary ID must be a valid UUID; received ${String(id)}`,
      );
    }
  }
  if (new Set(allIds).size !== allIds.length) {
    throw new Error(
      "Grid series canary IDs must be distinct (canary, series and three matches)",
    );
  }

  const createdAt = now().toISOString();

  // 4. Publication-path collision preflight before executing any match.
  const preflightFinal = await fsEntryKind(fs, join(request.outputRoot, canaryId));
  if (preflightFinal !== null) {
    throw new Error(
      `Grid series canary final path already exists (${preflightFinal}) and must not be modified or removed: ${join(request.outputRoot, canaryId)}`,
    );
  }
  const preflightTmp = await fsEntryKind(
    fs,
    join(request.outputRoot, `.tmp-${canaryId}`),
  );
  if (preflightTmp !== null) {
    throw new Error(
      `Grid series canary temporary path already exists (${preflightTmp}) and must not be reused or removed: ${join(request.outputRoot, `.tmp-${canaryId}`)}`,
    );
  }

  // 5. Execute the pure core with injected identities.
  const outcome = executeGridSeriesCanary({
    baseSeed: request.baseSeed,
    seriesId,
    matchIdentities: matchIds.map((matchId) => ({
      matchId,
      createdAt,
    })) as [
      { matchId: string; createdAt: string },
      { matchId: string; createdAt: string },
      { matchId: string; createdAt: string },
    ],
  });

  // 6. Build the series-record v2 and the series report.
  const series = buildGridSeriesCanarySeriesRecord({
    seriesId,
    createdAt,
    updatedAt: createdAt,
    matches: outcome.matches,
  });
  const seriesReport = buildGridSeriesCanaryReport(series);

  // 7. Build the four JSON envelopes.
  const matchesEnvelope = {
    schemaVersion: "1",
    seriesId,
    items: outcome.matches.map((match) => match.record),
  };
  const factualReportsEnvelope = {
    schemaVersion: "1",
    seriesId,
    items: outcome.matches.map((match) => match.report),
  };
  const fallbackReviewsEnvelope = {
    schemaVersion: "1",
    seriesId,
    items: outcome.matches.map((match) => ({
      matchNumber: match.matchNumber,
      matchId: match.matchId,
      review: match.fallbackReview,
    })),
  };
  const matchArtifactsEnvelope = {
    schemaVersion: "1",
    seriesId,
    items: outcome.matches.map((match) => ({
      matchNumber: match.matchNumber,
      matchId: match.matchId,
      textReplay: match.textReplay,
      asciiReplay: match.asciiReplay,
      reviewPrompt: match.reviewPrompt,
    })),
  };

  // 8. Serialize every artifact exactly once (these strings are the digests).
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

  // 9. Round trips: series, adaptation trace and all four envelopes.
  const seriesRoundTrip = deserializeSeriesRecord(serializedSeries);
  if (!seriesRoundTrip.ok || !isSeriesRecordV2(seriesRoundTrip.record)) {
    throw new Error(
      `Grid series canary series-record round trip failed: ${seriesRoundTrip.ok ? "not schema v2" : seriesRoundTrip.errors}`,
    );
  }
  if (seriesRoundTrip.record.seriesId !== seriesId) {
    throw new Error("Grid series canary series round trip changed the series ID");
  }
  const traceRoundTrip = deserializeGridSeriesCanaryAdaptationTrace(
    serializedAdaptationTrace,
  );
  if (!traceRoundTrip.ok) {
    throw new Error(
      `Grid series canary adaptation trace round trip failed: ${traceRoundTrip.errors}`,
    );
  }
  if (traceRoundTrip.trace.seriesId !== seriesId) {
    throw new Error("Grid series canary trace round trip changed the series ID");
  }
  const matchesRoundTrip = deserializeGridSeriesCanaryMatchesEnvelope(serializedMatches);
  if (!matchesRoundTrip.ok) {
    throw new Error(
      `Grid series canary matches envelope round trip failed: ${matchesRoundTrip.errors}`,
    );
  }
  const reportsRoundTrip = deserializeGridSeriesCanaryFactualReportsEnvelope(
    serializedFactualReports,
  );
  if (!reportsRoundTrip.ok) {
    throw new Error(
      `Grid series canary factual-reports envelope round trip failed: ${reportsRoundTrip.errors}`,
    );
  }
  const fallbackRoundTrip = deserializeGridSeriesCanaryFallbackReviewsEnvelope(
    serializedFallbackReviews,
  );
  if (!fallbackRoundTrip.ok) {
    throw new Error(
      `Grid series canary fallback-reviews envelope round trip failed: ${fallbackRoundTrip.errors}`,
    );
  }
  const artifactsRoundTrip = deserializeGridSeriesCanaryMatchArtifactsEnvelope(
    serializedMatchArtifacts,
  );
  if (!artifactsRoundTrip.ok) {
    throw new Error(
      `Grid series canary match-artifacts envelope round trip failed: ${artifactsRoundTrip.errors}`,
    );
  }

  // 10. Deterministic re-execution: the same injected identities must produce
  // the identical series, envelopes and trace.
  const reexecuted = executeGridSeriesCanary({
    baseSeed: request.baseSeed,
    seriesId,
    matchIdentities: matchIds.map((matchId) => ({
      matchId,
      createdAt,
    })) as [
      { matchId: string; createdAt: string },
      { matchId: string; createdAt: string },
      { matchId: string; createdAt: string },
    ],
  });
  const reexecutedSeries = buildGridSeriesCanarySeriesRecord({
    seriesId,
    createdAt,
    updatedAt: createdAt,
    matches: reexecuted.matches,
  });
  if (JSON.stringify(series) !== JSON.stringify(reexecutedSeries)) {
    throw new Error(
      "Grid series canary is not deterministic: series-record differs on re-execution",
    );
  }
  if (
    JSON.stringify(matchesEnvelope.items) !==
    JSON.stringify(reexecuted.matches.map((match) => match.record))
  ) {
    throw new Error(
      "Grid series canary is not deterministic: matches differ on re-execution",
    );
  }
  if (
    JSON.stringify(factualReportsEnvelope.items) !==
    JSON.stringify(reexecuted.matches.map((match) => match.report))
  ) {
    throw new Error(
      "Grid series canary is not deterministic: factual reports differ on re-execution",
    );
  }
  if (outcome.serializedAdaptationTrace !== reexecuted.serializedAdaptationTrace) {
    throw new Error(
      "Grid series canary is not deterministic: adaptation trace differs on re-execution",
    );
  }

  // 11. Digests of the seven non-manifest artifacts.
  const digests: GridSeriesCanaryManifestV1["digests"] = {
    series: sha256Hex(serializedSeries),
    matches: sha256Hex(serializedMatches),
    factualReports: sha256Hex(serializedFactualReports),
    fallbackReviews: sha256Hex(serializedFallbackReviews),
    matchArtifacts: sha256Hex(serializedMatchArtifacts),
    adaptationTrace: sha256Hex(serializedAdaptationTrace),
    seriesReport: sha256Hex(seriesReport),
  };

  // 12. Build the manifest only after all checks and all artifact contents and
  // digests exist.
  const manifest = buildGridSeriesCanaryManifest({
    canaryId,
    seriesId,
    createdAt,
    baseSeed: request.baseSeed,
    seeds: plan.seeds,
    outcome,
    digests,
  });

  // 13. Publish one atomic bundle with the shared immutable publisher. The
  // verify hook reads every artifact back, deserializes and revalidates the
  // complete bundle (enforcing allArtifactsReadBack and
  // bundleCrossAgreementPassed); the afterRootCreated hook re-inspects the
  // physical root.
  const artifactDirectory = await publishImmutableBundle({
    fs,
    outputRoot: request.outputRoot,
    canaryId,
    manifestFileName: GRID_SERIES_CANARY_MANIFEST_FILE,
    entryNames: GRID_SERIES_CANARY_BUNDLE_ENTRIES,
    artifacts: [
      { name: GRID_SERIES_CANARY_SERIES_FILE, content: serializedSeries },
      { name: GRID_SERIES_CANARY_MATCHES_FILE, content: serializedMatches },
      {
        name: GRID_SERIES_CANARY_FACTUAL_REPORTS_FILE,
        content: serializedFactualReports,
      },
      {
        name: GRID_SERIES_CANARY_FALLBACK_REVIEWS_FILE,
        content: serializedFallbackReviews,
      },
      {
        name: GRID_SERIES_CANARY_MATCH_ARTIFACTS_FILE,
        content: serializedMatchArtifacts,
      },
      {
        name: GRID_SERIES_CANARY_ADAPTATION_TRACE_FILE,
        content: serializedAdaptationTrace,
      },
      { name: GRID_SERIES_CANARY_SERIES_REPORT_FILE, content: seriesReport },
    ],
    serializedManifest: serializeGridSeriesCanaryManifest(manifest),
    verify: async ({ contents }) => {
      await verifyGridSeriesCanaryBundleContents(contents);
    },
    afterRootCreated: async () => {
      await assertCanaryPhysicalRoot(request.outputRoot, "grid-series", fs);
    },
  });

  // 14. Return a structured success result.
  return {
    canaryId,
    scenarioVersion: GRID_SERIES_CANARY_SCENARIO_VERSION,
    seriesId,
    baseSeed: request.baseSeed,
    seeds: plan.seeds,
    simulatorVersion: "0.3.0",
    positioningModel: "grid-3x3-v1",
    matchCount: 3,
    matches: outcome.matches.map((match) => ({
      matchNumber: match.matchNumber,
      matchId: match.matchId,
      seed: match.seed,
      rounds: match.rounds,
      winner: match.winner,
      resultMethod: match.resultMethod,
      eventCount: match.eventCount,
    })),
    score: series.score,
    winner: series.winner,
    adaptations: outcome.adaptations.map((adaptation) => ({
      sourceMatchNumber: adaptation.sourceMatchNumber,
      aggressionBefore: adaptation.decision.aggressionBefore,
      aggressionAfter: adaptation.decision.aggressionAfter,
      openingBefore: adaptation.policyBefore.opening,
      openingAfter: adaptation.policyAfter.opening,
      integrityComparison: adaptation.decision.integrityComparison,
      openingReason: adaptation.decision.openingReason,
    })),
    artifactDirectory,
    artifacts: GRID_SERIES_CANARY_BUNDLE_ENTRIES.map((name) => ({
      name,
      path: join(artifactDirectory, name),
    })),
    manifest,
  };
}

/**
 * Verifies the read-back bundle contents supplied by the shared publisher:
 * authoritative deserialization of every JSON artifact and the pure bundle
 * cross-agreement validator (identity, ordering, runtime, result, adaptation,
 * series, text contracts and every SHA-256 digest). The exact inventory,
 * regular-file, byte-for-byte, manifest-last and ownership guarantees are
 * provided by the shared immutable bundle publisher.
 */
export async function verifyGridSeriesCanaryBundleContents(
  contents: Record<string, string>,
): Promise<void> {
  const seriesParsed = deserializeSeriesRecord(contents[GRID_SERIES_CANARY_SERIES_FILE]!);
  if (!seriesParsed.ok || !isSeriesRecordV2(seriesParsed.record)) {
    throw new Error(
      `Grid series canary read-back: invalid series record: ${seriesParsed.ok ? "not schema v2" : seriesParsed.errors}`,
    );
  }
  const matchesParsed = deserializeGridSeriesCanaryMatchesEnvelope(
    contents[GRID_SERIES_CANARY_MATCHES_FILE]!,
  );
  if (!matchesParsed.ok) {
    throw new Error(
      `Grid series canary read-back: invalid matches envelope: ${matchesParsed.errors}`,
    );
  }
  const reportsParsed = deserializeGridSeriesCanaryFactualReportsEnvelope(
    contents[GRID_SERIES_CANARY_FACTUAL_REPORTS_FILE]!,
  );
  if (!reportsParsed.ok) {
    throw new Error(
      `Grid series canary read-back: invalid factual-reports envelope: ${reportsParsed.errors}`,
    );
  }
  const fallbackParsed = deserializeGridSeriesCanaryFallbackReviewsEnvelope(
    contents[GRID_SERIES_CANARY_FALLBACK_REVIEWS_FILE]!,
  );
  if (!fallbackParsed.ok) {
    throw new Error(
      `Grid series canary read-back: invalid fallback-reviews envelope: ${fallbackParsed.errors}`,
    );
  }
  const artifactsParsed = deserializeGridSeriesCanaryMatchArtifactsEnvelope(
    contents[GRID_SERIES_CANARY_MATCH_ARTIFACTS_FILE]!,
  );
  if (!artifactsParsed.ok) {
    throw new Error(
      `Grid series canary read-back: invalid match-artifacts envelope: ${artifactsParsed.errors}`,
    );
  }
  const traceParsed = deserializeGridSeriesCanaryAdaptationTrace(
    contents[GRID_SERIES_CANARY_ADAPTATION_TRACE_FILE]!,
  );
  if (!traceParsed.ok) {
    throw new Error(
      `Grid series canary read-back: invalid adaptation trace: ${traceParsed.errors}`,
    );
  }
  const manifestParsed = deserializeGridSeriesCanaryManifestV1(
    contents[GRID_SERIES_CANARY_MANIFEST_FILE]!,
  );
  if (!manifestParsed.ok) {
    throw new Error(
      `Grid series canary read-back: invalid manifest (v1 required): ${manifestParsed.errors}`,
    );
  }

  validateGridSeriesCanaryBundle({
    manifest: manifestParsed.manifest,
    series: seriesParsed.record,
    matchesEnvelope: matchesParsed.envelope,
    factualReportsEnvelope: reportsParsed.envelope,
    fallbackReviewsEnvelope: fallbackParsed.envelope,
    matchArtifactsEnvelope: artifactsParsed.envelope,
    adaptationTrace: traceParsed.trace,
    seriesReport: contents[GRID_SERIES_CANARY_SERIES_REPORT_FILE]!,
    serializedSeries: contents[GRID_SERIES_CANARY_SERIES_FILE]!,
    serializedMatches: contents[GRID_SERIES_CANARY_MATCHES_FILE]!,
    serializedFactualReports: contents[GRID_SERIES_CANARY_FACTUAL_REPORTS_FILE]!,
    serializedFallbackReviews: contents[GRID_SERIES_CANARY_FALLBACK_REVIEWS_FILE]!,
    serializedMatchArtifacts: contents[GRID_SERIES_CANARY_MATCH_ARTIFACTS_FILE]!,
    serializedAdaptationTrace: contents[GRID_SERIES_CANARY_ADAPTATION_TRACE_FILE]!,
  });
}
