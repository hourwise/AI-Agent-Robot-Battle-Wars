import { sha256Hex } from "../canary/grid-canary-digest.js";
import {
  GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
  GRID_OPT_IN_BETA_CONTRACT_ID,
} from "./grid-opt-in-beta-contract.js";
import {
  GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT,
  deserializeGridOptInBetaGovernanceDecision,
} from "./grid-opt-in-beta-governance.js";
import {
  GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES,
  GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE,
  GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT,
  GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT,
  deserializeGridOptInBetaContract,
  deserializeGridOptInBetaGovernanceManifest,
  deserializeGridOptInBetaSourceState,
  validateGridOptInBetaGovernanceBundle,
} from "./grid-opt-in-beta-governance-bundle.js";
import {
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT,
  anchorGridOptInBetaReviewedSourceSnapshot,
  buildGridOptInBetaReviewedSourceSnapshot,
  type GridOptInBetaReviewedSourceSnapshotV1,
} from "./grid-opt-in-beta-source-snapshot.js";
import {
  assertGridOptInBetaReviewedSourceFactsCanonical,
  deriveGridOptInBetaReviewedSourceFacts,
  type GridOptInBetaReviewedSourceFactsV1,
} from "./grid-opt-in-beta-source-facts.js";
import { assertCanonicalGridOptInBetaGovernanceSourceState } from "./grid-opt-in-beta-source-state-provenance.js";
import {
  GitSourceCommitReader,
  type GridOptInBetaSourceCommitReader,
} from "./grid-source-commit-reader.js";

/**
 * Official grid opt-in beta governance decision identity (Milestone 0.2C
 * Phase 3F.1, Phase 1).
 *
 * Freezes the official Phase 3F governance bundle identity: decision ID,
 * reviewed source commit, outcome, contract ID/checksum and the exact SHA-256
 * of all seven persisted artifacts. `anchorOfficialGridOptInBetaGovernanceDecision`
 * requires the unchanged official seven-file bundle (validated and matched to
 * the frozen hashes) together with successful validation of the reviewed Git
 * source snapshot at commit `5173fd0f…`. The official approval is
 * authoritative only when both are true — never inferred from the
 * `sourceCommit` string inside the bundle alone.
 *
 * This anchor prepares implementation-authorisation evidence. It does not
 * implement or enable the beta, change defaults or begin Milestone 0.2D.
 */

export const GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_DECISION_ID =
  "58e8cd87-504e-4b5f-9bac-f6b81d82377b" as const;

export const GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_OUTCOME =
  "approved_for_bounded_opt_in_beta_implementation" as const;

export interface GridOptInBetaOfficialGovernanceIdentityV1 {
  readonly decisionId: typeof GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_DECISION_ID;
  readonly reviewedSourceCommit: typeof GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT;
  readonly outcome: typeof GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_OUTCOME;
  readonly contractId: typeof GRID_OPT_IN_BETA_CONTRACT_ID;
  readonly contractChecksum: typeof GRID_OPT_IN_BETA_CONTRACT_CHECKSUM;
  readonly artifactHashes: {
    readonly [GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE]: string;
    readonly [GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT]: string;
    readonly [GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT]: string;
    readonly [GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT]: string;
    readonly [GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT]: string;
    readonly [GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT]: string;
    readonly [GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT]: string;
  };
}

/** Frozen official governance identity (hashes of the persisted official bundle). */
export const GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_IDENTITY: GridOptInBetaOfficialGovernanceIdentityV1 =
  Object.freeze({
    decisionId: GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_DECISION_ID,
    reviewedSourceCommit: GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT,
    outcome: GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_OUTCOME,
    contractId: GRID_OPT_IN_BETA_CONTRACT_ID,
    contractChecksum: GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
    artifactHashes: Object.freeze({
      [GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE]:
        "0f143dde27bbc8c3e963045a1235f9510693ea5de8f47abcb63ae72900907973",
      [GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT]:
        "5721585d4f07e9ce2d0b5dc70296a90fc7fbaaa650c6f95792de9e30db378173",
      [GRID_OPT_IN_BETA_GOVERNANCE_BASE_EVIDENCE_REFERENCE_ARTIFACT]:
        "972d99b96d1bbdb17b1469b185d578d878f30aac042ff02639ab2e3e02ca44b9",
      [GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_EVIDENCE_REFERENCE_ARTIFACT]:
        "0cc07da64780975442c84dec4d2246c7887995181e424b17384d62a1e64fff77",
      [GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT]:
        "5f345ce4e933a4cc1f9db7633c1e03d21e8b323d65d36eb7f52ef5251953fff6",
      [GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT]:
        "da377b33f7081cb7c8a4741ebe632c875a4cc3146ce28d8330cec9cb95d0410c",
      [GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT]:
        "63259937c0fd832aabe6de6432db1df611f70690d68108c01399401c3edc5710",
    }),
  });

