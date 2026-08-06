import { sha256Hex } from "../canary/grid-canary-digest.js";

/**
 * Bounded opt-in grid beta policy contract (Milestone 0.2C Phase 3F, Phase 2).
 *
 * A versioned, pure, deterministic contract that any later bounded grid beta
 * implementation must satisfy. The contract itself authorises nothing: it is
 * the binding policy for the separately reviewed implementation phase. It
 * requires explicit selection, legacy default isolation, an internal
 * single-match beta scope, schema-v3 persistence with the complete frozen grid
 * identity, user/operator clarity, one immediate deterministic kill switch,
 * migration-free rollback and frozen suspension triggers.
 */

export const GRID_OPT_IN_BETA_CONTRACT_ID = "grid-opt-in-beta-contract-v1" as const;
export const GRID_OPT_IN_BETA_CONTRACT_PURPOSE =
  "internal-bounded-grid-beta-implementation" as const;

export interface GridOptInBetaExplicitSelectionContract {
  readonly gridEnteredOnlyThroughExplicitBetaSelection: boolean;
  readonly absentSelectionResolvesToLegacy: boolean;
  readonly invalidUnknownOrMissingSelectionFailsClosed: boolean;
  readonly neverSelectedFromInferredPreferencesOrState: boolean;
  readonly betaChoiceVisibleInInitiatingCommandOrUi: boolean;
}

export interface GridOptInBetaDefaultIsolationContract {
  readonly normalMatchBattleAndSeriesCommandsRemainLegacy: boolean;
  readonly existingCallersRequireNoModification: boolean;
  readonly globalSimulatorVersionRemains020: boolean;
  readonly globalRulesetVersionRemains020: boolean;
  readonly gridRemainsExplicitAlternateRuntimeIdentity: boolean;
  readonly gridErrorNeverSilentlyRetriesLegacySameIdentity: boolean;
  readonly legacyErrorNeverSilentlyRetriesGrid: boolean;
}

export interface GridOptInBetaScopeContract {
  readonly internalOrDevelopmentUseOnly: boolean;
  readonly explicitlyBetaLabelledSingleMatchesOnly: boolean;
  readonly deterministicLocalScriptedFightersOnly: boolean;
  readonly schemaV3PersistenceOnly: boolean;
  readonly existingGridTextAndAsciiReplayOnly: boolean;
  readonly existingFactualReportsAndReviewPromptsOnly: boolean;
}

export interface GridOptInBetaPersistenceIdentityContract {
  readonly gridBetaRecordsRemainSchemaV3: boolean;
  readonly gridBetaRecordsCarryCompleteFrozenGridIdentity: boolean;
  readonly legacyRecordsRemainSchemaV2UnderExistingIdentity: boolean;
  readonly runtimeIdentityChosenBeforeMatchIdCreationWherePractical: boolean;
  readonly runtimeIdentityAlwaysChosenBeforeSimulation: boolean;
  readonly runtimeIdentityPresentInRecordReportAndReplay: boolean;
  readonly mixedRuntimeSeriesOrAggregatesForbidden: boolean;
}

export interface GridOptInBetaUserClarityContract {
  readonly betaSurfaceStatesGrid3x3BetaBanner: boolean;
  readonly betaSurfaceStatesOptInExperimentalNotBalanceQualified: boolean;
  readonly betaSurfaceStatesLegacyRemainsDefault: boolean;
  readonly betaSurfaceStatesC2RemainsExperimentalDefault: boolean;
  readonly betaSurfaceStatesBetaMayBeRemovedOrChanged: boolean;
  readonly betaSurfaceStatesResultsNotBalanceConclusions: boolean;
}

export interface GridOptInBetaKillSwitchContract {
  readonly oneImmediateDeterministicKillSwitch: boolean;
  readonly killSwitchPreventsNewGridBetaMatches: boolean;
  readonly killSwitchDoesNotAffectLegacyMatches: boolean;
  readonly killSwitchDoesNotDeleteExistingV3Records: boolean;
  readonly killSwitchLeavesExistingV3ReplayAvailable: boolean;
  readonly rollbackRequiresNoDataMigration: boolean;
  readonly rollbackRequiresNoChangeToLegacyRecords: boolean;
}

