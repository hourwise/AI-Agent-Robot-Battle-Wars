import type { GridMatchCanaryManifestV2 } from "../schemas/grid-match-canary.schema.js";
import type { MatchRecordV3 } from "../schemas/match-record.schema.js";
import type { FactualMatchReportV2 } from "../schemas/factual-report.schema.js";
import type { MatchReview } from "../schemas/review.schema.js";
import { sha256Hex } from "./grid-canary-digest.js";

/**
 * Pure grid canary bundle cross-agreement validator (Milestone 0.2C Phase
 * 3D2A.1).
 *
 * Verifies that every artifact of a canary bundle agrees on identity, result,
 * review facts, text-artifact contracts and SHA-256 digests. It accepts only
 * parsed canonical artifacts plus the exact text contents of the three text
 * artifacts, uses the actual match-record v3 / factual-report v2 / review
 * shapes, never mutates any input, and throws a clear
 * `GridCanaryBundleError` describing every disagreement.
 */
export class GridCanaryBundleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridCanaryBundleError";
  }
}

export interface GridCanaryBundleValidationInput {
  manifest: GridMatchCanaryManifestV2;
  record: MatchRecordV3;
  report: FactualMatchReportV2;
  fallbackReview: MatchReview;
  textReplay: string;
  asciiReplay: string;
  reviewPrompt: string;
  /** Exact UTF-8 strings written to disk, used to verify SHA-256 digests. */
  serializedMatch: string;
  serializedFactualReport: string;
  serializedFallbackReview: string;
}

export interface GridCanaryBundleValidationResult {
  matchId: string;
  seed: number;
  rounds: number;
  winner: string | null;
  resultMethod: string;
  eventCount: number;
  digestAgreement: true;
}

const GRID_CORNER_LABELS = ["NORTH WEST", "NORTH EAST", "SOUTH WEST", "SOUTH EAST"];

function check(failures: string[], condition: boolean, message: string): void {
  if (!condition) failures.push(message);
}

