import { describe, expect, it } from "vitest";
import {
  GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS,
  deriveGridOptInBetaReviewedSourceFacts,
} from "../../src/readiness/grid-opt-in-beta-source-facts.js";
import { buildGridOptInBetaReviewedSourceSnapshot } from "../../src/readiness/grid-opt-in-beta-source-snapshot.js";
import {
  assertCanonicalGridOptInBetaGovernanceSourceState,
  canonicalCanaryIsolationFromFacts,
  canonicalGovernanceInputsFromFacts,
  canonicalStaticPreflightFromFacts,
  gridOptInBetaSourceStateProvenanceFailures,
  sourceStateFromFacts,
} from "../../src/readiness/grid-opt-in-beta-source-state-provenance.js";
import { GRID_OPT_IN_BETA_CONTRACT_CHECKSUM } from "../../src/readiness/grid-opt-in-beta-contract.js";
import { GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT } from "../../src/readiness/grid-opt-in-beta-governance.js";
import {
  validateGridOptInBetaGovernanceBundle,
  GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT,
} from "../../src/readiness/grid-opt-in-beta-governance-bundle.js";
import type { GridOptInBetaSourceStateV1 } from "../../src/readiness/grid-opt-in-beta-governance-bundle.js";
import {
  buildCoherentGovernanceBundleFromSourceState,
  buildInMemoryReviewedSourceReader,
  officialGovernanceEvidenceAvailable,
} from "../helpers/grid-opt-in-beta-governance-builder.js";

const ALTERED_CONSTANTS =
  'export const SIMULATOR_VERSION = "0.3.0" as const;\nexport const RULESET_VERSION = "0.2.0" as const;\n';

function cloneSourceState(state: GridOptInBetaSourceStateV1): GridOptInBetaSourceStateV1 {
  return JSON.parse(JSON.stringify(state)) as GridOptInBetaSourceStateV1;
}

