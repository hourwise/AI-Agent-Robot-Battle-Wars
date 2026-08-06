import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import { GRID_READINESS_BUNDLE_ENTRIES } from "../../src/readiness/readiness-bundle.js";
import { GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES } from "../../src/readiness/grid-grapple-supplement-bundle.js";
import {
  GRID_OPT_IN_BETA_GOVERNANCE_BASE_V3_DIR,
  GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_DIR,
} from "../../src/app/grid-opt-in-beta-governance.js";
import {
  buildGridOptInBetaBaseV3EvidenceReference,
  buildGridOptInBetaGovernanceManifest,
  buildGridOptInBetaSourceState,
  buildGridOptInBetaSupplementEvidenceReference,
  reconstructGovernanceDerivation,
  serializeGridOptInBetaEvidenceReference,
  serializeGridOptInBetaGovernanceManifest,
  serializeGridOptInBetaSourceState,
  GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE,
  GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT,
} from "../../src/readiness/grid-opt-in-beta-governance-bundle.js";
import {
  buildGridOptInBetaGovernanceDecision,
  gridOptInBetaGovernanceDecisionChecksum,
  serializeGridOptInBetaGovernanceDecision,
  GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT,
  type GridOptInBetaGovernanceEvidence,
} from "../../src/readiness/grid-opt-in-beta-governance.js";
import {
  GRID_OPT_IN_BETA_CONTRACT,
  GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
  GRID_OPT_IN_BETA_CONTRACT_ID,
  serializeGridOptInBetaContract,
} from "../../src/readiness/grid-opt-in-beta-contract.js";
import { buildGridOptInBetaGovernanceReport } from "../../src/readiness/grid-opt-in-beta-report.js";

export const GOVERNANCE_TEST_DECISION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const GOVERNANCE_TEST_CREATED_AT = "2026-08-03T00:00:00.000Z";

export const OFFICIAL_BASE_EVIDENCE_DIR = GRID_OPT_IN_BETA_GOVERNANCE_BASE_V3_DIR;
export const OFFICIAL_SUPPLEMENT_EVIDENCE_DIR =
  GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_DIR;

export function officialGovernanceEvidenceAvailable(): boolean {
  return (
    existsSync(OFFICIAL_BASE_EVIDENCE_DIR) && existsSync(OFFICIAL_SUPPLEMENT_EVIDENCE_DIR)
  );
}

export function readOfficialGovernanceEvidence(): {
  baseContents: Record<string, string>;
  supplementContents: Record<string, string>;
} {
  const baseContents: Record<string, string> = {};
  for (const name of GRID_READINESS_BUNDLE_ENTRIES) {
    baseContents[name] = readFileSync(join(OFFICIAL_BASE_EVIDENCE_DIR, name), "utf-8");
  }
  const supplementContents: Record<string, string> = {};
  for (const name of GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES) {
    supplementContents[name] = readFileSync(
      join(OFFICIAL_SUPPLEMENT_EVIDENCE_DIR, name),
      "utf-8",
    );
  }
  return { baseContents, supplementContents };
}

/**
 * Copies the official evidence byte-for-byte into fresh temporary directories
 * (tests never write to the official evidence directories).
 */
