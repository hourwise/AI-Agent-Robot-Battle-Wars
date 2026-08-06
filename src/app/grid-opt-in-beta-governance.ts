import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  assertCanaryOutputRootIsolation,
  assertCanaryPhysicalRoot,
} from "../canary/canary-output-root.js";
import {
  defaultCanaryFs,
  fsEntryKind,
  publishImmutableBundle,
  type CanaryFileSystem,
} from "../canary/immutable-canary-bundle.js";
import { sha256Hex } from "../canary/grid-canary-digest.js";
import {
  GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
  GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_ID,
  GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES,
} from "../readiness/grid-grapple-supplement-bundle.js";
import { GRID_READINESS_BUNDLE_ENTRIES } from "../readiness/readiness-bundle.js";
import {
  buildGridOptInBetaBaseV3EvidenceReference,
  buildGridOptInBetaGovernanceManifest,
  buildGridOptInBetaSourceState,
  buildGridOptInBetaSupplementEvidenceReference,
  deserializeGridOptInBetaGovernanceManifest,
  reconstructGovernanceDerivation,
  serializeGridOptInBetaEvidenceReference,
  serializeGridOptInBetaGovernanceManifest,
  serializeGridOptInBetaSourceState,
  validateGridOptInBetaGovernanceBundle,
  GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES,
  GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE,
  GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT,
} from "../readiness/grid-opt-in-beta-governance-bundle.js";
import {
  buildGridOptInBetaGovernanceDecision,
  gridOptInBetaGovernanceDecisionChecksum,
  serializeGridOptInBetaGovernanceDecision,
  GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT,
  type GridOptInBetaBaseV3EvidenceReference,
  type GridOptInBetaGovernanceCriteria,
  type GridOptInBetaGovernanceDecisionV1,
  type GridOptInBetaGovernanceEvidence,
  type GridOptInBetaGovernanceOutcome,
  type GridOptInBetaSupplementEvidenceReference,
} from "../readiness/grid-opt-in-beta-governance.js";
import {
  GRID_OPT_IN_BETA_CONTRACT,
  GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
  GRID_OPT_IN_BETA_CONTRACT_ID,
  serializeGridOptInBetaContract,
} from "../readiness/grid-opt-in-beta-contract.js";
import { buildGridOptInBetaGovernanceReport } from "../readiness/grid-opt-in-beta-report.js";
import type { GridOptInBetaGovernanceManifestV1 } from "../readiness/grid-opt-in-beta-governance-bundle.js";
import type { GridOptInBetaSourceStateV1 } from "../readiness/grid-opt-in-beta-governance-bundle.js";
import {
  buildGridOptInBetaReviewedSourceSnapshot,
  anchorGridOptInBetaReviewedSourceSnapshot,
  type GridOptInBetaReviewedSourceSnapshotV1,
} from "../readiness/grid-opt-in-beta-source-snapshot.js";
import {
  assertGridOptInBetaReviewedSourceFactsCanonical,
  deriveGridOptInBetaReviewedSourceFacts,
  type GridOptInBetaReviewedSourceFactsV1,
} from "../readiness/grid-opt-in-beta-source-facts.js";
import {
  GitSourceCommitReader,
  type GridOptInBetaSourceCommitReader,
} from "../readiness/grid-source-commit-reader.js";

/**
 * Grid opt-in beta governance application service (Milestone 0.2C Phase 3F).
 *
 * A bounded, evidence-based, non-activating governance decision. It reads the
 * official v3 readiness evaluation and the official supplemental grapple
 * evidence, validates and anchors both with the production validators and
 * anchors (never modifying them), runs the read-only static isolation
 * preflight, derives the governance outcome by the pure criteria function,
 * and publishes an immutable seven-file governance bundle under
 * `data/readiness/grid-governance/<decisionId>/`.
 *
 * The service never simulates a match, never reruns either evaluation, never
 * runs a benchmark or opens a seed bank, never calls a provider, never enables
 * the grid runtime, never changes defaults and never begins Milestone 0.2D.
 */

export const GRID_OPT_IN_BETA_GOVERNANCE_DEFAULT_ROOT = join(
  process.cwd(),
  "data",
  "readiness",
  "grid-governance",
);

