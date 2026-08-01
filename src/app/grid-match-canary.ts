import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runGridMatch } from "../simulator/grid-runtime.js";
import { RULESET_VERSION } from "../simulator/constants.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import { matchResultToRecord } from "../persistence/match-converter.js";
import { buildGridFactualReport } from "../reports/factual-match-report.js";
import { bindGridFactualReportToMatchRecord } from "../reports/grid-factual-report-binding.js";
import { renderTextReplay } from "../replay/text-replay-renderer.js";
import { renderAsciiReplay } from "../replay/ascii/ascii-replay-renderer.js";
import {
  buildFallbackReview,
  buildReviewUserPrompt,
} from "../prompts/review-prompt.v1.js";
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
  validateMatchReview,
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
import { assertCanaryOutputRootIsolation } from "./grid-canary-output-root.js";
import type { GridMatchResult, MatchConfig } from "../simulator/types.js";
import type { FighterStateSummaryV2 } from "../schemas/factual-report.schema.js";

/**
 * Isolated deterministic grid match canary service (Milestone 0.2C Phase
 * 3D2A).
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

/** Minimal injectable filesystem for the atomic bundle writer. */
export interface CanaryFileSystem {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  writeFile(path: string, data: string, encoding?: "utf-8"): Promise<void>;
  readFile(path: string, encoding: "utf-8"): Promise<string>;
  rename(from: string, to: string): Promise<void>;
  rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
}

const defaultCanaryFs: CanaryFileSystem = {
  mkdir: async (path, options) => {
    await mkdir(path, options);
  },
  writeFile: (path, data, encoding) => writeFile(path, data, encoding),
  readFile: (path, encoding) => readFile(path, encoding),
  rename: (from, to) => rename(from, to),
  rm: (path, options) => rm(path, options),
};

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

function isCode(e: unknown, code: string): boolean {
  return e instanceof Error && "code" in e && (e as { code?: string }).code === code;
}

/**
 * The existing deterministic fallback review (reused from the deepseek agent's
 * fallback shape) produced without instantiating any provider.
 */
export function buildDeterministicFallbackReview(
  report: FactualMatchReportV2,
): MatchReview {
  const fallbackReview: MatchReview = {
    schemaVersion: "1",
    summary: buildFallbackReview(report),
    keyMoments: [],
    strategyAssessment: {
      effectiveChoices: [],
      ineffectiveChoices: [],
      policyAssessment: "AI review unavailable.",
      designAssessment: "AI review unavailable.",
    },
    suggestedChanges: [],
    confidence: "low",
    observedOutcome: {
      winnerId: report.winner,
      method: report.resultMethod,
      rounds: report.rounds,
      ownFinalIntegrity: report.finalStates.fighterA.integrity,
      opponentFinalIntegrity: report.finalStates.fighterB.integrity,
      ownDisabledComponents: normaliseDisabledComponents(report.finalStates.fighterA),
      opponentDisabledComponents: normaliseDisabledComponents(
        report.finalStates.fighterB,
      ),
    },
  };
  const validated = validateMatchReview(fallbackReview);
  if (!validated.ok) {
    throw new Error(
      `Grid canary fallback review failed its schema: ${validated.errors.message}`,
    );
  }
  return validated.review;
}

function normaliseDisabledComponents(
  state: FighterStateSummaryV2,
): Array<"mobility" | "weapon" | "utility"> {
  const result: Array<"mobility" | "weapon" | "utility"> = [];
  if (state.mobilityDisabled) result.push("mobility");
  if (state.weaponDisabled) result.push("weapon");
  if (state.utilityDisabled) result.push("utility");
  return result;
}

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

interface BundleArtifact {
  name: string;
  content: string;
}

interface VerifiedBundle {
  record: MatchRecordV3;
  report: FactualMatchReportV2;
  review: MatchReview;
  manifest: GridMatchCanaryManifestV2;
  contents: Record<string, string>;
}

/**
 * Reads every artifact of a bundle at `dir` and verifies the complete bundle:
 * byte-for-byte equality of all seven artifacts (the six non-manifest artifacts
 * against the strings that were written, and `manifest.json` against the
 * exact serialized manifest the service wrote), authoritative deserialization
 * of the four JSON artifacts, manifest schema v2, and the pure bundle
 * cross-agreement validator (including every SHA-256 digest).
 */
