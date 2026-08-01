import {
  FactualMatchReportV2Schema,
  type FactualMatchReportV2,
} from "../schemas/factual-report.schema.js";
import {
  MatchRecordV3Schema,
  type MatchRecordV3,
} from "../schemas/match-record.schema.js";

/**
 * Binds a factual-report v2 to its persisted match-record v3 (Milestone 0.2C
 * Phase 3D2A).
 *
 * A factual-report builder initially returns `matchId: "pending"`; the
 * persisted match record owns the actual UUID. This pure helper installs the
 * real UUID onto a fresh copy of the report and rejects every identity or
 * factual mismatch:
 *
 *   - factual-report schema v2 (authoritative parse);
 *   - match-record schema v3 (authoritative parse);
 *   - report identity is exactly grid `0.3.0 / grid-3x3-v1 / 0.2.0 / 1`;
 *   - record identity is exactly grid `0.3.0 / grid-3x3-v1 / 0.2.0 / 1`;
 *   - report seed == record seed;
 *   - report rounds == record rounds;
 *   - report winner == record winner;
 *   - report result method == record result method;
 *   - report `matchId` is either `"pending"` or already the record UUID.
 *
 * The completed report is re-validated against its authoritative schema before
 * being returned. Neither input is ever mutated.
 */
export function bindGridFactualReportToMatchRecord(
  report: FactualMatchReportV2,
  record: MatchRecordV3,
): FactualMatchReportV2 {
  const parsedReport = FactualMatchReportV2Schema.safeParse(report);
  if (!parsedReport.success) {
    throw new Error(
      `Grid canary binding: factual report failed its authoritative schema: ${parsedReport.error.message}`,
    );
  }
  const parsedRecord = MatchRecordV3Schema.safeParse(record);
  if (!parsedRecord.success) {
    throw new Error(
      `Grid canary binding: match record failed its authoritative schema: ${parsedRecord.error.message}`,
    );
  }

  const r = parsedReport.data;
  const rec = parsedRecord.data;

  assertIdentity("factual report", {
    simulatorVersion: r.simulatorVersion,
    positioningModel: r.positioningModel,
    rulesetVersion: r.rulesetVersion,
    catalogueVersion: r.catalogueVersion,
  });
  assertIdentity("match record", {
    simulatorVersion: rec.simulatorVersion,
    positioningModel: rec.positioningModel,
    rulesetVersion: rec.rulesetVersion,
    catalogueVersion: rec.catalogueVersion,
  });

  if (r.seed !== rec.seed) {
    throw new Error(
      `Grid canary binding: report seed ${r.seed} does not equal record seed ${rec.seed}`,
    );
  }
  if (r.rounds !== rec.rounds) {
    throw new Error(
      `Grid canary binding: report rounds ${r.rounds} do not equal record rounds ${rec.rounds}`,
    );
  }
  if (r.winner !== rec.result.winner) {
    throw new Error(
      `Grid canary binding: report winner ${String(r.winner)} does not equal record winner ${String(rec.result.winner)}`,
    );
  }
  if (r.resultMethod !== rec.result.method) {
    throw new Error(
      `Grid canary binding: report result method ${r.resultMethod} does not equal record result method ${rec.result.method}`,
    );
  }
  if (r.matchId !== "pending" && r.matchId !== rec.matchId) {
    throw new Error(
      `Grid canary binding: report matchId ${r.matchId} is neither "pending" nor the record UUID ${rec.matchId}`,
    );
  }

  const bound: FactualMatchReportV2 = { ...r, matchId: rec.matchId };
  const parsedBound = FactualMatchReportV2Schema.safeParse(bound);
  if (!parsedBound.success) {
    throw new Error(
      `Grid canary binding: completed factual report failed its authoritative schema: ${parsedBound.error.message}`,
    );
  }
  return parsedBound.data;
}

function assertIdentity(
  label: string,
  identity: {
    simulatorVersion: string;
    positioningModel: string;
    rulesetVersion: string;
    catalogueVersion: string;
  },
): void {
  if (identity.simulatorVersion !== "0.3.0") {
    throw new Error(
      `Grid canary binding: ${label} requires simulatorVersion 0.3.0; received ${identity.simulatorVersion}`,
    );
  }
  if (identity.positioningModel !== "grid-3x3-v1") {
    throw new Error(
      `Grid canary binding: ${label} requires positioningModel grid-3x3-v1; received ${identity.positioningModel}`,
    );
  }
  if (identity.rulesetVersion !== "0.2.0") {
    throw new Error(
      `Grid canary binding: ${label} requires rulesetVersion 0.2.0; received ${identity.rulesetVersion}`,
    );
  }
  if (identity.catalogueVersion !== "1") {
    throw new Error(
      `Grid canary binding: ${label} requires catalogueVersion 1; received ${identity.catalogueVersion}`,
    );
  }
}
