import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { runGridMatch } from "../simulator/grid-runtime.js";
import { RULESET_VERSION } from "../simulator/constants.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import { matchResultToRecord } from "../persistence/match-converter.js";
import { buildGridFactualReport } from "../reports/factual-match-report.js";
import { bindGridFactualReportToMatchRecord } from "../reports/grid-factual-report-binding.js";
import { renderTextReplay } from "../replay/text-replay-renderer.js";
import { renderAsciiReplay } from "../replay/ascii/ascii-replay-renderer.js";
import { buildReviewUserPrompt } from "../prompts/review-prompt.v1.js";
import { POSITIONING_MODEL_GRID } from "../schemas/positioning.schema.js";
import {
  deserializeMatchRecord,
  isV3Record,
  serializeMatchRecord,
  validateMatchRecord,
  type MatchRecordV3,
} from "../schemas/match-record.schema.js";
import {
  deserializeFactualMatchReport,
  isFactualReportV2,
  serializeFactualMatchReport,
  validateFactualMatchReport,
  type FactualMatchReportV2,
} from "../schemas/factual-report.schema.js";
import {
  deserializeMatchReview,
  serializeMatchReview,
  type MatchReview,
} from "../schemas/review.schema.js";
import {
  deserializeGridMatchCanaryManifestV2,
  serializeGridMatchCanaryManifest,
  validateGridMatchCanaryManifestV2,
  type GridMatchCanaryManifestV2,
} from "../schemas/grid-match-canary.schema.js";
import {
  createGridCanaryScenario,
  GRID_CANARY_SCENARIO_VERSION,
} from "../canary/grid-canary-scenario.js";
import {
  assertGridCanaryFinalAgreement,
  inspectGridCanaryEvidence,
  verifyGridCanaryDeterminism,
  type GridCanaryEvidence,
} from "../canary/grid-match-canary-evidence.js";
import { validateGridMatchCanaryBundle } from "../canary/grid-match-canary-bundle.js";
import { sha256Hex } from "../canary/grid-canary-digest.js";
import { buildDeterministicFallbackReview } from "../canary/grid-canary-fallback-review.js";
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
import type { GridMatchResult, MatchConfig } from "../simulator/types.js";

export type {
  CanaryFileSystem,
  CanaryFsEntry,
} from "../canary/immutable-canary-bundle.js";

export { buildDeterministicFallbackReview } from "../canary/grid-canary-fallback-review.js";

/**
 * Isolated deterministic grid match canary service (Milestone 0.2C Phase
 * 3D2A / 3D2A.1 / 3D2A.2).
 *
 * A deliberately isolated, deterministic, local-only single-match canary that
 * proves the complete grid pipeline works operationally:
 *
 *   built-in scenario
 *   → runGridMatch
 *   → match-record v3
 *   → factual-report v2
 *   → replay
 *   → deterministic fallback review
 *   → validated atomic artifact bundle
 *
 * It is separate from command-line parsing, consumes only a fresh direct
 * `runGridMatch` result (never imported records or user-supplied event
 * streams), never calls `runMatch`, `runSeries`, an `ArenaAgent`, a provider
 * or benchmark code, and writes exclusively under its dedicated output root.
 */
export const GRID_CANARY_DEFAULT_ROOT = join(
  process.cwd(),
  "data",
  "canary",
  "grid-match",
);

export const GRID_CANARY_MANIFEST_FILE = "manifest.json" as const;
export const GRID_CANARY_ARTIFACT_NAMES = {
  match: "match.json",
  factualReport: "factual-report.json",
  textReplay: "text-replay.txt",
  asciiReplay: "ascii-replay.txt",
  reviewPrompt: "review-prompt.txt",
  fallbackReview: "fallback-review.json",
  manifest: "manifest.json",
} as const;