export const GRID_OPT_IN_BETA_GOVERNANCE_BASE_V3_DIR = join(
  process.cwd(),
  "data",
  "readiness",
  "grid",
  GRID_GRAPPLE_COVERAGE_BASE_V3_EVALUATION_ID,
);

export const GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_DIR = join(
  process.cwd(),
  "data",
  "readiness",
  "grid-supplements",
  GRID_GRAPPLE_COVERAGE_OFFICIAL_SUPPLEMENT_ID,
);

export interface GridOptInBetaGovernanceRequest {
  outputRoot: string;
  /** Official v3 base bundle directory (defaults to the canonical path). */
  baseV3Root?: string;
  /** Official supplement bundle directory (defaults to the canonical path). */
  supplementRoot?: string;
}

export interface GridOptInBetaGovernanceDependencies {
  createUuid?: () => string;
  now?: () => Date;
  fs?: CanaryFileSystem;
  /** Git commit-object reader used to bind the reviewed source snapshot. */
  sourceCommitReader?: GridOptInBetaSourceCommitReader;
}

export interface GridOptInBetaGovernanceResult {
  decisionId: string;
  sourceCommit: string;
  outcome: GridOptInBetaGovernanceOutcome;
  baseV3: GridOptInBetaBaseV3EvidenceReference;
  supplement: GridOptInBetaSupplementEvidenceReference;
  contractId: string;
  contractChecksum: string;
  criteria: GridOptInBetaGovernanceCriteria;
  evidenceValidationStatus: "validated";
  sourceState: GridOptInBetaSourceStateV1;
  decision: GridOptInBetaGovernanceDecisionV1;
  artifactDirectory: string;
  artifacts: Array<{ name: string; path: string }>;
  manifest: GridOptInBetaGovernanceManifestV1;
  reviewedSourceSnapshot: GridOptInBetaReviewedSourceSnapshotV1;
  reviewedSourceFacts: GridOptInBetaReviewedSourceFactsV1;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

async function readAllEntries(
  root: string,
  entries: readonly string[],
  fs: CanaryFileSystem,
  label: string,
): Promise<Record<string, string>> {
  const contents: Record<string, string> = {};
  for (const name of entries) {
    let text: string;
    try {
      text = await fs.readFile(join(root, name), "utf-8");
    } catch (e) {
      throw new Error(
        `${label} is absent or unreadable at ${join(root, name)}: ${
          e instanceof Error ? e.message : String(e)
        }`,
        { cause: e },
      );
    }
    contents[name] = text;
  }
  return contents;
}

async function assertEvidenceUnchangedSinceStart(
  baseRoot: string,
  supplementRoot: string,
  fs: CanaryFileSystem,
  retainedBase: Record<string, string>,
  retainedSupplement: Record<string, string>,
): Promise<void> {
  const currentBase = await readAllEntries(
    baseRoot,
    GRID_READINESS_BUNDLE_ENTRIES,
    fs,
    "Official v3 base bundle",
  );
  const currentSupplement = await readAllEntries(
    supplementRoot,
    GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES,
    fs,
    "Official supplement bundle",
  );
  for (const name of GRID_READINESS_BUNDLE_ENTRIES) {
    if (currentBase[name] !== retainedBase[name]) {
      throw new Error(
        `Official v3 base artifact changed during governance execution: ${name}`,
      );
    }
  }
  for (const name of GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES) {
    if (currentSupplement[name] !== retainedSupplement[name]) {
      throw new Error(
        `Official supplement artifact changed during governance execution: ${name}`,
      );
    }
  }
}

export async function runGridOptInBetaGovernanceDecision(
  request: GridOptInBetaGovernanceRequest,
  dependencies: GridOptInBetaGovernanceDependencies = {},
): Promise<GridOptInBetaGovernanceResult> {
  const createUuid = dependencies.createUuid ?? randomUUID;
  const now = dependencies.now ?? (() => new Date());
  const fs = dependencies.fs ?? defaultCanaryFs;
  const baseV3Root = request.baseV3Root ?? GRID_OPT_IN_BETA_GOVERNANCE_BASE_V3_DIR;
  const supplementRoot =
    request.supplementRoot ?? GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_DIR;

  // 1. Exact lexical root guard (grid-readiness-governance kind).
  assertCanaryOutputRootIsolation(request.outputRoot, "grid-readiness-governance");

  // 2. Read, validate and anchor the official v3 base evidence (never
  //    modified). Retain the exact bytes for the pre-publication re-check.
  const retainedBase = await readAllEntries(
    baseV3Root,
    GRID_READINESS_BUNDLE_ENTRIES,
    fs,
    "Official v3 base bundle",
  );
  const baseReference = buildGridOptInBetaBaseV3EvidenceReference(retainedBase);

  // 3. Read, validate and anchor the official supplemental evidence (never
  //    modified). Retain the exact bytes for the pre-publication re-check.
  const retainedSupplement = await readAllEntries(
    supplementRoot,
    GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES,
    fs,
    "Official supplement bundle",
  );
  const supplementReference =
    buildGridOptInBetaSupplementEvidenceReference(retainedSupplement);

  // 4. Generate the decision ID and timestamp.
  const decisionId = createUuid();
  if (!isUuid(decisionId)) {
    throw new Error(
      `Grid opt-in beta governance decision ID must be a valid UUID; received ${String(decisionId)}`,
    );
  }
  const createdAt = now().toISOString();

  // 5. Publication-path collision preflight.
  const preflightFinal = await fsEntryKind(fs, join(request.outputRoot, decisionId));
  if (preflightFinal !== null) {
    throw new Error(
      `Grid opt-in beta governance final path already exists (${preflightFinal}) and must not be modified or removed: ${join(request.outputRoot, decisionId)}`,
    );
  }
  const preflightTmp = await fsEntryKind(
    fs,
    join(request.outputRoot, `.tmp-${decisionId}`),
  );
  if (preflightTmp !== null) {
    throw new Error(
      `Grid opt-in beta governance temporary path already exists (${preflightTmp}) and must not be reused or removed: ${join(request.outputRoot, `.tmp-${decisionId}`)}`,
    );
  }

  // 6. Physical-root guard before any artifact write.
  await assertCanaryPhysicalRoot(request.outputRoot, "grid-readiness-governance", fs);

  // 7. Build the reviewed source snapshot from the exact Git commit object
  //    (Phase 3F.1). This fails before publication if the commit or any
  //    reviewed blob is unavailable, and never reads the working tree.
  const sourceCommitReader =
    dependencies.sourceCommitReader ?? new GitSourceCommitReader();
  const reviewedSource =
    await buildGridOptInBetaReviewedSourceSnapshot(sourceCommitReader);
  anchorGridOptInBetaReviewedSourceSnapshot(reviewedSource.snapshot);
  const reviewedSourceFacts = deriveGridOptInBetaReviewedSourceFacts(
    reviewedSource.snapshot,
    reviewedSource.contents,
  );
  assertGridOptInBetaReviewedSourceFactsCanonical(reviewedSourceFacts);

  // 8. Build the source state from the exact reviewed source facts (never
  //    the working tree; canary isolation is source-bound, not hard-coded).
  const sourceState = buildGridOptInBetaSourceState({
    sourceCommit: GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT,
    policyContractId: GRID_OPT_IN_BETA_CONTRACT_ID,
    policyContractChecksum: GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
    facts: reviewedSourceFacts,
  });

  // 9. Derive the outcome through the pure criteria function.
  const derivation = reconstructGovernanceDerivation(
    baseReference,
    supplementReference,
    sourceState,
    GRID_OPT_IN_BETA_CONTRACT,
  );
  const evidence: GridOptInBetaGovernanceEvidence = {
    baseV3: baseReference,
    supplement: supplementReference,
    validationStatus: "validated",
  };
  const decision = buildGridOptInBetaGovernanceDecision({
    decisionId,
    createdAt,
    sourceCommit: GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT,
    evidence,
    derivation,
  });

  // 10. Render the human report.
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
  if (report.length === 0 || report.includes("\u0000")) {
    throw new Error("Grid opt-in beta governance report must be non-empty with no NUL");
  }

  // 11. Serialize the artifacts and compute all digests.
  const serializedSourceState = serializeGridOptInBetaSourceState(sourceState);
  const serializedBaseReference = serializeGridOptInBetaEvidenceReference(baseReference);
  const serializedSupplementReference =
    serializeGridOptInBetaEvidenceReference(supplementReference);
  const serializedContract = serializeGridOptInBetaContract(GRID_OPT_IN_BETA_CONTRACT);
  const serializedDecision = serializeGridOptInBetaGovernanceDecision(decision);
  const serializedReport = report;

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
    [GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT]: sha256Hex(serializedReport),
  };

