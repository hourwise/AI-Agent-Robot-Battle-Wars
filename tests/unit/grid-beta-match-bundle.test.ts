import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BETA_TEST_MATCH_ID,
  createBetaTempEnvironment,
  officialGovernanceBundleAvailable,
  readBetaBundle,
  redigestBetaBundle,
  runBetaMatchToTemp,
} from "../helpers/grid-beta-builder.js";
import {
  GRID_BETA_MATCH_ASCII_REPLAY_ARTIFACT,
  GRID_BETA_MATCH_BUNDLE_ENTRIES,
  GRID_BETA_MATCH_EXECUTION_ATTESTATION_ARTIFACT,
  GRID_BETA_MATCH_FACTUAL_REPORT_ARTIFACT,
  GRID_BETA_MATCH_FIGHTER_A_ARTIFACT,
  GRID_BETA_MATCH_MANIFEST_FILE,
  GRID_BETA_MATCH_RECORD_ARTIFACT,
  GRID_BETA_MATCH_SELECTION_ARTIFACT,
  GRID_BETA_MATCH_TEXT_REPLAY_ARTIFACT,
  validateGridBetaMatchBundle,
} from "../../src/beta/grid-beta-match-bundle.js";

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
      buildProposal: Record<string, unknown>;
    };
    // Another catalogue-valid build with the same fighterId: only the machine
    // name changes, so the spec checksum changes.
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
      /record config\/initial state does not match the fighter artifacts/,
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
      /record initial-state builds do not match the record config builds/,
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
});
