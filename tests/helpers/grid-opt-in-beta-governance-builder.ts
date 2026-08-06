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
  type GridOptInBetaSourceStateV1,
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
import { GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS } from "../../src/readiness/grid-opt-in-beta-source-facts.js";
import {
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT,
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_PATHS,
} from "../../src/readiness/grid-opt-in-beta-source-snapshot.js";
import {
  GitSourceCommitReader,
  type GridOptInBetaSourceCommitReader,
} from "../../src/readiness/grid-source-commit-reader.js";

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

interface ReviewedSourceBlob {
  sha: string;
  bytes: Uint8Array;
}

let cachedReviewedSourceData: Map<string, ReviewedSourceBlob> | null = null;

async function getReviewedSourceData(): Promise<Map<string, ReviewedSourceBlob>> {
  if (cachedReviewedSourceData !== null) return cachedReviewedSourceData;
  const real = new GitSourceCommitReader();
  const commit = GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT;
  const map = new Map<string, ReviewedSourceBlob>();
  for (const path of GRID_OPT_IN_BETA_REVIEWED_SOURCE_PATHS) {
    const sha = await real.readBlobSha(commit, path);
    const bytes = await real.readBlobBytes(commit, path);
    map.set(path, { sha, bytes });
  }
  cachedReviewedSourceData = map;
  return map;
}

/**
 * Builds an in-memory commit-object reader from the exact reviewed commit
 * bytes (read once through the real Git reader and cached). This keeps
 * service/corruption tests hermetic and fast after a single upfront read;
 * the served bytes are the exact committed bytes at `5173fd0f…`.
 *
 * `overrides` replace the committed bytes for selected reviewed paths with
 * arbitrary text while retaining the commit label (used by the coherent
 * corruption tests to simulate an altered reviewed source).
 */
export async function buildInMemoryReviewedSourceReader(
  overrides: Record<string, string> = {},
): Promise<GridOptInBetaSourceCommitReader> {
  const base = await getReviewedSourceData();
  const commit = GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT;
  const blobs = new Map<string, ReviewedSourceBlob>();
  for (const path of GRID_OPT_IN_BETA_REVIEWED_SOURCE_PATHS) {
    const entry = base.get(path)!;
    const override = overrides[path];
    blobs.set(
      path,
      override === undefined
        ? entry
        : { sha: entry.sha, bytes: new TextEncoder().encode(override) },
    );
  }
  return {
    commitAvailable: async (c) => c === commit,
    blobAvailable: async (c, p) => c === commit && blobs.has(p),
    readBlobSha: async (c, p) => {
      if (c !== commit) throw new Error(`wrong commit ${c}`);
      const entry = blobs.get(p);
      if (!entry) throw new Error(`missing blob ${p}`);
      return entry.sha;
    },
    readBlobBytes: async (c, p) => {
      if (c !== commit) throw new Error(`wrong commit ${c}`);
      const entry = blobs.get(p);
      if (!entry) throw new Error(`missing blob ${p}`);
      return entry.bytes;
    },
  };
}

