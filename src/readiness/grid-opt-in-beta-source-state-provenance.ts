import {
  GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
  GRID_OPT_IN_BETA_CONTRACT_ID,
} from "./grid-opt-in-beta-contract.js";
import {
  GRID_OPT_IN_BETA_GOVERNANCE_REPOSITORY_NAME,
  GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT,
} from "./grid-opt-in-beta-governance.js";
import {
  GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS,
  type GridOptInBetaReviewedSourceFactsV1,
} from "./grid-opt-in-beta-source-facts.js";
import type {
  GridOptInBetaCanaryIsolationStatus,
  GridOptInBetaGovernanceInputs,
  GridOptInBetaSourceStateV1,
  GridOptInBetaStaticPreflight,
} from "./grid-opt-in-beta-governance-bundle.js";

/**
 * Canonical grid opt-in beta governance source-state provenance (Milestone
 * 0.2C Phase 3F.1, Phase 5).
 *
 * `assertCanonicalGridOptInBetaGovernanceSourceState` requires a persisted
 * `source-state.json` to agree with the canonical source state derived from
 * the reviewed source facts: repository name, source commit, global
 * identities, contract ID and checksum, every static-preflight outcome,
 * every canary-isolation outcome, the governance inputs and the exact
 * expected shape.
 *
 * The canary source-isolation booleans are derived from the reviewed source
 * facts (which in turn are derived from the reviewed snapshot and its frozen
 * file hashes) — they are never hard-coded to `true` here.
 *
 * The two governance-module isolation fields are Phase 3F design properties
 * (the governance module did not exist at the reviewed commit); their
 * canonical values are frozen constants enforced by the governance-provenance
 * regression tests (no benchmark/provider/simulation imports).
 */

export const GRID_OPT_IN_BETA_CANONICAL_GOVERNANCE_MODULE_ISOLATION: Readonly<{
  noNormalCommandImportsOrInvokesGovernanceService: true;
  noBenchmarkOrProviderDependencyInGovernanceModule: true;
}> = Object.freeze({
  noNormalCommandImportsOrInvokesGovernanceService: true,
  noBenchmarkOrProviderDependencyInGovernanceModule: true,
});

export function canonicalStaticPreflightFromFacts(
  facts: GridOptInBetaReviewedSourceFactsV1,
): GridOptInBetaStaticPreflight {
  return {
    normalMatchPathsCallLegacyRunMatch:
      facts.normalMatchPathUsesLegacyRunMatch && facts.normalSeriesPathUsesLegacyRunMatch,
    gridOnlyEnteredThroughExplicitRunGridMatch:
      facts.gridExistsOnlyAsExplicitAlternateRunGridMatch,
    noNormalCommandImportsOrInvokesGovernanceService:
      GRID_OPT_IN_BETA_CANONICAL_GOVERNANCE_MODULE_ISOLATION.noNormalCommandImportsOrInvokesGovernanceService,
    globalConstantsStill020020:
      facts.globalSimulatorVersion === "0.2.0" && facts.globalRulesetVersion === "0.2.0",
    catalogueStill1: facts.catalogueVersion === "1",
    gridIdentityFrozenSeparately:
      facts.gridRuntimeIdentity.simulatorVersion === "0.3.0" &&
      facts.gridRuntimeIdentity.positioningModel === "grid-3x3-v1" &&
      facts.normalRuntimeIdentity.simulatorVersion === "0.2.0",
    schemaV3ConverterAndReplaySupportPresent:
      facts.schemaV3GridConverterPathPresent && facts.schemaV3ReplayDispatchPresent,
    schemaV2LegacyPersistenceUnchanged: facts.schemaV2LegacyConverterPathPresent,
    bothCanaryChecksUnchanged: facts.bothCanarySourcesMatchReviewedSnapshot,
    noBenchmarkOrProviderDependencyInGovernanceModule:
      GRID_OPT_IN_BETA_CANONICAL_GOVERNANCE_MODULE_ISOLATION.noBenchmarkOrProviderDependencyInGovernanceModule,
  };
}

export function canonicalCanaryIsolationFromFacts(
  facts: GridOptInBetaReviewedSourceFactsV1,
): GridOptInBetaCanaryIsolationStatus {
  return {
    matchCanaryIsolated: facts.matchCanaryIsolated,
    seriesCanaryIsolated: facts.seriesCanaryIsolated,
  };
}

export function canonicalGovernanceInputsFromFacts(
  facts: GridOptInBetaReviewedSourceFactsV1,
  contractChecksum: string,
): GridOptInBetaGovernanceInputs {
  const preflight = canonicalStaticPreflightFromFacts(facts);
  const canary = canonicalCanaryIsolationFromFacts(facts);
  return {
    legacyIsActiveDefault:
      preflight.normalMatchPathsCallLegacyRunMatch &&
      preflight.globalConstantsStill020020 &&
      preflight.catalogueStill1 &&
      preflight.schemaV2LegacyPersistenceUnchanged &&
      canary.matchCanaryIsolated &&
      canary.seriesCanaryIsolated,
    schemaV3PersistenceAndReplayAvailable:
      preflight.schemaV3ConverterAndReplaySupportPresent,
    deterministicRollbackPossible:
      preflight.schemaV3ConverterAndReplaySupportPresent &&
      preflight.schemaV2LegacyPersistenceUnchanged,
    frozenConstraintsUnchanged:
      preflight.globalConstantsStill020020 &&
      preflight.catalogueStill1 &&
      preflight.bothCanaryChecksUnchanged &&
      facts.c1ChecksumIsFrozen &&
      facts.c2ChecksumIsFrozen &&
      facts.ab2ChecksumIsFrozen &&
      facts.c2IsDefault &&
      contractChecksum === GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
  };
}