export interface GridOptInBetaContract {
  readonly contractId: "grid-opt-in-beta-contract-v1";
  readonly purpose: "internal-bounded-grid-beta-implementation";
  readonly version: "1";
  readonly explicitSelection: GridOptInBetaExplicitSelectionContract;
  readonly defaultIsolation: GridOptInBetaDefaultIsolationContract;
  readonly betaScope: GridOptInBetaScopeContract;
  readonly persistenceAndIdentity: GridOptInBetaPersistenceIdentityContract;
  readonly userAndOperatorClarity: GridOptInBetaUserClarityContract;
  readonly killSwitchAndRollback: GridOptInBetaKillSwitchContract;
  /** Scopes that remain forbidden without a later, separately reviewed decision. */
  readonly forbiddenScopes: readonly string[];
  /** Frozen suspension triggers. */
  readonly suspensionTriggers: readonly string[];
  readonly disclaimer: string;
}

const EXPLICIT_SELECTION: GridOptInBetaExplicitSelectionContract = {
  gridEnteredOnlyThroughExplicitBetaSelection: true,
  absentSelectionResolvesToLegacy: true,
  invalidUnknownOrMissingSelectionFailsClosed: true,
  neverSelectedFromInferredPreferencesOrState: true,
  betaChoiceVisibleInInitiatingCommandOrUi: true,
};

const DEFAULT_ISOLATION: GridOptInBetaDefaultIsolationContract = {
  normalMatchBattleAndSeriesCommandsRemainLegacy: true,
  existingCallersRequireNoModification: true,
  globalSimulatorVersionRemains020: true,
  globalRulesetVersionRemains020: true,
  gridRemainsExplicitAlternateRuntimeIdentity: true,
  gridErrorNeverSilentlyRetriesLegacySameIdentity: true,
  legacyErrorNeverSilentlyRetriesGrid: true,
};

const BETA_SCOPE: GridOptInBetaScopeContract = {
  internalOrDevelopmentUseOnly: true,
  explicitlyBetaLabelledSingleMatchesOnly: true,
  deterministicLocalScriptedFightersOnly: true,
  schemaV3PersistenceOnly: true,
  existingGridTextAndAsciiReplayOnly: true,
  existingFactualReportsAndReviewPromptsOnly: true,
};

const PERSISTENCE_IDENTITY: GridOptInBetaPersistenceIdentityContract = {
  gridBetaRecordsRemainSchemaV3: true,
  gridBetaRecordsCarryCompleteFrozenGridIdentity: true,
  legacyRecordsRemainSchemaV2UnderExistingIdentity: true,
  runtimeIdentityChosenBeforeMatchIdCreationWherePractical: true,
  runtimeIdentityAlwaysChosenBeforeSimulation: true,
  runtimeIdentityPresentInRecordReportAndReplay: true,
  mixedRuntimeSeriesOrAggregatesForbidden: true,
};

const USER_CLARITY: GridOptInBetaUserClarityContract = {
  betaSurfaceStatesGrid3x3BetaBanner: true,
  betaSurfaceStatesOptInExperimentalNotBalanceQualified: true,
  betaSurfaceStatesLegacyRemainsDefault: true,
  betaSurfaceStatesC2RemainsExperimentalDefault: true,
  betaSurfaceStatesBetaMayBeRemovedOrChanged: true,
  betaSurfaceStatesResultsNotBalanceConclusions: true,
};

const KILL_SWITCH: GridOptInBetaKillSwitchContract = {
  oneImmediateDeterministicKillSwitch: true,
  killSwitchPreventsNewGridBetaMatches: true,
  killSwitchDoesNotAffectLegacyMatches: true,
  killSwitchDoesNotDeleteExistingV3Records: true,
  killSwitchLeavesExistingV3ReplayAvailable: true,
  rollbackRequiresNoDataMigration: true,
  rollbackRequiresNoChangeToLegacyRecords: true,
};

