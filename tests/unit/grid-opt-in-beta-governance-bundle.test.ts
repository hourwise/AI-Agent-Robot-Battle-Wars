import { describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import {
  buildGovernanceFixture,
  officialGovernanceEvidenceAvailable,
  GOVERNANCE_TEST_DECISION_ID,
} from "../helpers/grid-opt-in-beta-governance-builder.js";
import {
  validateGridOptInBetaGovernanceBundle,
  GridOptInBetaGovernanceBundleError,
  GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES,
  GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE,
  GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT,
} from "../../src/readiness/grid-opt-in-beta-governance-bundle.js";

function buildFixture() {
  return buildGovernanceFixture();
}

function redigestAll(corrupted: Record<string, string>): Record<string, string> {
  const manifest = JSON.parse(corrupted[GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE]!) as {
    digests: Record<string, string>;
    decisionChecksum: string;
    reportChecksum: string;
  };
  for (const name of GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES) {
    if (name === GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE) continue;
    manifest.digests[name] = sha256Hex(corrupted[name]!);
  }
  manifest.decisionChecksum =
    manifest.digests[GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT];
  manifest.reportChecksum = manifest.digests[GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT];
  corrupted[GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE] = JSON.stringify(
    manifest,
    null,
    2,
  );
  return corrupted;
}

describe("grid opt-in beta governance bundle (Phase 3F Phase 6)", () => {
  it("declares exactly the seven fixed artifact names", () => {
    expect(GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES).toEqual([
      "manifest.json",
      "source-state.json",
      "base-evidence-reference.json",
      "supplement-evidence-reference.json",
      "beta-contract.json",
      "decision.json",
      "report.txt",
    ]);
    expect(GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES.length).toBe(7);
  });

  it("validates a fully consistent governance bundle built from the official evidence", () => {
    if (!officialGovernanceEvidenceAvailable()) return;
    const fixture = buildFixture();
    const result = validateGridOptInBetaGovernanceBundle(fixture.contents);
    expect(result.decisionId).toBe(GOVERNANCE_TEST_DECISION_ID);
    expect(result.outcome).toBe("approved_for_bounded_opt_in_beta_implementation");
    expect(result.validationStatus).toBe("validated");
  });

  it("rejects a source-state bound to a different source commit even after redigesting", () => {
    if (!officialGovernanceEvidenceAvailable()) return;
    const fixture = buildFixture();
    const corrupted = { ...fixture.contents };
    const sourceState = JSON.parse(
      corrupted[GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT]!,
    ) as { sourceCommit: string };
    sourceState.sourceCommit = "9999999999999999999999999999999999999999";
    corrupted[GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT] = JSON.stringify(
      sourceState,
      null,
      2,
    );
    redigestAll(corrupted);
    expect(() => validateGridOptInBetaGovernanceBundle(corrupted)).toThrow(
      /source commit does not equal the authorised commit/,
    );
  });

  it("rejects a tampered base evidence reference even after a coherent rebuild", () => {
    if (!officialGovernanceEvidenceAvailable()) return;
    const fixture = buildFixture();
    const corrupted = { ...fixture.contents };
    const baseRef = JSON.parse(
      corrupted[GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT]!,
    ) as { nonPassGates: string[] };
    baseRef.nonPassGates = ["C02"];
    corrupted[GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT] =
      JSON.stringify(baseRef, null, 2);
    redigestAll(corrupted);
    expect(() => validateGridOptInBetaGovernanceBundle(corrupted)).toThrow(
      /base evidence reference does not match the frozen official v3 identity/,
    );
  });

  it("rejects a tampered supplement evidence reference even after redigesting", () => {
    if (!officialGovernanceEvidenceAvailable()) return;
    const fixture = buildFixture();
    const corrupted = { ...fixture.contents };
    const supplementRef = JSON.parse(
      corrupted[GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT]!,
    ) as { grappleCoverage: { fighterAAttackerRepositionCount: number } };
    supplementRef.grappleCoverage.fighterAAttackerRepositionCount = 0;
    corrupted[GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT] =
      JSON.stringify(supplementRef, null, 2);
    redigestAll(corrupted);
    expect(() => validateGridOptInBetaGovernanceBundle(corrupted)).toThrow(
      /supplement evidence reference does not match the frozen official supplement/,
    );
  });

  it("rejects a tampered beta contract even after redigesting", () => {
    if (!officialGovernanceEvidenceAvailable()) return;
    const fixture = buildFixture();
    const corrupted = { ...fixture.contents };
    const contract = JSON.parse(
      corrupted[GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT]!,
    ) as { explicitSelection: { gridEnteredOnlyThroughExplicitBetaSelection: boolean } };
    contract.explicitSelection.gridEnteredOnlyThroughExplicitBetaSelection = false;
    corrupted[GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT] = JSON.stringify(
      contract,
      null,
      2,
    );
    redigestAll(corrupted);
    expect(() => validateGridOptInBetaGovernanceBundle(corrupted)).toThrow(
      /policy contract checksum does not equal the frozen contract checksum/,
    );
  });

  it("rejects a decision payload change even when the manifest and digests are coherent", () => {
    if (!officialGovernanceEvidenceAvailable()) return;
    const fixture = buildFixture();
    const corrupted = { ...fixture.contents };
    const decision = JSON.parse(
      corrupted[GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT]!,
    ) as { criteria: { frozenConstraintsUnchanged: boolean } };
    decision.criteria.frozenConstraintsUnchanged = false;
    corrupted[GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT] = JSON.stringify(
      decision,
      null,
      2,
    );
    redigestAll(corrupted);
    expect(() => validateGridOptInBetaGovernanceBundle(corrupted)).toThrow(
      /persisted decision does not equal the complete reconstructed decision/,
    );
  });

  it("rejects a report.txt change even after redigesting", () => {
    if (!officialGovernanceEvidenceAvailable()) return;
    const fixture = buildFixture();
    const corrupted = { ...fixture.contents };
    corrupted[GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT] =
      `${corrupted[GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT]}\ntampered`;
    redigestAll(corrupted);
    expect(() => validateGridOptInBetaGovernanceBundle(corrupted)).toThrow(
      /report.txt does not byte-for-byte match the regenerated report/,
    );
  });

  it("rejects a manifest whose outcome disagrees with the decision", () => {
    if (!officialGovernanceEvidenceAvailable()) return;
    const fixture = buildFixture();
    const corrupted = { ...fixture.contents };
    const manifest = JSON.parse(
      corrupted[GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE]!,
    ) as {
      outcome: string;
    };
    manifest.outcome = "rejected";
    corrupted[GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE] = JSON.stringify(
      manifest,
      null,
      2,
    );
    expect(() => validateGridOptInBetaGovernanceBundle(corrupted)).toThrow(
      /manifest identity does not agree with the persisted decision/,
    );
  });

  it("rejects a missing artifact", () => {
    if (!officialGovernanceEvidenceAvailable()) return;
    const fixture = buildFixture();
    const corrupted = { ...fixture.contents };
    delete corrupted[GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT];
    expect(() => validateGridOptInBetaGovernanceBundle(corrupted)).toThrow(
      GridOptInBetaGovernanceBundleError,
    );
  });
});
