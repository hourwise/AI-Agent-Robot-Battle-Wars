import { randomUUID } from "node:crypto";
import { join } from "node:path";
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
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import { validateBuild } from "../validation/build-validator.js";
import { POSITIONING_MODEL_GRID } from "../schemas/positioning.schema.js";
import {
  getComponentQualificationConfig,
  getComponentQualificationMetadata,
} from "../simulator/component-qualification-registry.js";
import { GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES } from "../readiness/grid-opt-in-beta-governance-bundle.js";
import { anchorOfficialGridOptInBetaGovernanceDecision } from "../readiness/grid-opt-in-beta-official-identity.js";
import type { GridOptInBetaSourceCommitReader } from "../readiness/grid-source-commit-reader.js";
import { GitSourceCommitReader } from "../readiness/grid-source-commit-reader.js";
import { matchResultToRecord } from "../persistence/match-converter.js";
import type { GridMatchResult } from "../simulator/types.js";
import { buildGridFactualReport } from "../reports/factual-match-report.js";
import { bindGridFactualReportToMatchRecord } from "../reports/grid-factual-report-binding.js";
import { renderTextReplay } from "../replay/text-replay-renderer.js";
import { renderAsciiReplay } from "../replay/ascii/ascii-replay-renderer.js";
import { buildReviewUserPrompt } from "../prompts/review-prompt.v1.js";
import {
  isV3Record,
  serializeMatchRecord,
  validateMatchRecord,
  type MatchRecordV3,
} from "../schemas/match-record.schema.js";
import {
  serializeFactualMatchReport,
  validateFactualMatchReport,
} from "../schemas/factual-report.schema.js";
import {
  assertGridReadinessRecordReportFinalAgreement,
  gridRecordToGridResult,
  inspectGridReadinessRecordEvidence,
} from "../readiness/record-evidence.js";
import {
  GRID_BETA_MATCH_BUNDLE_ENTRIES,
  GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT,
  GRID_BETA_MATCH_FACTUAL_REPORT_ARTIFACT,
  GRID_BETA_MATCH_FIGHTER_A_ARTIFACT,
  GRID_BETA_MATCH_FIGHTER_B_ARTIFACT,
  GRID_BETA_MATCH_MANIFEST_FILE,
  GRID_BETA_MATCH_RECORD_ARTIFACT,
  GRID_BETA_MATCH_REVIEW_PROMPT_ARTIFACT,
  GRID_BETA_MATCH_SELECTION_ARTIFACT,
  GRID_BETA_MATCH_ASCII_REPLAY_ARTIFACT,
  GRID_BETA_MATCH_TEXT_REPLAY_ARTIFACT,
  buildGridBetaExecutionAttestation,
  buildGridBetaMatchManifest,
  buildGridBetaSelection,
  deserializeGridBetaMatchManifest,
  serializeGridBetaExecutionAttestation,
  serializeGridBetaMatchManifest,
  serializeGridBetaSelection,
  validateGridBetaMatchBundle,
  type GridBetaMatchManifestV1,
  type GridBetaSelectionV1,
} from "../beta/grid-beta-match-bundle.js";
import {
  createGridBetaFighterExecutionValues,
  gridBetaFighterSpecChecksum,
  loadGridBetaFighterSpec,
  serializeGridBetaFighterSpec,
  type GridBetaFighterSpecV1,
} from "../beta/grid-beta-fighter-spec.js";
import {
  assertCanonicalGridBetaPreflightPass,
  runGridBetaLegacyIsolationPreflight,
} from "../beta/grid-beta-legacy-preflight.js";
import {
  executeGridBetaMatch,
  gridBetaMatchResultChecksum,
} from "../beta/grid-beta-execution-core.js";
import {
  assertSuspensionMarkerAbsent,
  createGridBetaSuspensionMarker,
  GridBetaSafetyError,
  type GridBetaSuspensionTrigger,
} from "../beta/grid-beta-suspension.js";
import {
  GRID_OPT_IN_BETA_FIGHTER_ROOT,
  GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ID,
  GRID_OPT_IN_BETA_MATCH_OUTPUT_ROOT,
  GRID_OPT_IN_BETA_SUSPENSION_MARKER_PATH,
} from "../beta/grid-beta-identity.js";