export async function copyOfficialEvidenceToTemp(): Promise<{
  baseDir: string;
  supplementDir: string;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), "gov-evidence-"));
  const baseDir = join(root, "base");
  const supplementDir = join(root, "supplement");
  await mkdir(baseDir);
  await mkdir(supplementDir);
  const { baseContents, supplementContents } = readOfficialGovernanceEvidence();
  for (const name of GRID_READINESS_BUNDLE_ENTRIES) {
    await writeFile(join(baseDir, name), baseContents[name]!, "utf-8");
  }
  for (const name of GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES) {
    await writeFile(join(supplementDir, name), supplementContents[name]!, "utf-8");
  }
  return {
    baseDir,
    supplementDir,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

export interface GovernanceFixture {
  contents: Record<string, string>;
  decisionId: string;
  createdAt: string;
  sourceCommit: string;
  contractChecksum: string;
  evidence: GridOptInBetaGovernanceEvidence;
  manifest: ReturnType<typeof buildGridOptInBetaGovernanceManifest>;
}

/**
 * Builds a fully consistent in-memory governance bundle from the official
 * evidence bytes (read-only) — identical to the service pipeline without
 * filesystem publication. Used by coherent corruption tests.
 */
export function buildGovernanceFixture(): GovernanceFixture {
  const { baseContents, supplementContents } = readOfficialGovernanceEvidence();
  const baseReference = buildGridOptInBetaBaseV3EvidenceReference(baseContents);
  const supplementReference =
    buildGridOptInBetaSupplementEvidenceReference(supplementContents);
  const evidence: GridOptInBetaGovernanceEvidence = {
    baseV3: baseReference,
    supplement: supplementReference,
    validationStatus: "validated",
  };
  const sourceState = buildGridOptInBetaSourceState({
    sourceCommit: GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT,
    policyContractId: GRID_OPT_IN_BETA_CONTRACT_ID,
    policyContractChecksum: GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
  });
  const derivation = reconstructGovernanceDerivation(
    baseReference,
    supplementReference,
    sourceState,
    GRID_OPT_IN_BETA_CONTRACT,
  );
  const decision = buildGridOptInBetaGovernanceDecision({
    decisionId: GOVERNANCE_TEST_DECISION_ID,
    createdAt: GOVERNANCE_TEST_CREATED_AT,
    sourceCommit: GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT,
    evidence,
    derivation,
  });
  const report = buildGridOptInBetaGovernanceReport({
    decisionId: decision.decisionId,
    createdAt: decision.createdAt,
    sourceCommit: decision.sourceCommit,
    baseV3: decision.evidence.baseV3,
    supplement: decision.evidence.supplement,
    contractId: GRID_OPT_IN_BETA_CONTRACT_ID,
    contractChecksum: GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
    criteria: decision.criteria,
    outcome: decision.outcome,
    authorisedScope: decision.authorisedScope,
    forbiddenScope: decision.forbiddenScope,
    requiredSafeguards: decision.requiredSafeguards,
    rollbackAndSuspensionTriggers: decision.rollbackAndSuspensionTriggers,
    unresolvedRisks: decision.unresolvedRisks,
    disclaimer: decision.disclaimer,
  });
  const serializedSourceState = serializeGridOptInBetaSourceState(sourceState);
  const serializedBaseReference = serializeGridOptInBetaEvidenceReference(baseReference);
  const serializedSupplementReference =
    serializeGridOptInBetaEvidenceReference(supplementReference);
  const serializedContract = serializeGridOptInBetaContract(GRID_OPT_IN_BETA_CONTRACT);
  const serializedDecision = serializeGridOptInBetaGovernanceDecision(decision);
  const digests: Record<string, string> = {
    [GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT]: sha256Hex(serializedSourceState),
    [GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT]: sha256Hex(
      serializedBaseReference,
    ),
    [GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT]: sha256Hex(
      serializedSupplementReference,
    ),
    [GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT]: sha256Hex(serializedContract),
    [GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT]: sha256Hex(serializedDecision),
    [GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT]: sha256Hex(report),
  };
  const manifest = buildGridOptInBetaGovernanceManifest({
    decisionId: decision.decisionId,
    createdAt: decision.createdAt,
    sourceCommit: decision.sourceCommit,
    outcome: decision.outcome,
    contractId: GRID_OPT_IN_BETA_CONTRACT_ID,
    contractChecksum: GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
    decisionChecksum: gridOptInBetaGovernanceDecisionChecksum(decision),
    reportChecksum: digests[GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT]!,
    digests,
  });
  const contents: Record<string, string> = {
    [GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE]:
      serializeGridOptInBetaGovernanceManifest(manifest),
    [GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT]: serializedSourceState,
    [GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT]:
      serializedBaseReference,
    [GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT]:
      serializedSupplementReference,
    [GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT]: serializedContract,
    [GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT]: serializedDecision,
    [GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT]: report,
  };
  return {
    contents,
    decisionId: decision.decisionId,
    createdAt: decision.createdAt,
    sourceCommit: decision.sourceCommit,
    contractChecksum: GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
    evidence,
    manifest,
  };
}
