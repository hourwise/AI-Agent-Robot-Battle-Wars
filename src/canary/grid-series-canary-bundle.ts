import type { GridSeriesCanaryManifestV1 } from "../schemas/grid-series-canary-manifest.schema.js";
import type { SeriesRecordV2 } from "../schemas/series.schema.js";
import type { GridSeriesCanaryMatchesEnvelope } from "../schemas/grid-series-canary-envelopes.schema.js";
import type { GridSeriesCanaryFactualReportsEnvelope } from "../schemas/grid-series-canary-envelopes.schema.js";
import type { GridSeriesCanaryFallbackReviewsEnvelope } from "../schemas/grid-series-canary-envelopes.schema.js";
import type { GridSeriesCanaryMatchArtifactsEnvelope } from "../schemas/grid-series-canary-envelopes.schema.js";
import type { GridSeriesCanaryAdaptationTraceV1 } from "../schemas/grid-series-canary-adaptation-trace.schema.js";
import type { MatchRecordV3 } from "../schemas/match-record.schema.js";
import type { FactualMatchReportV2 } from "../schemas/factual-report.schema.js";
import { sha256Hex } from "./grid-canary-digest.js";
import { gridFallbackReviewDisagreements } from "./grid-canary-fallback-agreement.js";
import {
  BULWARK_BUILD_PROPOSAL,
  BULWARK_POLICY,
} from "../agents/scripted/bulwark-agent.js";
import { MAX_ROUNDS } from "../simulator/constants.js";
import { isGridZone } from "../simulator/arena-grid.js";
import { formatCompetitionEndedLine } from "../replay/text-replay-renderer.js";
import { formatMethod } from "../replay/ascii/result-card-renderer.js";
import { buildReviewUserPrompt } from "../prompts/review-prompt.v1.js";
import { sanitizeTerminalText } from "../shared/text-sanitise.js";
import { formatSeriesCanaryScoreLine } from "./grid-series-canary-report.js";
import { GRID_SERIES_CANARY_REVIEW_FAILURE } from "./grid-series-canary-series.js";

/**
 * Pure grid series canary bundle cross-agreement validator (Milestone 0.2C
 * Phase 3D2B / 3D2B.1).
 *
 * Verifies that every artifact of a series canary bundle agrees on identity
 * and ordering, runtime/schema identity, per-match provenance (every series
 * entry bound to its actual match record, embedded factual report and
 * fallback review), builds/policies bound to actual execution, result facts,
 * complete fallback-review agreement, adaptation facts, series facts, safe
 * seeds, recomputed manifest evidence, rendered per-match facts, the
 * authoritative raw series score and SHA-256 digests. It accepts only parsed
 * canonical artifacts, never mutates any input, and throws a clear
 * `GridSeriesCanaryBundleError` describing every disagreement.
 */
export class GridSeriesCanaryBundleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridSeriesCanaryBundleError";
  }
}

export interface GridSeriesCanaryBundleValidationInput {
  manifest: GridSeriesCanaryManifestV1;
  series: SeriesRecordV2;
  matchesEnvelope: GridSeriesCanaryMatchesEnvelope;
  factualReportsEnvelope: GridSeriesCanaryFactualReportsEnvelope;
  fallbackReviewsEnvelope: GridSeriesCanaryFallbackReviewsEnvelope;
  matchArtifactsEnvelope: GridSeriesCanaryMatchArtifactsEnvelope;
  adaptationTrace: GridSeriesCanaryAdaptationTraceV1;
  seriesReport: string;
  /** Exact UTF-8 strings written to disk, used to verify SHA-256 digests. */
  serializedSeries: string;
  serializedMatches: string;
  serializedFactualReports: string;
  serializedFallbackReviews: string;
  serializedMatchArtifacts: string;
  serializedAdaptationTrace: string;
}

export interface GridSeriesCanaryBundleValidationResult {
  seriesId: string;
  baseSeed: number;
  matchIds: readonly string[];
  digestAgreement: true;
}

const GRID_CORNER_LABELS = ["NORTH WEST", "NORTH EAST", "SOUTH WEST", "SOUTH EAST"];