/**
 * Grid beta match application service (Milestone 0.2C Phase 3G, Phases 1, 8
 * and 12).
 *
 * The explicitly selected, internal/development, local-scripted, single-match
 * grid-beta surface. Before any beta match ID is generated, any simulation
 * occurs or any artifact directory is created, the official seven-file
 * governance bundle is read, snapshotted and anchored with
 * `anchorOfficialGridOptInBetaGovernanceDecision` (which also requires the
 * exact reviewed Git source snapshot). The governance bytes are re-checked
 * immediately before simulation and immediately before publication, the
 * suspension marker is checked at three checkpoints, and a read-only
 * protected-source preflight runs against the current checkout. Any confirmed
 * safety trigger engages the one suspension marker and publishes no beta
 * bundle. User/input errors (bad arguments, missing fighters, fighter-schema
 * errors) never suspend the beta.
 */

export class GridBetaMatchError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GridBetaMatchError";
  }
}

export const GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_DIR = join(
  process.cwd(),
  "data",
  "readiness",
  "grid-governance",
  GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ID,
);

export interface GridBetaMatchRequest {
  readonly seed: number;
  readonly fighterA: string;
  readonly fighterB: string;
  readonly acknowledgement: true;
}

export interface GridBetaMatchDependencies {
  readonly createUuid?: () => string;
  readonly now?: () => Date;
  readonly fs?: CanaryFileSystem;
  readonly sourceCommitReader?: GridOptInBetaSourceCommitReader;
  /**
   * Optional execution-entry observer (tests only). Invoked immediately
   * before the fixed `executeGridBetaMatch(...)` call. It receives no match
   * data, cannot cancel, replace or mutate execution, and never produces an
   * alternate result or simulator.
   */
  readonly onExecutionStart?: () => void;
}

export interface GridBetaMatchResult {
  readonly matchId: string;
  readonly createdAt: string;
  readonly winner: string | null;
  readonly method: string;
  readonly rounds: number;
  readonly fighterAChecksum: string;
  readonly fighterBChecksum: string;
  readonly primaryResultChecksum: string;
  readonly repeatResultChecksum: string;
  readonly selection: GridBetaSelectionV1;
  readonly manifest: GridBetaMatchManifestV1;
  readonly artifactDirectory: string;
  readonly artifacts: Array<{ name: string; path: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Order-insensitive deep equality. The persisted record may rebuild objects
 * (e.g., initial fighter states) with a different key order while carrying
 * identical values; JSON equality would false-flag those as disagreements.
 */
function deepEqualOrderInsensitive(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length &&
      a.every((value, index) => deepEqualOrderInsensitive(value, b[index]))
    );
  }
  if (a !== null && typeof a === "object" && b !== null && typeof b === "object") {
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    return (
      keysA.length === keysB.length &&
      keysA.every(
        (key, index) =>
          key === keysB[index] &&
          deepEqualOrderInsensitive(
            (a as Record<string, unknown>)[key],
            (b as Record<string, unknown>)[key],
          ),
      )
    );
  }
  return a === b;
}

async function readGovernanceBundle(
  fs: CanaryFileSystem,
  dir: string,
): Promise<Record<string, string>> {
  let names: string[];
  try {
    // List every directory entry, including dotfiles (never filtered).
    names = await fs.readdir(dir);
  } catch (e) {
    throw new GridBetaMatchError(
      `official governance bundle is absent or unreadable at ${dir}: ${
        e instanceof Error ? e.message : String(e)
      }`,
      { cause: e },
    );
  }
  // Both the actual and the expected lists are sorted before the exact
  // equality comparison.
  names.sort();
  const expected = [...GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES].sort();
  if (names.length !== expected.length || names.some((n, i) => n !== expected[i])) {
    throw new GridBetaMatchError(
      `official governance bundle must contain exactly seven files; found: ${names.length === 0 ? "nothing" : names.join(", ")}`,
    );
  }
  const contents: Record<string, string> = {};
  for (const name of GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES) {
    const entry = await fs.lstat(join(dir, name));
    if (entry.isSymbolicLink() || !entry.isFile()) {
      throw new GridBetaMatchError(
        `official governance artifact ${name} must be a regular file, not a symbolic link or directory`,
      );
    }
    contents[name] = await fs.readFile(join(dir, name), "utf-8");
  }
  return contents;
}

async function assertGovernanceBundleUnchanged(
  fs: CanaryFileSystem,
  dir: string,
  retained: Record<string, string>,
): Promise<void> {
  const current = await readGovernanceBundle(fs, dir);
  for (const name of GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES) {
    if (current[name] !== retained[name]) {
      throw new GridBetaMatchError(
        `official governance artifact ${name} changed since it was anchored`,
      );
    }
  }
}

