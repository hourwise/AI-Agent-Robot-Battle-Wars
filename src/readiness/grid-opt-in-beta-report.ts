import type {
  GridOptInBetaBaseV3EvidenceReference,
  GridOptInBetaGovernanceCriteria,
  GridOptInBetaGovernanceOutcome,
  GridOptInBetaSupplementEvidenceReference,
} from "./grid-opt-in-beta-governance.js";

/**
 * Human-readable governance report (Milestone 0.2C Phase 3F). Deterministic
 * text; the bundle validator regenerates it byte-for-byte from the persisted
 * decision, contract and evidence references.
 */

export interface BuildGridOptInBetaGovernanceReportInput {
  readonly decisionId: string;
  readonly createdAt: string;
  readonly sourceCommit: string;
  readonly baseV3: GridOptInBetaBaseV3EvidenceReference;
  readonly supplement: GridOptInBetaSupplementEvidenceReference;
  readonly contractId: string;
  readonly contractChecksum: string;
  readonly criteria: GridOptInBetaGovernanceCriteria;
  readonly outcome: GridOptInBetaGovernanceOutcome;
  readonly authorisedScope: readonly string[];
  readonly forbiddenScope: readonly string[];
  readonly requiredSafeguards: readonly string[];
  readonly rollbackAndSuspensionTriggers: readonly string[];
  readonly unresolvedRisks: readonly string[];
  readonly disclaimer: string;
}

function boolLine(value: boolean): string {
  return value ? "PASS" : "FAIL";
}

function bulletList(items: readonly string[]): string {
  return items.map((item) => `  - ${item}`).join("\n");
}

