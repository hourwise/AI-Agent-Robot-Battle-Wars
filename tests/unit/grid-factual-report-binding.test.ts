import { describe, expect, it } from "vitest";
import { runGridMatch } from "../../src/simulator/grid-runtime.js";
import { RULESET_VERSION } from "../../src/simulator/constants.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { createGridCanaryScenario } from "../../src/canary/grid-canary-scenario.js";
import { matchResultToRecord } from "../../src/persistence/match-converter.js";
import { buildGridFactualReport } from "../../src/reports/factual-match-report.js";
import { bindGridFactualReportToMatchRecord } from "../../src/reports/grid-factual-report-binding.js";
import type { FactualMatchReportV2 } from "../../src/schemas/factual-report.schema.js";
import type { MatchRecordV3 } from "../../src/schemas/match-record.schema.js";

function buildBinding(): {
  report: FactualMatchReportV2;
  record: MatchRecordV3;
} {
  const scenario = createGridCanaryScenario();
  const result = runGridMatch({
    seed: 5,
    fighterA: scenario.fighterA,
    fighterB: scenario.fighterB,
    rulesetVersion: RULESET_VERSION,
    catalogueVersion: CATALOGUE_V1.version,
  });
  const record = matchResultToRecord(result, []) as MatchRecordV3;
  const report = buildGridFactualReport(result);
  return { report, record };
}

describe("grid factual-report → match-record binding (Phase 3D2A)", () => {
  it("binds a pending report to the real match UUID", () => {
    const { report, record } = buildBinding();
    expect(report.matchId).toBe("pending");

    const bound = bindGridFactualReportToMatchRecord(report, record);
    expect(bound.matchId).toBe(record.matchId);
    expect(bound).not.toBe(report);
  });

  it("is idempotent for repeated binding", () => {
    const { report, record } = buildBinding();
    const once = bindGridFactualReportToMatchRecord(report, record);
    const twice = bindGridFactualReportToMatchRecord(once, record);
    expect(twice.matchId).toBe(record.matchId);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  it("accepts a report already bound to the record UUID", () => {
    const { report, record } = buildBinding();
    const bound = bindGridFactualReportToMatchRecord(report, record);
    const rebound = bindGridFactualReportToMatchRecord(bound, record);
    expect(rebound.matchId).toBe(record.matchId);
  });

  it("never mutates the input report or record", () => {
    const { report, record } = buildBinding();
    const reportBefore = JSON.stringify(report);
    const recordBefore = JSON.stringify(record);
    bindGridFactualReportToMatchRecord(report, record);
    expect(JSON.stringify(report)).toBe(reportBefore);
    expect(JSON.stringify(record)).toBe(recordBefore);
  });

  it("rejects a report that is not schema v2", () => {
    const { report, record } = buildBinding();
    const bad = { ...report, schemaVersion: "1" } as unknown as FactualMatchReportV2;
    expect(() => bindGridFactualReportToMatchRecord(bad, record)).toThrow(
      /factual report failed its authoritative schema/,
    );
  });

  it("rejects a record that is not schema v3", () => {
    const { report, record } = buildBinding();
    const bad = { ...record, schemaVersion: "2" } as unknown as MatchRecordV3;
    expect(() => bindGridFactualReportToMatchRecord(report, bad)).toThrow(
      /match record failed its authoritative schema/,
    );
  });

  it("rejects a report with a wrong grid identity", () => {
    const { report, record } = buildBinding();
    // The v2 schema freezes the report identity as literals, so a wrong value
    // is rejected at the authoritative-schema boundary.
    const bad = { ...report, simulatorVersion: "0.2.0" } as FactualMatchReportV2;
    expect(() => bindGridFactualReportToMatchRecord(bad, record)).toThrow(
      /factual report failed its authoritative schema/,
    );
  });

  it("rejects a record with a wrong grid identity", () => {
    const { report, record } = buildBinding();
    // The v3 schema allows non-1 catalogueVersion as long as top-level and
    // config agree, so this is caught by the binding identity check.
    const bad = {
      ...record,
      catalogueVersion: "2",
      config: { ...record.config, catalogueVersion: "2" },
    } as MatchRecordV3;
    expect(() => bindGridFactualReportToMatchRecord(report, bad)).toThrow(
      /match record requires catalogueVersion 1/,
    );
  });

  it("rejects a seed mismatch", () => {
    const { report, record } = buildBinding();
    const badReport = { ...report, seed: report.seed + 1 } as FactualMatchReportV2;
    expect(() => bindGridFactualReportToMatchRecord(badReport, record)).toThrow(
      /report seed .* does not equal record seed/,
    );
  });

  it("rejects a rounds mismatch", () => {
    const { report, record } = buildBinding();
    const badReport = { ...report, rounds: report.rounds - 1 } as FactualMatchReportV2;
    expect(() => bindGridFactualReportToMatchRecord(badReport, record)).toThrow(
      /report rounds .* do not equal record rounds/,
    );
  });

  it("rejects a winner mismatch", () => {
    const { report, record } = buildBinding();
    const badReport = { ...report, winner: "fighter_a" } as FactualMatchReportV2;
    expect(() => bindGridFactualReportToMatchRecord(badReport, record)).toThrow(
      /report winner .* does not equal record winner/,
    );
  });

  it("rejects a result-method mismatch", () => {
    const { report, record } = buildBinding();
    const badReport = { ...report, resultMethod: "destruction" } as FactualMatchReportV2;
    expect(() => bindGridFactualReportToMatchRecord(badReport, record)).toThrow(
      /report result method .* does not equal record result method/,
    );
  });

  it("rejects a matchId that is neither pending nor the record UUID", () => {
    const { report, record } = buildBinding();
    const badReport = {
      ...report,
      matchId: "11111111-2222-3333-4444-555555555555",
    } as FactualMatchReportV2;
    expect(() => bindGridFactualReportToMatchRecord(badReport, record)).toThrow(
      /neither "pending" nor the record UUID/,
    );
  });
});