/**
 * Engages the one deterministic suspension switch for a confirmed safety
 * trigger. If marker creation itself fails, the beta still fails closed and
 * reports both the original safety trigger and the marker-write failure.
 */
async function suspendBeta(
  fs: CanaryFileSystem,
  markerPath: string,
  now: () => Date,
  trigger: GridBetaSuspensionTrigger,
  message: string,
): Promise<never> {
  const createdAt = now().toISOString();
  let markerWriteError: string | null = null;
  try {
    await createGridBetaSuspensionMarker(fs, markerPath, { trigger, message, createdAt });
  } catch (e) {
    markerWriteError = e instanceof Error ? e.message : String(e);
  }
  if (markerWriteError !== null) {
    throw new GridBetaMatchError(
      `Grid beta suspended (${trigger}): ${message}. The suspension marker could not be written: ${markerWriteError}`,
    );
  }
  throw new GridBetaMatchError(
    `Grid beta suspended (${trigger}): ${message}. Suspension marker created at ${markerPath}.`,
  );
}

/**
 * Production grid beta match entry point (Milestone 0.2C Phase 3G.1.2,
 * Phase 1).
 *
 * This is the one fixed beta match service boundary and the only match
 * operation exported by this module. It always uses exactly the frozen
 * canonical roots (`data/beta/grid-fighters`, `data/beta/grid-matches`,
 * `data/readiness/grid-governance/58e8cd87-504e-4b5f-9bac-f6b81d82377b` and
 * `data/beta/GRID_BETA_SUSPENDED`) and always enters the fixed imported
 * `executeGridBetaMatch` (which hard-codes `runGridMatch`). The public match
 * request contains only `seed`, `fighterA`, `fighterB` and `acknowledgement`;
 * there are no root overrides, no exported environment/root-selection API and
 * no alternate execution injection. The general dependency contract keeps the
 * existing injectable filesystem, source-commit reader, UUID, clock and a
 * non-result-producing execution-entry observer as general testability seams;
 * the observer cannot cancel, replace or mutate execution.
 */