  // 12. Pre-publication evidence immutability re-check: all nineteen evidence
  //     files must be byte-for-byte unchanged since the start.
  await assertEvidenceUnchangedSinceStart(
    baseV3Root,
    supplementRoot,
    fs,
    retainedBase,
    retainedSupplement,
  );

  // 13. Build the manifest (written last).
  const manifest = buildGridOptInBetaGovernanceManifest({
    decisionId,
    createdAt,
    sourceCommit: GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT,
    outcome: decision.outcome,
    contractId: GRID_OPT_IN_BETA_CONTRACT_ID,
    contractChecksum: GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
    decisionChecksum: gridOptInBetaGovernanceDecisionChecksum(decision),
    reportChecksum: digests[GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT]!,
    digests,
  });
  const serializedManifest = serializeGridOptInBetaGovernanceManifest(manifest);

  // 14. Pre-publish in-memory full-bundle validation.
  const inMemoryContents: Record<string, string> = {
    [GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE]: serializedManifest,
    [GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT]: serializedSourceState,
    [GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT]:
      serializedBaseReference,
    [GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT]:
      serializedSupplementReference,
    [GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT]: serializedContract,
    [GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT]: serializedDecision,
    [GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT]: serializedReport,
  };
  validateGridOptInBetaGovernanceBundle(inMemoryContents);