export const GRID_OPT_IN_BETA_FORBIDDEN_SCOPES: readonly string[] = Object.freeze([
  "public default selection",
  "ranked matches",
  "prizes, rewards or monetised outcomes",
  "tournaments",
  "adaptation evaluation",
  "held-out evaluation",
  "mixed-runtime series",
  "automatic migration of legacy matches",
  "provider-driven autonomous runtime selection",
  "production matchmaking",
  "balance claims",
]);

export const GRID_OPT_IN_BETA_SUSPENSION_TRIGGERS: readonly string[] = Object.freeze([
  "nondeterministic result for identical inputs",
  "schema-v3 validation failure",
  "record/report final-state disagreement",
  "replay reconstruction disagreement",
  "incorrect runtime identity",
  "legacy-default regression",
  "cross-root persistence or isolation failure",
  "silent runtime fallback",
  "corrupt or unreplayable v3 record",
  "canary regression",
  "evidence-anchor failure",
]);

export const GRID_OPT_IN_BETA_CONTRACT_DISCLAIMER =
  "This contract is a binding policy for a later, separately reviewed bounded grid beta implementation. It does not enable the grid runtime, change the default runtime, qualify combat balance, authorise a public rollout or begin Milestone 0.2D." as const;

/** Canonical serialization of the contract (stable key order, 2-space JSON). */
export function serializeGridOptInBetaContract(contract: GridOptInBetaContract): string {
  return JSON.stringify(contract, null, 2);
}

/** Deterministic SHA-256 checksum of the contract. */
export function gridOptInBetaContractChecksum(contract: GridOptInBetaContract): string {
  return sha256Hex(serializeGridOptInBetaContract(contract));
}

/**
 * The frozen bounded opt-in beta policy contract (v1). Deeply frozen and
 * immutable; the checksum is deterministic over the canonical serialization.
 */
export const GRID_OPT_IN_BETA_CONTRACT: GridOptInBetaContract = Object.freeze({
  contractId: GRID_OPT_IN_BETA_CONTRACT_ID,
  purpose: GRID_OPT_IN_BETA_CONTRACT_PURPOSE,
  version: "1",
  explicitSelection: EXPLICIT_SELECTION,
  defaultIsolation: DEFAULT_ISOLATION,
  betaScope: BETA_SCOPE,
  persistenceAndIdentity: PERSISTENCE_IDENTITY,
  userAndOperatorClarity: USER_CLARITY,
  killSwitchAndRollback: KILL_SWITCH,
  forbiddenScopes: GRID_OPT_IN_BETA_FORBIDDEN_SCOPES,
  suspensionTriggers: GRID_OPT_IN_BETA_SUSPENSION_TRIGGERS,
  disclaimer: GRID_OPT_IN_BETA_CONTRACT_DISCLAIMER,
});

/**
 * Structural completeness check: every required contract clause is present and
 * every requirement field is satisfied. This is the authoritative
 * "complete bounded-beta policy contract" governance input.
 */
export function isGridOptInBetaContractComplete(
  contract: GridOptInBetaContract,
): boolean {
  const groups = [
    contract.explicitSelection,
    contract.defaultIsolation,
    contract.betaScope,
    contract.persistenceAndIdentity,
    contract.userAndOperatorClarity,
    contract.killSwitchAndRollback,
  ];
  for (const group of groups) {
    for (const value of Object.values(group)) {
      if (value !== true) return false;
    }
  }
  if (contract.contractId !== GRID_OPT_IN_BETA_CONTRACT_ID) return false;
  if (contract.purpose !== GRID_OPT_IN_BETA_CONTRACT_PURPOSE) return false;
  if (contract.forbiddenScopes.length === 0) return false;
  if (contract.suspensionTriggers.length === 0) return false;
  if (contract.disclaimer.length === 0) return false;
  return true;
}

/** Deterministic checksum of the frozen contract. */
export const GRID_OPT_IN_BETA_CONTRACT_CHECKSUM: string = gridOptInBetaContractChecksum(
  GRID_OPT_IN_BETA_CONTRACT,
);
