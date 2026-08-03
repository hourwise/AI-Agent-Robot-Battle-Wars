import { describe, expect, it } from "vitest";
import {
  buildGridGrappleSupplementFixture,
  grappleSupplementFixtureBaseIdentity,
  rebuildSupplementContents,
} from "../helpers/grid-grapple-supplement-builder.js";
import {
  validateGridGrappleCoverageSupplementBundle,
  deserializeGridGrappleCoverageSupplementManifest,
  GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES,
  GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE,
  GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_FACTUAL_REPORTS_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_METRICS_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT,
  GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT,
  GridGrappleCoverageSupplementBundleError,
  type GridGrappleCoverageSupplementManifestV1,
} from "../../src/readiness/grid-grapple-supplement-bundle.js";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import { recomputeGridActivationReadinessRunChecksums } from "../../src/readiness/record-evidence.js";
import { computeGridGrappleCoverageMetrics } from "../../src/readiness/grid-grapple-metrics.js";
import {
  buildGridGrappleCoverageDecision,
  buildGridActivationReadinessAddendum,
  deriveCombinedReadinessClassification,
  type GridGrappleCoverageHardChecks,
} from "../../src/readiness/grid-grapple-decision.js";
import { grappleAttackerSlotForRun } from "../../src/readiness/grid-grapple-execution-core.js";
import { GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT } from "../../src/readiness/grid-grapple-run-plan.js";
import { gridGrappleCoverageScenarioRegistryChecksum } from "../../src/readiness/grid-grapple-scenarios.js";

function buildFixture() {
  return buildGridGrappleSupplementFixture();
}