export function validateGridMatchCanaryBundle(
  input: GridCanaryBundleValidationInput,
): GridCanaryBundleValidationResult {
  const { manifest, record, report, fallbackReview } = input;
  const failures: string[] = [];

  // --- Identity agreement ---
  if (manifest.matchId !== record.matchId) {
    check(
      failures,
      false,
      `manifest.matchId ${manifest.matchId} != record.matchId ${record.matchId}`,
    );
  }
  if (manifest.matchId !== report.matchId) {
    check(
      failures,
      false,
      `manifest.matchId ${manifest.matchId} != report.matchId ${report.matchId}`,
    );
  }
  if (record.matchId !== report.matchId) {
    check(
      failures,
      false,
      `record.matchId ${record.matchId} != report.matchId ${report.matchId}`,
    );
  }
  if (manifest.seed !== record.seed) {
    check(
      failures,
      false,
      `manifest.seed ${manifest.seed} != record.seed ${record.seed}`,
    );
  }
  if (manifest.seed !== report.seed) {
    check(
      failures,
      false,
      `manifest.seed ${manifest.seed} != report.seed ${report.seed}`,
    );
  }

  const identity = (
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
  identity("manifest", manifest);
  identity("record", record);
  identity("report", report);

  if (
    manifest.simulatorVersion !== record.simulatorVersion ||
    manifest.simulatorVersion !== report.simulatorVersion
  ) {
    check(failures, false, "simulatorVersion does not agree across artifacts");
  }
  if (
    manifest.positioningModel !== record.positioningModel ||
    manifest.positioningModel !== report.positioningModel
  ) {
    check(failures, false, "positioningModel does not agree across artifacts");
  }
  if (
    manifest.rulesetVersion !== record.rulesetVersion ||
    manifest.rulesetVersion !== report.rulesetVersion
  ) {
    check(failures, false, "rulesetVersion does not agree across artifacts");
  }
  if (
    manifest.catalogueVersion !== record.catalogueVersion ||
    manifest.catalogueVersion !== report.catalogueVersion
  ) {
    check(failures, false, "catalogueVersion does not agree across artifacts");
  }

  if (record.schemaVersion !== "3" || manifest.matchRecordSchemaVersion !== "3") {
    check(
      failures,
      false,
      "match record schema version must be 3 in record and manifest",
    );
  }
  if (report.schemaVersion !== "2" || manifest.factualReportSchemaVersion !== "2") {
    check(
      failures,
      false,
      "factual report schema version must be 2 in report and manifest",
    );
  }

  // --- Result agreement ---
  if (manifest.rounds !== record.rounds) {
    check(
      failures,
      false,
      `manifest.rounds ${manifest.rounds} != record rounds ${record.rounds}`,
    );
  }
  if (manifest.rounds !== report.rounds) {
    check(
      failures,
      false,
      `manifest.rounds ${manifest.rounds} != report.rounds ${report.rounds}`,
    );
  }
  if (manifest.winner !== record.result.winner) {
    check(
      failures,
      false,
      `manifest.winner ${String(manifest.winner)} != record winner ${String(record.result.winner)}`,
    );
  }
  if (manifest.winner !== report.winner) {
    check(
      failures,
      false,
      `manifest.winner ${String(manifest.winner)} != report winner ${String(report.winner)}`,
    );
  }
  if (manifest.resultMethod !== record.result.method) {
    check(
      failures,
      false,
      `manifest.resultMethod ${manifest.resultMethod} != record method ${record.result.method}`,
    );
  }
  if (manifest.resultMethod !== report.resultMethod) {
    check(
      failures,
      false,
      `manifest.resultMethod ${manifest.resultMethod} != report resultMethod ${report.resultMethod}`,
    );
  }
  if (manifest.eventCount !== record.events.length) {
    check(
      failures,
      false,
      `manifest.eventCount ${manifest.eventCount} != record event count ${record.events.length}`,
    );
  }

  // --- Review agreement ---
  const review = fallbackReview.observedOutcome;
  if (review.winnerId !== report.winner) {
    check(
      failures,
      false,
      `fallback review winner ${String(review.winnerId)} != report winner ${String(report.winner)}`,
    );
  }
  if (review.method !== report.resultMethod) {
    check(
      failures,
      false,
      `fallback review method ${review.method} != report resultMethod ${report.resultMethod}`,
    );
  }
  if (review.rounds !== report.rounds) {
    check(
      failures,
      false,
      `fallback review rounds ${review.rounds} != report rounds ${report.rounds}`,
    );
  }
  if (review.ownFinalIntegrity !== report.finalStates.fighterA.integrity) {
    check(
      failures,
      false,
      `fallback review own integrity ${review.ownFinalIntegrity} != report fighterA integrity ${report.finalStates.fighterA.integrity}`,
    );
  }
  if (review.opponentFinalIntegrity !== report.finalStates.fighterB.integrity) {
    check(
      failures,
      false,
      `fallback review opponent integrity ${review.opponentFinalIntegrity} != report fighterB integrity ${report.finalStates.fighterB.integrity}`,
    );
  }
  if (
    JSON.stringify(review.ownDisabledComponents) !==
    JSON.stringify(normaliseDisabledComponents(report.finalStates.fighterA))
  ) {
    check(
      failures,
      false,
      "fallback review own disabled components do not agree with report fighterA",
    );
  }
  if (
    JSON.stringify(review.opponentDisabledComponents) !==
    JSON.stringify(normaliseDisabledComponents(report.finalStates.fighterB))
  ) {
    check(
      failures,
      false,
      "fallback review opponent disabled components do not agree with report fighterB",
    );
  }

  // --- Text-artifact requirements ---
  checkTextArtifact(failures, "text replay", input.textReplay, (text) =>
    text.includes("MATCH COMPLETE"),
  );
  checkTextArtifact(
    failures,
    "ASCII replay",
    input.asciiReplay,
    (text) =>
      text.includes("ASCII REPLAY") &&
      GRID_CORNER_LABELS.some((label) => text.includes(label)),
  );
  checkTextArtifact(
    failures,
    "review prompt",
    input.reviewPrompt,
    (text) => text.includes("Simulator: 0.3.0 (grid-3x3-v1)") && /Zone: [A-Z]/.test(text),
  );

  // --- Digest agreement ---
  const digestEntries: Array<{
    key: keyof GridMatchCanaryManifestV2["digests"];
    text: string;
  }> = [
    { key: "match", text: input.serializedMatch },
    { key: "factualReport", text: input.serializedFactualReport },
    { key: "textReplay", text: input.textReplay },
    { key: "asciiReplay", text: input.asciiReplay },
    { key: "reviewPrompt", text: input.reviewPrompt },
    { key: "fallbackReview", text: input.serializedFallbackReview },
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
    throw new GridCanaryBundleError(failures.join("; "));
  }

  return {
    matchId: manifest.matchId,
    seed: manifest.seed,
    rounds: manifest.rounds,
    winner: manifest.winner,
    resultMethod: manifest.resultMethod,
    eventCount: manifest.eventCount,
    digestAgreement: true,
  };
}

function checkTextArtifact(
  failures: string[],
  label: string,
  text: string,
  contentCheck: (text: string) => boolean,
): void {
  check(failures, text.length > 0, `${label} must be non-empty`);
  check(failures, !text.includes("\u0000"), `${label} must not contain a NUL character`);
  check(
    failures,
    Buffer.from(text, "utf-8").toString("utf-8") === text,
    `${label} must be valid UTF-8`,
  );
  check(failures, contentCheck(text), `${label} lacks the required content marker`);
}

function normaliseDisabledComponents(state: {
  mobilityDisabled: boolean;
  weaponDisabled: boolean;
  utilityDisabled: boolean;
}): Array<"mobility" | "weapon" | "utility"> {
  const result: Array<"mobility" | "weapon" | "utility"> = [];
  if (state.mobilityDisabled) result.push("mobility");
  if (state.weaponDisabled) result.push("weapon");
  if (state.utilityDisabled) result.push("utility");
  return result;
}
