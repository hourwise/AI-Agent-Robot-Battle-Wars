import type { GridActivationReadinessMetrics } from "./metrics.js";
import type { GridActivationReadinessSuiteOutcome } from "./execution-core.js";
import { GRID_ACTIVATION_READINESS_RUN_COUNT } from "./run-plan.js";

/**
 * Frozen grid activation-readiness gates (Milestone 0.2C Phase 3E1).
 *
 * Gate outcomes: `pass`, `fail`, `inconclusive`.
 *
 *   - Hard correctness gates H01–H10 are pass/fail; any failure produces
 *     `not_ready`.
 *   - Coverage gates C01–C06 are pass/inconclusive; missing coverage produces
 *     `inconclusive`, never a simulator failure, and nothing is tuned to make
 *     a coverage item appear.
 *   - Slot-order stability gates S01–S03 and progress gates P01–P02 are gross
 *     pathology gates (pass/inconclusive/fail); a `fail` produces `not_ready`.
 *
 * These thresholds are frozen gross-pathology thresholds and must not be
 * adjusted after seeing results.
 */
export type ReadinessGateOutcome = "pass" | "fail" | "inconclusive";

export type ReadinessGateCategory =
  "hard-correctness" | "coverage" | "slot-order-stability" | "progress";

export interface ReadinessGateResult {
  readonly gateId: string;
  readonly category: ReadinessGateCategory;
  readonly outcome: ReadinessGateOutcome;
  readonly frozenThreshold: string;
  readonly observedValue: string;
  readonly evidence: string;
  readonly blockingReason: string | null;
}

export interface GridActivationReadinessGateResults {
  readonly gates: readonly ReadinessGateResult[];
  readonly anyFail: boolean;
  readonly anyInconclusive: boolean;
}

export interface EvaluateGridActivationReadinessGatesInput {
  metrics: GridActivationReadinessMetrics;
  outcome: GridActivationReadinessSuiteOutcome;
  inputsUnmodified: boolean;
  /** H09 input: in-memory schema/checksum/digest/cross-agreement validation. */
  artifactIntegrityVerified: boolean;
  /** H10 input: legacy commands, schemas, constants and canaries unchanged. */
  legacyIsolationVerified: boolean;
}

const ALL_NINE_ZONES = [
  "north_west",
  "north",
  "north_east",
  "west",
  "center",
  "east",
  "south_west",
  "south",
  "south_east",
];

function gate(
  gateId: string,
  category: ReadinessGateCategory,
  outcome: ReadinessGateOutcome,
  frozenThreshold: string,
  observedValue: string,
  evidence: string,
  blockingReason: string | null,
): ReadinessGateResult {
  return Object.freeze({
    gateId,
    category,
    outcome,
    frozenThreshold,
    observedValue,
    evidence,
    blockingReason,
  });
}

/**
 * Evaluates every frozen gate against the metrics, the suite outcome and the
 * externally supplied artifact-integrity / legacy-isolation evidence.
 */