describe("grid grapple coverage supplement bundle (Phase 3E2 Phase 12)", () => {
  it("declares exactly the ten fixed artifact names", () => {
    expect(GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES).toEqual([
      "manifest.json",
      "base-readiness-reference.json",
      "seed-registry.json",
      "scenario-registry.json",
      "run-index.json",
      "match-records.json",
      "factual-reports.json",
      "metrics.json",
      "decision.json",
      "report.txt",
    ]);
    expect(GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES.length).toBe(10);
  });

  it("validates a fully consistent supplement bundle (complete read-back)", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const result = validateGridGrappleCoverageSupplementBundle(
      fixture.contents,
      identity,
    );
    expect(result.supplementId).toBe(fixture.supplementId);
    expect(result.decision).toBe("coverage_confirmed");
  });

  it("verifies every non-manifest digest and the decision/report checksums", () => {
    const fixture = buildFixture();
    const manifestParsed = deserializeGridGrappleCoverageSupplementManifest(
      fixture.contents[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!,
    );
    expect(manifestParsed.ok).toBe(true);
    if (!manifestParsed.ok) return;
    const manifest = manifestParsed.manifest;
    expect(Object.keys(manifest.digests).length).toBe(9);
    for (const name of GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES.filter(
      (n) => n !== GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE,
    )) {
      expect(manifest.digests[name]).toBe(sha256Hex(fixture.contents[name]!));
    }
    expect(manifest.decisionChecksum).toBe(
      sha256Hex(fixture.contents[GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT]!),
    );
    expect(manifest.reportChecksum).toBe(
      sha256Hex(fixture.contents[GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT]!),
    );
  });

  it("binds the base reference to the frozen official base identity", () => {
    const fixture = buildFixture();
    expect(fixture.manifest.addendum.baseV3.evaluationId).toBe(
      fixture.baseReference.evaluationId,
    );
    expect(fixture.manifest.addendum.baseV3.suiteChecksum).toBe(
      fixture.baseReference.suiteChecksum,
    );
    expect(fixture.manifest.addendum.baseV3.nonPassGates).toEqual(["C04"]);
    expect(fixture.manifest.combinedReadinessClassification).toBe(
      "ready_for_opt_in_beta_review",
    );
  });

  it("rejects a digest mismatch", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const corrupted = { ...fixture.contents };
    const manifest = JSON.parse(corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!) as {
      digests: Record<string, string>;
    };
    manifest.digests[GRID_GRAPPLE_SUPPLEMENT_METRICS_ARTIFACT] = "0".repeat(64);
    corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(/digest mismatch/);
  });

  it("rejects a missing artifact", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const corrupted = { ...fixture.contents };
    delete corrupted[GRID_GRAPPLE_SUPPLEMENT_FACTUAL_REPORTS_ARTIFACT];
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(GridGrappleCoverageSupplementBundleError);
  });

  it("rejects a changed record even when its digest is coherently redigested", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const corrupted = { ...fixture.contents };
    const records = JSON.parse(
      corrupted[GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT]!,
    ) as {
      items: Array<{ initialState: { fighterA: { integrity: number } } }>;
    };
    records.items[0]!.initialState.fighterA.integrity += 1;
    corrupted[GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT] = JSON.stringify(
      records,
      null,
      2,
    );
    const manifest = JSON.parse(corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!) as {
      digests: Record<string, string>;
    };
    manifest.digests[GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT] = sha256Hex(
      corrupted[GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT]!,
    );
    corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    // The record/report binding and run-index agreement now disagree.
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(GridGrappleCoverageSupplementBundleError);
  });

  it("rejects a run-index checksum change even after redigesting", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const corrupted = { ...fixture.contents };
    const runIndex = JSON.parse(
      corrupted[GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT]!,
    ) as {
      items: Array<{ recordChecksum: string }>;
    };
    runIndex.items[0]!.recordChecksum = "0".repeat(64);
    corrupted[GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT] = JSON.stringify(
      runIndex,
      null,
      2,
    );
    const manifest = JSON.parse(corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!) as {
      digests: Record<string, string>;
    };
    manifest.digests[GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT] = sha256Hex(
      corrupted[GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT]!,
    );
    corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(/checksums do not match/);
  });

  it("rejects a changed base-reference artifact even after redigesting", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const corrupted = { ...fixture.contents };
    const baseRef = JSON.parse(
      corrupted[GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT]!,
    ) as { baseV3: { knockbackEvents: number } };
    baseRef.baseV3.knockbackEvents = 999;
    corrupted[GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT] = JSON.stringify(
      baseRef,
      null,
      2,
    );
    const manifest = JSON.parse(corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!) as {
      digests: Record<string, string>;
    };
    manifest.digests[GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT] = sha256Hex(
      corrupted[GRID_GRAPPLE_SUPPLEMENT_BASE_REFERENCE_ARTIFACT]!,
    );
    corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(/base reference does not match the frozen official v3 evaluation/);
  });

  it("rejects a report.txt change even after redigesting", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const corrupted = { ...fixture.contents };
    corrupted[GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT] =
      `${corrupted[GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT]}\ntampered`;
    const manifest = JSON.parse(corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!) as {
      digests: Record<string, string>;
      reportChecksum: string;
    };
    manifest.digests[GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT] = sha256Hex(
      corrupted[GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT]!,
    );
    manifest.reportChecksum = manifest.digests[GRID_GRAPPLE_SUPPLEMENT_REPORT_ARTIFACT];
    corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(/report.txt does not byte-for-byte match/);
  });

  it("rejects a manifest whose combined classification disagrees with recomputation", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const corrupted = { ...fixture.contents };
    const manifest = JSON.parse(corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!) as {
      combinedReadinessClassification: string;
    };
    manifest.combinedReadinessClassification = "not_ready";
    corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(/combined readiness classification/);
  });

  it("serializes a manifest that round-trips through its schema", () => {
    const fixture = buildFixture();
    const parsed = deserializeGridGrappleCoverageSupplementManifest(
      fixture.contents[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const manifest: GridGrappleCoverageSupplementManifestV1 = parsed.manifest;
    expect(manifest.schemaVersion).toBe("1");
    expect(manifest.evaluationKind).toBe("grid-grapple-coverage-supplement");
    expect(manifest.runCount).toBe(48);
    expect(manifest.seedCount).toBe(24);
    expect(manifest.scenarioCount).toBe(1);
    expect(manifest.assignmentCount).toBe(2);
    expect(manifest.evidence.baseV3Unmodified).toBe(true);
  });
});

// ── Phase 3E2.1: fully coherent corruption rejection ────────────────────────

interface ParsedSupplement {
  records: Array<Record<string, unknown>>;
  reports: Array<Record<string, unknown>>;
  runIndex: Array<Record<string, unknown>>;
}

