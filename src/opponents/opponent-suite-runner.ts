import { sha256Hex } from "../canary/grid-canary-digest.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import { RULESET_VERSION } from "../simulator/constants.js";
import { DEFAULT_COMPONENT_QUALIFICATION_ID } from "../simulator/component-qualification-registry.js";
import { LEGACY_RUNTIME_IDENTITY } from "../simulator/runtime-identity.js";
import { runMatch } from "../simulator/simulator.js";
import type { ActionPolicy, MatchConfig, MatchResult } from "../simulator/types.js";
import { serializeOpponentFixture, type OpponentFixtureV1 } from "./opponent-fixture.js";
import { loadOpponentFixture } from "./opponent-fixture-loader.js";
import { assertOpponentFixtureSupportsRuntime } from "./opponent-runtime-compatibility.js";
import type { ValidatedBuild } from "../validation/validation.types.js";
import {
  CANONICAL_OPPONENT_SUITE_V1,
  OPPONENT_SUITE_ID,
  OPPONENT_SUITE_LEGACY_RUNTIME,
  OPPONENT_SUITE_SCHEMA_VERSION,
  OPPONENT_SUITE_V1_CHECKSUM,
  OPPONENT_SUITE_V1_INCOMPATIBLE_OPPONENT_IDS,
  OPPONENT_SUITE_V1_RUNNABLE_OPPONENT_IDS,
  OPPONENT_SUITE_VERSION,
} from "./opponent-suite-v1.js";

/**
 * Development-only legacy opponent-suite runner v1 (Milestone 0.2D Phase 4).
 *
 * ADR-004 does NOT authorise a general grid cross-opponent matrix runner.
 * This runner is LEGACY RUNTIME ONLY: it executes the frozen canonical
 * opponent suite through the unchanged legacy `runMatch` runtime with an
 * explicit runtime contract, respecting explicit fixture compatibility, and
 * produces reproducible factual match outputs.
 *
 * Authorised question (only): can the frozen canonical suite be executed
 * locally and deterministically through the unchanged legacy runtime,
 * respecting explicit fixture compatibility and producing reproducible
 * factual match outputs? This module records factual outcomes only; it makes
 * no aggregate interpretation, no ranking and no tuning recommendation.
 *
 * The runner NEVER touches grid activation/default behaviour, NEVER uses the
 * bounded beta service as a matrix runner, performs NO persistence, and makes
 * NO AI/provider/adaptation calls.
 */

/** Only the legacy runtime is authorised for the Phase 4 runner. */
export type OpponentSuiteRuntimeV1 = "legacy";

/** Fail-closed error for all opponent-suite runner input/execution failures. */
export class OpponentSuiteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpponentSuiteError";
  }
}

/**
 * Explicit runtime guard. `"legacy"` is the only authorised runner runtime;
 * `"grid"` is recognised and rejected as separately unauthorised (ADR-004);
 * any other value fails. There is no ambient/default runtime inference and no
 * fallback. This is intentionally stricter than normal application default
 * behaviour.
 */
export function assertOpponentSuiteRuntime(
  runtime: string,
): asserts runtime is OpponentSuiteRuntimeV1 {
  if (runtime === OPPONENT_SUITE_LEGACY_RUNTIME) return;
  if (runtime === "grid") {
    throw new OpponentSuiteError(
      "general grid opponent-suite execution is not authorised",
    );
  }
  throw new OpponentSuiteError(
    `opponent-suite runtime must be "legacy"; received ${JSON.stringify(runtime)}`,
  );
}

/** Public runner input: explicit runtime (legacy only) plus a caller seed. */
export interface OpponentSuiteRunInputV1 {
  readonly runtime: OpponentSuiteRuntimeV1;
  readonly seed: number;
}

export function assertOpponentSuiteSeed(seed: number): void {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new OpponentSuiteError(
      `opponent-suite seed must be a non-negative safe integer; received ${JSON.stringify(seed)}`,
    );
  }
}

/**
 * Deterministic match ID derived ONLY from: suiteId, suiteVersion, runtime,
 * seed, plan index, fighterA opponentId + fixtureChecksum, fighterB
 * opponentId + fixtureChecksum. Never uses time, random UUIDs, provider IDs
 * or filesystem state. Identical suite input ⇒ identical match ID; reversing
 * roles ⇒ a different match ID.
 */