/** Exact seven-entry bundle inventory (regular files only, no symlinks). */
export const GRID_CANARY_BUNDLE_ENTRIES: readonly string[] = Object.freeze([
  GRID_CANARY_MANIFEST_FILE,
  GRID_CANARY_ARTIFACT_NAMES.match,
  GRID_CANARY_ARTIFACT_NAMES.factualReport,
  GRID_CANARY_ARTIFACT_NAMES.textReplay,
  GRID_CANARY_ARTIFACT_NAMES.asciiReplay,
  GRID_CANARY_ARTIFACT_NAMES.reviewPrompt,
  GRID_CANARY_ARTIFACT_NAMES.fallbackReview,
]);

export interface GridMatchCanaryRequest {
  seed: number;
  outputRoot: string;
}

export interface GridMatchCanaryDependencies {
  createUuid?: () => string;
  now?: () => Date;
  fs?: CanaryFileSystem;
}

export interface GridMatchCanaryResult {
  canaryId: string;
  scenarioVersion: string;
  seed: number;
  simulatorVersion: "0.3.0";
  positioningModel: "grid-3x3-v1";
  matchId: string;
  rounds: number;
  winner: string | null;
  resultMethod: string;
  eventCount: number;
  evidence: GridCanaryEvidence;
  artifactDirectory: string;
  artifacts: Array<{ name: string; path: string }>;
  manifest: GridMatchCanaryManifestV2;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * The existing deterministic fallback review is now shared in
 * `src/canary/grid-canary-fallback-review.ts` and re-exported from here for
 * historical import compatibility.
 */
function requireTrue(value: boolean, label: string): asserts value is true {
  if (!value) {
    throw new Error(
      `Grid canary manifest requires ${label}; inspection did not establish it`,
    );
  }
}

function buildCanaryManifest(params: {
  canaryId: string;
  createdAt: string;
  seed: number;
  result: GridMatchResult;
  record: MatchRecordV3;
  report: FactualMatchReportV2;
  evidence: GridCanaryEvidence;
  digests: GridMatchCanaryManifestV2["digests"];
}): GridMatchCanaryManifestV2 {
  // The evidence inspector derives these and fails closed; the manifest only
  // records the derived values (never hard-coded).
  requireTrue(params.evidence.lateralFlankObserved, "a canonical lateral flank");
  requireTrue(
    params.evidence.stationaryFighterCellUnchanged,
    "the stationary fighter cell to remain unchanged",
  );

  const manifest: GridMatchCanaryManifestV2 = {
    schemaVersion: "2",
    canaryKind: "grid-match",
    scenarioVersion: GRID_CANARY_SCENARIO_VERSION,
    status: "passed",
    canaryId: params.canaryId,
    createdAt: params.createdAt,
    seed: params.seed,
    simulatorVersion: "0.3.0",
    positioningModel: "grid-3x3-v1",
    rulesetVersion: "0.2.0",
    catalogueVersion: "1",
    matchId: params.record.matchId,
    matchRecordSchemaVersion: "3",
    factualReportSchemaVersion: "2",
    rounds: params.result.rounds,
    winner: params.result.result.winner,
    resultMethod: params.result.result.method,
    eventCount: params.result.events.length,
    evidence: {
      translatedCircleEvents: params.evidence.translatedCircleEvents,
      cornerZonesVisited: params.evidence.cornerZonesVisited,
      lateralFlankObserved: params.evidence.lateralFlankObserved,
      observedFlankBearings: [...params.evidence.observedFlankBearings],
      strictRearExposureObserved: params.evidence.strictRearExposureObserved,
      stationaryFighterCellUnchanged: params.evidence.stationaryFighterCellUnchanged,
      allMovementZonesCanonical: true,
      recordRoundTripPassed: true,
      reportRoundTripPassed: true,
      replayFinalStateAgreement: true,
      fallbackReviewGenerated: true,
      allArtifactsReadBack: true,
      bundleCrossAgreementPassed: true,
    },
    digests: params.digests,
    artifacts: {
      match: GRID_CANARY_ARTIFACT_NAMES.match,
      factualReport: GRID_CANARY_ARTIFACT_NAMES.factualReport,
      textReplay: GRID_CANARY_ARTIFACT_NAMES.textReplay,
      asciiReplay: GRID_CANARY_ARTIFACT_NAMES.asciiReplay,
      reviewPrompt: GRID_CANARY_ARTIFACT_NAMES.reviewPrompt,
      fallbackReview: GRID_CANARY_ARTIFACT_NAMES.fallbackReview,
      manifest: GRID_CANARY_ARTIFACT_NAMES.manifest,
    },
  };
  const validated = validateGridMatchCanaryManifestV2(manifest);
  if (!validated.ok) {
    throw new Error(
      `Grid canary manifest failed its authoritative schema: ${validated.errors}`,
    );
  }
  return validated.manifest;
}

interface VerifiedBundle {
  record: MatchRecordV3;
  report: FactualMatchReportV2;
  review: MatchReview;
  manifest: GridMatchCanaryManifestV2;
  contents: Record<string, string>;
}

/**
 * Verifies the read-back bundle contents supplied by the shared immutable
 * publisher: authoritative deserialization of the four JSON artifacts,
 * manifest schema v2, and the pure bundle cross-agreement validator
 * (identity, result, review, text contracts and every SHA-256 digest). The
 * exact inventory, regular-file, byte-for-byte, manifest-last and ownership
 * guarantees are provided by the shared immutable bundle publisher.
 */
async function verifyGridCanaryBundleContents(
  contents: Record<string, string>,
): Promise<VerifiedBundle> {
  const recordParsed = deserializeMatchRecord(
    contents[GRID_CANARY_ARTIFACT_NAMES.match]!,
  );
  if (!recordParsed.ok || !isV3Record(recordParsed.record)) {
    throw new Error(
      `Grid canary read-back: invalid match record: ${recordParsed.ok ? "not schema v3" : recordParsed.errors}`,
    );
  }
  const reportParsed = deserializeFactualMatchReport(
    contents[GRID_CANARY_ARTIFACT_NAMES.factualReport]!,
  );
  if (!reportParsed.ok || !isFactualReportV2(reportParsed.report)) {
    throw new Error(
      `Grid canary read-back: invalid factual report: ${reportParsed.ok ? "not schema v2" : reportParsed.errors}`,
    );
  }
  const reviewParsed = deserializeMatchReview(
    contents[GRID_CANARY_ARTIFACT_NAMES.fallbackReview]!,
  );
  if (!reviewParsed.ok) {
    throw new Error(
      `Grid canary read-back: invalid fallback review: ${reviewParsed.errors instanceof Error ? reviewParsed.errors.message : String(reviewParsed.errors)}`,
    );
  }
  const manifestParsed = deserializeGridMatchCanaryManifestV2(
    contents[GRID_CANARY_MANIFEST_FILE]!,
  );
  if (!manifestParsed.ok) {
    throw new Error(
      `Grid canary read-back: invalid manifest (v2 required): ${manifestParsed.errors}`,
    );
  }

  validateGridMatchCanaryBundle({
    manifest: manifestParsed.manifest,
    record: recordParsed.record,
    report: reportParsed.report,
    fallbackReview: reviewParsed.review,
    textReplay: contents[GRID_CANARY_ARTIFACT_NAMES.textReplay]!,
    asciiReplay: contents[GRID_CANARY_ARTIFACT_NAMES.asciiReplay]!,
    reviewPrompt: contents[GRID_CANARY_ARTIFACT_NAMES.reviewPrompt]!,
    serializedMatch: contents[GRID_CANARY_ARTIFACT_NAMES.match]!,
    serializedFactualReport: contents[GRID_CANARY_ARTIFACT_NAMES.factualReport]!,
    serializedFallbackReview: contents[GRID_CANARY_ARTIFACT_NAMES.fallbackReview]!,
  });

  return {
    record: recordParsed.record,
    report: reportParsed.report,
    review: reviewParsed.review,
    manifest: manifestParsed.manifest,
    contents,
  };
}

export async function runGridMatchCanary(
  request: GridMatchCanaryRequest,
  dependencies: GridMatchCanaryDependencies = {},
): Promise<GridMatchCanaryResult> {
  const createUuid = dependencies.createUuid ?? randomUUID;
  const now = dependencies.now ?? (() => new Date());
  const fs = dependencies.fs ?? defaultCanaryFs;

  // 0. Output-root isolation guard: runs before any directory is created or
  // any match is executed. Protected normal storage roots and any non-canary
  // root inside the repository data tree are rejected.
  assertCanaryOutputRootIsolation(request.outputRoot, "grid-match");

  // 1. Validate the seed (before any filesystem activity).
  if (!Number.isInteger(request.seed) || request.seed < 0) {
    throw new Error(
      `Canary seed must be a non-negative integer; received ${String(request.seed)}`,
    );
  }

  // 1.1 Physical-root guard: every existing path component relevant to the
  // root must be a real directory (inspected with lstat; symbolic links and
  // junctions are rejected); missing components are created normally and the
  // complete ancestry is re-inspected after creation and again before any
  // artifact write.
  await assertCanaryPhysicalRoot(request.outputRoot, "grid-match", fs);

  // 2. Generate and validate the canary identity before executing the match.
  const canaryId = createUuid();
  if (!isUuid(canaryId)) {
    throw new Error(`Canary ID must be a valid UUID; received ${String(canaryId)}`);
  }

  // 3. Publication-path collision preflight: the final and temporary paths
  // must not exist as any filesystem entry before the match is executed.
  const preflightFinal = await fsEntryKind(fs, join(request.outputRoot, canaryId));
  if (preflightFinal !== null) {
    throw new Error(
      `Grid canary final path already exists (${preflightFinal}) and must not be modified or removed: ${join(request.outputRoot, canaryId)}`,
    );
  }
  const preflightTmp = await fsEntryKind(
    fs,
    join(request.outputRoot, `.tmp-${canaryId}`),
  );
  if (preflightTmp !== null) {
    throw new Error(
      `Grid canary temporary path already exists (${preflightTmp}) and must not be reused or removed: ${join(request.outputRoot, `.tmp-${canaryId}`)}`,
    );
  }

  // 4. Create the frozen canary scenario (fresh values per call).
  const scenario = createGridCanaryScenario();

  // 5. Execute runGridMatch directly.
  const matchConfig: MatchConfig = {
    seed: request.seed,
    fighterA: scenario.fighterA,
    fighterB: scenario.fighterB,
    rulesetVersion: RULESET_VERSION,
    catalogueVersion: CATALOGUE_V1.version,
  };
  const result = runGridMatch(matchConfig);

  // 6. Validate direct result identity and scenario invariants (fail closed).
  const evidence = inspectGridCanaryEvidence(result);

  // Determinism: re-execute the same seed and scenario and compare.
  verifyGridCanaryDeterminism(matchConfig, result);

  // 7. Convert the result to a persisted match record.
  const converted = matchResultToRecord(result, []);
  if (!isV3Record(converted)) {
    throw new Error("Grid canary match record must be schema v3");
  }
  const record: MatchRecordV3 = converted;

  // 8. Build the factual-report v2 and bind it to the persisted match UUID.
  const unboundReport = buildGridFactualReport(result);
  const report = bindGridFactualReportToMatchRecord(unboundReport, record);

  // 9. Validate the match record and the factual report.
  const recordValidation = validateMatchRecord(record);
  if (!recordValidation.ok) {
    throw new Error(
      `Grid canary match record failed validation: ${recordValidation.errors}`,
    );
  }
  const reportValidation = validateFactualMatchReport(report);
  if (!reportValidation.ok) {
    throw new Error(
      `Grid canary factual report failed validation: ${reportValidation.errors}`,
    );
  }

  // 10. Reconstruct final state through replay and compare with the report.
  assertGridCanaryFinalAgreement(result, report);

  // 11. Render text replay, ASCII replay, review prompt and fallback review.
  const textReplay = renderTextReplay(result);
  const asciiReplay = renderAsciiReplay(
    result,
    { mode: "ascii" },
    POSITIONING_MODEL_GRID,
  );
  const reviewPrompt = buildReviewUserPrompt(report);
  const fallbackReview = buildDeterministicFallbackReview(report);

  // 12. Serialize/deserialize round trips for record and report.
  const serializedRecord = serializeMatchRecord(record);
  const recordRoundTrip = deserializeMatchRecord(serializedRecord);
  if (!recordRoundTrip.ok || !isV3Record(recordRoundTrip.record)) {
    throw new Error("Grid canary record serialization/deserialization round trip failed");
  }
  if (recordRoundTrip.record.matchId !== record.matchId) {
    throw new Error("Grid canary record round trip changed the match ID");
  }
  const serializedReport = serializeFactualMatchReport(report);
  const reportRoundTrip = deserializeFactualMatchReport(serializedReport);
  if (!reportRoundTrip.ok || !isFactualReportV2(reportRoundTrip.report)) {
    throw new Error(
      "Grid canary factual report serialization/deserialization round trip failed",
    );
  }
  if (reportRoundTrip.report.matchId !== record.matchId) {
    throw new Error("Grid canary factual report round trip changed the bound match ID");
  }
  const serializedReview = serializeMatchReview(fallbackReview);

  // 13. Build the manifest only after all checks and all six artifact contents
  // and digests exist. The canary ID was generated and preflighted earlier.
  const manifest = buildCanaryManifest({
    canaryId,
    createdAt: now().toISOString(),
    seed: request.seed,
    result,
    record,
    report,
    evidence,
    digests: {
      match: sha256Hex(serializedRecord),
      factualReport: sha256Hex(serializedReport),
      textReplay: sha256Hex(textReplay),
      asciiReplay: sha256Hex(asciiReplay),
      reviewPrompt: sha256Hex(reviewPrompt),
      fallbackReview: sha256Hex(serializedReview),
    },
  });

  // 14. Persist one atomic canary bundle (shared immutable publisher) and
  // validate the completed bundle.
  const artifactDirectory = await publishImmutableBundle({
    fs,
    outputRoot: request.outputRoot,
    canaryId,
    manifestFileName: GRID_CANARY_MANIFEST_FILE,
    entryNames: GRID_CANARY_BUNDLE_ENTRIES,
    artifacts: [
      { name: GRID_CANARY_ARTIFACT_NAMES.match, content: serializedRecord },
      { name: GRID_CANARY_ARTIFACT_NAMES.factualReport, content: serializedReport },
      { name: GRID_CANARY_ARTIFACT_NAMES.textReplay, content: textReplay },
      { name: GRID_CANARY_ARTIFACT_NAMES.asciiReplay, content: asciiReplay },
      { name: GRID_CANARY_ARTIFACT_NAMES.reviewPrompt, content: reviewPrompt },
      {
        name: GRID_CANARY_ARTIFACT_NAMES.fallbackReview,
        content: serializedReview,
      },
    ],
    serializedManifest: serializeGridMatchCanaryManifest(manifest),
    verify: async ({ contents }) => {
      await verifyGridCanaryBundleContents(contents);
    },
    afterRootCreated: async () => {
      await assertCanaryPhysicalRoot(request.outputRoot, "grid-match", fs);
    },
  });

  // 15. Return a structured success result.
  return {
    canaryId,
    scenarioVersion: GRID_CANARY_SCENARIO_VERSION,
    seed: request.seed,
    simulatorVersion: "0.3.0",
    positioningModel: "grid-3x3-v1",
    matchId: record.matchId,
    rounds: result.rounds,
    winner: result.result.winner,
    resultMethod: result.result.method,
    eventCount: result.events.length,
    evidence,
    artifactDirectory,
    artifacts: Object.values(GRID_CANARY_ARTIFACT_NAMES).map((name) => ({
      name,
      path: join(artifactDirectory, name),
    })),
    manifest,
  };
}