export async function runGridBetaMatch(
  request: GridBetaMatchRequest,
  dependencies: GridBetaMatchDependencies = {},
): Promise<GridBetaMatchResult> {
  const createUuid = dependencies.createUuid ?? randomUUID;
  const now = dependencies.now ?? (() => new Date());
  const fs = dependencies.fs ?? defaultCanaryFs;
  const sourceCommitReader =
    dependencies.sourceCommitReader ?? new GitSourceCommitReader();
  const outputRoot = GRID_OPT_IN_BETA_MATCH_OUTPUT_ROOT;
  const fighterRoot = GRID_OPT_IN_BETA_FIGHTER_ROOT;
  const governanceDir = GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_DIR;
  const markerPath = GRID_OPT_IN_BETA_SUSPENSION_MARKER_PATH;

  // 0. Input validation (user errors — never a suspension trigger).
  if (request.acknowledgement !== true) {
    throw new GridBetaMatchError(
      "the explicit grid beta acknowledgement (--acknowledge-grid-beta) is required before any beta match",
    );
  }
  if (!Number.isSafeInteger(request.seed) || request.seed < 0) {
    throw new GridBetaMatchError(
      `grid beta seed must be a non-negative integer; received ${String(request.seed)}`,
    );
  }

  // 1. Output-root isolation guard before any ID, simulation or write.
  try {
    assertCanaryOutputRootIsolation(outputRoot, "grid-beta-match");
  } catch (e) {
    return suspendBeta(
      fs,
      markerPath,
      now,
      "cross_root_persistence_failure",
      `beta output root failed the isolation guard: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // 2. Suspension marker check #1 (before governance anchoring).
  try {
    await assertSuspensionMarkerAbsent(fs, markerPath);
  } catch (e) {
    throw new GridBetaMatchError(e instanceof Error ? e.message : String(e));
  }

  // 3. Governance anchor before any beta match ID, simulation or artifact
  //    directory is created. A governance bundle that is absent, invalid,
  //    altered or no longer anchors engages the suspension mechanism.
  let governanceContents: Record<string, string>;
  try {
    governanceContents = await readGovernanceBundle(fs, governanceDir);
    await anchorOfficialGridOptInBetaGovernanceDecision(governanceContents, {
      sourceCommitReader,
    });
  } catch (e) {
    return suspendBeta(
      fs,
      markerPath,
      now,
      "governance_anchor_failure",
      `official governance bundle is absent, invalid, altered or no longer anchors: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  // 4. Physical-root guard before any artifact write.
  try {
    await assertCanaryPhysicalRoot(outputRoot, "grid-beta-match", fs);
  } catch (e) {
    return suspendBeta(
      fs,
      markerPath,
      now,
      "cross_root_persistence_failure",
      `beta output root failed the physical-root guard: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  // 5. Load the fighter specifications (input errors — never a suspension
  //    trigger).
  const fighterALoad = await loadGridBetaFighterSpec(fighterRoot, request.fighterA, fs);
  const fighterBLoad = await loadGridBetaFighterSpec(fighterRoot, request.fighterB, fs);

  // 6. Generate the match ID and timestamp after the governance anchor.
  const matchId = createUuid();
  if (!isUuid(matchId)) {
    throw new GridBetaMatchError(
      `grid beta match ID must be a valid UUID; received ${String(matchId)}`,
    );
  }
  const createdAt = now().toISOString();

  // 7. Publication-path collision preflight.
  const finalCollision = await fsEntryKind(fs, join(outputRoot, matchId));
  if (finalCollision !== null) {
    throw new GridBetaMatchError(
      `grid beta final path already exists (${finalCollision}) and must not be modified or removed: ${join(outputRoot, matchId)}`,
    );
  }
  const tmpCollision = await fsEntryKind(fs, join(outputRoot, `.tmp-${matchId}`));
  if (tmpCollision !== null) {
    throw new GridBetaMatchError(
      `grid beta temporary path already exists (${tmpCollision}) and must not be reused or removed: ${join(outputRoot, `.tmp-${matchId}`)}`,
    );
  }

  // 8. Current legacy-isolation preflight (read-only; computed from the
  //     actual current protected-file bytes and source-level checks). Its
  //     result is required to be the exact canonical pass before any further
  //     async safety check and before the simulation.
  const preflight = await runGridBetaLegacyIsolationPreflight(fs);
  if (preflight.status !== "pass" && preflight.trigger !== null) {
    return suspendBeta(
      fs,
      markerPath,
      now,
      preflight.trigger,
      `protected legacy-isolation preflight failed: ${preflight.failures.join("; ")}`,
    );
  }
  assertCanonicalGridBetaPreflightPass(preflight);

  // 9. Governance bytes unchanged immediately before simulation (re-read
  //     after the preflight so the pre-simulation window is closed: no async
  //     preflight occurs after the final governance and suspension checks).
  try {
    await assertGovernanceBundleUnchanged(fs, governanceDir, governanceContents);
  } catch (e) {
    return suspendBeta(
      fs,
      markerPath,
      now,
      "governance_anchor_failure",
      e instanceof Error ? e.message : String(e),
    );
  }

  // 10. Suspension marker check #2. This is the final await before entry into
  //     the pure execution core: the execute call below is synchronous and
  //     there is no await between this marker check and the first
  //     `runGridMatch` call.
  try {
    await assertSuspensionMarkerAbsent(fs, markerPath);
  } catch (e) {
    throw new GridBetaMatchError(e instanceof Error ? e.message : String(e));
  }

  // 11. Execute the same grid beta match twice with identical but independent
  //     inputs and require deterministic equality of all simulator facts. The
  //     execution core is always the fixed imported `executeGridBetaMatch`
  //     (which hard-codes `runGridMatch`); the optional execution-entry
  //     observer is invoked immediately before that call and can never
  //     replace or modify the execution or its result.
  let primary: GridMatchResult;
  try {
    dependencies.onExecutionStart?.();
    const execution = executeGridBetaMatch({
      seed: request.seed,
      fighterA: createGridBetaFighterExecutionValues(fighterALoad.spec),
      fighterB: createGridBetaFighterExecutionValues(fighterBLoad.spec),
    });
    primary = execution.primary;
  } catch (e) {
    return suspendBeta(
      fs,
      markerPath,
      now,
      "nondeterministic_result",
      e instanceof Error ? e.message : String(e),
    );
  }

  // 12. Require the exact grid runtime identity on the primary result.
  if (
    primary.runtime.simulatorVersion !== "0.3.0" ||
    primary.runtime.positioningModel !== "grid-3x3-v1"
  ) {
    return suspendBeta(
      fs,
      markerPath,
      now,
      "runtime_identity_mismatch",
      `primary grid beta result identity is ${primary.runtime.simulatorVersion}/${primary.runtime.positioningModel}`,
    );
  }
  if (
    primary.config.rulesetVersion !== "0.2.0" ||
    primary.config.catalogueVersion !== "1"
  ) {
    return suspendBeta(
      fs,
      markerPath,
      now,
      "runtime_identity_mismatch",
      "primary grid beta config does not carry the frozen ruleset/catalogue identity",
    );
  }

  // 13. Convert the primary result to a persisted schema-v3 record with the
  //     injected match UUID and timestamp, and empty agent usage.
  let record: MatchRecordV3;
  try {
    const converted = matchResultToRecord(primary, [], { matchId, createdAt });
    if (!isV3Record(converted)) {
      throw new GridBetaMatchError("grid beta match record must be schema v3");
    }
    record = converted;
  } catch (e) {
    return suspendBeta(
      fs,
      markerPath,
      now,
      "schema_v3_validation_failure",
      e instanceof Error ? e.message : String(e),
    );
  }

  // 14. Build and bind the factual-report v2, validate both schemas.
  let report;
  try {
    const unboundReport = buildGridFactualReport(primary);
    report = bindGridFactualReportToMatchRecord(unboundReport, record);
    const recordValidation = validateMatchRecord(record);
    if (!recordValidation.ok) {
      throw new GridBetaMatchError(
        `grid beta match record failed validation: ${recordValidation.errors}`,
      );
    }
    const reportValidation = validateFactualMatchReport(report);
    if (!reportValidation.ok) {
      throw new GridBetaMatchError(
        `grid beta factual report failed validation: ${reportValidation.errors}`,
      );
    }
    if (record.agentUsage.length !== 0) {
      throw new GridBetaMatchError("grid beta record agent usage must be empty");
    }
  } catch (e) {
    return suspendBeta(
      fs,
      markerPath,
      now,
      "schema_v3_validation_failure",
      e instanceof Error ? e.message : String(e),
    );
  }

  // 15. Record/report final-state agreement and readiness evidence inspection.
  try {
    assertGridReadinessRecordReportFinalAgreement(record, report);
    inspectGridReadinessRecordEvidence(record);
  } catch (e) {
    return suspendBeta(
      fs,
      markerPath,
      now,
      "record_report_disagreement",
      e instanceof Error ? e.message : String(e),
    );
  }

  // 16. Complete configuration binding (Phase 3G.1 Phases 6 and 7): the
  //     authoritative reconstructed build must equal the record config and
  //     initial-state builds across every field, policies must match exactly,
  //     and the complete canonical C2 metadata must agree across the record
  //     and the record config.
  const fighterASpec: GridBetaFighterSpecV1 = fighterALoad.spec;
  const fighterBSpec: GridBetaFighterSpecV1 = fighterBLoad.spec;
  try {
    const buildAResult = validateBuild(fighterASpec.buildProposal, CATALOGUE_V1);
    const buildBResult = validateBuild(fighterBSpec.buildProposal, CATALOGUE_V1);
    if (!buildAResult.ok || !buildBResult.ok) {
      throw new GridBetaMatchError(
        "grid beta fighter build failed the authoritative catalogue-v1 validator",
      );
    }
    const buildA = buildAResult.build;
    const buildB = buildBResult.build;
    if (
      !sameJson(buildA, record.config.fighterA.build) ||
      !sameJson(buildA, record.initialState.fighterA.build) ||
      !sameJson(buildB, record.config.fighterB.build) ||
      !sameJson(buildB, record.initialState.fighterB.build) ||
      !sameJson(record.config.fighterA.build, record.initialState.fighterA.build) ||
      !sameJson(record.config.fighterB.build, record.initialState.fighterB.build) ||
      !sameJson(fighterASpec.policy, record.config.fighterA.policy) ||
      !sameJson(fighterBSpec.policy, record.config.fighterB.policy)
    ) {
      throw new GridBetaMatchError(
        "record config/initial state does not match the validated fighter specifications (complete build and policy binding)",
      );
    }
    if (record.seed !== request.seed || record.config.seed !== request.seed) {
      throw new GridBetaMatchError("record seed does not match the selection");
    }
    const c2Config = getComponentQualificationConfig("component-impact-c2");
    const c2Metadata = getComponentQualificationMetadata(c2Config);
    if (
      record.componentQualificationId !== c2Metadata.id ||
      !sameJson(record.componentQualification, c2Metadata) ||
      record.config.componentQualificationId !== c2Metadata.id ||
      !sameJson(record.config.componentQualification, c2Metadata)
    ) {
      throw new GridBetaMatchError(
        "record C2 component qualification metadata is not the complete canonical C2 metadata",
      );
    }
    if (c2Metadata.configChecksum !== "13548462df34a183") {
      throw new GridBetaMatchError("C2 component qualification checksum changed");
    }
  } catch (e) {
    return suspendBeta(
      fs,
      markerPath,
      now,
      "runtime_identity_mismatch",
      e instanceof Error ? e.message : String(e),
    );
  }

  // 17. Render text replay, ASCII replay and review prompt from the persisted
  //     record reconstruction, and require replay reconstruction agreement.
  let reconstructed: GridMatchResult;
  let textReplay: string;
  let asciiReplay: string;
  let reviewPrompt: string;
  try {
    reconstructed = gridRecordToGridResult(record);
    if (
      !deepEqualOrderInsensitive(reconstructed.events, primary.events) ||
      !deepEqualOrderInsensitive(reconstructed.result, primary.result) ||
      reconstructed.rounds !== primary.rounds ||
      !deepEqualOrderInsensitive(reconstructed.initialState, primary.initialState)
    ) {
      throw new GridBetaMatchError(
        "replay reconstruction from the persisted record disagrees with the primary result",
      );
    }
    textReplay = renderTextReplay(reconstructed);
    asciiReplay = renderAsciiReplay(
      reconstructed,
      { mode: "ascii" },
      POSITIONING_MODEL_GRID,
    );
    reviewPrompt = buildReviewUserPrompt(report);
  } catch (e) {
    return suspendBeta(
      fs,
      markerPath,
      now,
      "replay_reconstruction_disagreement",
      e instanceof Error ? e.message : String(e),
    );
  }

  // 18. Governance bytes unchanged immediately before publication.
  try {
    await assertGovernanceBundleUnchanged(fs, governanceDir, governanceContents);
  } catch (e) {
    return suspendBeta(
      fs,
      markerPath,
      now,
      "governance_anchor_failure",
      e instanceof Error ? e.message : String(e),
    );
  }

  // 19. Suspension marker check #3 and the canonical protected-source
  //     preflight re-run immediately before the artifacts are built.
  try {
    await assertSuspensionMarkerAbsent(fs, markerPath);
  } catch (e) {
    throw new GridBetaMatchError(e instanceof Error ? e.message : String(e));
  }
  const preflightBeforePublication = await runGridBetaLegacyIsolationPreflight(fs);
  if (
    preflightBeforePublication.status !== "pass" &&
    preflightBeforePublication.trigger !== null
  ) {
    return suspendBeta(
      fs,
      markerPath,
      now,
      preflightBeforePublication.trigger,
      `protected legacy-isolation preflight failed before publication: ${preflightBeforePublication.failures.join("; ")}`,
    );
  }
  assertCanonicalGridBetaPreflightPass(preflightBeforePublication);

  // 20. Serialize all artifacts and compute digests. The primary execution
  //     checksum is bound to the persisted record reconstruction (the repeat
  //     event stream is intentionally not persisted, so the repeat checksum
  //     equals the primary checksum as an execution attestation). Every
  //     attestation fact is an explicit confirmed outcome from this service
  //     flow; the builder fails if any supplied confirmation is not true.
  const fighterAChecksum = gridBetaFighterSpecChecksum(fighterASpec);
  const fighterBChecksum = gridBetaFighterSpecChecksum(fighterBSpec);
  const selection = buildGridBetaSelection({
    seed: request.seed,
    fighterA: { fighterId: fighterASpec.fighterId, checksum: fighterAChecksum },
    fighterB: { fighterId: fighterBSpec.fighterId, checksum: fighterBChecksum },
    protectedSourcePreflight: preflightBeforePublication,
  });
  const primaryChecksum = gridBetaMatchResultChecksum(reconstructed);
  const repeatChecksum = primaryChecksum;
  const attestation = buildGridBetaExecutionAttestation({
    matchId,
    primaryResultChecksum: primaryChecksum,
    repeatResultChecksum: repeatChecksum,
    governanceBytesUnchangedBeforeSimulation: true,
    governanceBytesUnchangedBeforePublication: true,
    suspensionMarkerAbsentBeforeGovernanceAnchor: true,
    suspensionMarkerAbsentBeforeSimulation: true,
    suspensionMarkerAbsentBeforePublication: true,
    protectedSourcePreflightPass: preflightBeforePublication.status === "pass",
    deterministicEquality: true,
    noLegacyFallback: true,
    emptyAgentUsage: record.agentUsage.length === 0,
    recordReportAgreement: true,
    replayReconstructionAgreement: true,
    temporaryBundleValidation: true,
  });

  const serializedSelection = serializeGridBetaSelection(selection);
  const serializedFighterA = serializeGridBetaFighterSpec(fighterASpec);
  const serializedFighterB = serializeGridBetaFighterSpec(fighterBSpec);
  const serializedAttestation = serializeGridBetaExecutionAttestation(attestation);
  const serializedRecord = serializeMatchRecord(record);
  const serializedReport = serializeFactualMatchReport(report);
  const serializedTextReplay = textReplay;
  const serializedAsciiReplay = asciiReplay;
  const serializedReviewPrompt = reviewPrompt;

  const digests: Record<string, string> = {
    [GRID_BETA_MATCH_SELECTION_ARTIFACT]: sha256Hex(serializedSelection),
    [GRID_BETA_MATCH_FIGHTER_A_ARTIFACT]: sha256Hex(serializedFighterA),
    [GRID_BETA_MATCH_FIGHTER_B_ARTIFACT]: sha256Hex(serializedFighterB),
    [GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT]: sha256Hex(serializedAttestation),
    [GRID_BETA_MATCH_RECORD_ARTIFACT]: sha256Hex(serializedRecord),
    [GRID_BETA_MATCH_FACTUAL_REPORT_ARTIFACT]: sha256Hex(serializedReport),
    [GRID_BETA_MATCH_TEXT_REPLAY_ARTIFACT]: sha256Hex(serializedTextReplay),
    [GRID_BETA_MATCH_ASCII_REPLAY_ARTIFACT]: sha256Hex(serializedAsciiReplay),
    [GRID_BETA_MATCH_REVIEW_PROMPT_ARTIFACT]: sha256Hex(serializedReviewPrompt),
  };

  // 21. Build the manifest (written last) and validate the complete bundle
  //     in memory before publication.
  const manifest = buildGridBetaMatchManifest({
    matchId,
    createdAt,
    result: {
      winner: record.result.winner,
      method: record.result.method,
      rounds: record.rounds,
    },
    fighterChecksums: { fighterA: fighterAChecksum, fighterB: fighterBChecksum },
    protectedSourcePreflightStatus: preflightBeforePublication.status,
    suspensionStatus: "clear",
    digests,
  });
  const serializedManifest = serializeGridBetaMatchManifest(manifest);

  const inMemoryContents: Record<string, string> = {
    [GRID_BETA_MATCH_MANIFEST_FILE]: serializedManifest,
    [GRID_BETA_MATCH_SELECTION_ARTIFACT]: serializedSelection,
    [GRID_BETA_MATCH_FIGHTER_A_ARTIFACT]: serializedFighterA,
    [GRID_BETA_MATCH_FIGHTER_B_ARTIFACT]: serializedFighterB,
    [GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT]: serializedAttestation,
    [GRID_BETA_MATCH_RECORD_ARTIFACT]: serializedRecord,
    [GRID_BETA_MATCH_FACTUAL_REPORT_ARTIFACT]: serializedReport,
    [GRID_BETA_MATCH_TEXT_REPLAY_ARTIFACT]: serializedTextReplay,
    [GRID_BETA_MATCH_ASCII_REPLAY_ARTIFACT]: serializedAsciiReplay,
    [GRID_BETA_MATCH_REVIEW_PROMPT_ARTIFACT]: serializedReviewPrompt,
  };
  try {
    validateGridBetaMatchBundle(inMemoryContents);
  } catch (e) {
    return suspendBeta(
      fs,
      markerPath,
      now,
      "bundle_integrity_failure",
      e instanceof Error ? e.message : String(e),
    );
  }
  // 22. Publish one immutable beta match bundle (manifest last). The shared
  //     publisher's `beforeAtomicPublish` hook is the final safety gate: it
  //     reruns the complete protected legacy-source preflight, requires the
  //     governance bytes unchanged, requires the suspension marker absent and
  //     rechecks the physical output-root integrity immediately before the
  //     atomic rename. A typed `GridBetaSafetyError` carries the original
  //     safety classification so the service creates the marker exactly once
  //     with the correct trigger (never collapsing into
  //     `bundle_integrity_failure`).
  let artifactDirectory: string;
  try {
    artifactDirectory = await publishImmutableBundle({
      fs,
      outputRoot,
      canaryId: matchId,
      manifestFileName: GRID_BETA_MATCH_MANIFEST_FILE,
      entryNames: GRID_BETA_MATCH_BUNDLE_ENTRIES,
      artifacts: [
        { name: GRID_BETA_MATCH_SELECTION_ARTIFACT, content: serializedSelection },
        { name: GRID_BETA_MATCH_FIGHTER_A_ARTIFACT, content: serializedFighterA },
        { name: GRID_BETA_MATCH_FIGHTER_B_ARTIFACT, content: serializedFighterB },
        {
          name: GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT,
          content: serializedAttestation,
        },
        { name: GRID_BETA_MATCH_RECORD_ARTIFACT, content: serializedRecord },
        { name: GRID_BETA_MATCH_FACTUAL_REPORT_ARTIFACT, content: serializedReport },
        { name: GRID_BETA_MATCH_TEXT_REPLAY_ARTIFACT, content: serializedTextReplay },
        { name: GRID_BETA_MATCH_ASCII_REPLAY_ARTIFACT, content: serializedAsciiReplay },
        { name: GRID_BETA_MATCH_REVIEW_PROMPT_ARTIFACT, content: serializedReviewPrompt },
      ],
      serializedManifest,
      verify: async ({ contents }) => {
        validateGridBetaMatchBundle(contents);
      },
      afterRootCreated: async () => {
        await assertCanaryPhysicalRoot(outputRoot, "grid-beta-match", fs);
      },
      beforeAtomicPublish: async () => {
        let finalPreflight;
        try {
          finalPreflight = await runGridBetaLegacyIsolationPreflight(fs);
        } catch (e) {
          throw new GridBetaSafetyError(
            "legacy_default_regression",
            `protected legacy-isolation preflight could not run at the final publication gate: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        if (finalPreflight.status !== "pass" && finalPreflight.trigger !== null) {
          throw new GridBetaSafetyError(
            finalPreflight.trigger,
            `protected legacy-isolation preflight failed at the final publication gate: ${finalPreflight.failures.join("; ")}`,
          );
        }
        try {
          assertCanonicalGridBetaPreflightPass(finalPreflight);
        } catch (e) {
          throw new GridBetaSafetyError(
            "legacy_default_regression",
            `protected-source preflight is not the canonical pass at the final publication gate: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        try {
          await assertGovernanceBundleUnchanged(fs, governanceDir, governanceContents);
        } catch (e) {
          throw new GridBetaSafetyError(
            "governance_anchor_failure",
            `governance bytes changed at the final publication gate: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        try {
          await assertSuspensionMarkerAbsent(fs, markerPath);
        } catch (e) {
          throw new GridBetaSafetyError(
            "bundle_integrity_failure",
            `suspension marker appeared at the final publication gate: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        try {
          await assertCanaryPhysicalRoot(outputRoot, "grid-beta-match", fs);
        } catch (e) {
          throw new GridBetaSafetyError(
            "cross_root_persistence_failure",
            `beta output root failed the physical-root guard at the final publication gate: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      },
    });
  } catch (e) {
    if (e instanceof GridBetaSafetyError) {
      return suspendBeta(fs, markerPath, now, e.trigger, e.message);
    }
    return suspendBeta(
      fs,
      markerPath,
      now,
      "bundle_integrity_failure",
      `beta bundle publication failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // 23. Read back and cross-validate the final bundle explicitly.
  let manifestReadBack: GridBetaMatchManifestV1;
  try {
    const readBack: Record<string, string> = {};
    for (const name of GRID_BETA_MATCH_BUNDLE_ENTRIES) {
      readBack[name] = await fs.readFile(join(artifactDirectory, name), "utf-8");
    }
    validateGridBetaMatchBundle(readBack);
    const parsed = deserializeGridBetaMatchManifest(
      readBack[GRID_BETA_MATCH_MANIFEST_FILE]!,
    );
    if (!parsed.ok) {
      throw new GridBetaMatchError(
        `grid beta manifest read-back failed: ${parsed.errors}`,
      );
    }
    manifestReadBack = parsed.manifest;
  } catch (e) {
    return suspendBeta(
      fs,
      markerPath,
      now,
      "bundle_integrity_failure",
      `beta bundle read-back validation failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  return {
    matchId,
    createdAt,
    winner: record.result.winner,
    method: record.result.method,
    rounds: record.rounds,
    fighterAChecksum: fighterAChecksum,
    fighterBChecksum: fighterBChecksum,
    primaryResultChecksum: primaryChecksum,
    repeatResultChecksum: repeatChecksum,
    selection,
    manifest: manifestReadBack,
    artifactDirectory,
    artifacts: GRID_BETA_MATCH_BUNDLE_ENTRIES.map((name) => ({
      name,
      path: join(artifactDirectory, name),
    })),
  };
}
