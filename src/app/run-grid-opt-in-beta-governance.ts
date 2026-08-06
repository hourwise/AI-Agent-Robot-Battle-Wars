import {
  GRID_OPT_IN_BETA_GOVERNANCE_DEFAULT_ROOT,
  runGridOptInBetaGovernanceDecision,
} from "./grid-opt-in-beta-governance.js";

/**
 * Explicit grid opt-in beta governance command (Milestone 0.2C Phase 3F).
 *
 * Evidence-based, non-activating, no simulation. Accepts no arguments. A
 * completed `approved_for_bounded_opt_in_beta_implementation`, `deferred` or
 * `rejected` decision exits zero; it exits nonzero only for an operational
 * failure that prevents creating a validated governance bundle.
 */
export function rejectGovernanceArguments(args: readonly string[]): void {
  if (args.length > 0) {
    throw new Error(
      `The grid opt-in beta governance command accepts no arguments. Rejected: ${args.join(", ")}`,
    );
  }
}

async function main(): Promise<void> {
  let args: readonly string[];
  try {
    args = process.argv.slice(2);
    rejectGovernanceArguments(args);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    console.error(
      "Usage: tsx src/app/run-grid-opt-in-beta-governance.ts (no arguments accepted)",
    );
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("FORGE ARENA — GRID OPT-IN BETA GOVERNANCE");
  console.log("EVIDENCE-BASED / NON-ACTIVATING / NO SIMULATION");
  console.log("=".repeat(60));
  console.log("");

  try {
    const outcome = await runGridOptInBetaGovernanceDecision({
      outputRoot: GRID_OPT_IN_BETA_GOVERNANCE_DEFAULT_ROOT,
    });

    console.log(`Decision ID: ${outcome.decisionId}`);
    console.log(`Source commit: ${outcome.sourceCommit}`);
    console.log("");
    console.log("Official v3 readiness evidence");
    console.log(`  Evaluation ID: ${outcome.baseV3.evaluationId}`);
    console.log(`  Suite: ${outcome.baseV3.suiteId} (${outcome.baseV3.suiteChecksum})`);
    console.log(`  Manifest checksum: ${outcome.baseV3.manifestChecksum}`);
    console.log(`  Decision checksum: ${outcome.baseV3.decisionChecksum}`);
    console.log(`  Metrics checksum: ${outcome.baseV3.metricsChecksum}`);
    console.log(`  Classification: ${outcome.baseV3.classification}`);
    console.log(`  Non-pass gates: ${outcome.baseV3.nonPassGates.join(", ")}`);
    console.log("");
    console.log("Official supplemental grapple evidence");
    console.log(`  Supplement ID: ${outcome.supplement.supplementId}`);
    console.log(`  Suite: ${outcome.supplement.suiteId}`);
    console.log(
      `  Scenario-registry checksum: ${outcome.supplement.scenarioRegistryChecksum}`,
    );
    console.log(`  Plan checksum: ${outcome.supplement.planChecksum}`);
    console.log(`  Decision: ${outcome.supplement.decision}`);
    console.log(
      `  Combined readiness classification: ${outcome.supplement.combinedReadinessClassification}`,
    );
    console.log(`  Manifest checksum: ${outcome.supplement.manifestChecksum}`);
    console.log(`  Base-reference checksum: ${outcome.supplement.baseReferenceChecksum}`);
    console.log(`  Metrics checksum: ${outcome.supplement.metricsChecksum}`);
    console.log(`  Decision checksum: ${outcome.supplement.decisionChecksum}`);
    console.log(`  Report checksum: ${outcome.supplement.reportChecksum}`);
    console.log("");
    console.log(`Evidence validation status: ${outcome.evidenceValidationStatus}`);
    console.log(`Policy contract: ${outcome.contractId} (${outcome.contractChecksum})`);
    console.log("");
    console.log("Governance criteria");
    const c = outcome.criteria;
    const fmt = (label: string, value: boolean): void =>
      console.log(`  ${label}: ${value ? "PASS" : "FAIL"}`);
    fmt("Official v3 evidence validates and anchors exactly", c.baseV3ValidAndAnchored);
    fmt(
      "Official supplement validates and anchors exactly",
      c.supplementValidAndAnchored,
    );
    fmt("All hard readiness gates passed", c.hardReadinessGatesPassed);
    fmt("C04 is the sole base non-pass gate", c.soleNonPassGateIsC04);
    fmt("Supplement decision coverage_confirmed", c.supplementDecisionCoverageConfirmed);
    fmt(
      "Combined classification ready_for_opt_in_beta_review",
      c.combinedClassificationReadyForOptInBetaReview,
    );
    fmt(
      "Both attacker slots produced causal grapple reposition",
      c.bothAttackerSlotsProducedReposition,
    );
    fmt(
      "Distinct seeds produced reposition in each slot",
      c.distinctSeedsProducedReposition,
    );
    fmt("Legacy remains the active default", c.legacyIsActiveDefault);
    fmt(
      "Schema-v3 persistence and replay available",
      c.schemaV3PersistenceAndReplayAvailable,
    );
    fmt("Deterministic rollback possible", c.deterministicRollbackPossible);
    fmt("Complete bounded-beta policy contract present", c.contractComplete);
    fmt(
      "Kill-switch/rollback/persistence/identity/suspension requirements complete",
      c.safeguardsComplete,
    );
    fmt(
      "No default or public activation requested",
      c.noDefaultOrPublicActivationRequested,
    );
    fmt("No forbidden claims included", c.noForbiddenClaimsIncluded);
    fmt("Frozen constraints unchanged", c.frozenConstraintsUnchanged);
    fmt("No unresolved risk blocks approval", !c.unresolvedRiskBlocksApproval);
    console.log("");
    console.log(`GOVERNANCE DECISION: ${outcome.outcome}`);
    console.log("");
    console.log("Authorised scope (implementation authorisation only)");
    for (const item of outcome.decision.authorisedScope) {
      console.log(`  - ${item}`);
    }
    console.log("Forbidden scope");
    for (const item of outcome.decision.forbiddenScope) {
      console.log(`  - ${item}`);
    }
    console.log("");
    console.log(`Artifact directory: ${outcome.artifactDirectory}`);
    console.log("");
    console.log(
      "No runtime was enabled and legacy remains the default. No simulation ran, no evaluation was rerun, no benchmark ran and no balance conclusion was made.",
    );
    console.log(
      "This decision authorises at most implementation of a bounded and explicitly selected grid beta in a later, separately reviewed phase.",
    );
    console.log("Grid opt-in beta governance decision completed successfully.");
  } catch (e) {
    console.error(
      "Grid opt-in beta governance failed:",
      e instanceof Error ? e.message : String(e),
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