export function opponentSuiteMatchId(input: {
  readonly suiteId: string;
  readonly suiteVersion: number;
  readonly runtime: string;
  readonly seed: number;
  readonly planIndex: number;
  readonly fighterA: { readonly opponentId: string; readonly fixtureChecksum: string };
  readonly fighterB: { readonly opponentId: string; readonly fixtureChecksum: string };
}): string {
  const hash = sha256Hex(
    JSON.stringify({
      suiteId: input.suiteId,
      suiteVersion: input.suiteVersion,
      runtime: input.runtime,
      seed: input.seed,
      planIndex: input.planIndex,
      fighterA: {
        opponentId: input.fighterA.opponentId,
        fixtureChecksum: input.fighterA.fixtureChecksum,
      },
      fighterB: {
        opponentId: input.fighterB.opponentId,
        fixtureChecksum: input.fighterB.fixtureChecksum,
      },
    }),
  );
  return `opponent-suite-match-v1:${hash}`;
}

/**
 * Generic opponent-suite result checksum over the COMPLETE returned legacy
 * MatchResult (exact deterministic serialization). Deliberately NOT the
 * grid-beta-specific checksum. Binds all returned simulator facts.
 */
export function opponentSuiteResultChecksum(result: MatchResult): string {
  return sha256Hex(JSON.stringify(result));
}

/** Exact frozen ordered legacy matchup plan (12 entries, no self matches). */
export interface OpponentSuitePlanEntryV1 {
  readonly planIndex: number;
  readonly fighterA: string;
  readonly fighterB: string;
}

function buildLegacyPlan(): OpponentSuitePlanEntryV1[] {
  const plan: OpponentSuitePlanEntryV1[] = [];
  const ids = OPPONENT_SUITE_V1_RUNNABLE_OPPONENT_IDS;
  for (let i = 0; i < ids.length; i++) {
    for (let j = 0; j < ids.length; j++) {
      if (i === j) continue;
      plan.push(
        Object.freeze({
          planIndex: plan.length + 1,
          fighterA: ids[i]!,
          fighterB: ids[j]!,
        }),
      );
    }
  }
  return plan;
}

/** Frozen exact 12-entry ordered plan (deterministic, role-aware). */
export const OPPONENT_SUITE_V1_LEGACY_PLAN: readonly OpponentSuitePlanEntryV1[] =
  Object.freeze(buildLegacyPlan());

/**
 * Number of internal deterministic simulator executions per caller seed:
 * every planned matchup runs exactly twice (primary + repeat) as a
 * determinism guard. 12 planned matchups ⇒ 24 internal executions. Pure
 * bookkeeping only — the runner never exposes a simulator-injection seam.
 */
export function opponentSuiteInternalExecutionCount(): number {
  return OPPONENT_SUITE_V1_LEGACY_PLAN.length * 2;
}

export interface OpponentSuiteFixtureInventoryEntryV1 {
  readonly opponentId: string;
  readonly fixtureVersion: number;
  readonly fixtureChecksum: string;
  readonly legacyCompatibility: "supported" | "incompatible";
}

export interface OpponentSuiteMatchEntryV1 {
  readonly matchId: string;
  readonly planIndex: number;
  readonly fighterA: {
    readonly opponentId: string;
    readonly fixtureVersion: number;
    readonly fixtureChecksum: string;
  };
  readonly fighterB: {
    readonly opponentId: string;
    readonly fixtureVersion: number;
    readonly fixtureChecksum: string;
  };
  readonly runtime: {
    readonly simulatorVersion: string;
    readonly positioningModel: string;
  };
  readonly seed: number;
  /** Canonical opponent ID, or null for a draw. Never "fighter_a"/"fighter_b". */
  readonly winner: string | null;
  readonly method: string;
  readonly rounds: number;
  readonly resultChecksum: string;
}

