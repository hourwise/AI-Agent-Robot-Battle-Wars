import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import { buildReviewUserPrompt } from "../../src/prompts/review-prompt.v1.js";
import { gridRecordToGridResult } from "../../src/readiness/record-evidence.js";
import { renderAsciiReplay } from "../../src/replay/ascii/ascii-replay-renderer.js";
import { renderTextReplay } from "../../src/replay/text-replay-renderer.js";
import { POSITIONING_MODEL_GRID } from "../../src/schemas/positioning.schema.js";
import { gridBetaMatchResultChecksum } from "../../src/beta/grid-beta-execution-core.js";
import {
  GRID_BETA_MATCH_ASCII_REPLAY_ARTIFACT,
  GRID_BETA_MATCH_BUNDLE_ENTRIES,
  GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT,
  GRID_BETA_MATCH_FACTUAL_REPORT_ARTIFACT,
  GRID_BETA_MATCH_FIGHTER_A_ARTIFACT,
  GRID_BETA_MATCH_FIGHTER_B_ARTIFACT,
  GRID_BETA_MATCH_MANIFEST_FILE,
  GRID_BETA_MATCH_NON_MANIFEST_ARTIFACTS,
  GRID_BETA_MATCH_RECORD_ARTIFACT,
  GRID_BETA_MATCH_REVIEW_PROMPT_ARTIFACT,
  GRID_BETA_MATCH_SELECTION_ARTIFACT,
  GRID_BETA_MATCH_TEXT_REPLAY_ARTIFACT,
  validateGridBetaMatchBundle,
} from "../../src/beta/grid-beta-match-bundle.js";
import {
  BETA_TEST_MATCH_ID,
  createBetaTempEnvironment,
  officialGovernanceBundleAvailable,
  readBetaBundle,
  redigestBetaBundle,
  runBetaMatchToTemp,
} from "../helpers/grid-beta-builder.js";

/**
 * Coherently rebuilds every downstream artifact and digest after the caller
 * mutates the record, report, fighter artifacts, selection, attestation or
 * manifest. Rejection therefore cannot depend on a forgotten checksum or a
 * stale digest: the record-derived replays, the report-derived review prompt,
 * the execution primary/repeat checksum and every manifest digest are all
 * recomputed from the mutated inputs before the validator runs.
 */