export interface AnchorOfficialGridOptInBetaGovernanceDecisionInput {
  /** Pre-built reviewed source snapshot (otherwise read from the exact commit). */
  readonly snapshot?: GridOptInBetaReviewedSourceSnapshotV1;
  /** Pre-derived reviewed source facts (otherwise derived from the snapshot). */
  readonly facts?: GridOptInBetaReviewedSourceFactsV1;
  /** Git commit-object reader (defaults to the real repository reader). */
  readonly sourceCommitReader?: GridOptInBetaSourceCommitReader;
}

export class GridOptInBetaOfficialGovernanceAnchorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridOptInBetaOfficialGovernanceAnchorError";
  }
}

function requireArtifact(contents: Record<string, string>, name: string): string {
  const value = contents[name];
  if (typeof value !== "string") {
    throw new GridOptInBetaOfficialGovernanceAnchorError(
      `Official governance bundle is missing artifact ${name}`,
    );
  }
  return value;
}

/**
 * Anchors the official Phase 3F governance decision. Requires:
 * 1. the unchanged official seven-file bundle — generic cross-agreement
 *    validation, exact decision ID, exact reviewed source commit, exact
 *    outcome, exact contract identity and all seven frozen artifact hashes;
 * 2. successful validation of the reviewed Git source snapshot at commit
 *    `5173fd0f…` and its canonical source facts, and that the persisted
 *    source-state is exactly the canonical reviewed source state.
 *
 * Returns the frozen official governance identity on success; throws with a
 * precise reason otherwise.
 */