export interface OpponentSuiteRunV1 {
  readonly schemaVersion: "1";
  readonly suiteId: string;
  readonly suiteVersion: number;
  readonly suiteChecksum: string;
  readonly runtime: {
    readonly simulatorVersion: string;
    readonly positioningModel: string;
  };
  readonly seed: number;
  readonly fixtureInventory: readonly OpponentSuiteFixtureInventoryEntryV1[];
  readonly runnableOpponentIds: readonly string[];
  readonly incompatibleOpponentIds: readonly string[];
  readonly matches: readonly OpponentSuiteMatchEntryV1[];
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

/** Exact deterministic comparison of the facts that must not differ. */
function deterministicFacts(result: MatchResult): string {
  return JSON.stringify({
    runtime: result.runtime,
    config: result.config,
    initialState: result.initialState,
    events: result.events,
    result: result.result,
    rounds: result.rounds,
  });
}

function mapWinner(
  result: MatchResult,
  fighterA: OpponentSuiteMatchEntryV1["fighterA"],
  fighterB: OpponentSuiteMatchEntryV1["fighterB"],
): string | null {
  if (result.result.winner === "fighter_a") return fighterA.opponentId;
  if (result.result.winner === "fighter_b") return fighterB.opponentId;
  if (result.result.winner === null) return null;
  throw new OpponentSuiteError(
    `unexpected simulator winner identity ${JSON.stringify(result.result.winner)}`,
  );
}

/**
 * Fresh complete `ValidatedBuild` execution clone (execution isolation only).
 *
 * Every primary and repeat execution receives its own complete build graph
 * (proposal, armour and derived fields), reference-distinct from the deeply
 * frozen canonical fixture build and from every other execution graph. Values
 * are copied exactly — never re-validated, never changed, no derived totals,
 * and the canonical fixture build is never used as an optimisation input.
 */
function cloneValidatedBuildForExecution(build: ValidatedBuild): ValidatedBuild {
  return {
    proposal: {
      machineName: build.proposal.machineName,
      chassisId: build.proposal.chassisId,
      mobilityId: build.proposal.mobilityId,
      weaponId: build.proposal.weaponId,
      utilityId: build.proposal.utilityId,
      armour: {
        front: build.proposal.armour.front,
        left: build.proposal.armour.left,
        right: build.proposal.armour.right,
        rear: build.proposal.armour.rear,
        top: build.proposal.armour.top,
      },
      designSummary: build.proposal.designSummary,
      designRationale: build.proposal.designRationale,
    },
    totalCost: build.totalCost,
    armourCost: build.armourCost,
    totalArmourPoints: build.totalArmourPoints,
    catalogueVersion: build.catalogueVersion,
  };
}

/**
 * Fresh complete policy execution clone. The `ActionPolicy` is flat; every
 * authoritative field is copied exactly so the execution policy is deep-equal
 * to, but reference-distinct from, the canonical fixture policy. The
 * canonical policy is never mutated.
 */
function cloneActionPolicyForExecution(policy: ActionPolicy): ActionPolicy {
  return {
    opening: policy.opening,
    preferredRange: policy.preferredRange,
    aggression: policy.aggression,
    primaryTarget: policy.primaryTarget,
    secondaryTarget: policy.secondaryTarget,
    retreatThreshold: policy.retreatThreshold,
    heatThreshold: policy.heatThreshold,
    fallback: policy.fallback,
  };
}

/**
 * Builds one independent fresh `MatchConfig` graph for a matchup. Every call
 * returns a completely new object graph: outer config, fighterA/fighterB,
 * execution build clones (including proposal and armour) and execution policy
 * clones — all reference-distinct from the canonical fixture graphs and from
 * every other returned config. Values deep-equal the canonical fixture
 * values exactly. Public narrowly-scoped pure helper used by the runner and
 * by reference-isolation tests; no filesystem/root/provider/runtime
 * substitution is exposed.
 */
export function buildOpponentSuiteMatchConfig(
  fixtureA: OpponentFixtureV1,
  fixtureB: OpponentFixtureV1,
  seed: number,
): MatchConfig {
  return {
    seed,
    fighterA: {
      build: cloneValidatedBuildForExecution(fixtureA.validatedBuild),
      policy: cloneActionPolicyForExecution(fixtureA.policy),
    },
    fighterB: {
      build: cloneValidatedBuildForExecution(fixtureB.validatedBuild),
      policy: cloneActionPolicyForExecution(fixtureB.policy),
    },
    rulesetVersion: RULESET_VERSION,
    catalogueVersion: CATALOGUE_V1.version,
    componentQualificationId: DEFAULT_COMPONENT_QUALIFICATION_ID,
  };
}

/**
 * Executes the full legacy opponent suite for one caller seed.
 *
 * Loads all six canonical fixtures through the reviewed fixed-root production
 * loader and validates each against the frozen suite anchor (opponentId,
 * fixtureVersion = 1, exact fixtureChecksum, ruleset supported, persisted
 * fixture validation). The two legacy-incompatible fixtures are visible
 * factual suite members with status `incompatible`: they are never executed,
 * translated, fallen back, silently omitted or counted as losses/draws, and
 * they do not fail the valid legacy suite. An unexpected compatibility state,
 * missing fixture, checksum mismatch or validation failure fails the complete
 * invocation closed.
 *
 * The four compatible fixtures are executed through the unchanged legacy
 * `runMatch` exactly twice per matchup (primary + repeat) with independent
 * fresh MatchConfig object graphs — every call clones the complete
 * build/policy graphs, so primary and repeat never share a canonical fixture
 * reference — requiring exact deterministic equality across runtime/resolved
 * config/initial state/ordered events/result/rounds and identical result
 * checksums. Any difference fails the entire suite run. Only one factual
 * match entry is returned per matchup (12 planned, 24 internal executions
 * per seed). Canonical fixture state is verified unchanged before and after
 * execution.
 */
export async function runOpponentSuite(
  input: OpponentSuiteRunInputV1,
): Promise<OpponentSuiteRunV1> {
  assertOpponentSuiteRuntime(input.runtime);
  assertOpponentSuiteSeed(input.seed);
  const runtime: OpponentSuiteRuntimeV1 = "legacy";

  // 1. Load all six canonical fixtures via the reviewed fixed-root loader and
  //    verify each against the frozen suite anchor.
  const loaded = new Map<string, OpponentFixtureV1>();
  const inventory: OpponentSuiteFixtureInventoryEntryV1[] = [];
  for (const entry of CANONICAL_OPPONENT_SUITE_V1) {
    const fixture = await loadOpponentFixture(entry.opponentId, entry.fixtureVersion);
    if (fixture.opponentId !== entry.opponentId) {
      throw new OpponentSuiteError(
        `canonical fixture opponentId mismatch: expected ${entry.opponentId}, received ${fixture.opponentId}`,
      );
    }
    if (fixture.fixtureVersion !== entry.fixtureVersion) {
      throw new OpponentSuiteError(
        `canonical fixture ${entry.opponentId} fixtureVersion mismatch: expected ${entry.fixtureVersion}, received ${fixture.fixtureVersion}`,
      );
    }
    if (fixture.fixtureChecksum !== entry.fixtureChecksum) {
      throw new OpponentSuiteError(
        `canonical fixture ${entry.opponentId} fixtureChecksum mismatch: expected ${entry.fixtureChecksum}, received ${fixture.fixtureChecksum}`,
      );
    }
    if (
      fixture.rulesetCompatibility.rulesetVersion !== RULESET_VERSION ||
      fixture.rulesetCompatibility.status !== "supported"
    ) {
      throw new OpponentSuiteError(
        `canonical fixture ${entry.opponentId} does not declare supported ruleset ${RULESET_VERSION}`,
      );
    }
    const declared = fixture.runtimeCompatibility.legacy.status;
    if (declared !== entry.legacyCompatibility) {
      throw new OpponentSuiteError(
        `canonical fixture ${entry.opponentId} legacy compatibility mismatch: suite declares ${entry.legacyCompatibility}, fixture declares ${declared}`,
      );
    }
    if (entry.legacyCompatibility === "supported") {
      // Existing runtime compatibility gate (fails closed if not supported).
      assertOpponentFixtureSupportsRuntime(fixture, "legacy");
    }
    loaded.set(entry.opponentId, fixture);
    inventory.push({
      opponentId: entry.opponentId,
      fixtureVersion: entry.fixtureVersion,
      fixtureChecksum: entry.fixtureChecksum,
      legacyCompatibility: entry.legacyCompatibility,
    });
  }

  // 2. Canonical fixture immutability snapshot (before execution).
  const beforeBytes = new Map<string, string>();
  const beforeChecksums = new Map<string, string>();
  for (const fixture of loaded.values()) {
    beforeBytes.set(fixture.opponentId, serializeOpponentFixture(fixture));
    beforeChecksums.set(fixture.opponentId, fixture.fixtureChecksum);
  }

  // 3. Execute the exact 12-entry plan (primary + repeat determinism guard).
  const matches: OpponentSuiteMatchEntryV1[] = [];
  for (const plan of OPPONENT_SUITE_V1_LEGACY_PLAN) {
    const fixtureA = loaded.get(plan.fighterA);
    const fixtureB = loaded.get(plan.fighterB);
    if (!fixtureA || !fixtureB) {
      throw new OpponentSuiteError(
        `planned matchup references a non-runnable opponent: ${plan.fighterA} vs ${plan.fighterB}`,
      );
    }
    const fighterA = {
      opponentId: fixtureA.opponentId,
      fixtureVersion: fixtureA.fixtureVersion,
      fixtureChecksum: fixtureA.fixtureChecksum,
    };
    const fighterB = {
      opponentId: fixtureB.opponentId,
      fixtureVersion: fixtureB.fixtureVersion,
      fixtureChecksum: fixtureB.fixtureChecksum,
    };
    // Independent fresh MatchConfig object graphs for primary and repeat:
    // every call clones complete build/policy graphs, so no canonical
    // fixture reference is ever shared between the two executions.
    const primary = runMatch(
      buildOpponentSuiteMatchConfig(fixtureA, fixtureB, input.seed),
    );
    const repeat = runMatch(
      buildOpponentSuiteMatchConfig(fixtureA, fixtureB, input.seed),
    );
    if (deterministicFacts(primary) !== deterministicFacts(repeat)) {
      throw new OpponentSuiteError(
        `primary/repeat determinism failure at plan index ${plan.planIndex} (${plan.fighterA} vs ${plan.fighterB})`,
      );
    }
    if (opponentSuiteResultChecksum(primary) !== opponentSuiteResultChecksum(repeat)) {
      throw new OpponentSuiteError(
        `primary/repeat result checksum mismatch at plan index ${plan.planIndex} (${plan.fighterA} vs ${plan.fighterB})`,
      );
    }
    const matchId = opponentSuiteMatchId({
      suiteId: OPPONENT_SUITE_ID,
      suiteVersion: OPPONENT_SUITE_VERSION,
      runtime,
      seed: input.seed,
      planIndex: plan.planIndex,
      fighterA,
      fighterB,
    });
    matches.push({
      matchId,
      planIndex: plan.planIndex,
      fighterA,
      fighterB,
      runtime: { ...LEGACY_RUNTIME_IDENTITY },
      seed: input.seed,
      winner: mapWinner(primary, fighterA, fighterB),
      method: primary.result.method,
      rounds: primary.rounds,
      resultChecksum: opponentSuiteResultChecksum(primary),
    });
  }

  // 4. Canonical fixture immutability verification (after execution).
  for (const fixture of loaded.values()) {
    if (serializeOpponentFixture(fixture) !== beforeBytes.get(fixture.opponentId)) {
      throw new OpponentSuiteError(
        `canonical fixture ${fixture.opponentId} serialized bytes changed during suite execution`,
      );
    }
    if (fixture.fixtureChecksum !== beforeChecksums.get(fixture.opponentId)) {
      throw new OpponentSuiteError(
        `canonical fixture ${fixture.opponentId} fixtureChecksum changed during suite execution`,
      );
    }
  }

  const result: OpponentSuiteRunV1 = {
    schemaVersion: OPPONENT_SUITE_SCHEMA_VERSION,
    suiteId: OPPONENT_SUITE_ID,
    suiteVersion: OPPONENT_SUITE_VERSION,
    suiteChecksum: OPPONENT_SUITE_V1_CHECKSUM,
    runtime: { ...LEGACY_RUNTIME_IDENTITY },
    seed: input.seed,
    fixtureInventory: inventory,
    runnableOpponentIds: [...OPPONENT_SUITE_V1_RUNNABLE_OPPONENT_IDS],
    incompatibleOpponentIds: [...OPPONENT_SUITE_V1_INCOMPATIBLE_OPPONENT_IDS],
    matches,
  };
  return deepFreeze(result);
}

/** Deterministic JSON serialization of a suite run (CLI output bytes). */
export function formatOpponentSuiteRunV1(run: OpponentSuiteRunV1): string {
  return JSON.stringify(run, null, 2);
}