function rebuildCoherently(
  bundle: Record<string, string>,
  mutations: {
    record?: Record<string, unknown>;
    report?: Record<string, unknown>;
    fighterA?: Record<string, unknown>;
    fighterB?: Record<string, unknown>;
    selection?: Record<string, unknown>;
    attestation?: Record<string, unknown>;
    manifest?: Record<string, unknown>;
  },
): Record<string, string> {
  const out = { ...bundle };
  if (mutations.record) {
    out[GRID_BETA_MATCH_RECORD_ARTIFACT] = JSON.stringify(mutations.record, null, 2);
  }
  if (mutations.report) {
    out[GRID_BETA_MATCH_FACTUAL_REPORT_ARTIFACT] = JSON.stringify(
      mutations.report,
      null,
      2,
    );
  }
  if (mutations.fighterA) {
    out[GRID_BETA_MATCH_FIGHTER_A_ARTIFACT] = JSON.stringify(mutations.fighterA, null, 2);
  }
  if (mutations.fighterB) {
    out[GRID_BETA_MATCH_FIGHTER_B_ARTIFACT] = JSON.stringify(mutations.fighterB, null, 2);
  }
  if (mutations.selection) {
    const selection = JSON.parse(out[GRID_BETA_MATCH_SELECTION_ARTIFACT]!) as Record<
      string,
      unknown
    >;
    out[GRID_BETA_MATCH_SELECTION_ARTIFACT] = JSON.stringify(
      { ...selection, ...mutations.selection },
      null,
      2,
    );
  }
  if (mutations.attestation) {
    const attestation = JSON.parse(
      out[GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT]!,
    ) as Record<string, unknown>;
    out[GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT] = JSON.stringify(
      { ...attestation, ...mutations.attestation },
      null,
      2,
    );
  }
  // Re-derive the replays from the (mutated) record and the review prompt from
  // the (mutated) report.
  const record = JSON.parse(out[GRID_BETA_MATCH_RECORD_ARTIFACT]!);
  const report = JSON.parse(out[GRID_BETA_MATCH_FACTUAL_REPORT_ARTIFACT]!);
  const reconstructed = gridRecordToGridResult(record);
  out[GRID_BETA_MATCH_TEXT_REPLAY_ARTIFACT] = renderTextReplay(reconstructed);
  out[GRID_BETA_MATCH_ASCII_REPLAY_ARTIFACT] = renderAsciiReplay(
    reconstructed,
    { mode: "ascii" },
    POSITIONING_MODEL_GRID,
  );
  out[GRID_BETA_MATCH_REVIEW_PROMPT_ARTIFACT] = buildReviewUserPrompt(report);
  // Recompute the execution primary/repeat checksum from the record
  // reconstruction (so a mutated record is coherent), then apply any explicit
  // attestation override last.
  const attestation = JSON.parse(
    out[GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT]!,
  ) as {
    primaryResultChecksum: string;
    repeatResultChecksum: string;
  };
  attestation.primaryResultChecksum = gridBetaMatchResultChecksum(reconstructed);
  attestation.repeatResultChecksum = attestation.primaryResultChecksum;
  if (mutations.attestation) {
    Object.assign(attestation, mutations.attestation);
  }
  out[GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT] = JSON.stringify(
    attestation,
    null,
    2,
  );
  // Rebuild the manifest: sync match identity and fighter checksums from the
  // mutated record/selection, recompute every digest and apply any explicit
  // manifest override last.
  const manifest = JSON.parse(out[GRID_BETA_MATCH_MANIFEST_FILE]!) as Record<
    string,
    unknown
  > & { digests: Record<string, string> };
  const selection = JSON.parse(out[GRID_BETA_MATCH_SELECTION_ARTIFACT]!) as {
    fighterA: { checksum: string };
    fighterB: { checksum: string };
  };
  manifest.fighterChecksums = {
    fighterA: selection.fighterA.checksum,
    fighterB: selection.fighterB.checksum,
  };
  manifest.createdAt = (record as { createdAt: string }).createdAt;
  for (const name of GRID_BETA_MATCH_NON_MANIFEST_ARTIFACTS) {
    manifest.digests[name] = sha256Hex(out[name]!);
  }
  if (mutations.manifest) {
    Object.assign(manifest, mutations.manifest);
  }
  out[GRID_BETA_MATCH_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
  return out;
}

let env: Awaited<ReturnType<typeof createBetaTempEnvironment>> | null = null;
let baseline: Record<string, string> | null = null;

beforeAll(async () => {
  if (!officialGovernanceBundleAvailable()) return;
  env = await createBetaTempEnvironment();
  const result = await runBetaMatchToTemp(env);
  baseline = await readBetaBundle(result.artifactDirectory);
}, 120_000);

afterAll(async () => {
  if (env) await env.cleanup();
});

describe("grid beta match bundle and validator (Phase 3G Phases 9 and 10)", () => {
  it("declares exactly the ten fixed artifact names", () => {
    expect(GRID_BETA_MATCH_BUNDLE_ENTRIES).toEqual([
      "manifest.json",
      "selection.json",
      "fighter-a.json",
      "fighter-b.json",
      "execution-attestation.json",
      "match.json",
      "factual-report.json",
      "text-replay.txt",
      "ascii-replay.txt",
      "review-prompt.txt",
    ]);
    expect(GRID_BETA_MATCH_BUNDLE_ENTRIES.length).toBe(10);
  });

  it("validates a fully consistent beta match bundle", () => {
    if (!baseline) return;
    const result = validateGridBetaMatchBundle(baseline);
    expect(result.matchId).toBe(BETA_TEST_MATCH_ID);
    expect(result.validationStatus).toBe("validated");
  });

  it("rejects a coherently-redigested selection acknowledgement change", () => {
    if (!baseline) return;
    const corrupted = { ...baseline };
    const selection = JSON.parse(corrupted[GRID_BETA_MATCH_SELECTION_ARTIFACT]!) as {
      acknowledgement: boolean;
    };
    selection.acknowledgement = false;
    corrupted[GRID_BETA_MATCH_SELECTION_ARTIFACT] = JSON.stringify(selection, null, 2);
    redigestBetaBundle(corrupted);
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(/invalid selection/);
  });

  it("rejects a coherently-redigested governance decision change", () => {
    if (!baseline) return;
    const corrupted = { ...baseline };
    const selection = JSON.parse(corrupted[GRID_BETA_MATCH_SELECTION_ARTIFACT]!) as {
      governanceDecisionId: string;
    };
    selection.governanceDecisionId = "99999999-9999-4999-8999-999999999999";
    corrupted[GRID_BETA_MATCH_SELECTION_ARTIFACT] = JSON.stringify(selection, null, 2);
    redigestBetaBundle(corrupted);
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(/invalid selection/);
  });

  it("rejects a coherently-redigested governance hash change through the frozen-hash rule", () => {
    if (!baseline) return;
    const corrupted = { ...baseline };
    const selection = JSON.parse(corrupted[GRID_BETA_MATCH_SELECTION_ARTIFACT]!) as {
      governanceArtifactHashes: Record<string, string>;
    };
    const name = Object.keys(selection.governanceArtifactHashes)[0]!;
    selection.governanceArtifactHashes[name] = "0".repeat(64);
    corrupted[GRID_BETA_MATCH_SELECTION_ARTIFACT] = JSON.stringify(selection, null, 2);
    redigestBetaBundle(corrupted);
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /frozen official hashes/,
    );
  });

  it("rejects a fighter spec changed to another valid build", () => {
    if (!baseline) return;
    const corrupted = { ...baseline };
    const fighterA = JSON.parse(corrupted[GRID_BETA_MATCH_FIGHTER_A_ARTIFACT]!) as {
      displayName: string;
      buildProposal: Record<string, unknown>;
    };
    // Another catalogue-valid, authoritative-valid build with the same
    // fighterId: the machine name and the agreeing display name both change,
    // so the spec passes authoritative fighter validation but its checksum
    // differs.
    fighterA.displayName = "Alpha Prime";
    fighterA.buildProposal = {
      ...fighterA.buildProposal,
      machineName: "Alpha Prime",
    };
    corrupted[GRID_BETA_MATCH_FIGHTER_A_ARTIFACT] = JSON.stringify(fighterA, null, 2);
    redigestBetaBundle(corrupted);
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /fighter-a checksum does not match the selection/,
    );
  });

  it("rejects a record configuration that differs from the fighter artifact", () => {
    if (!baseline) return;
    const corrupted = { ...baseline };
    const record = JSON.parse(corrupted[GRID_BETA_MATCH_RECORD_ARTIFACT]!) as {
      config: {
        fighterA: {
          build: { proposal: { machineName: string } };
        };
      };
    };
    record.config.fighterA.build.proposal.machineName = "Tampered";
    corrupted[GRID_BETA_MATCH_RECORD_ARTIFACT] = JSON.stringify(record, null, 2);
    redigestBetaBundle(corrupted);
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /record config\/initial-state builds do not match the authoritative reconstructed builds/,
    );
  });

  it("rejects an initial-state build that differs from the record config", () => {
    if (!baseline) return;
    const corrupted = { ...baseline };
    const record = JSON.parse(corrupted[GRID_BETA_MATCH_RECORD_ARTIFACT]!) as {
      initialState: {
        fighterA: {
          build: { proposal: { machineName: string } };
        };
      };
    };
    record.initialState.fighterA.build.proposal.machineName = "Tampered";
    corrupted[GRID_BETA_MATCH_RECORD_ARTIFACT] = JSON.stringify(record, null, 2);
    redigestBetaBundle(corrupted);
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /record config\/initial-state builds do not match the authoritative reconstructed builds/,
    );
  });

  it("rejects a changed C2 component qualification identity", () => {
    if (!baseline) return;
    const corrupted = { ...baseline };
    const record = JSON.parse(corrupted[GRID_BETA_MATCH_RECORD_ARTIFACT]!) as {
      config: { componentQualificationId: string };
    };
    record.config.componentQualificationId = "component-impact-c1";
    corrupted[GRID_BETA_MATCH_RECORD_ARTIFACT] = JSON.stringify(record, null, 2);
    redigestBetaBundle(corrupted);
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /C2 component qualification/,
    );
  });

  it("rejects a changed runtime identity", () => {
    if (!baseline) return;
    const corrupted = { ...baseline };
    const record = JSON.parse(corrupted[GRID_BETA_MATCH_RECORD_ARTIFACT]!) as {
      simulatorVersion: string;
    };
    record.simulatorVersion = "0.9.9";
    corrupted[GRID_BETA_MATCH_RECORD_ARTIFACT] = JSON.stringify(record, null, 2);
    redigestBetaBundle(corrupted);
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /invalid match record|runtime identity/,
    );
  });

  it("rejects a record/report final-state change", () => {
    if (!baseline) return;
    const corrupted = { ...baseline };
    const report = JSON.parse(corrupted[GRID_BETA_MATCH_FACTUAL_REPORT_ARTIFACT]!) as {
      finalStates: { fighterA: { zone: string } };
    };
    // Change a reconstructed final-state fact (fighter A final zone).
    report.finalStates.fighterA.zone = "south";
    corrupted[GRID_BETA_MATCH_FACTUAL_REPORT_ARTIFACT] = JSON.stringify(report, null, 2);
    redigestBetaBundle(corrupted);
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /final-state|agreement|final zone/,
    );
  });

  it("rejects a changed replay artifact", () => {
    if (!baseline) return;
    const corrupted = { ...baseline };
    corrupted[GRID_BETA_MATCH_TEXT_REPLAY_ARTIFACT] =
      `${corrupted[GRID_BETA_MATCH_TEXT_REPLAY_ARTIFACT]}\ntampered`;
    redigestBetaBundle(corrupted);
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /text-replay\.txt does not byte-for-byte match/,
    );
  });

  it("rejects non-empty agent usage", () => {
    if (!baseline) return;
    const corrupted = { ...baseline };
    const record = JSON.parse(corrupted[GRID_BETA_MATCH_RECORD_ARTIFACT]!) as {
      agentUsage: unknown[];
    };
    record.agentUsage = [
      {
        phase: "design",
        agentId: "x",
        provider: "y",
        model: "z",
        providerRequestId: null,
        promptVersion: "v1",
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        costUsd: null,
        costIsEstimated: false,
        pricingVersion: null,
        latencyMs: 0,
        attempts: 1,
        fallbackUsed: false,
        errorCategory: "none",
      },
    ];
    corrupted[GRID_BETA_MATCH_RECORD_ARTIFACT] = JSON.stringify(record, null, 2);
    redigestBetaBundle(corrupted);
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /agent usage must be empty/,
    );
  });

  it("rejects a false no-legacy-fallback attestation", () => {
    if (!baseline) return;
    const corrupted = { ...baseline };
    const attestation = JSON.parse(
      corrupted[GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT]!,
    ) as { noLegacyFallback: boolean };
    attestation.noLegacyFallback = false;
    corrupted[GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT] = JSON.stringify(
      attestation,
      null,
      2,
    );
    redigestBetaBundle(corrupted);
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /invalid attestation|noLegacyFallback/,
    );
  });

  it("rejects a changed manifest result summary", () => {
    if (!baseline) return;
    const corrupted = { ...baseline };
    const manifest = JSON.parse(corrupted[GRID_BETA_MATCH_MANIFEST_FILE]!) as {
      result: { winner: string | null };
    };
    manifest.result.winner = "tampered";
    corrupted[GRID_BETA_MATCH_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /manifest result summary does not agree with the record/,
    );
  });

  it("rejects a missing artifact", () => {
    if (!baseline) return;
    const corrupted = { ...baseline };
    delete corrupted[GRID_BETA_MATCH_ASCII_REPLAY_ARTIFACT];
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(/missing artifact/);
  });

  it("rejects an unexpected artifact", () => {
    if (!baseline) return;
    const corrupted = { ...baseline };
    corrupted["extra.txt"] = "x";
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(/unexpected artifact/);
  });

  it("does not reject through a stale digest (rejections are cross-agreement rules)", () => {
    if (!baseline) return;
    // Sanity: the redigest helper produces coherent digests for the baseline.
    const copied = { ...baseline };
    redigestBetaBundle(copied);
    expect(() => validateGridBetaMatchBundle(copied)).not.toThrow();
  });

  // ── Phase 3G.1 fully coherent corruption cases (Phase 14) ────────────────

  it("rejects a coherently-rebuilt catalogue-invalid fighter through authoritative fighter validation", () => {
    if (!baseline) return;
    const overBudgetArmour = { front: 100000, left: 0, right: 0, rear: 0, top: 0 };
    const fighterA = JSON.parse(baseline[GRID_BETA_MATCH_FIGHTER_A_ARTIFACT]!) as {
      buildProposal: { armour: Record<string, number> };
    };
    fighterA.buildProposal.armour = overBudgetArmour;
    const fighterAJson = JSON.stringify(fighterA, null, 2);
    const record = JSON.parse(baseline[GRID_BETA_MATCH_RECORD_ARTIFACT]!) as {
      config: {
        fighterA: {
          build: {
            proposal: { armour: Record<string, number> };
            totalCost: number;
            armourCost: number;
          };
        };
      };
      initialState: {
        fighterA: {
          build: {
            proposal: { armour: Record<string, number> };
            totalCost: number;
            armourCost: number;
          };
        };
      };
    };
    for (const build of [
      record.config.fighterA.build,
      record.initialState.fighterA.build,
    ]) {
      build.proposal.armour = { ...overBudgetArmour };
      build.totalCost = 100001;
      build.armourCost = 100000;
    }
    // Coherently update the report armour so the final-state agreement rule is
    // not the (accidental) cause of rejection.
    const report = JSON.parse(baseline[GRID_BETA_MATCH_FACTUAL_REPORT_ARTIFACT]!) as {
      fighterA: { armour: Record<string, number>; totalCost: number };
    };
    report.fighterA.armour = { ...overBudgetArmour };
    report.fighterA.totalCost = 100001;
    const corrupted = rebuildCoherently(baseline, {
      fighterA,
      record: record as unknown as Record<string, unknown>,
      report: report as unknown as Record<string, unknown>,
      selection: { fighterA: { fighterId: "alpha", checksum: sha256Hex(fighterAJson) } },
    });
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /fighter-a failed authoritative fighter validation/,
    );
  });

  it("rejects a coherently-rebuilt proposal/derived-build disagreement through the full build binding", () => {
    if (!baseline) return;
    const record = JSON.parse(baseline[GRID_BETA_MATCH_RECORD_ARTIFACT]!) as {
      config: {
        fighterA: {
          build: {
            totalCost: number;
            armourCost: number;
            totalArmourPoints: number;
            catalogueVersion: string;
          };
        };
      };
      initialState: {
        fighterA: {
          build: {
            totalCost: number;
            armourCost: number;
            totalArmourPoints: number;
            catalogueVersion: string;
          };
        };
      };
    };
    // Keep the proposal schema-valid but alter every derived cost field.
    for (const build of [
      record.config.fighterA.build,
      record.initialState.fighterA.build,
    ]) {
      build.totalCost = 1;
      build.armourCost = 1;
      build.totalArmourPoints = 1;
      build.catalogueVersion = "9";
    }
    const corrupted = rebuildCoherently(baseline, {
      record: record as unknown as Record<string, unknown>,
    });
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /record config\/initial-state builds do not match the authoritative reconstructed builds/,
    );
  });

  it("rejects a coherently-rebuilt altered C2 metadata through the complete C2 metadata rule", () => {
    if (!baseline) return;
    const record = JSON.parse(baseline[GRID_BETA_MATCH_RECORD_ARTIFACT]!) as {
      componentQualification: { configChecksum: string };
      config: { componentQualification: { configChecksum: string } };
    };
    // Keep both IDs as component-impact-c2 but change the persisted metadata
    // checksum (schema-valid 16-hex), so the complete C2 metadata rule fires.
    record.componentQualification.configChecksum = "0000000000000000";
    record.config.componentQualification.configChecksum = "0000000000000000";
    const corrupted = rebuildCoherently(baseline, {
      record: record as unknown as Record<string, unknown>,
    });
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /C2 component qualification metadata/,
    );
  });

  it("rejects a coherently-rebuilt contradictory preflight through canonical preflight validation", () => {
    if (!baseline) return;
    const selection = JSON.parse(baseline[GRID_BETA_MATCH_SELECTION_ARTIFACT]!) as {
      protectedSourcePreflight: {
        status: string;
        trigger: string | null;
        failures: string[];
        catalogueStill1: boolean;
      };
    };
    // status pass with one detailed boolean false and no failures/trigger.
    selection.protectedSourcePreflight = {
      ...selection.protectedSourcePreflight,
      catalogueStill1: false,
    };
    const corrupted = rebuildCoherently(baseline, {
      selection: { protectedSourcePreflight: selection.protectedSourcePreflight },
    });
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /not the canonical pass/,
    );
    // status pass with a nonempty trigger also rejects.
    const selection2 = JSON.parse(baseline[GRID_BETA_MATCH_SELECTION_ARTIFACT]!) as {
      protectedSourcePreflight: {
        status: string;
        trigger: string | null;
        failures: string[];
      };
    };
    selection2.protectedSourcePreflight = {
      ...selection2.protectedSourcePreflight,
      trigger: "legacy_default_regression",
    };
    const corrupted2 = rebuildCoherently(baseline, {
      selection: { protectedSourcePreflight: selection2.protectedSourcePreflight },
    });
    expect(() => validateGridBetaMatchBundle(corrupted2)).toThrow(
      /not the canonical pass/,
    );
  });

  it("rejects a coherently-rebuilt false execution checksum through primary checksum binding", () => {
    if (!baseline) return;
    const fakeChecksum = "a".repeat(64);
    const corrupted = rebuildCoherently(baseline, {
      attestation: {
        primaryResultChecksum: fakeChecksum,
        repeatResultChecksum: fakeChecksum,
      },
    });
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /primary checksum does not bind to the persisted record reconstruction/,
    );
  });

  it("rejects a coherently-rebuilt active suspension status", () => {
    if (!baseline) return;
    const corrupted = rebuildCoherently(baseline, {
      manifest: {
        safety: { protectedSourcePreflightStatus: "pass", suspensionStatus: "active" },
      },
    });
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /clear suspension status/,
    );
  });

  it("rejects unknown fields on every beta-owned machine artifact through strict schemas", () => {
    if (!baseline) return;
    for (const artifact of [
      GRID_BETA_MATCH_SELECTION_ARTIFACT,
      GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT,
      GRID_BETA_MATCH_MANIFEST_FILE,
    ]) {
      const corrupted = { ...baseline };
      const parsed = JSON.parse(corrupted[artifact]!) as Record<string, unknown>;
      parsed.provider = "x";
      parsed.ranked = true;
      parsed.tournament = true;
      corrupted[artifact] = JSON.stringify(parsed, null, 2);
      redigestBetaBundle(corrupted);
      expect(() => validateGridBetaMatchBundle(corrupted), artifact).toThrow(
        /invalid selection|invalid attestation|invalid manifest/,
      );
    }
    // Unknown field on a fighter artifact fails authoritative fighter validation.
    const corrupted = { ...baseline };
    const fighterA = JSON.parse(corrupted[GRID_BETA_MATCH_FIGHTER_A_ARTIFACT]!) as Record<
      string,
      unknown
    >;
    fighterA.provider = "x";
    corrupted[GRID_BETA_MATCH_FIGHTER_A_ARTIFACT] = JSON.stringify(fighterA, null, 2);
    redigestBetaBundle(corrupted);
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /fighter-a failed authoritative fighter validation/,
    );
  });

  it("rejects a coherently-rebuilt created-at disagreement between manifest and record", () => {
    if (!baseline) return;
    const corrupted = rebuildCoherently(baseline, {
      manifest: { createdAt: "2020-01-01T00:00:00.000Z" },
    });
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /manifest createdAt does not agree with the record createdAt/,
    );
  });

  it("rejects a noncanonical fighter artifact serialization through canonical byte serialization", () => {
    if (!baseline) return;
    const corrupted = { ...baseline };
    // Re-serialize the fighter artifact with reordered keys: identical parsed
    // content but not the canonical fighter serialization bytes.
    const fighterA = JSON.parse(corrupted[GRID_BETA_MATCH_FIGHTER_A_ARTIFACT]!) as Record<
      string,
      unknown
    >;
    const reordered = {
      policy: fighterA.policy,
      buildProposal: fighterA.buildProposal,
      displayName: fighterA.displayName,
      fighterId: fighterA.fighterId,
      sourceKind: fighterA.sourceKind,
      schemaVersion: fighterA.schemaVersion,
    };
    corrupted[GRID_BETA_MATCH_FIGHTER_A_ARTIFACT] = JSON.stringify(reordered, null, 2);
    redigestBetaBundle(corrupted);
    expect(() => validateGridBetaMatchBundle(corrupted)).toThrow(
      /not the canonical fighter serialization/,
    );
  });
});