export async function anchorOfficialGridOptInBetaGovernanceDecision(
  contents: Record<string, string>,
  input: AnchorOfficialGridOptInBetaGovernanceDecisionInput = {},
): Promise<GridOptInBetaOfficialGovernanceIdentityV1> {
  // 1. Generic cross-agreement validation (includes the canonical source-state
  //    requirement via the frozen canonical facts).
  validateGridOptInBetaGovernanceBundle(contents);

  const manifestJson = requireArtifact(
    contents,
    GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE,
  );
  const sourceStateJson = requireArtifact(
    contents,
    GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT,
  );
  const decisionJson = requireArtifact(
    contents,
    GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ARTIFACT,
  );
  const contractJson = requireArtifact(
    contents,
    GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT,
  );

  const manifestParsed = deserializeGridOptInBetaGovernanceManifest(manifestJson);
  const sourceStateParsed = deserializeGridOptInBetaSourceState(sourceStateJson);
  const decisionParsed = deserializeGridOptInBetaGovernanceDecision(decisionJson);
  const contractParsed = deserializeGridOptInBetaContract(contractJson);
  if (!manifestParsed.ok) {
    throw new GridOptInBetaOfficialGovernanceAnchorError(
      `Official governance manifest is invalid: ${manifestParsed.errors}`,
    );
  }
  if (!sourceStateParsed.ok) {
    throw new GridOptInBetaOfficialGovernanceAnchorError(
      `Official governance source-state is invalid: ${sourceStateParsed.errors}`,
    );
  }
  if (!decisionParsed.ok) {
    throw new GridOptInBetaOfficialGovernanceAnchorError(
      `Official governance decision is invalid: ${decisionParsed.errors}`,
    );
  }
  if (!contractParsed.ok) {
    throw new GridOptInBetaOfficialGovernanceAnchorError(
      `Official governance contract is invalid: ${contractParsed.errors}`,
    );
  }

  const failures: string[] = [];
  const manifest = manifestParsed.manifest;
  const sourceState = sourceStateParsed.state;
  const decision = decisionParsed.decision;

  // 2. Exact official decision identity.
  if (manifest.decisionId !== GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_DECISION_ID) {
    failures.push(
      `official decision ID must be ${GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_DECISION_ID}; found ${manifest.decisionId}`,
    );
  }
  if (decision.decisionId !== GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_DECISION_ID) {
    failures.push(
      `official decision.decisionId must be ${GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_DECISION_ID}; found ${decision.decisionId}`,
    );
  }

  // 3. Exact reviewed source commit (never inferred from the string alone —
  //    the snapshot validation below binds it to the actual commit object).
  if (manifest.sourceCommit !== GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT) {
    failures.push(
      `official manifest source commit must be ${GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT}; found ${manifest.sourceCommit}`,
    );
  }
  if (sourceState.sourceCommit !== GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT) {
    failures.push(
      `official source-state source commit must be ${GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT}; found ${sourceState.sourceCommit}`,
    );
  }

  // 4. Exact official outcome.
  if (manifest.outcome !== GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_OUTCOME) {
    failures.push(
      `official outcome must be ${GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_OUTCOME}; found ${manifest.outcome}`,
    );
  }
  if (decision.outcome !== GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_OUTCOME) {
    failures.push(
      `official decision outcome must be ${GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_OUTCOME}; found ${decision.outcome}`,
    );
  }

  // 5. Exact contract identity.
  if (
    manifest.contractId !== GRID_OPT_IN_BETA_CONTRACT_ID ||
    sourceState.policyContractId !== GRID_OPT_IN_BETA_CONTRACT_ID ||
    contractParsed.contract.contractId !== GRID_OPT_IN_BETA_CONTRACT_ID
  ) {
    failures.push(`official contract ID must be ${GRID_OPT_IN_BETA_CONTRACT_ID}`);
  }
  if (
    manifest.contractChecksum !== GRID_OPT_IN_BETA_CONTRACT_CHECKSUM ||
    sourceState.policyContractChecksum !== GRID_OPT_IN_BETA_CONTRACT_CHECKSUM
  ) {
    failures.push(
      `official contract checksum must be ${GRID_OPT_IN_BETA_CONTRACT_CHECKSUM}`,
    );
  }

  // 6. All seven frozen artifact hashes (exact persisted bytes).
  for (const name of GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES) {
    const key = name as keyof GridOptInBetaOfficialGovernanceIdentityV1["artifactHashes"];
    const frozen = GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_IDENTITY.artifactHashes[key];
    const actual = sha256Hex(contents[name]!);
    if (actual !== frozen) {
      failures.push(
        `official governance artifact ${name} hash ${actual} does not match the frozen ${frozen}`,
      );
    }
  }

  // 7. Reviewed Git source snapshot at the exact commit + canonical source
  //    facts + canonical source-state (never inferred from the string alone).
  let snapshot = input.snapshot;
  let facts = input.facts;
  if (snapshot === undefined || facts === undefined) {
    const reader = input.sourceCommitReader ?? new GitSourceCommitReader();
    const built = await buildGridOptInBetaReviewedSourceSnapshot(reader);
    if (snapshot === undefined) snapshot = built.snapshot;
    if (facts === undefined) {
      facts = deriveGridOptInBetaReviewedSourceFacts(built.snapshot, built.contents);
    }
  }
  try {
    anchorGridOptInBetaReviewedSourceSnapshot(snapshot);
  } catch (e) {
    failures.push(e instanceof Error ? e.message : String(e));
  }
  try {
    assertGridOptInBetaReviewedSourceFactsCanonical(facts);
  } catch (e) {
    failures.push(e instanceof Error ? e.message : String(e));
  }
  try {
    assertCanonicalGridOptInBetaGovernanceSourceState(sourceState, facts);
  } catch (e) {
    failures.push(e instanceof Error ? e.message : String(e));
  }

  if (failures.length > 0) {
    throw new GridOptInBetaOfficialGovernanceAnchorError(
      `Official grid opt-in beta governance decision anchor failed: ${failures.join("; ")}`,
    );
  }

  return GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_IDENTITY;
}