function parseFixture(
  fixture: ReturnType<typeof buildGridGrappleSupplementFixture>,
): ParsedSupplement {
  return {
    records: JSON.parse(fixture.contents[GRID_GRAPPLE_SUPPLEMENT_MATCH_RECORDS_ARTIFACT]!)
      .items,
    reports: JSON.parse(
      fixture.contents[GRID_GRAPPLE_SUPPLEMENT_FACTUAL_REPORTS_ARTIFACT]!,
    ).items,
    runIndex: JSON.parse(fixture.contents[GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT]!)
      .items,
  };
}

function withRecomputedChecksums(
  entry: Record<string, unknown>,
  record: Record<string, unknown>,
  report: Record<string, unknown>,
): Record<string, unknown> {
  const checksums = recomputeGridActivationReadinessRunChecksums(
    record as never,
    report as never,
  );
  return {
    ...entry,
    recordChecksum: checksums.recordChecksum,
    reportChecksum: checksums.reportChecksum,
    textReplayChecksum: checksums.textReplayChecksum,
    asciiReplayChecksum: checksums.asciiReplayChecksum,
    reviewPromptChecksum: checksums.reviewPromptChecksum,
  };
}

function evidenceFromRunIndex(entry: Record<string, unknown>) {
  return {
    grapplerAttackAttempts: entry.grapplerAttackAttempts as number,
    grapplerHits: entry.grapplerHits as number,
    grapplerMisses: entry.grapplerMisses as number,
    grappleRepositionEvents: entry.grappleRepositionEvents as number,
    sameCellGrapplerHitsWithoutReposition:
      entry.sameCellGrapplerHitsWithoutReposition as number,
    grappleSourceZones: entry.grappleSourceZones as Record<string, number>,
    grappleDestinationZones: entry.grappleDestinationZones as Record<string, number>,
    grappleRounds: entry.grappleRounds as number[],
    nonGrappleKnockbackEvents: entry.nonGrappleKnockbackEvents as number,
    overturnEvents: entry.overturnEvents as number,
    grappleEventsAttributedToWrongFighter:
      entry.grappleEventsAttributedToWrongFighter as number,
    malformedOrResolverDisagreeingGrappleEvents:
      entry.malformedOrResolverDisagreeingGrappleEvents as number,
  };
}

function naiveMetricsFromRunIndex(runIndex: Array<Record<string, unknown>>) {
  return computeGridGrappleCoverageMetrics({
    runs: runIndex.map((e) => ({
      runNumber: e.runNumber as number,
      seed: e.seed as number,
      attackerSlot: e.attackerSlot as "fighter_a" | "fighter_b",
      winner: (e.winner as string | null) ?? null,
      resultMethod: e.resultMethod as string,
      rounds: e.rounds as number,
      eventCount: e.eventCount as number,
      evidence: evidenceFromRunIndex(e),
    })),
    execution: {
      deterministicRuns: GRID_GRAPPLE_COVERAGE_SUPPLEMENT_RUN_COUNT,
      schemaValidRecords: runIndex.length,
      schemaValidReports: runIndex.length,
      finalStateAgreements: runIndex.length,
      invalidEventCount: 0,
      mutationFailures: 0,
    },
    timing: { totalElapsedMs: 0, perMatchMs: [] },
  });
}

function passingHardChecks(): GridGrappleCoverageHardChecks {
  return {
    allMatchesCompleted: true,
    determinismVerified: true,
    runtimeIdentityMatches: true,
    recordsValid: true,
    reportsValid: true,
    finalStateAgreementsComplete: true,
    chronologyValid: true,
    malformedGrappleEventsAbsent: true,
    resolverDisagreementsAbsent: true,
    inputsUnmodified: true,
    artifactIntegrityVerified: true,
    baseV3Valid: true,
    baseV3IdentityMatches: true,
    legacyIsolationVerified: true,
  };
}