/** A reader whose commit object is reported unavailable (missing/shallow). */
export function buildUnavailableCommitReader(): GridOptInBetaSourceCommitReader {
  return {
    commitAvailable: async () => false,
    blobAvailable: async () => false,
    readBlobSha: async (_c, p) => {
      throw new Error(`blob ${p} unavailable`);
    },
    readBlobBytes: async (_c, p) => {
      throw new Error(`blob ${p} unavailable`);
    },
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
    facts: GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS,
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

export interface RawGovernanceManifestParams {
  decisionId: string;
  createdAt: string;
  sourceCommit: string;
  outcome: string;
  contractChecksum: string;
  decisionChecksum: string;
  reportChecksum: string;
  digests: Record<string, string>;
}

/**
 * Builds a governance manifest JSON directly (bypassing the authoritative
 * schema) so corruption tests can coherently rebuild a bundle whose source
 * commit is not the authorised commit.
 */
export function buildRawGovernanceManifest(params: RawGovernanceManifestParams): string {
  return JSON.stringify(
    {
      schemaVersion: "1",
      decisionKind: "grid-opt-in-beta-governance",
      decisionId: params.decisionId,
      createdAt: params.createdAt,
      sourceCommit: params.sourceCommit,
      repositoryName: "hourwise/AI-Agent-Robot-Battle-Wars",
      outcome: params.outcome,
      validationStatus: "validated",
      contractId: "grid-opt-in-beta-contract-v1",
      contractChecksum: params.contractChecksum,
      decisionChecksum: params.decisionChecksum,
      reportChecksum: params.reportChecksum,
      artifacts: {
        manifest: "manifest.json",
        sourceState: "source-state.json",
        baseEvidenceReference: "base-evidence-reference.json",
        supplementEvidenceReference: "supplement-evidence-reference.json",
        betaContract: "beta-contract.json",
        decision: "decision.json",
        report: "report.txt",
      },
      digests: params.digests,
      evidenceUnchanged: true,
    },
    null,
    2,
  );
}

/**
 * Coherently rebuilds a complete seven-file governance bundle from an
 * arbitrary source-state and an arbitrary source commit: governance inputs
 * are re-derived, the decision is rebuilt from the reconstruction, the
 * outcome is re-derived, the report is regenerated, and every digest plus the
 * manifest are recomputed so the result is fully self-consistent. Used by the
 * coherent corruption tests (Phase 3F.1 Phase 8) so rejection must come from
 * provenance rules, never from a stale digest.
 */
export function buildCoherentGovernanceBundleFromSourceState(
  sourceState: GridOptInBetaSourceStateV1,
  sourceCommit: string = GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT,
): Record<string, string> {
  const { baseContents, supplementContents } = readOfficialGovernanceEvidence();
  const baseReference = buildGridOptInBetaBaseV3EvidenceReference(baseContents);
  const supplementReference =
    buildGridOptInBetaSupplementEvidenceReference(supplementContents);
  const evidence: GridOptInBetaGovernanceEvidence = {
    baseV3: baseReference,
    supplement: supplementReference,
    validationStatus: "validated",
  };
  const derivation = reconstructGovernanceDerivation(
    baseReference,
    supplementReference,
    sourceState,
    GRID_OPT_IN_BETA_CONTRACT,
  );
  const decision = buildGridOptInBetaGovernanceDecision({
    decisionId: GOVERNANCE_TEST_DECISION_ID,
    createdAt: GOVERNANCE_TEST_CREATED_AT,
    sourceCommit,
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
  const decisionChecksum = gridOptInBetaGovernanceDecisionChecksum(decision);
  const manifestJson =
    sourceCommit === GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT
      ? serializeGridOptInBetaGovernanceManifest(
          buildGridOptInBetaGovernanceManifest({
            decisionId: decision.decisionId,
            createdAt: decision.createdAt,
            sourceCommit:
              decision.sourceCommit as typeof GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT,
            outcome: decision.outcome,
            contractId: GRID_OPT_IN_BETA_CONTRACT_ID,
            contractChecksum: GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
            decisionChecksum,
            reportChecksum: digests[GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT]!,
            digests,
          }),
        )
      : buildRawGovernanceManifest({
          decisionId: decision.decisionId,
          createdAt: decision.createdAt,
          sourceCommit,
          outcome: decision.outcome,
          contractChecksum: GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
          decisionChecksum,
          reportChecksum: digests[GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT]!,
          digests,
        });
  return {
    [GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE]: manifestJson,
    [GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT]: serializedSourceState,
    [GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT]:
      serializedBaseReference,
    [GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT]:
      serializedSupplementReference,
    [GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT]: serializedContract,
    [GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT]: serializedDecision,
    [GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT]: report,
  };
}
