import { describe, expect, it } from "vitest";
import {
  GRID_OPT_IN_BETA_CONTRACT,
  GRID_OPT_IN_BETA_CONTRACT_ID,
  GRID_OPT_IN_BETA_CONTRACT_PURPOSE,
  GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
  GRID_OPT_IN_BETA_FORBIDDEN_SCOPES,
  GRID_OPT_IN_BETA_SUSPENSION_TRIGGERS,
  gridOptInBetaContractChecksum,
  isGridOptInBetaContractComplete,
} from "../../src/readiness/grid-opt-in-beta-contract.js";

describe("grid opt-in beta policy contract (Phase 3F Phase 2)", () => {
  it("has the frozen contract ID and purpose", () => {
    expect(GRID_OPT_IN_BETA_CONTRACT.contractId).toBe("grid-opt-in-beta-contract-v1");
    expect(GRID_OPT_IN_BETA_CONTRACT_ID).toBe("grid-opt-in-beta-contract-v1");
    expect(GRID_OPT_IN_BETA_CONTRACT.purpose).toBe(
      "internal-bounded-grid-beta-implementation",
    );
    expect(GRID_OPT_IN_BETA_CONTRACT_PURPOSE).toBe(
      "internal-bounded-grid-beta-implementation",
    );
  });

  it("requires explicit selection and legacy default isolation", () => {
    const s = GRID_OPT_IN_BETA_CONTRACT.explicitSelection;
    expect(s.gridEnteredOnlyThroughExplicitBetaSelection).toBe(true);
    expect(s.absentSelectionResolvesToLegacy).toBe(true);
    expect(s.invalidUnknownOrMissingSelectionFailsClosed).toBe(true);
    expect(s.neverSelectedFromInferredPreferencesOrState).toBe(true);
    expect(s.betaChoiceVisibleInInitiatingCommandOrUi).toBe(true);
    const d = GRID_OPT_IN_BETA_CONTRACT.defaultIsolation;
    expect(d.normalMatchBattleAndSeriesCommandsRemainLegacy).toBe(true);
    expect(d.existingCallersRequireNoModification).toBe(true);
    expect(d.globalSimulatorVersionRemains020).toBe(true);
    expect(d.globalRulesetVersionRemains020).toBe(true);
    expect(d.gridRemainsExplicitAlternateRuntimeIdentity).toBe(true);
    expect(d.gridErrorNeverSilentlyRetriesLegacySameIdentity).toBe(true);
    expect(d.legacyErrorNeverSilentlyRetriesGrid).toBe(true);
  });

  it("restricts the beta to an internal single-match scope", () => {
    const s = GRID_OPT_IN_BETA_CONTRACT.betaScope;
    expect(s.internalOrDevelopmentUseOnly).toBe(true);
    expect(s.explicitlyBetaLabelledSingleMatchesOnly).toBe(true);
    expect(s.deterministicLocalScriptedFightersOnly).toBe(true);
    expect(s.schemaV3PersistenceOnly).toBe(true);
    expect(s.existingGridTextAndAsciiReplayOnly).toBe(true);
    expect(s.existingFactualReportsAndReviewPromptsOnly).toBe(true);
  });

  it("requires schema-v3 identity and forbids mixed-runtime series", () => {
    const p = GRID_OPT_IN_BETA_CONTRACT.persistenceAndIdentity;
    expect(p.gridBetaRecordsRemainSchemaV3).toBe(true);
    expect(p.gridBetaRecordsCarryCompleteFrozenGridIdentity).toBe(true);
    expect(p.legacyRecordsRemainSchemaV2UnderExistingIdentity).toBe(true);
    expect(p.runtimeIdentityChosenBeforeMatchIdCreationWherePractical).toBe(true);
    expect(p.runtimeIdentityAlwaysChosenBeforeSimulation).toBe(true);
    expect(p.runtimeIdentityPresentInRecordReportAndReplay).toBe(true);
    expect(p.mixedRuntimeSeriesOrAggregatesForbidden).toBe(true);
  });

  it("forbids public, ranked, tournament and held-out scopes", () => {
    for (const forbidden of [
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
    ]) {
      expect(GRID_OPT_IN_BETA_FORBIDDEN_SCOPES).toContain(forbidden);
    }
  });

  it("requires user and operator clarity", () => {
    const u = GRID_OPT_IN_BETA_CONTRACT.userAndOperatorClarity;
    expect(u.betaSurfaceStatesGrid3x3BetaBanner).toBe(true);
    expect(u.betaSurfaceStatesOptInExperimentalNotBalanceQualified).toBe(true);
    expect(u.betaSurfaceStatesLegacyRemainsDefault).toBe(true);
    expect(u.betaSurfaceStatesC2RemainsExperimentalDefault).toBe(true);
    expect(u.betaSurfaceStatesBetaMayBeRemovedOrChanged).toBe(true);
    expect(u.betaSurfaceStatesResultsNotBalanceConclusions).toBe(true);
  });

  it("completes the kill-switch and rollback requirements", () => {
    const k = GRID_OPT_IN_BETA_CONTRACT.killSwitchAndRollback;
    expect(k.oneImmediateDeterministicKillSwitch).toBe(true);
    expect(k.killSwitchPreventsNewGridBetaMatches).toBe(true);
    expect(k.killSwitchDoesNotAffectLegacyMatches).toBe(true);
    expect(k.killSwitchDoesNotDeleteExistingV3Records).toBe(true);
    expect(k.killSwitchLeavesExistingV3ReplayAvailable).toBe(true);
    expect(k.rollbackRequiresNoDataMigration).toBe(true);
    expect(k.rollbackRequiresNoChangeToLegacyRecords).toBe(true);
  });

  it("freezes the suspension triggers", () => {
    for (const trigger of [
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
    ]) {
      expect(GRID_OPT_IN_BETA_SUSPENSION_TRIGGERS).toContain(trigger);
    }
  });

  it("is structurally complete", () => {
    expect(isGridOptInBetaContractComplete(GRID_OPT_IN_BETA_CONTRACT)).toBe(true);
  });

  it("has a deterministic contract checksum", () => {
    expect(gridOptInBetaContractChecksum(GRID_OPT_IN_BETA_CONTRACT)).toBe(
      GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
    );
    expect(GRID_OPT_IN_BETA_CONTRACT_CHECKSUM).toMatch(/^[0-9a-f]{64}$/);
  });
});