export function buildGridOptInBetaGovernanceReport(
  input: BuildGridOptInBetaGovernanceReportInput,
): string {
  const lines: string[] = [];
  lines.push("=".repeat(68));
  lines.push("FORGE ARENA — GRID OPT-IN BETA GOVERNANCE DECISION");
  lines.push("EVIDENCE-BASED / NON-ACTIVATING / NO SIMULATION");
  lines.push("=".repeat(68));
  lines.push("");
  lines.push(`Decision ID: ${input.decisionId}`);
  lines.push(`Created: ${input.createdAt}`);
  lines.push(`Source commit: ${input.sourceCommit}`);
  lines.push("");
  lines.push("OFFICIAL V3 READINESS EVIDENCE");
  lines.push(`  Evaluation ID: ${input.baseV3.evaluationId}`);
  lines.push(`  Suite: ${input.baseV3.suiteId} (${input.baseV3.suiteChecksum})`);
  lines.push(`  Seed-registry checksum: ${input.baseV3.seedRegistryChecksum}`);
  lines.push(`  Scenario-registry checksum: ${input.baseV3.scenarioRegistryChecksum}`);
  lines.push(`  Classification: ${input.baseV3.classification}`);
  lines.push(`  Non-pass gates: ${input.baseV3.nonPassGates.join(", ")}`);
  lines.push(`  Manifest checksum: ${input.baseV3.manifestChecksum}`);
  lines.push(`  Decision checksum: ${input.baseV3.decisionChecksum}`);
  lines.push(`  Metrics checksum: ${input.baseV3.metricsChecksum}`);
  lines.push("");
  lines.push("OFFICIAL SUPPLEMENTAL GRAPPLE EVIDENCE");
  lines.push(`  Supplement ID: ${input.supplement.supplementId}`);
  lines.push(`  Suite: ${input.supplement.suiteId}`);
  lines.push(
    `  Scenario-registry checksum: ${input.supplement.scenarioRegistryChecksum}`,
  );
  lines.push(`  Plan checksum: ${input.supplement.planChecksum}`);
  lines.push(`  Decision: ${input.supplement.decision}`);
  lines.push(
    `  Combined readiness classification: ${input.supplement.combinedReadinessClassification}`,
  );
  lines.push(`  Manifest checksum: ${input.supplement.manifestChecksum}`);
  lines.push(`  Base-reference checksum: ${input.supplement.baseReferenceChecksum}`);
  lines.push(`  Metrics checksum: ${input.supplement.metricsChecksum}`);
  lines.push(`  Decision checksum: ${input.supplement.decisionChecksum}`);
  lines.push(`  Report checksum: ${input.supplement.reportChecksum}`);
  lines.push("");
  lines.push("EVIDENCE VALIDATION STATUS: validated");
  lines.push(`POLICY CONTRACT: ${input.contractId} (${input.contractChecksum})`);
  lines.push("");
  lines.push("GOVERNANCE CRITERIA");
  lines.push(
    `  Official v3 evidence validates and anchors exactly: ${boolLine(input.criteria.baseV3ValidAndAnchored)}`,
  );
  lines.push(
    `  Official supplement validates and anchors exactly: ${boolLine(input.criteria.supplementValidAndAnchored)}`,
  );
  lines.push(
    `  All hard readiness gates passed: ${boolLine(input.criteria.hardReadinessGatesPassed)}`,
  );
  lines.push(
    `  C04 is the sole base non-pass gate: ${boolLine(input.criteria.soleNonPassGateIsC04)}`,
  );
  lines.push(
    `  Supplement decision coverage_confirmed: ${boolLine(input.criteria.supplementDecisionCoverageConfirmed)}`,
  );
  lines.push(
    `  Combined classification ready_for_opt_in_beta_review: ${boolLine(input.criteria.combinedClassificationReadyForOptInBetaReview)}`,
  );
  lines.push(
    `  Both attacker slots produced causal grapple reposition: ${boolLine(input.criteria.bothAttackerSlotsProducedReposition)}`,
  );
  lines.push(
    `  Distinct seeds produced reposition in each slot: ${boolLine(input.criteria.distinctSeedsProducedReposition)}`,
  );
  lines.push(
    `  Legacy remains the active default: ${boolLine(input.criteria.legacyIsActiveDefault)}`,
  );
  lines.push(
    `  Schema-v3 persistence and replay available: ${boolLine(input.criteria.schemaV3PersistenceAndReplayAvailable)}`,
  );
  lines.push(
    `  Deterministic rollback possible: ${boolLine(input.criteria.deterministicRollbackPossible)}`,
  );
  lines.push(
    `  Complete bounded-beta policy contract present: ${boolLine(input.criteria.contractComplete)}`,
  );
  lines.push(
    `  Kill-switch/rollback/persistence/identity/suspension requirements complete: ${boolLine(input.criteria.safeguardsComplete)}`,
  );
  lines.push(
    `  No default or public activation requested: ${boolLine(input.criteria.noDefaultOrPublicActivationRequested)}`,
  );
  lines.push(
    `  No balance, ranked, tournament or held-out claims included: ${boolLine(input.criteria.noForbiddenClaimsIncluded)}`,
  );
  lines.push(
    `  Frozen constraints unchanged: ${boolLine(input.criteria.frozenConstraintsUnchanged)}`,
  );
  lines.push(
    `  No unresolved risk blocks approval: ${boolLine(!input.criteria.unresolvedRiskBlocksApproval)}`,
  );
  lines.push("");
  lines.push(`GOVERNANCE DECISION: ${input.outcome}`);
  lines.push("");
  lines.push("AUTHORISED SCOPE (implementation authorisation only)");
  lines.push(bulletList(input.authorisedScope));
  lines.push("");
  lines.push("FORBIDDEN SCOPE");
  lines.push(bulletList(input.forbiddenScope));
  lines.push("");
  lines.push("REQUIRED IMPLEMENTATION SAFEGUARDS");
  lines.push(bulletList(input.requiredSafeguards));
  lines.push("");
  lines.push("ROLLBACK AND SUSPENSION TRIGGERS");
  lines.push(bulletList(input.rollbackAndSuspensionTriggers));
  lines.push("");
  lines.push("UNRESOLVED RISKS");
  lines.push(bulletList(input.unresolvedRisks));
  lines.push("");
  lines.push(`DISCLAIMER: ${input.disclaimer}`);
  lines.push("");
  lines.push(
    "No runtime was enabled and legacy remains the default. No simulation ran, no evaluation was rerun, no benchmark ran and no balance conclusion was made.",
  );
  lines.push("Grid opt-in beta governance decision completed.");
  lines.push("");
  return lines.join("\n");
}