  // 15. Publish with the shared immutable publisher.
  const artifactDirectory = await publishImmutableBundle({
    fs,
    outputRoot: request.outputRoot,
    canaryId: decisionId,
    manifestFileName: GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE,
    entryNames: GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES,
    artifacts: [
      {
        name: GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT,
        content: serializedSourceState,
      },
      {
        name: GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT,
        content: serializedBaseReference,
      },
      {
        name: GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT,
        content: serializedSupplementReference,
      },
      {
        name: GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT,
        content: serializedContract,
      },
      {
        name: GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT,
        content: serializedDecision,
      },
      {
        name: GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT,
        content: serializedReport,
      },
    ],
    serializedManifest,
    verify: async ({ contents }) => {
      validateGridOptInBetaGovernanceBundle(contents);
    },
    afterRootCreated: async () => {
      await assertCanaryPhysicalRoot(request.outputRoot, "grid-readiness-governance", fs);
    },
  });

  // 16. Read back and cross-validate the final bundle explicitly.
  const readBack: Record<string, string> = {};
  for (const name of GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES) {
    readBack[name] = await fs.readFile(join(artifactDirectory, name), "utf-8");
  }
  validateGridOptInBetaGovernanceBundle(readBack);
  const manifestReadBack = deserializeGridOptInBetaGovernanceManifest(
    readBack[GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE]!,
  );
  if (!manifestReadBack.ok) {
    throw new Error(
      `Grid opt-in beta governance manifest read-back failed: ${manifestReadBack.errors}`,
    );
  }

  return {
    decisionId,
    sourceCommit: GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT,
    outcome: decision.outcome,
    baseV3: baseReference,
    supplement: supplementReference,
    contractId: GRID_OPT_IN_BETA_CONTRACT_ID,
    contractChecksum: GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
    criteria: decision.criteria,
    evidenceValidationStatus: "validated",
    sourceState,
    decision,
    artifactDirectory,
    artifacts: GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES.map((name) => ({
      name,
      path: join(artifactDirectory, name),
    })),
    manifest: manifestReadBack.manifest,
    reviewedSourceSnapshot: reviewedSource.snapshot,
    reviewedSourceFacts,
  };
}
