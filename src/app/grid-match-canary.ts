import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
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

/** Minimal injectable filesystem for the atomic bundle writer. */
export interface CanaryFsEntry {
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

export interface CanaryFileSystem {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  writeFile(path: string, data: string, encoding?: "utf-8"): Promise<void>;
  readFile(path: string, encoding: "utf-8"): Promise<string>;
  readdir(path: string): Promise<string[]>;
  lstat(path: string): Promise<CanaryFsEntry>;
  rename(from: string, to: string): Promise<void>;
  rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
}

const defaultCanaryFs: CanaryFileSystem = {
  mkdir: async (path, options) => {
    await mkdir(path, options);
  },
  writeFile: (path, data, encoding) => writeFile(path, data, encoding),
  readFile: (path, encoding) => readFile(path, encoding),
  readdir: (path) => readdir(path),
  lstat: (path) => lstat(path),
  rename: (from, to) => rename(from, to),
  rm: (path, options) => rm(path, options),
};

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

function isCode(e: unknown, code: string): boolean {
  return e instanceof Error && "code" in e && (e as { code?: string }).code === code;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Describes a filesystem entry at `path` via `lstat` (so symbolic links and
 * broken symbolic links count as existing entries), or `null` when the path
 * does not exist. `lstat` is used, never `stat`, so collisions are detected
 * for the entry itself without following links.
 */
async function entryKind(
  fs: CanaryFileSystem,
  path: string,
): Promise<"directory" | "file" | "symbolic link" | "other" | null> {
  try {
    const entry = await fs.lstat(path);
    if (entry.isSymbolicLink()) return "symbolic link";
    if (entry.isDirectory()) return "directory";
    if (entry.isFile()) return "file";
    return "other";
  } catch (e) {
    if (isCode(e, "ENOENT")) return null;
    throw e;
  }
}

/**
 * Requires `dir` to contain exactly the seven canonical bundle entries, all
 * regular files, and nothing else (no missing artifact, no additional file,
 * no additional directory, no nested data, no symbolic link). Names are
 * sorted before comparison and must agree exactly with manifest v2.
 */
async function assertExactBundleInventory(
  fs: CanaryFileSystem,
  dir: string,
): Promise<void> {
  const names = (await fs.readdir(dir)).sort();
  const expected = [...GRID_CANARY_BUNDLE_ENTRIES].sort();
  if (names.length !== expected.length || names.some((n, i) => n !== expected[i])) {
    throw new Error(
      `Grid canary bundle inventory mismatch in ${dir}: expected exactly ${expected.join(", ")}; found ${names.length === 0 ? "nothing" : names.join(", ")}`,
    );
  }
  for (const name of names) {
    const entry = await fs.lstat(join(dir, name));
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Grid canary bundle artifact ${name} must be a regular file, not a symbolic link`,
      );
    }
    if (!entry.isFile()) {
      throw new Error(
        `Grid canary bundle artifact ${name} must be a regular file, not a directory`,
      );
    }
  }
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
  // Exact seven-entry inventory (regular files only, no symlinks) first.
  await assertExactBundleInventory(fs, dir);

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
 * Atomic, exclusive and immutable artifact bundle publication (Phase 3D2A.2).
 *
 * The final path `outputRoot/<canaryId>` and the temporary path
 * `outputRoot/.tmp-<canaryId>` are preflighted with `lstat` and must not exist
 * as any filesystem entry (directory, empty directory, regular file, symbolic
 * link, broken symbolic link or other). The complete bundle is then
 * constructed in the sibling temporary directory, which is created
 * **exclusively** with non-recursive `mkdir` (so a raced-in entry fails with
 * `EEXIST` and is never modified or removed). `manifest.json` is written last,
 * the temporary directory must contain exactly the seven canonical regular
 * files (exact inventory, no symlinks, no extra entries), then every one of
 * the seven files is read back: all seven strings must match the written
 * strings byte-for-byte, all four JSON artifacts are deserialized and
 * validated, the manifest must be schema v2, and the pure bundle
 * cross-agreement validator (identity, result, review, text contracts and
 * every SHA-256 digest) must pass. Only then is the completed temporary
 * directory atomically renamed to `<canaryId>`. After the rename the final
 * directory must also contain exactly the seven regular files and the complete
 * final bundle is reread and reverified; if any final-path check fails the
 * final directory is removed only because this invocation published it.
 *
 * Cleanup applies only to invocation-owned paths: the temporary directory is
 * removed only when this invocation successfully created it, and the final
 * directory is removed only when this invocation successfully published it and
 * final verification subsequently failed. Paths that existed before this
 * invocation are never reused, modified or removed, and the original
 * operational or verification error is preserved if cleanup also fails.
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
  const serializedManifest = serializeGridMatchCanaryManifest(manifest);

  // lstat-based preflight: neither path may exist as any filesystem entry.
  const finalCollision = await entryKind(fs, finalDir);
  if (finalCollision !== null) {
    throw new Error(
      `Grid canary final path already exists (${finalCollision}) and must not be modified or removed: ${finalDir}`,
    );
  }
  const tmpCollision = await entryKind(fs, tmpDir);
  if (tmpCollision !== null) {
    throw new Error(
      `Grid canary temporary path already exists (${tmpCollision}) and must not be reused or removed: ${tmpDir}`,
    );
  }

  // Invocation ownership tracking.
  let tmpCreatedByThisInvocation = false;
  let finalPublishedByThisInvocation = false;

  await fs.mkdir(outputRoot, { recursive: true });

  try {
    // Create the temporary directory exclusively (non-recursive), so a raced
    // entry between preflight and creation fails with EEXIST.
    await fs.mkdir(tmpDir, { recursive: false });
    tmpCreatedByThisInvocation = true;

    for (const artifact of artifacts) {
      await fs.writeFile(join(tmpDir, artifact.name), artifact.content, "utf-8");
    }
    // manifest.json is written last.
    await fs.writeFile(
      join(tmpDir, GRID_CANARY_MANIFEST_FILE),
      serializedManifest,
      "utf-8",
    );

    // Verify the complete temporary bundle (exact inventory + byte, schema,
    // digest and cross-agreement checks) before publishing.
    await verifyCanaryBundleAtPath(fs, tmpDir, artifacts, serializedManifest);

    // Atomically publish the completed temporary directory.
    await fs.rename(tmpDir, finalDir);
    finalPublishedByThisInvocation = true;

    // Verify the exact final bundle at the published path.
    await verifyCanaryBundleAtPath(fs, finalDir, artifacts, serializedManifest);
  } catch (e) {
    // Cleanup applies only to invocation-owned paths, and the original
    // operational or verification error is preserved if cleanup also fails.
    if (finalPublishedByThisInvocation) {
      try {
        await fs.rm(finalDir, { recursive: true, force: true });
      } catch {
        // best-effort removal of the invocation-published final directory
      }
    }
    if (tmpCreatedByThisInvocation) {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup of the invocation-created temporary directory
      }
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

  // 2. Generate and validate the canary identity before executing the match.
  const canaryId = createUuid();
  if (!isUuid(canaryId)) {
    throw new Error(`Canary ID must be a valid UUID; received ${String(canaryId)}`);
  }

  // 3. Publication-path collision preflight: the final and temporary paths
  // must not exist as any filesystem entry before the match is executed.
  const preflightFinal = await entryKind(fs, join(request.outputRoot, canaryId));
  if (preflightFinal !== null) {
    throw new Error(
      `Grid canary final path already exists (${preflightFinal}) and must not be modified or removed: ${join(request.outputRoot, canaryId)}`,
    );
  }
  const preflightTmp = await entryKind(fs, join(request.outputRoot, `.tmp-${canaryId}`));
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

  // 14. Persist one atomic canary bundle and validate the completed bundle.
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