function rebuildFromParts(
  fixture: ReturnType<typeof buildGridGrappleSupplementFixture>,
  parsed: ParsedSupplement,
  metrics: ReturnType<typeof naiveMetricsFromRunIndex>,
  decisionLabel: "coverage_confirmed" | "inconclusive" | "not_ready",
  overrides?: {
    validGrappleRepositionEvents?: number;
    fighterAAttackerRepositionCount?: number;
    fighterBAttackerRepositionCount?: number;
    distinctSeedsProducingFighterAAttackerReposition?: number;
    distinctSeedsProducingFighterBAttackerReposition?: number;
  },
): Record<string, string> {
  const decision = buildGridGrappleCoverageDecision({
    supplementId: fixture.supplementId,
    createdAt: fixture.createdAt,
    metrics,
    hardChecks: passingHardChecks(),
  });
  const effectiveDecision: typeof decision = {
    ...decision,
    decision: decisionLabel,
  };
  const g = metrics.grapple;
  const addendum = buildGridActivationReadinessAddendum({
    baseV3: {
      evaluationId: fixture.baseReference.evaluationId,
      suiteChecksum: fixture.baseReference.suiteChecksum,
      manifestChecksum: fixture.baseReference.manifestChecksum,
      decisionChecksum: fixture.baseReference.decisionChecksum,
      metricsChecksum: fixture.baseReference.metricsChecksum,
      classification: fixture.baseReference.classification,
      nonPassGates: fixture.baseReference.nonPassGates,
      knockbackEvents: fixture.baseReference.knockbackEvents,
      overturnEvents: fixture.baseReference.overturnEvents,
      grappleRepositionEvents: fixture.baseReference.grappleRepositionEvents,
    },
    supplement: {
      supplementId: fixture.supplementId,
      planChecksum: fixture.planChecksum,
      scenarioRegistryChecksum: fixture.scenarioRegistry.scenarios
        ? scenarioRegistryChecksumOf(fixture)
        : "",
      decision: decisionLabel,
      validGrappleRepositionEvents:
        overrides?.validGrappleRepositionEvents ?? g.validGrappleRepositionEvents,
      fighterAAttackerRepositionCount:
        overrides?.fighterAAttackerRepositionCount ?? g.fighterAAttackerRepositionCount,
      fighterBAttackerRepositionCount:
        overrides?.fighterBAttackerRepositionCount ?? g.fighterBAttackerRepositionCount,
      distinctSeedsProducingFighterAAttackerReposition:
        overrides?.distinctSeedsProducingFighterAAttackerReposition ??
        g.distinctSeedsProducingFighterAAttackerReposition,
      distinctSeedsProducingFighterBAttackerReposition:
        overrides?.distinctSeedsProducingFighterBAttackerReposition ??
        g.distinctSeedsProducingFighterBAttackerReposition,
    },
  });
  const combined = deriveCombinedReadinessClassification({
    baseV3: {
      evaluationId: fixture.baseReference.evaluationId,
      suiteChecksum: fixture.baseReference.suiteChecksum,
      manifestChecksum: fixture.baseReference.manifestChecksum,
      decisionChecksum: fixture.baseReference.decisionChecksum,
      metricsChecksum: fixture.baseReference.metricsChecksum,
      classification: fixture.baseReference.classification,
      nonPassGates: fixture.baseReference.nonPassGates,
      knockbackEvents: fixture.baseReference.knockbackEvents,
      overturnEvents: fixture.baseReference.overturnEvents,
      grappleRepositionEvents: fixture.baseReference.grappleRepositionEvents,
    },
    supplement: {
      supplementId: fixture.supplementId,
      planChecksum: fixture.planChecksum,
      scenarioRegistryChecksum: scenarioRegistryChecksumOf(fixture),
      decision: decisionLabel,
      validGrappleRepositionEvents:
        overrides?.validGrappleRepositionEvents ?? g.validGrappleRepositionEvents,
      fighterAAttackerRepositionCount:
        overrides?.fighterAAttackerRepositionCount ?? g.fighterAAttackerRepositionCount,
      fighterBAttackerRepositionCount:
        overrides?.fighterBAttackerRepositionCount ?? g.fighterBAttackerRepositionCount,
      distinctSeedsProducingFighterAAttackerReposition:
        overrides?.distinctSeedsProducingFighterAAttackerReposition ??
        g.distinctSeedsProducingFighterAAttackerReposition,
      distinctSeedsProducingFighterBAttackerReposition:
        overrides?.distinctSeedsProducingFighterBAttackerReposition ??
        g.distinctSeedsProducingFighterBAttackerReposition,
    },
  });
  return rebuildSupplementContents({
    supplementId: fixture.supplementId,
    createdAt: fixture.createdAt,
    seedRegistry: fixture.seedRegistry,
    scenarioRegistry: fixture.scenarioRegistry,
    planChecksum: fixture.planChecksum,
    baseReference: fixture.baseReference,
    records: parsed.records,
    reports: parsed.reports,
    runIndexEntries: parsed.runIndex,
    metrics,
    decision: effectiveDecision,
    addendum,
    combined,
  });
}