/**
 * Pure source-state construction from the reviewed source facts. With the
 * canonical facts this reproduces the official source-state exactly. The
 * literal-type casts are safe because a source-state is only authoritative
 * when its facts equal the frozen canonical facts (asserted separately).
 */
export function sourceStateFromFacts(
  facts: GridOptInBetaReviewedSourceFactsV1,
  contractId: "grid-opt-in-beta-contract-v1" = GRID_OPT_IN_BETA_CONTRACT_ID,
  contractChecksum: string = GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
): GridOptInBetaSourceStateV1 {
  const preflight = canonicalStaticPreflightFromFacts(facts);
  const canary = canonicalCanaryIsolationFromFacts(facts);
  return {
    schemaVersion: "1",
    repositoryName: GRID_OPT_IN_BETA_GOVERNANCE_REPOSITORY_NAME,
    sourceCommit: facts.sourceCommit,
    globalSimulatorVersion: facts.globalSimulatorVersion as "0.2.0",
    globalRulesetVersion: facts.globalRulesetVersion as "0.2.0",
    catalogueVersion: facts.catalogueVersion as "1",
    gridRuntimeIdentity: {
      simulatorVersion: facts.gridRuntimeIdentity.simulatorVersion as "0.3.0",
      positioningModel: facts.gridRuntimeIdentity.positioningModel as "grid-3x3-v1",
      rulesetVersion: facts.gridRuntimeIdentity.rulesetVersion as "0.2.0",
      catalogueVersion: facts.gridRuntimeIdentity.catalogueVersion as "1",
    },
    normalRuntimeIdentity: {
      simulatorVersion: facts.normalRuntimeIdentity.simulatorVersion as "0.2.0",
      positioningModel: facts.normalRuntimeIdentity
        .positioningModel as "legacy-five-zone-v1",
      rulesetVersion: facts.normalRuntimeIdentity.rulesetVersion as "0.2.0",
      catalogueVersion: facts.normalRuntimeIdentity.catalogueVersion as "1",
    },
    legacyDefaultStaticPreflight: preflight,
    canaryIsolationStatus: canary,
    policyContractId: contractId,
    policyContractChecksum: contractChecksum,
    governanceInputs: canonicalGovernanceInputsFromFacts(facts, contractChecksum),
  };
}

function deepDiff(actual: unknown, expected: unknown, path: string): string[] {
  if (
    typeof actual === "object" &&
    actual !== null &&
    typeof expected === "object" &&
    expected !== null &&
    !Array.isArray(actual) &&
    !Array.isArray(expected)
  ) {
    const failures: string[] = [];
    const actualRecord = actual as Record<string, unknown>;
    const expectedRecord = expected as Record<string, unknown>;
    for (const key of Object.keys(expectedRecord)) {
      if (!(key in actualRecord)) {
        failures.push(`${path}.${key} is missing`);
      } else {
        failures.push(
          ...deepDiff(actualRecord[key], expectedRecord[key], `${path}.${key}`),
        );
      }
    }
    for (const key of Object.keys(actualRecord)) {
      if (!(key in expectedRecord)) {
        failures.push(`${path}.${key} is unexpected`);
      }
    }
    return failures;
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    return [
      `${path} expected ${JSON.stringify(expected)} but found ${JSON.stringify(actual)}`,
    ];
  }
  return [];
}

/**
 * Returns precise canonical-source-state mismatches (empty when the source
 * state equals the canonical reviewed source state for the given facts).
 */
export function gridOptInBetaSourceStateProvenanceFailures(
  sourceState: GridOptInBetaSourceStateV1,
  facts: GridOptInBetaReviewedSourceFactsV1 = GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS,
  contractChecksum: string = GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
): string[] {
  const expected = sourceStateFromFacts(
    facts,
    sourceState.policyContractId as "grid-opt-in-beta-contract-v1",
    contractChecksum,
  );
  const failures = deepDiff(sourceState, expected, "source-state");
  if (
    failures.length === 0 &&
    sourceState.sourceCommit !== GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT
  ) {
    failures.push(
      `source-state sourceCommit ${sourceState.sourceCommit} is not the authorised ${GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT}`,
    );
  }
  return failures;
}

/**
 * Requires the persisted source-state to be exactly the canonical reviewed
 * source state. The existing official `source-state.json` passes unchanged;
 * any coherent rewrite of arbitrary source-state booleans fails here.
 */
export function assertCanonicalGridOptInBetaGovernanceSourceState(
  sourceState: GridOptInBetaSourceStateV1,
  facts: GridOptInBetaReviewedSourceFactsV1 = GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS,
  contractChecksum: string = GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
): void {
  const failures = gridOptInBetaSourceStateProvenanceFailures(
    sourceState,
    facts,
    contractChecksum,
  );
  if (failures.length > 0) {
    throw new Error(
      `Source-state is not the canonical reviewed source state: ${failures.join("; ")}`,
    );
  }
}