export function evaluateGridActivationReadinessGates(
  input: EvaluateGridActivationReadinessGatesInput,
): GridActivationReadinessGateResults {
  const { metrics, outcome, inputsUnmodified } = input;
  const gates: ReadinessGateResult[] = [];

  // ── Hard correctness gates (pass/fail) ───────────────────────────────────

  const h01Complete =
    metrics.execution.totalPlannedRuns === GRID_ACTIVATION_READINESS_RUN_COUNT &&
    metrics.execution.totalCompletedRuns === GRID_ACTIVATION_READINESS_RUN_COUNT;
  gates.push(
    gate(
      "H01",
      "hard-correctness",
      h01Complete ? "pass" : "fail",
      `exactly ${GRID_ACTIVATION_READINESS_RUN_COUNT} planned matches complete without exception`,
      `${metrics.execution.totalCompletedRuns}/${metrics.execution.totalPlannedRuns}`,
      "Every planned match completed",
      h01Complete ? null : "not all planned matches completed",
    ),
  );

  const h02Determinism =
    metrics.execution.deterministicMatches === GRID_ACTIVATION_READINESS_RUN_COUNT;
  gates.push(
    gate(
      "H02",
      "hard-correctness",
      h02Determinism ? "pass" : "fail",
      "every repeated run is byte-identical under fixed identities",
      `${metrics.execution.deterministicMatches} deterministic`,
      "Repeat suite matched the primary suite byte-for-byte",
      h02Determinism ? null : "repeat execution was not byte-identical",
    ),
  );

  const identityViolations: string[] = [];
  for (const run of outcome.results) {
    const record = run.record;
    const report = run.report;
    if (
      record.simulatorVersion !== "0.3.0" ||
      record.positioningModel !== "grid-3x3-v1" ||
      record.rulesetVersion !== "0.2.0" ||
      record.catalogueVersion !== "1"
    ) {
      identityViolations.push(`run ${run.runNumber} record identity`);
    }
    if (
      report.simulatorVersion !== "0.3.0" ||
      report.positioningModel !== "grid-3x3-v1" ||
      report.rulesetVersion !== "0.2.0" ||
      report.catalogueVersion !== "1"
    ) {
      identityViolations.push(`run ${run.runNumber} report identity`);
    }
  }
  const h03Identity = identityViolations.length === 0;
  gates.push(
    gate(
      "H03",
      "hard-correctness",
      h03Identity ? "pass" : "fail",
      "every result, record and report uses 0.3.0 / grid-3x3-v1 / 0.2.0 / 1",
      identityViolations.length === 0
        ? "0.3.0 / grid-3x3-v1 / 0.2.0 / 1"
        : identityViolations.join(", "),
      "Every record and report carries the exact grid runtime identity",
      h03Identity ? null : "an identity mismatch was found",
    ),
  );

  let bindingViolations = 0;
  let schemaViolations = 0;
  for (const run of outcome.results) {
    if (run.record.schemaVersion !== "3") schemaViolations += 1;
    if (run.report.schemaVersion !== "2") schemaViolations += 1;
    if (run.record.matchId !== run.report.matchId) bindingViolations += 1;
  }
  const h04Persistence =
    schemaViolations === 0 && bindingViolations === 0 && input.artifactIntegrityVerified;
  gates.push(
    gate(
      "H04",
      "hard-correctness",
      h04Persistence ? "pass" : "fail",
      "every record is v3, every report is v2, every report is bound to its record and every artifact validates",
      `records v3 / reports v2 / bound ${bindingViolations === 0 ? "yes" : `violations ${bindingViolations}`}`,
      "All 312 records are v3, all 312 reports are v2 and every report is bound to its record",
      h04Persistence ? null : "record/report schema or binding violation",
    ),
  );

  const h05Replay =
    metrics.execution.replayAgreeingMatches === GRID_ACTIVATION_READINESS_RUN_COUNT;
  gates.push(
    gate(
      "H05",
      "hard-correctness",
      h05Replay ? "pass" : "fail",
      "every report agrees with replay reconstruction and final authoritative round facts",
      `${metrics.execution.replayAgreeingMatches} agreeing`,
      "Replay, report and final round_ended facts agree for every match",
      h05Replay ? null : "a replay/report/final-round disagreement was found",
    ),
  );

  const h06Events = metrics.execution.invalidEventCount === 0;
  gates.push(
    gate(
      "H06",
      "hard-correctness",
      h06Events ? "pass" : "fail",
      "no malformed action, zone, subject, facing, condition or impossible schema fact is accepted",
      `${metrics.execution.invalidEventCount} invalid events`,
      "All movement actions, subjects, zones, facings, conditions and schema facts are canonical",
      h06Events ? null : "an invalid event fact was accepted",
    ),
  );

  const h07Immutability = inputsUnmodified && metrics.execution.mutationFailures === 0;
  gates.push(
    gate(
      "H07",
      "hard-correctness",
      h07Immutability ? "pass" : "fail",
      "no scenario, build, policy, registry or run-plan input mutates",
      inputsUnmodified ? "unmodified" : "mutated",
      "Every supplied registry, plan and fighter value remained unmodified",
      h07Immutability ? null : "a supplied input was mutated",
    ),
  );

  const maxNoProgress = metrics.results.maximumConsecutiveNoProgressRounds;
  const h08Progress = maxNoProgress <= 10;
  gates.push(
    gate(
      "H08",
      "hard-correctness",
      h08Progress ? "pass" : "fail",
      "no match contains more than 10 consecutive rounds with no meaningful progress",
      `${maxNoProgress} consecutive no-progress rounds`,
      "Maximum consecutive no-progress rounds across the suite",
      h08Progress ? null : "a match exceeded 10 consecutive no-progress rounds",
    ),
  );

  const h09Artifacts = input.artifactIntegrityVerified;
  gates.push(
    gate(
      "H09",
      "hard-correctness",
      h09Artifacts ? "pass" : "fail",
      "all bundle schemas, checksums, digests, read-back and cross-agreement checks pass",
      h09Artifacts ? "verified" : "not verified",
      "Envelope schemas, digests and cross-agreement checks validated",
      h09Artifacts ? null : "artifact integrity validation failed",
    ),
  );

  const h10Legacy = input.legacyIsolationVerified;
  gates.push(
    gate(
      "H10",
      "hard-correctness",
      h10Legacy ? "pass" : "fail",
      "legacy commands, normal schemas, constants and both existing canaries remain unchanged",
      h10Legacy ? "isolated" : "not isolated",
      "Legacy commands, constants and existing canaries were verified unchanged",
      h10Legacy ? null : "legacy isolation was not verified",
    ),
  );

  // ── Coverage gates (pass/inconclusive) ───────────────────────────────────

  const zoneVisits = metrics.movement.zoneVisits;
  const allZonesVisited = ALL_NINE_ZONES.every(
    (zone) => (zoneVisits[zone as keyof typeof zoneVisits] ?? 0) > 0,
  );
  gates.push(
    gate(
      "C01",
      "coverage",
      allZonesVisited ? "pass" : "inconclusive",
      "all nine grid zones are visited",
      `${Object.values(zoneVisits).filter((count) => count > 0).length}/9 zones visited`,
      "Grid-space coverage across the suite",
      allZonesVisited ? null : "not all nine grid zones were visited",
    ),
  );

  const actionCounts = metrics.movement.actionCounts;
  const translated = metrics.movement.translatedActionCounts;
  const allActions = ["advance", "retreat", "circle_left", "circle_right", "hold"].every(
    (action) => (actionCounts[action as keyof typeof actionCounts] ?? 0) > 0,
  );
  const allTranslated = ["advance", "retreat", "circle_left", "circle_right"].every(
    (action) => (translated[action as keyof typeof translated] ?? 0) > 0,
  );
  const c02Movement = allActions && allTranslated;
  gates.push(
    gate(
      "C02",
      "coverage",
      c02Movement ? "pass" : "inconclusive",
      "all five canonical movement actions and translated advance/retreat/circle_left/circle_right are observed",
      `actions ${Object.values(actionCounts).filter((c) => c > 0).length}/5, translated ${Object.values(translated).filter((c) => c > 0).length}/4`,
      "Movement and translated-movement coverage across the suite",
      c02Movement ? null : "a canonical or translated movement action was not observed",
    ),
  );

  const combat = metrics.combat;
  const c03Combat =
    combat.attacksAttempted > 0 &&
    combat.hits > 0 &&
    combat.misses > 0 &&
    combat.integrityDamageEvents > 0;
  gates.push(
    gate(
      "C03",
      "coverage",
      c03Combat ? "pass" : "inconclusive",
      "attack_attempted, attack_hit, attack_missed and integrity_damaged are observed",
      `attempts ${combat.attacksAttempted}, hits ${combat.hits}, misses ${combat.misses}, integrity damage ${combat.integrityDamageEvents}`,
      "Core combat coverage across the suite",
      c03Combat ? null : "a core combat event type was not observed",
    ),
  );

  const c04Reposition =
    combat.knockbackEvents > 0 &&
    combat.grappleRepositionEvents > 0 &&
    combat.overturnEvents > 0;
  gates.push(
    gate(
      "C04",
      "coverage",
      c04Reposition ? "pass" : "inconclusive",
      "knockback, grapple reposition and robot_overturned are all observed",
      `knockback ${combat.knockbackEvents}, grapple ${combat.grappleRepositionEvents}, overturn ${combat.overturnEvents}`,
      "Reposition feature coverage across the suite",
      c04Reposition ? null : "a reposition feature was not observed",
    ),
  );

  const c05Lifecycle =
    combat.componentDamaged > 0 &&
    combat.componentDisabled > 0 &&
    combat.componentDamageResisted > 0;
  gates.push(
    gate(
      "C05",
      "coverage",
      c05Lifecycle ? "pass" : "inconclusive",
      "component_damaged, component_disabled and component_damage_resisted are observed",
      `damaged ${combat.componentDamaged}, disabled ${combat.componentDisabled}, resisted ${combat.componentDamageResisted}`,
      "Component lifecycle coverage across the suite",
      c05Lifecycle ? null : "a component lifecycle transition was not observed",
    ),
  );

  const results = metrics.results;
  const c06Methods =
    results.judges > 0 && (results.destruction > 0 || results.immobilisation > 0);
  gates.push(
    gate(
      "C06",
      "coverage",
      c06Methods ? "pass" : "inconclusive",
      "judges and at least one of destruction or immobilisation are observed",
      `judges ${results.judges}, destruction ${results.destruction}, immobilisation ${results.immobilisation}`,
      "Result-method coverage across the suite",
      c06Methods ? null : "judges or a decisive result method was not observed",
    ),
  );

  // ── Slot-order stability gates (pass/inconclusive/fail) ──────────────────

  const mirror = metrics.slotOrder;
  let s01Outcome: ReadinessGateOutcome;
  let s01Reason: string | null = null;
  if (mirror.bulwarkMirrorDecisiveCount < 8) {
    s01Outcome = "inconclusive";
    s01Reason = "fewer than eight Bulwark-mirror matches are decisive";
  } else if (mirror.bulwarkMirrorSlotImbalance <= 0.25) {
    s01Outcome = "pass";
  } else if (mirror.bulwarkMirrorSlotImbalance > 0.5) {
    s01Outcome = "fail";
    s01Reason = "Bulwark-mirror slot imbalance exceeds 0.50";
  } else {
    s01Outcome = "inconclusive";
    s01Reason = "Bulwark-mirror slot imbalance is between 0.25 and 0.50";
  }
  gates.push(
    gate(
      "S01",
      "slot-order-stability",
      s01Outcome,
      "mirror decisive >= 8; abs(A-B)/decisive mirror <= 0.25 pass, > 0.50 fail, else inconclusive",
      `${mirror.bulwarkMirrorDecisiveCount} decisive mirror, imbalance ${mirror.bulwarkMirrorSlotImbalance.toFixed(4)}`,
      "Bulwark-mirror slot-order pathology diagnostic",
      s01Reason,
    ),
  );

  let s02Outcome: ReadinessGateOutcome;
  let s02Reason: string | null = null;
  const s02Ratio = mirror.pairedSlotSensitivityRatio;
  if (s02Ratio <= 0.25) {
    s02Outcome = "pass";
  } else if (s02Ratio > 0.5) {
    s02Outcome = "fail";
    s02Reason = "paired role-swap slot sensitivity exceeds 0.50";
  } else {
    s02Outcome = "inconclusive";
    s02Reason = "paired role-swap slot sensitivity is between 0.25 and 0.50";
  }
  gates.push(
    gate(
      "S02",
      "slot-order-stability",
      s02Outcome,
      "slot-sensitive / all asymmetric paired outcomes <= 0.25 pass, > 0.50 fail, else inconclusive",
      `${mirror.pairedSlotSensitiveComparisons}/${mirror.pairedAsymmetricComparisons} (${s02Ratio.toFixed(4)})`,
      "Paired role-swap slot-order pathology diagnostic",
      s02Reason,
    ),
  );

  let s03Outcome: ReadinessGateOutcome;
  let s03Reason: string | null = null;
  const s03Ratio =
    mirror.decisiveMatches > 0
      ? mirror.absoluteFirstSlotAdvantage / mirror.decisiveMatches
      : 0;
  if (s03Ratio <= 0.2) {
    s03Outcome = "pass";
  } else if (s03Ratio > 0.4) {
    s03Outcome = "fail";
    s03Reason = "overall first-slot advantage exceeds 0.40";
  } else {
    s03Outcome = "inconclusive";
    s03Reason = "overall first-slot advantage is between 0.20 and 0.40";
  }
  gates.push(
    gate(
      "S03",
      "slot-order-stability",
      s03Outcome,
      "abs(A-B)/decisive runs <= 0.20 pass, > 0.40 fail, else inconclusive",
      `${mirror.absoluteFirstSlotAdvantage}/${mirror.decisiveMatches} (${s03Ratio.toFixed(4)})`,
      "Overall first-slot advantage diagnostic",
      s03Reason,
    ),
  );

  // ── Progress gates (pass/inconclusive/fail) ──────────────────────────────

  let p01Outcome: ReadinessGateOutcome;
  let p01Reason: string | null = null;
  if (metrics.attacklessRate <= 0.1) {
    p01Outcome = "pass";
  } else if (metrics.attacklessRate > 0.25) {
    p01Outcome = "fail";
    p01Reason = "attackless rate over non-Sentinel runs exceeds 0.25";
  } else {
    p01Outcome = "inconclusive";
    p01Reason = "attackless rate is between 0.10 and 0.25";
  }
  gates.push(
    gate(
      "P01",
      "progress",
      p01Outcome,
      "attackless rate (non-Sentinel) <= 0.10 pass, > 0.25 fail, else inconclusive",
      metrics.attacklessRate.toFixed(4),
      "Attackless combat matches over non-Sentinel runs",
      p01Reason,
    ),
  );

  let p02Outcome: ReadinessGateOutcome;
  let p02Reason: string | null = null;
  if (metrics.roundCapRate <= 0.75) {
    p02Outcome = "pass";
  } else if (metrics.roundCapRate > 0.95) {
    p02Outcome = "fail";
    p02Reason = "round-cap concentration exceeds 0.95";
  } else {
    p02Outcome = "inconclusive";
    p02Reason = "round-cap concentration is between 0.75 and 0.95";
  }
  gates.push(
    gate(
      "P02",
      "progress",
      p02Outcome,
      "round-cap rate <= 0.75 pass, > 0.95 fail, else inconclusive",
      metrics.roundCapRate.toFixed(4),
      "Round-cap concentration across the suite",
      p02Reason,
    ),
  );

  const anyFail = gates.some((g) => g.outcome === "fail");
  const anyInconclusive = gates.some((g) => g.outcome === "inconclusive");
  return Object.freeze({
    gates: Object.freeze(gates),
    anyFail,
    anyInconclusive,
  });
}