function scenarioRegistryChecksumOf(
  fixture: ReturnType<typeof buildGridGrappleSupplementFixture>,
): string {
  return gridGrappleCoverageScenarioRegistryChecksum(fixture.scenarioRegistry);
}

interface FixtureRecordEvent {
  type: string;
  sequence: number;
  round: number;
  timestampMs: number;
  actorId?: string;
  targetId?: string;
  data: Record<string, unknown>;
}

/**
 * Duplicates a grapple movement event in a structurally valid way: the fake
 * is inserted right before that round's `round_ended` with a fresh unique
 * per-round non-structural sequence number, so the record-evidence inspector
 * passes and the rejection must come from the causal evidence rule instead.
 * Returns the data of the injected event.
 */
function injectDuplicateGrappleEvent(
  record: { events: FixtureRecordEvent[] },
  grappleIdx: number,
): Record<string, unknown> {
  const original = record.events[grappleIdx]!;
  const round = original.round;
  const roundEndedIdx = record.events.findIndex(
    (e, i) => e.type === "round_ended" && e.round === round && i > grappleIdx,
  );
  const insertAt = roundEndedIdx >= 0 ? roundEndedIdx : record.events.length;
  const lastNonStructuralSeq = Math.max(
    ...record.events
      .slice(0, insertAt)
      .filter((e) => e.round === round)
      .map((e) => e.sequence),
  );
  const maxTimestamp = Math.max(...record.events.map((e) => e.timestampMs));
  const fake: FixtureRecordEvent = structuredClone(original);
  fake.sequence = lastNonStructuralSeq + 1;
  fake.timestampMs = maxTimestamp + 1;
  record.events.splice(insertAt, 0, fake);
  return fake.data;
}

