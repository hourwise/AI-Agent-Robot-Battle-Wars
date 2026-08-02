import type { GridSeriesCanaryManifestV1 } from "../schemas/grid-series-canary-manifest.schema.js";
import type { SeriesRecordV2 } from "../schemas/series.schema.js";
import type { GridSeriesCanaryMatchesEnvelope } from "../schemas/grid-series-canary-envelopes.schema.js";
import type { GridSeriesCanaryFactualReportsEnvelope } from "../schemas/grid-series-canary-envelopes.schema.js";
import type { GridSeriesCanaryFallbackReviewsEnvelope } from "../schemas/grid-series-canary-envelopes.schema.js";
import type { GridSeriesCanaryMatchArtifactsEnvelope } from "../schemas/grid-series-canary-envelopes.schema.js";
import type { GridSeriesCanaryAdaptationTraceV1 } from "../schemas/grid-series-canary-adaptation-trace.schema.js";
import { sha256Hex } from "./grid-canary-digest.js";

/**
 * Pure grid series canary bundle cross-agreement validator (Milestone 0.2C
 * Phase 3D2B).
 *
 * Verifies that every artifact of a series canary bundle agrees on identity
 * and ordering, runtime/schema identity, result facts, adaptation facts,
 * series facts, text-artifact contracts and SHA-256 digests. It accepts only
 * parsed canonical artifacts, never mutates any input, and throws a clear
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

    check(
      failures,
      entry.matchId === record.matchId,
      `${label} series entry matchId ${entry.matchId} != matches envelope record matchId ${record.matchId}`,
    );
    check(
      failures,
      report.matchId === record.matchId,
      `${label} factual report matchId ${report.matchId} != matches envelope record matchId ${record.matchId}`,
    );
    check(
      failures,
      fallback.matchId === record.matchId,
      `${label} fallback review matchId ${fallback.matchId} != matches envelope record matchId ${record.matchId}`,
    );
    check(
      failures,
      artifacts.matchId === record.matchId,
      `${label} match artifacts matchId ${artifacts.matchId} != matches envelope record matchId ${record.matchId}`,
    );
    check(
      failures,
      fallback.matchNumber === index + 1,
      `${label} fallback review matchNumber ${fallback.matchNumber} != ${index + 1}`,
    );
    check(
      failures,
      artifacts.matchNumber === index + 1,
      `${label} match artifacts matchNumber ${artifacts.matchNumber} != ${index + 1}`,
    );

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

    matchIds.push(record.matchId);
  }
  check(
    failures,
    new Set(matchIds).size === matchIds.length,
    `match IDs must be unique across the series; found duplicates`,
  );

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

  // ── Result facts across record / report / entry / review ──
  for (const [index, record] of records.entries()) {
    const label = `match ${index + 1}`;
    const entry = entries[index]!;
    const report = reports[index]!;
    const review = fallbackReviews[index]!.review.observedOutcome;

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

    check(
      failures,
      review.winnerId === report.winner,
      `${label} fallback review winner does not agree with the report`,
    );
    check(
      failures,
      review.method === report.resultMethod,
      `${label} fallback review method does not agree with the report`,
    );
    check(
      failures,
      review.rounds === report.rounds,
      `${label} fallback review rounds do not agree with the report`,
    );
    check(
      failures,
      review.ownFinalIntegrity === report.finalStates.fighterA.integrity,
      `${label} fallback review own integrity does not agree with the report`,
    );
    check(
      failures,
      review.opponentFinalIntegrity === report.finalStates.fighterB.integrity,
      `${label} fallback review opponent integrity does not agree with the report`,
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
      JSON.stringify(entries[0]!.nextPolicy) ===
        JSON.stringify(transitions[0]!.policyAfter),
    "entry 1 nextPolicy must equal trace transition 1 policyAfter",
  );
  check(
    failures,
    JSON.stringify(entries[1]!.policyBeforeMatch) ===
      JSON.stringify(transitions[0]!.policyAfter),
    "entry 2 policyBefore must equal trace transition 1 policyAfter",
  );
  check(
    failures,
    entries[1]!.nextPolicy !== undefined &&
      JSON.stringify(entries[1]!.nextPolicy) ===
        JSON.stringify(transitions[1]!.policyAfter),
    "entry 2 nextPolicy must equal trace transition 2 policyAfter",
  );
  check(
    failures,
    JSON.stringify(entries[2]!.policyBeforeMatch) ===
      JSON.stringify(transitions[1]!.policyAfter),
    "entry 3 policyBefore must equal trace transition 2 policyAfter",
  );
  check(
    failures,
    entries[2]!.nextPolicy === undefined,
    "entry 3 must not carry a next policy",
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

  // No build change across the series.
  const firstBuild = JSON.stringify(entries[0]!.designBeforeMatch);
  for (const [index, entry] of entries.entries()) {
    check(
      failures,
      entry.nextDesign === undefined,
      `entry ${index + 1} must not carry a next design`,
    );
    check(
      failures,
      JSON.stringify(entry.designBeforeMatch) === firstBuild,
      `entry ${index + 1} changed the build across the series`,
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

  // ── Text artifacts ──
  for (const [index, artifact] of matchArtifacts.entries()) {
    checkTextArtifact(
      failures,
      `match ${index + 1} text replay`,
      artifact.textReplay,
      (text) => text.includes("MATCH COMPLETE"),
    );
    checkTextArtifact(
      failures,
      `match ${index + 1} ASCII replay`,
      artifact.asciiReplay,
      (text) =>
        text.includes("ASCII REPLAY") &&
        GRID_CORNER_LABELS.some((label) => text.includes(label)),
    );
    checkTextArtifact(
      failures,
      `match ${index + 1} review prompt`,
      artifact.reviewPrompt,
      (text) =>
        text.includes("Simulator: 0.3.0 (grid-3x3-v1)") && /Zone: [A-Z]/.test(text),
    );
  }

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
    /3 match/i.test(seriesReport),
    "series report must state the three-match series",
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