describe("canonical grid opt in beta governance source state (Phase 3F.1 Phase 5)", () => {
  it("passes the official source-state shape unchanged", () => {
    const sourceState = sourceStateFromFacts(GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS);
    expect(sourceState.schemaVersion).toBe("1");
    expect(sourceState.repositoryName).toBe("hourwise/AI-Agent-Robot-Battle-Wars");
    expect(sourceState.sourceCommit).toBe(GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT);
    expect(sourceState.policyContractId).toBe("grid-opt-in-beta-contract-v1");
    expect(sourceState.policyContractChecksum).toBe(GRID_OPT_IN_BETA_CONTRACT_CHECKSUM);
    expect(() =>
      assertCanonicalGridOptInBetaGovernanceSourceState(sourceState),
    ).not.toThrow();
  });

  it("derives every canonical preflight, canary and governance input from the facts", () => {
    const preflight = canonicalStaticPreflightFromFacts(
      GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS,
    );
    for (const [key, value] of Object.entries(preflight)) {
      expect(value, `static preflight ${key}`).toBe(true);
    }
    const canary = canonicalCanaryIsolationFromFacts(
      GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS,
    );
    expect(canary).toEqual({ matchCanaryIsolated: true, seriesCanaryIsolated: true });
    const inputs = canonicalGovernanceInputsFromFacts(
      GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS,
      GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
    );
    expect(inputs).toEqual({
      legacyIsActiveDefault: true,
      schemaV3PersistenceAndReplayAvailable: true,
      deterministicRollbackPossible: true,
      frozenConstraintsUnchanged: true,
    });
  });

  it("requires repository name, source commit, identities, contract and exact shape", () => {
    const sourceState = sourceStateFromFacts(GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS);

    const wrongRepo = cloneSourceState(sourceState);
    wrongRepo.repositoryName = "evil/repository";
    expect(
      gridOptInBetaSourceStateProvenanceFailures(wrongRepo).some((f) =>
        f.includes("repositoryName"),
      ),
    ).toBe(true);

    const wrongCommit = cloneSourceState(sourceState);
    wrongCommit.sourceCommit = "9999999999999999999999999999999999999999";
    const commitFailures = gridOptInBetaSourceStateProvenanceFailures(wrongCommit);
    expect(commitFailures.some((f) => f.includes("sourceCommit"))).toBe(true);
    expect(() => assertCanonicalGridOptInBetaGovernanceSourceState(wrongCommit)).toThrow(
      /not the canonical reviewed source state/,
    );

    const wrongVersion = cloneSourceState(sourceState);
    wrongVersion.globalSimulatorVersion = "0.9.9";
    expect(
      gridOptInBetaSourceStateProvenanceFailures(wrongVersion).some((f) =>
        f.includes("globalSimulatorVersion"),
      ),
    ).toBe(true);

    const wrongContract = cloneSourceState(sourceState);
    wrongContract.policyContractChecksum = "0".repeat(64);
    expect(
      gridOptInBetaSourceStateProvenanceFailures(wrongContract).some((f) =>
        f.includes("policyContractChecksum"),
      ),
    ).toBe(true);

    const extraField = { ...sourceState, unexpected: true } as GridOptInBetaSourceStateV1;
    expect(
      gridOptInBetaSourceStateProvenanceFailures(extraField).some((f) =>
        f.includes("unexpected"),
      ),
    ).toBe(true);
  });

  it("rejects a coherent false->true preflight forgery for an altered source", async () => {
    if (!officialGovernanceEvidenceAvailable()) return;
    // The actual reviewed source is altered: global constants are 0.3.0.
    const reader = await buildInMemoryReviewedSourceReader({
      "src/simulator/constants.ts": ALTERED_CONSTANTS,
    });
    const built = await buildGridOptInBetaReviewedSourceSnapshot(reader);
    const alteredFacts = deriveGridOptInBetaReviewedSourceFacts(
      built.snapshot,
      built.contents,
    );

    // Honest source state for the altered source: globalConstantsStill020020 is
    // false and the governance inputs reflect that.
    const honest = sourceStateFromFacts(alteredFacts);
    expect(honest.legacyDefaultStaticPreflight.globalConstantsStill020020).toBe(false);
    expect(honest.governanceInputs.legacyIsActiveDefault).toBe(false);
    expect(honest.governanceInputs.frozenConstraintsUnchanged).toBe(false);

    // Forge: flip the preflight value false -> true and coherently rebuild every
    // governance input.
    const forged = cloneSourceState(honest);
    forged.legacyDefaultStaticPreflight.globalConstantsStill020020 = true;
    forged.governanceInputs.legacyIsActiveDefault = true;
    forged.governanceInputs.frozenConstraintsUnchanged = true;

    // The coherent bundle rebuild (decision, criteria, outcome, checksum,
    // report, manifest and every digest) is self-consistent.
    const coherent = buildCoherentGovernanceBundleFromSourceState(forged);
    expect(
      JSON.parse(coherent[GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_STATE_ARTIFACT]!)
        .legacyDefaultStaticPreflight.globalConstantsStill020020,
    ).toBe(true);

    // Reject because the persisted source state is not the canonical reviewed
    // source state for the actual source (global identity is still 0.3.0).
    expect(() =>
      assertCanonicalGridOptInBetaGovernanceSourceState(forged, alteredFacts),
    ).toThrow(/not the canonical reviewed source state/);

    // The generic validator also rejects: the forged source-state still carries
    // the non-canonical global identity derived from the altered source.
    expect(() => validateGridOptInBetaGovernanceBundle(coherent)).toThrow(
      /source-state\.globalSimulatorVersion/,
    );
  });

  it("rejects a coherent hard-coded canary isolation claim", async () => {
    if (!officialGovernanceEvidenceAvailable()) return;
    const sourceState = sourceStateFromFacts(GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS);
    const forged = cloneSourceState(sourceState);
    // Claim canary isolation that the reviewed source does not support.
    forged.canaryIsolationStatus = {
      matchCanaryIsolated: false,
      seriesCanaryIsolated: false,
    };
    forged.governanceInputs.legacyIsActiveDefault = false;
    const coherent = buildCoherentGovernanceBundleFromSourceState(forged);
    expect(() => validateGridOptInBetaGovernanceBundle(coherent)).toThrow(
      /source-state\.canaryIsolationStatus/,
    );
    expect(() => assertCanonicalGridOptInBetaGovernanceSourceState(forged)).toThrow(
      /canaryIsolationStatus/,
    );
  });

  it("rejects a coherent false commit label across source state, decision, manifest and report", async () => {
    if (!officialGovernanceEvidenceAvailable()) return;
    const sourceState = sourceStateFromFacts(GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS);
    const forged = cloneSourceState(sourceState);
    forged.sourceCommit = "9999999999999999999999999999999999999999";
    const coherent = buildCoherentGovernanceBundleFromSourceState(
      forged,
      forged.sourceCommit,
    );
    // The exact authorised source commit is required: the manifest cannot
    // deserialize against the frozen source-commit literal.
    expect(() => validateGridOptInBetaGovernanceBundle(coherent)).toThrow(
      /invalid manifest|source commit/,
    );
    // Provenance rule: the persisted source state is not the canonical
    // reviewed source state for the authorised commit.
    expect(() => assertCanonicalGridOptInBetaGovernanceSourceState(forged)).toThrow(
      /sourceCommit/,
    );
  });

  it("rejects an official-bundle source-state tamper through canonical provenance, not a stale digest", async () => {
    if (!officialGovernanceEvidenceAvailable()) return;
    const sourceState = sourceStateFromFacts(GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS);
    const tampered = cloneSourceState(sourceState);
    tampered.legacyDefaultStaticPreflight.bothCanaryChecksUnchanged = false;
    tampered.governanceInputs.frozenConstraintsUnchanged = false;
    // Coherent rebuild regenerates the decision, report, manifest and every
    // digest, so no stale digest can be the rejection reason.
    const coherent = buildCoherentGovernanceBundleFromSourceState(tampered);
    expect(() => validateGridOptInBetaGovernanceBundle(coherent)).toThrow(
      /source-state\.legacyDefaultStaticPreflight\.bothCanaryChecksUnchanged/,
    );
    expect(() => validateGridOptInBetaGovernanceBundle(coherent)).not.toThrow(
      /digests do not match/,
    );
  });
});