describe("grid grapple coverage supplement coherent corruption (Phase 3E2.1 Phase 13)", () => {
  it("rejects an alternate run plan even when records, reports, run-index and checksums are coherently swapped", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const parsed = parseFixture(fixture);
    // Swap run 0 and run 1 content across run-index, records and reports
    // (fixing position-bound fields so the envelope stays schema-valid).
    const entry0 = parsed.runIndex[0]!;
    const entry1 = parsed.runIndex[1]!;
    parsed.runIndex[0] = { ...entry1, runNumber: 1, recordIndex: 0, reportIndex: 0 };
    parsed.runIndex[1] = { ...entry0, runNumber: 2, recordIndex: 1, reportIndex: 1 };
    const record0 = parsed.records[0]!;
    parsed.records[0] = parsed.records[1]!;
    parsed.records[1] = record0;
    const report0 = parsed.reports[0]!;
    parsed.reports[0] = parsed.reports[1]!;
    parsed.reports[1] = report0;
    const corrupted = rebuildFromParts(
      fixture,
      parsed,
      naiveMetricsFromRunIndex(parsed.runIndex),
      "coverage_confirmed",
    );
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(/does not equal the canonical run plan/);
  });

  it("rejects an alternate build even after coherent checksum redigesting", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const parsed = parseFixture(fixture);
    // A schema-valid but non-canonical weapon for the attacker.
    const record = parsed.records[0]! as {
      config: {
        fighterA: {
          build: { proposal: { weaponId: string } };
        };
      };
    };
    record.config.fighterA.build.proposal.weaponId = "hammer";
    parsed.runIndex[0] = withRecomputedChecksums(
      parsed.runIndex[0]!,
      parsed.records[0]!,
      parsed.reports[0]!,
    );
    const corrupted = rebuildFromParts(
      fixture,
      parsed,
      naiveMetricsFromRunIndex(parsed.runIndex),
      "coverage_confirmed",
    );
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(/record configuration does not match the canonical supplemental scenario/);
  });

  it("rejects a fake resolver-valid grapple without a hit that is still claimed as coverage", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const parsed = parseFixture(fixture);
    // Find a run with a valid grapple and inject a structurally valid
    // duplicate grapple (no hit backs it).
    const index = fixture.primary.results.findIndex(
      (r) => r.evidence.grappleRepositionEvents > 0,
    );
    expect(index).toBeGreaterThanOrEqual(0);
    const attackerSlot = grappleAttackerSlotForRun(fixture.runPlan.runs[index]!);
    const record = parsed.records[index]! as { events: FixtureRecordEvent[] };
    const grappleIdx = record.events.findIndex(
      (e) =>
        e.type === "movement_resolved" &&
        e.actorId === attackerSlot &&
        (e.data as { action?: string }).action === "grapple",
    );
    expect(grappleIdx).toBeGreaterThanOrEqual(0);
    const data = injectDuplicateGrappleEvent(record, grappleIdx);
    // Claim the fake in the run-index entry (naive counting) and re-agree the
    // event count so only the causal evidence rule can reject the bundle.
    const entry = parsed.runIndex[index]!;
    const from = data.from as string;
    const to = data.to as string;
    parsed.runIndex[index] = {
      ...entry,
      eventCount: record.events.length,
      grappleRepositionEvents: (entry.grappleRepositionEvents as number) + 1,
      grappleSourceZones: {
        ...(entry.grappleSourceZones as Record<string, number>),
        [from]: ((entry.grappleSourceZones as Record<string, number>)[from] ?? 0) + 1,
      },
      grappleDestinationZones: {
        ...(entry.grappleDestinationZones as Record<string, number>),
        [to]: ((entry.grappleDestinationZones as Record<string, number>)[to] ?? 0) + 1,
      },
      grappleRounds: [
        ...(entry.grappleRounds as number[]),
        record.events[grappleIdx]!.round,
      ],
      ...withRecomputedChecksums(entry, parsed.records[index]!, parsed.reports[index]!),
    };
    const naiveMetrics = naiveMetricsFromRunIndex(parsed.runIndex);
    const corrupted = rebuildFromParts(
      fixture,
      parsed,
      naiveMetrics,
      "coverage_confirmed",
    );
    // The strengthened extractor never counts the unmatched grapple, so the
    // bundle that claims it as coverage must reject via the causal rule.
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(
      /recomputed grapple evidence does not match|persisted metrics do not match/,
    );
  });

  it("rejects a false grapple origin that is still claimed in source counts", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const parsed = parseFixture(fixture);
    const index = fixture.primary.results.findIndex(
      (r) => r.evidence.grappleRepositionEvents > 0,
    );
    expect(index).toBeGreaterThanOrEqual(0);
    const attackerSlot = grappleAttackerSlotForRun(fixture.runPlan.runs[index]!);
    const record = parsed.records[index]! as {
      events: Array<{
        type: string;
        actorId?: string;
        round: number;
        data: Record<string, unknown>;
      }>;
    };
    const grappleIdx = record.events.findIndex(
      (e) =>
        e.type === "movement_resolved" &&
        e.actorId === attackerSlot &&
        (e.data as { action?: string }).action === "grapple",
    );
    expect(grappleIdx).toBeGreaterThanOrEqual(0);
    const data = record.events[grappleIdx]!.data;
    const originalFrom = data.from as string;
    const falseFrom = originalFrom === "north" ? "south" : "north";
    data.from = falseFrom;
    // Claim the false origin in the run-index entry.
    const entry = parsed.runIndex[index]!;
    parsed.runIndex[index] = {
      ...entry,
      grappleSourceZones: {
        ...(entry.grappleSourceZones as Record<string, number>),
        [falseFrom]:
          ((entry.grappleSourceZones as Record<string, number>)[falseFrom] ?? 0) + 1,
      },
      ...withRecomputedChecksums(entry, parsed.records[index]!, parsed.reports[index]!),
    };
    const corrupted = rebuildFromParts(
      fixture,
      parsed,
      naiveMetricsFromRunIndex(parsed.runIndex),
      "coverage_confirmed",
    );
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(
      /recomputed grapple evidence does not match|persisted metrics do not match/,
    );
  });

  it("rejects a second resolver-valid grapple for one hit that is claimed as coverage", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const parsed = parseFixture(fixture);
    const index = fixture.primary.results.findIndex(
      (r) => r.evidence.grappleRepositionEvents > 0,
    );
    expect(index).toBeGreaterThanOrEqual(0);
    const attackerSlot = grappleAttackerSlotForRun(fixture.runPlan.runs[index]!);
    const record = parsed.records[index]! as { events: FixtureRecordEvent[] };
    const grappleIdx = record.events.findIndex(
      (e) =>
        e.type === "movement_resolved" &&
        e.actorId === attackerSlot &&
        (e.data as { action?: string }).action === "grapple",
    );
    expect(grappleIdx).toBeGreaterThanOrEqual(0);
    const data = injectDuplicateGrappleEvent(record, grappleIdx);
    const entry = parsed.runIndex[index]!;
    parsed.runIndex[index] = {
      ...entry,
      eventCount: record.events.length,
      grappleRepositionEvents: (entry.grappleRepositionEvents as number) + 1,
      grappleSourceZones: {
        ...(entry.grappleSourceZones as Record<string, number>),
        [data.from as string]:
          ((entry.grappleSourceZones as Record<string, number>)[data.from as string] ??
            0) + 1,
      },
      grappleDestinationZones: {
        ...(entry.grappleDestinationZones as Record<string, number>),
        [data.to as string]:
          ((entry.grappleDestinationZones as Record<string, number>)[data.to as string] ??
            0) + 1,
      },
      grappleRounds: [
        ...(entry.grappleRounds as number[]),
        record.events[grappleIdx]!.round,
      ],
      ...withRecomputedChecksums(entry, parsed.records[index]!, parsed.reports[index]!),
    };
    const corrupted = rebuildFromParts(
      fixture,
      parsed,
      naiveMetricsFromRunIndex(parsed.runIndex),
      "coverage_confirmed",
    );
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(
      /recomputed grapple evidence does not match|persisted metrics do not match/,
    );
  });

  it("rejects a decision payload corruption that retains the same decision label", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const corrupted = { ...fixture.contents };
    const decision = JSON.parse(
      corrupted[GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT]!,
    ) as {
      execution: { completedRuns: number };
      decision: string;
    };
    decision.execution.completedRuns = 47;
    corrupted[GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT] = JSON.stringify(
      decision,
      null,
      2,
    );
    const manifest = JSON.parse(corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!) as {
      digests: Record<string, string>;
      decisionChecksum: string;
    };
    manifest.digests[GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT] = sha256Hex(
      corrupted[GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT]!,
    );
    manifest.decisionChecksum =
      manifest.digests[GRID_GRAPPLE_SUPPLEMENT_DECISION_ARTIFACT];
    corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(/persisted decision artifact does not equal the complete decision/);
  });

  it("rejects an addendum corruption that preserves the combined label", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const corrupted = { ...fixture.contents };
    const manifest = JSON.parse(corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!) as {
      addendum: { supplement: { validGrappleRepositionEvents: number } };
    };
    manifest.addendum.supplement.validGrappleRepositionEvents = 9;
    corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(/persisted addendum does not equal the complete addendum/);
  });

  it("rejects an identity corruption across a subset of envelopes", () => {
    const fixture = buildFixture();
    const identity = grappleSupplementFixtureBaseIdentity();
    const corrupted = { ...fixture.contents };
    const runIndex = JSON.parse(
      corrupted[GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT]!,
    ) as {
      supplementId: string;
    };
    runIndex.supplementId = "99999999-9999-4999-8999-999999999999";
    corrupted[GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT] = JSON.stringify(
      runIndex,
      null,
      2,
    );
    const manifest = JSON.parse(corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE]!) as {
      digests: Record<string, string>;
    };
    manifest.digests[GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT] = sha256Hex(
      corrupted[GRID_GRAPPLE_SUPPLEMENT_RUN_INDEX_ARTIFACT]!,
    );
    corrupted[GRID_GRAPPLE_SUPPLEMENT_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() =>
      validateGridGrappleCoverageSupplementBundle(corrupted, identity),
    ).toThrow(/supplement ID is not identical across/);
  });
});