async function verifyCanaryBundleAtPath(
  fs: CanaryFileSystem,
  dir: string,
  artifacts: readonly BundleArtifact[],
  serializedManifest: string,
): Promise<VerifiedBundle> {
  const contents: Record<string, string> = {};
  for (const name of [
    GRID_CANARY_ARTIFACT_NAMES.match,
    GRID_CANARY_ARTIFACT_NAMES.factualReport,
    GRID_CANARY_ARTIFACT_NAMES.textReplay,
    GRID_CANARY_ARTIFACT_NAMES.asciiReplay,
    GRID_CANARY_ARTIFACT_NAMES.reviewPrompt,
    GRID_CANARY_ARTIFACT_NAMES.fallbackReview,
    GRID_CANARY_MANIFEST_FILE,
  ]) {
    contents[name] = await fs.readFile(join(dir, name), "utf-8");
  }

  for (const artifact of artifacts) {
    if (contents[artifact.name] !== artifact.content) {
      throw new Error(
        `Grid canary read-back: ${artifact.name} does not byte-for-byte match the written artifact`,
      );
    }
  }
  if (contents[GRID_CANARY_MANIFEST_FILE] !== serializedManifest) {
    throw new Error(
      "Grid canary read-back: manifest.json does not byte-for-byte match the written manifest",
    );
  }

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

/**
 * Atomic and isolated artifact bundle publication (Phase 3D2A.1).
 *
 * The complete bundle is constructed in a sibling temporary directory
 * `.tmp-<canaryId>`, `manifest.json` is written last, then every one of the
 * seven files is read back: the six non-manifest artifacts must match the
 * written strings byte-for-byte, all four JSON artifacts are deserialized and
 * validated, the manifest must be schema v2, the pure bundle cross-agreement
 * validator (identity, result, review, text contracts and every SHA-256
 * digest) must pass, and only then is the completed temporary directory
 * atomically renamed to `<canaryId>`. After the rename the complete final
 * bundle is reread and reverified; if final-path verification fails the final
 * directory is removed recursively and the original verification error is
 * preserved. On any failure no final canary directory exists, the temporary
 * directory is removed recursively and the original error is preserved. An
 * existing final canary directory is never overwritten.
 */
async function publishCanaryBundle(
  fs: CanaryFileSystem,
  outputRoot: string,
  canaryId: string,
  artifacts: readonly BundleArtifact[],
  manifest: GridMatchCanaryManifestV2,
): Promise<string> {
  const finalDir = join(outputRoot, canaryId);
  const tmpDir = join(outputRoot, `.tmp-${canaryId}`);

  // Never overwrite an existing canary directory.
  try {
    await fs.readFile(join(finalDir, GRID_CANARY_MANIFEST_FILE), "utf-8");
    throw new Error(`Canary directory already exists: ${finalDir}`);
  } catch (e) {
    if (isCode(e, "ENOENT")) {
      // final directory does not exist — safe to publish.
    } else {
      throw e;
    }
  }

  await fs.mkdir(outputRoot, { recursive: true });

  try {
    await fs.mkdir(tmpDir, { recursive: true });

    for (const artifact of artifacts) {
      await fs.writeFile(join(tmpDir, artifact.name), artifact.content, "utf-8");
    }
    // manifest.json is written last.
    await fs.writeFile(
      join(tmpDir, GRID_CANARY_MANIFEST_FILE),
      serializeGridMatchCanaryManifest(manifest),
      "utf-8",
    );

    // Verify the complete temporary bundle before publishing.
    await verifyCanaryBundleAtPath(
      fs,
      tmpDir,
      artifacts,
      serializeGridMatchCanaryManifest(manifest),
    );

    // Atomically publish the completed temporary directory.
    await fs.rename(tmpDir, finalDir);

    // Verify the complete final bundle at the published path. On failure
    // remove the final directory and preserve the original verification error.
    try {
      await verifyCanaryBundleAtPath(
        fs,
        finalDir,
        artifacts,
        serializeGridMatchCanaryManifest(manifest),
      );
    } catch (finalError) {
      try {
        await fs.rm(finalDir, { recursive: true, force: true });
      } catch {
        // best-effort removal of the final directory
      }
      throw finalError;
    }
  } catch (e) {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup of the temporary directory
    }
    throw e;
  }

  return finalDir;
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
  assertCanaryOutputRootIsolation(request.outputRoot);

  // 1. Validate the seed.
  if (!Number.isInteger(request.seed) || request.seed < 0) {
    throw new Error(
      `Canary seed must be a non-negative integer; received ${String(request.seed)}`,
    );
  }

  // 2. Create the frozen canary scenario (fresh values per call).
  const scenario = createGridCanaryScenario();

  // 3. Execute runGridMatch directly.
  const matchConfig: MatchConfig = {
    seed: request.seed,
    fighterA: scenario.fighterA,
    fighterB: scenario.fighterB,
    rulesetVersion: RULESET_VERSION,
    catalogueVersion: CATALOGUE_V1.version,
  };
  const result = runGridMatch(matchConfig);

  // 4. Validate direct result identity and scenario invariants (fail closed).
  const evidence = inspectGridCanaryEvidence(result);

  // Determinism: re-execute the same seed and scenario and compare.
  verifyGridCanaryDeterminism(matchConfig, result);

  // 5. Convert the result to a persisted match record.
  const converted = matchResultToRecord(result, []);
  if (!isV3Record(converted)) {
    throw new Error("Grid canary match record must be schema v3");
  }
  const record: MatchRecordV3 = converted;

  // 7. Build the factual-report v2 and bind it to the persisted match UUID.
  const unboundReport = buildGridFactualReport(result);
  const report = bindGridFactualReportToMatchRecord(unboundReport, record);

  // 9-10. Validate the match record and the factual report.
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

  // 16. Reconstruct final state through replay and compare with the report.
  assertGridCanaryFinalAgreement(result, report);

  // 11-14. Render text replay, ASCII replay, review prompt and fallback review.
  const textReplay = renderTextReplay(result);
  const asciiReplay = renderAsciiReplay(
    result,
    { mode: "ascii" },
    POSITIONING_MODEL_GRID,
  );
  const reviewPrompt = buildReviewUserPrompt(report);
  const fallbackReview = buildDeterministicFallbackReview(report);

  // 15. Serialize/deserialize round trips for record and report.
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

  // 17. Build the manifest only after all checks and all six artifact contents
  // and digests exist.
  const canaryId = createUuid();
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

  // 18-19. Persist one atomic canary bundle and validate the completed bundle.
  const artifactDirectory = await publishCanaryBundle(
    fs,
    request.outputRoot,
    canaryId,
    [
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
    manifest,
  );

  // 20. Return a structured success result.
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