function check(failures: string[], condition: boolean, message: string): void {
  if (!condition) failures.push(message);
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function checkTextArtifact(
  failures: string[],
  label: string,
  text: string,
  contentCheck: (text: string) => boolean,
): void {
  check(failures, text.length > 0, `${label} must be non-empty`);
  check(failures, !text.includes("\u0000"), `${label} must not contain a NUL character`);
  check(failures, contentCheck(text), `${label} lacks the required content marker`);
}

/**
 * Evidence recomputed directly from persisted artifacts (Milestone 0.2C Phase
 * 3D2B.1). The series canary manifest may not rely solely on literal `true`
 * fields: every recomputable evidence flag is derived here and must agree
 * with the corresponding manifest field.
 */
export interface RecomputedGridSeriesCanaryEvidence {
  allMatchesTerminated: boolean;
  allMatchRecordsV3: boolean;
  allFactualReportsV2: boolean;
  allReportsBoundToRecords: boolean;
  allFallbackReviewsValid: boolean;
  allMovementZonesCanonical: boolean;
  translatedGridMovementObserved: boolean;
  combatAttemptObserved: boolean;
  policyAdaptationCount: number;
  adaptationFactsAgree: boolean;
}

export function recomputeGridSeriesCanaryEvidence(params: {
  records: readonly MatchRecordV3[];
  reports: readonly FactualMatchReportV2[];
  fallbackReviews: GridSeriesCanaryFallbackReviewsEnvelope["items"];
  transitions: GridSeriesCanaryAdaptationTraceV1["transitions"];
}): RecomputedGridSeriesCanaryEvidence {
  const { records, reports, fallbackReviews, transitions } = params;

  let allMatchesTerminated = true;
  let allMovementZonesCanonical = true;
  let translatedGridMovementObserved = false;
  let combatAttemptObserved = false;
  let allReportsBoundToRecords = true;
  let allFallbackReviewsValid = true;

  for (const [index, record] of records.entries()) {
    if (!(record.rounds >= 0 && record.rounds <= MAX_ROUNDS)) {
      allMatchesTerminated = false;
    }

    for (const fighter of [record.initialState.fighterA, record.initialState.fighterB]) {
      if (!isGridZone(fighter.zone)) allMovementZonesCanonical = false;
    }
    for (const event of record.events) {
      if (event.type === "movement_resolved") {
        const data = event.data as { from?: unknown; to?: unknown };
        if (!isGridZone(data.from) || !isGridZone(data.to)) {
          allMovementZonesCanonical = false;
        }
        if (data.from !== data.to) translatedGridMovementObserved = true;
      } else if (event.type === "round_ended") {
        const data = event.data as {
          fighterA?: { zone?: unknown };
          fighterB?: { zone?: unknown };
        };
        if (!isGridZone(data.fighterA?.zone) || !isGridZone(data.fighterB?.zone)) {
          allMovementZonesCanonical = false;
        }
      } else if (event.type === "attack_attempted") {
        combatAttemptObserved = true;
      }
    }

    const report = reports[index];
    if (!report) {
      allReportsBoundToRecords = false;
      continue;
    }
    if (
      report.matchId !== record.matchId ||
      report.seed !== record.seed ||
      report.rounds !== record.rounds ||
      report.winner !== record.result.winner ||
      report.resultMethod !== record.result.method
    ) {
      allReportsBoundToRecords = false;
    }

    const review = fallbackReviews[index]?.review;
    if (!review) {
      allFallbackReviewsValid = false;
      continue;
    }
    if (gridFallbackReviewDisagreements(report, review).length > 0) {
      allFallbackReviewsValid = false;
    }
  }

  const allMatchRecordsV3 = records.every((record) => record.schemaVersion === "3");
  const allFactualReportsV2 = reports.every((report) => report.schemaVersion === "2");

  const policyAdaptationCount =
    transitions.length === 2 &&
    transitions[0]!.sourceMatchNumber === 1 &&
    transitions[1]!.sourceMatchNumber === 2
      ? 2
      : transitions.length;

  let adaptationFactsAgree = policyAdaptationCount === 2;
  for (const [index, transition] of transitions.entries()) {
    const report = reports[index];
    if (!report) {
      adaptationFactsAgree = false;
      continue;
    }
    const facts = transition.authoritativeFacts;
    if (facts.winner !== report.winner) adaptationFactsAgree = false;
    if (facts.resultMethod !== report.resultMethod) adaptationFactsAgree = false;
    if (facts.rounds !== report.rounds) adaptationFactsAgree = false;
    if (facts.ownFinalIntegrity !== report.finalStates.fighterA.integrity) {
      adaptationFactsAgree = false;
    }
    if (facts.opponentFinalIntegrity !== report.finalStates.fighterB.integrity) {
      adaptationFactsAgree = false;
    }
    if (facts.ownMobilityDisabled !== report.finalStates.fighterA.mobilityDisabled) {
      adaptationFactsAgree = false;
    }
    if (!sameJson(facts.ownConditions, report.finalStates.fighterA.conditions)) {
      adaptationFactsAgree = false;
    }
  }

  return {
    allMatchesTerminated,
    allMatchRecordsV3,
    allFactualReportsV2,
    allReportsBoundToRecords,
    allFallbackReviewsValid,
    allMovementZonesCanonical,
    translatedGridMovementObserved,
    combatAttemptObserved,
    policyAdaptationCount,
    adaptationFactsAgree,
  };
}

export function validateGridSeriesCanaryBundle(
  input: GridSeriesCanaryBundleValidationInput,
): GridSeriesCanaryBundleValidationResult {
  const { manifest, series, matchesEnvelope, factualReportsEnvelope } = input;
  const failures: string[] = [];

  const records = matchesEnvelope.items;
  const reports = factualReportsEnvelope.items;
  const fallbackReviews = input.fallbackReviewsEnvelope.items;
  const matchArtifacts = input.matchArtifactsEnvelope.items;
  const transitions = input.adaptationTrace.transitions;
  const entries = series.entries;

  // ── Identity and ordering ──
  const seriesId = manifest.seriesId;
  check(
    failures,
    series.seriesId === seriesId,
    `series record seriesId ${series.seriesId} != manifest seriesId ${seriesId}`,
  );
  check(
    failures,
    matchesEnvelope.seriesId === seriesId,
    `matches envelope seriesId ${matchesEnvelope.seriesId} != manifest seriesId ${seriesId}`,
  );
  check(
    failures,
    factualReportsEnvelope.seriesId === seriesId,
    `factual-reports envelope seriesId ${factualReportsEnvelope.seriesId} != manifest seriesId ${seriesId}`,
  );
  check(
    failures,
    input.fallbackReviewsEnvelope.seriesId === seriesId,
    `fallback-reviews envelope seriesId ${input.fallbackReviewsEnvelope.seriesId} != manifest seriesId ${seriesId}`,
  );
  check(
    failures,
    input.matchArtifactsEnvelope.seriesId === seriesId,
    `match-artifacts envelope seriesId ${input.matchArtifactsEnvelope.seriesId} != manifest seriesId ${seriesId}`,
  );
  check(
    failures,
    input.adaptationTrace.seriesId === seriesId,
    `adaptation trace seriesId ${input.adaptationTrace.seriesId} != manifest seriesId ${seriesId}`,
  );
  check(
    failures,
    manifest.baseSeed === input.adaptationTrace.baseSeed,
    `manifest baseSeed ${manifest.baseSeed} != trace baseSeed ${input.adaptationTrace.baseSeed}`,
  );
  check(
    failures,
    Number.isSafeInteger(manifest.baseSeed),
    "manifest baseSeed must be a safe integer",
  );
  for (const [index, seed] of manifest.seeds.entries()) {
    check(
      failures,
      Number.isSafeInteger(seed),
      `manifest seed ${index + 1} must be a safe integer`,
    );
  }
  check(
    failures,
    Number.isSafeInteger(input.adaptationTrace.baseSeed),
    "adaptation trace baseSeed must be a safe integer",
  );
  for (const [index, transition] of transitions.entries()) {
    check(
      failures,
      Number.isSafeInteger(transition.sourceSeed),
      `adaptation trace transition ${index + 1} sourceSeed must be a safe integer`,
    );
  }

  const matchIds: string[] = [];
  for (const [index, record] of records.entries()) {
    const label = `match ${index + 1}`;
    const entry = entries[index];
    const report = reports[index];
    const fallback = fallbackReviews[index];
    const artifacts = matchArtifacts[index];
    if (!entry || !report || !fallback || !artifacts) {
      check(failures, false, `${label} missing from a series artifact`);
      continue;
    }

    // ── Match summary versus record ──
    check(
      failures,
      entry.matchId === record.matchId,
      `${label} series entry matchId ${entry.matchId} != record matchId ${record.matchId}`,
    );
    check(
      failures,
      entry.match.matchId === record.matchId,
      `${label} entry match summary matchId != record matchId`,
    );
    check(
      failures,
      entry.match.createdAt === record.createdAt,
      `${label} entry match summary createdAt ${entry.match.createdAt} != record createdAt ${record.createdAt}`,
    );
    check(
      failures,
      entry.match.seed === record.seed,
      `${label} entry match summary seed ${entry.match.seed} != record seed ${record.seed}`,
    );
    check(
      failures,
      entry.match.rounds === record.rounds,
      `${label} entry match summary rounds ${entry.match.rounds} != record rounds ${record.rounds}`,
    );
    check(
      failures,
      entry.match.winner === record.result.winner,
      `${label} entry match summary winner ${String(entry.match.winner)} != record winner ${String(record.result.winner)}`,
    );
    check(
      failures,
      entry.match.resultMethod === record.result.method,
      `${label} entry match summary resultMethod ${entry.match.resultMethod} != record method ${record.result.method}`,
    );
    check(
      failures,
      entry.match.matchRecordSchemaVersion === record.schemaVersion,
      `${label} entry match summary schema version ${entry.match.matchRecordSchemaVersion} != record schema version ${record.schemaVersion}`,
    );
    check(
      failures,
      entry.match.simulatorVersion === record.simulatorVersion,
      `${label} entry match summary simulatorVersion != record simulatorVersion`,
    );
    check(
      failures,
      entry.match.positioningModel === record.positioningModel,
      `${label} entry match summary positioningModel != record positioningModel`,
    );

    // ── Embedded factual report versus the report envelope (complete value) ──
    check(
      failures,
      sameJson(entry.factualReport, report),
      `${label} entry factual report does not equal the factual-reports envelope report`,
    );
    check(
      failures,
      report.matchId === record.matchId,
      `${label} factual report matchId ${report.matchId} != record matchId ${record.matchId}`,
    );
    check(
      failures,
      report.seed === record.seed,
      `${label} factual report seed ${report.seed} != record seed ${record.seed}`,
    );

    // ── Embedded review versus the fallback-review envelope (complete value) ──
    check(
      failures,
      entry.review !== null,
      `${label} entry must carry its fallback review`,
    );
    check(
      failures,
      entry.review !== null && sameJson(entry.review, fallback.review),
      `${label} entry review does not equal the fallback-reviews envelope review`,
    );
    check(
      failures,
      fallback.matchNumber === index + 1,
      `${label} fallback review matchNumber ${fallback.matchNumber} != ${index + 1}`,
    );
    check(
      failures,
      fallback.matchId === record.matchId,
      `${label} fallback review matchId ${fallback.matchId} != record matchId ${record.matchId}`,
    );

    // ── Intentional fallback marker (frozen, required) ──
    check(
      failures,
      sameJson(entry.reviewFailure, GRID_SERIES_CANARY_REVIEW_FAILURE),
      `${label} reviewFailure must exactly equal the frozen intentional local-fallback marker (category local_fallback)`,
    );

    // ── Match artifacts envelope ──
    check(
      failures,
      artifacts.matchId === record.matchId,
      `${label} match artifacts matchId ${artifacts.matchId} != record matchId ${record.matchId}`,
    );
    check(
      failures,
      artifacts.matchNumber === index + 1,
      `${label} match artifacts matchNumber ${artifacts.matchNumber} != ${index + 1}`,
    );

    // ── Seeds agree with the manifest and are safe integers ──
    const expectedSeed = manifest.seeds[index];
    check(
      failures,
      record.seed === expectedSeed,
      `${label} record seed ${record.seed} != manifest seed ${expectedSeed}`,
    );
    check(
      failures,
      entry.seed === expectedSeed,
      `${label} series entry seed ${entry.seed} != manifest seed ${expectedSeed}`,
    );
    check(
      failures,
      report.seed === expectedSeed,
      `${label} factual report seed ${report.seed} != manifest seed ${expectedSeed}`,
    );
    check(
      failures,
      Number.isSafeInteger(record.seed),
      `${label} record seed must be a safe integer`,
    );
    check(
      failures,
      Number.isSafeInteger(entry.seed),
      `${label} series entry seed must be a safe integer`,
    );
    check(
      failures,
      Number.isSafeInteger(report.seed),
      `${label} factual report seed must be a safe integer`,
    );

    // ── Builds and policies bound to actual execution ──
    check(
      failures,
      sameJson(entry.designBeforeMatch, record.config.fighterA.build.proposal),
      `${label} entry designBeforeMatch does not equal the record fighterA build proposal`,
    );
    check(
      failures,
      sameJson(entry.policyBeforeMatch, record.config.fighterA.policy),
      `${label} entry policyBeforeMatch does not equal the record fighterA policy`,
    );
    check(
      failures,
      sameJson(record.config.fighterB.build.proposal, BULWARK_BUILD_PROPOSAL),
      `${label} record fighterB build proposal must equal the frozen Bulwark proposal`,
    );
    check(
      failures,
      sameJson(record.config.fighterB.policy, BULWARK_POLICY),
      `${label} record fighterB policy must equal BULWARK_POLICY`,
    );
    check(
      failures,
      entry.nextDesign === undefined,
      `${label} must not carry a next design`,
    );

    matchIds.push(record.matchId);
  }
  check(
    failures,
    new Set(matchIds).size === matchIds.length,
    `match IDs must be unique across the series; found duplicates`,
  );

  // The competitor build proposal must remain identical across all three
  // records.
  const competitorBuild = JSON.stringify(records[0]!.config.fighterA.build.proposal);
  for (const [index, record] of records.entries()) {
    check(
      failures,
      JSON.stringify(record.config.fighterA.build.proposal) === competitorBuild,
      `match ${index + 1} competitor build proposal changed across the series`,
    );
  }

  // ── Runtime and schema identity ──
  check(failures, series.schemaVersion === "2", "series record must be schema v2");
  check(
    failures,
    manifest.seriesRecordSchemaVersion === "2",
    "manifest seriesRecordSchemaVersion must be 2",
  );
  check(
    failures,
    manifest.matchRecordSchemaVersion === "3",
    "manifest matchRecordSchemaVersion must be 3",
  );
  check(
    failures,
    manifest.factualReportSchemaVersion === "2",
    "manifest factualReportSchemaVersion must be 2",
  );
  check(
    failures,
    manifest.matchCount === 3 && entries.length === 3,
    "series must contain exactly 3 matches",
  );

  const runtimeIdentity = (
    label: string,
    value: {
      simulatorVersion: string;
      positioningModel: string;
      rulesetVersion: string;
      catalogueVersion: string;
    },
  ): void => {
    check(
      failures,
      value.simulatorVersion === "0.3.0",
      `${label} simulatorVersion must be 0.3.0`,
    );
    check(
      failures,
      value.positioningModel === "grid-3x3-v1",
      `${label} positioningModel must be grid-3x3-v1`,
    );
    check(
      failures,
      value.rulesetVersion === "0.2.0",
      `${label} rulesetVersion must be 0.2.0`,
    );
    check(
      failures,
      value.catalogueVersion === "1",
      `${label} catalogueVersion must be 1`,
    );
  };
  runtimeIdentity("manifest", manifest);
  runtimeIdentity("series", series);
  for (const [index, record] of records.entries()) {
    runtimeIdentity(`match ${index + 1} record`, record);
    check(
      failures,
      record.schemaVersion === "3",
      `match ${index + 1} record must be schema v3`,
    );
    check(
      failures,
      record.simulatorVersion === series.simulatorVersion &&
        record.positioningModel === series.positioningModel,
      `match ${index + 1} record runtime must agree with the series`,
    );
  }
  for (const [index, report] of reports.entries()) {
    runtimeIdentity(`match ${index + 1} report`, report);
    check(
      failures,
      report.schemaVersion === "2",
      `match ${index + 1} factual report must be schema v2`,
    );
    check(
      failures,
      report.simulatorVersion === series.simulatorVersion &&
        report.positioningModel === series.positioningModel,
      `match ${index + 1} report runtime must agree with the series`,
    );
  }

  // ── Complete fallback-review agreement (shared canonical helper) ──
  for (const [index, report] of reports.entries()) {
    const review = fallbackReviews[index]?.review;
    if (!review) {
      check(failures, false, `match ${index + 1} fallback review is missing`);
      continue;
    }
    const disagreements = gridFallbackReviewDisagreements(report, review);
    if (disagreements.length > 0) {
      check(
        failures,
        false,
        `match ${index + 1} fallback review does not completely agree with the factual report: ${disagreements.join("; ")}`,
      );
    }
  }

  // ── Result facts across record / entry / report ──
  for (const [index, record] of records.entries()) {
    const label = `match ${index + 1}`;
    const entry = entries[index]!;
    const report = reports[index]!;

    check(
      failures,
      record.rounds === entry.match.rounds && entry.match.rounds === report.rounds,
      `${label} rounds do not agree across record/entry/report`,
    );
    check(
      failures,
      record.result.winner === entry.match.winner && entry.match.winner === report.winner,
      `${label} winner does not agree across record/entry/report`,
    );
    check(
      failures,
      record.result.method === entry.match.resultMethod &&
        entry.match.resultMethod === report.resultMethod,
      `${label} result method does not agree across record/entry/report`,
    );
  }

  // ── Adaptation facts ──
  check(
    failures,
    transitions.length === 2,
    "adaptation trace must contain exactly 2 transitions",
  );
  check(
    failures,
    transitions[0]!.sourceMatchNumber === 1 && transitions[1]!.sourceMatchNumber === 2,
    "adaptation transitions must source matches 1 and 2",
  );
  check(
    failures,
    transitions[0]!.sourceMatchId === matchIds[0] &&
      transitions[1]!.sourceMatchId === matchIds[1],
    "adaptation source match IDs must reference matches 1 and 2",
  );
  check(
    failures,
    transitions[0]!.sourceSeed === manifest.seeds[0] &&
      transitions[1]!.sourceSeed === manifest.seeds[1],
    "adaptation source seeds must reference matches 1 and 2",
  );

  check(
    failures,
    entries[0]!.nextPolicy !== undefined &&
      sameJson(entries[0]!.nextPolicy, transitions[0]!.policyAfter),
    "entry 1 nextPolicy must equal trace transition 1 policyAfter",
  );
  check(
    failures,
    sameJson(entries[1]!.policyBeforeMatch, transitions[0]!.policyAfter),
    "entry 2 policyBefore must equal trace transition 1 policyAfter",
  );
  check(
    failures,
    entries[1]!.nextPolicy !== undefined &&
      sameJson(entries[1]!.nextPolicy, transitions[1]!.policyAfter),
    "entry 2 nextPolicy must equal trace transition 2 policyAfter",
  );
  check(
    failures,
    sameJson(entries[2]!.policyBeforeMatch, transitions[1]!.policyAfter),
    "entry 3 policyBefore must equal trace transition 2 policyAfter",
  );
  check(
    failures,
    entries[2]!.nextPolicy === undefined,
    "entry 3 must not carry a next policy",
  );

  // The adaptation chain must agree with the actual match-record policies.
  check(
    failures,
    sameJson(records[0]!.config.fighterA.policy, entries[0]!.policyBeforeMatch),
    "match 1 record fighterA policy must equal entry 1 policyBeforeMatch",
  );
  check(
    failures,
    sameJson(records[1]!.config.fighterA.policy, entries[1]!.policyBeforeMatch),
    "match 2 record fighterA policy must equal entry 2 policyBeforeMatch",
  );
  check(
    failures,
    sameJson(records[2]!.config.fighterA.policy, entries[2]!.policyBeforeMatch),
    "match 3 record fighterA policy must equal entry 3 policyBeforeMatch",
  );
  check(
    failures,
    sameJson(records[1]!.config.fighterA.policy, transitions[0]!.policyAfter),
    "match 2 record fighterA policy must equal trace transition 1 policyAfter",
  );
  check(
    failures,
    sameJson(records[2]!.config.fighterA.policy, transitions[1]!.policyAfter),
    "match 3 record fighterA policy must equal trace transition 2 policyAfter",
  );

  for (const [index, transition] of transitions.entries()) {
    const report = reports[index]!;
    const facts = transition.authoritativeFacts;
    check(
      failures,
      facts.winner === report.winner,
      `transition ${index + 1} authoritative winner does not agree with the report`,
    );
    check(
      failures,
      facts.resultMethod === report.resultMethod,
      `transition ${index + 1} authoritative method does not agree with the report`,
    );
    check(
      failures,
      facts.rounds === report.rounds,
      `transition ${index + 1} authoritative rounds do not agree with the report`,
    );
    check(
      failures,
      facts.ownFinalIntegrity === report.finalStates.fighterA.integrity,
      `transition ${index + 1} authoritative own integrity does not agree with the report`,
    );
    check(
      failures,
      facts.opponentFinalIntegrity === report.finalStates.fighterB.integrity,
      `transition ${index + 1} authoritative opponent integrity does not agree with the report`,
    );
    check(
      failures,
      facts.ownMobilityDisabled === report.finalStates.fighterA.mobilityDisabled,
      `transition ${index + 1} authoritative mobility-disabled does not agree with the report`,
    );
    check(
      failures,
      JSON.stringify(facts.ownConditions) ===
        JSON.stringify(report.finalStates.fighterA.conditions),
      `transition ${index + 1} authoritative conditions do not agree with the report`,
    );
  }

  // ── Series facts ──
  const aiWins = records.filter((r) => r.result.winner === "fighter_a").length;
  const bulwarkWins = records.filter((r) => r.result.winner === "fighter_b").length;
  const draws = records.filter((r) => r.result.winner === null).length;
  check(
    failures,
    series.score.aiWins === aiWins &&
      series.score.bulwarkWins === bulwarkWins &&
      series.score.draws === draws,
    "series score must equal the actual match outcomes",
  );
  const expectedWinner =
    aiWins > bulwarkWins ? "ai" : bulwarkWins > aiWins ? "bulwark" : null;
  check(
    failures,
    series.winner === expectedWinner,
    `series winner ${String(series.winner)} != expected ${String(expectedWinner)}`,
  );
  check(failures, series.status === "completed", "series status must be completed");
  check(
    failures,
    series.targetWins === 3 && series.maximumMatches === 3,
    "series targetWins and maximumMatches must be 3",
  );
  check(
    failures,
    series.totalUsage.totalCostUsd === 0 &&
      series.totalUsage.totalInputTokens === 0 &&
      series.totalUsage.totalOutputTokens === 0 &&
      series.totalUsage.totalCachedTokens === 0 &&
      series.totalUsage.costIsEstimated === false &&
      series.totalUsage.recordCount === 0,
    "series totalUsage must be all zeros",
  );
  for (const [index, entry] of entries.entries()) {
    check(failures, entry.usage.length === 0, `entry ${index + 1} usage must be empty`);
  }

  // ── Manifest evidence recomputed from persisted artifacts ──
  const recomputed = recomputeGridSeriesCanaryEvidence({
    records,
    reports,
    fallbackReviews,
    transitions,
  });
  const evidenceAgreement: Array<{
    key: keyof GridSeriesCanaryManifestV1["evidence"];
    value: boolean | number;
    label: string;
  }> = [
    {
      key: "allMatchesTerminated",
      value: recomputed.allMatchesTerminated,
      label: "allMatchesTerminated",
    },
    {
      key: "allMatchRecordsV3",
      value: recomputed.allMatchRecordsV3,
      label: "allMatchRecordsV3",
    },
    {
      key: "allFactualReportsV2",
      value: recomputed.allFactualReportsV2,
      label: "allFactualReportsV2",
    },
    {
      key: "allReportsBoundToRecords",
      value: recomputed.allReportsBoundToRecords,
      label: "allReportsBoundToRecords",
    },
    {
      key: "allFallbackReviewsValid",
      value: recomputed.allFallbackReviewsValid,
      label: "allFallbackReviewsValid",
    },
    {
      key: "allMovementZonesCanonical",
      value: recomputed.allMovementZonesCanonical,
      label: "allMovementZonesCanonical",
    },
    {
      key: "translatedGridMovementObserved",
      value: recomputed.translatedGridMovementObserved,
      label: "translatedGridMovementObserved",
    },
    {
      key: "combatAttemptObserved",
      value: recomputed.combatAttemptObserved,
      label: "combatAttemptObserved",
    },
    {
      key: "policyAdaptationCount",
      value: recomputed.policyAdaptationCount,
      label: "policyAdaptationCount",
    },
    {
      key: "adaptationFactsAgree",
      value: recomputed.adaptationFactsAgree,
      label: "adaptationFactsAgree",
    },
  ];
  for (const entry of evidenceAgreement) {
    check(
      failures,
      manifest.evidence[entry.key] === entry.value,
      `manifest evidence ${entry.label} must agree with the evidence recomputed from persisted artifacts`,
    );
  }

  // ── Rendered per-match artifacts ──
  for (const [index, artifact] of matchArtifacts.entries()) {
    const record = records[index]!;
    const report = reports[index]!;

    checkTextArtifact(
      failures,
      `match ${index + 1} text replay`,
      artifact.textReplay,
      (text) => text.includes("MATCH COMPLETE"),
    );
    const nameA = sanitizeTerminalText(record.config.fighterA.build.proposal.machineName);
    const nameB = sanitizeTerminalText(record.config.fighterB.build.proposal.machineName);
    const completionLine = formatCompetitionEndedLine(
      record.result.winner,
      record.result.method,
      nameA,
      nameB,
    );
    check(
      failures,
      artifact.textReplay.includes(completionLine),
      `match ${index + 1} text replay must contain the authoritative completion line (winner or draw and method)`,
    );
    check(
      failures,
      artifact.textReplay.includes(`End of round ${record.rounds}.`),
      `match ${index + 1} text replay must contain the authoritative round count`,
    );
    check(
      failures,
      artifact.textReplay.includes(`Seed: ${record.seed}`),
      `match ${index + 1} text replay must contain the match seed`,
    );

    checkTextArtifact(
      failures,
      `match ${index + 1} ASCII replay`,
      artifact.asciiReplay,
      (text) =>
        text.includes("ASCII REPLAY") &&
        GRID_CORNER_LABELS.some((label) => text.includes(label)),
    );
    check(
      failures,
      artifact.asciiReplay.includes(`Seed: ${record.seed}`),
      `match ${index + 1} ASCII replay must contain the match seed`,
    );
    if (record.result.winner) {
      check(
        failures,
        artifact.asciiReplay.includes(`Method: ${formatMethod(record.result.method)}`),
        `match ${index + 1} ASCII replay must contain the authoritative result method`,
      );
      check(
        failures,
        artifact.asciiReplay.includes(`Round: ${record.rounds}`),
        `match ${index + 1} ASCII replay must contain the authoritative round count`,
      );
    } else {
      check(
        failures,
        artifact.asciiReplay.includes("DRAW"),
        `match ${index + 1} ASCII replay must state a draw`,
      );
      check(
        failures,
        artifact.asciiReplay.includes(`Rounds: ${record.rounds}`),
        `match ${index + 1} ASCII replay must contain the authoritative round count`,
      );
    }

    check(
      failures,
      artifact.reviewPrompt === buildReviewUserPrompt(report),
      `match ${index + 1} review prompt must be exactly reproducible from the factual report`,
    );
  }

  // ── Authoritative raw series score in the report ──
  const seriesReport = input.seriesReport;
  check(failures, seriesReport.length > 0, "series report must be non-empty");
  check(
    failures,
    !seriesReport.includes("\u0000"),
    "series report must not contain a NUL character",
  );
  check(
    failures,
    seriesReport.includes("0.3.0"),
    "series report must identify simulator 0.3.0",
  );
  check(
    failures,
    seriesReport.includes("grid-3x3-v1"),
    "series report must identify positioning model grid-3x3-v1",
  );
  check(
    failures,
    /canary/i.test(seriesReport),
    "series report must state it is a canary",
  );
  check(
    failures,
    /non-benchmark/i.test(seriesReport),
    "series report must state it is non-benchmark",
  );
  check(
    failures,
    seriesReport.includes(
      formatSeriesCanaryScoreLine(series.score, series.competitor.displayName),
    ),
    "series report must contain the exact authoritative raw score line (competitor wins, Bulwark wins, draws)",
  );
  check(
    failures,
    seriesReport.includes("3 matches completed"),
    "series report must state exactly three matches completed",
  );
  check(
    failures,
    !seriesReport.includes("%"),
    "series report must not contain win rates or percentages",
  );

  // ── Digest agreement (7 non-manifest artifacts) ──
  const digestEntries: Array<{
    key: keyof GridSeriesCanaryManifestV1["digests"];
    text: string;
  }> = [
    { key: "series", text: input.serializedSeries },
    { key: "matches", text: input.serializedMatches },
    { key: "factualReports", text: input.serializedFactualReports },
    { key: "fallbackReviews", text: input.serializedFallbackReviews },
    { key: "matchArtifacts", text: input.serializedMatchArtifacts },
    { key: "adaptationTrace", text: input.serializedAdaptationTrace },
    { key: "seriesReport", text: input.seriesReport },
  ];
  for (const entry of digestEntries) {
    const expected = manifest.digests[entry.key];
    const actual = sha256Hex(entry.text);
    check(
      failures,
      actual === expected,
      `${entry.key} digest mismatch: ${actual} != ${expected}`,
    );
  }

  if (failures.length > 0) {
    throw new GridSeriesCanaryBundleError(failures.join("; "));
  }

  return {
    seriesId,
    baseSeed: manifest.baseSeed,
    matchIds,
    digestAgreement: true,
  };
}
