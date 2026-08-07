import { z } from "zod";
import { sha256Hex } from "../canary/grid-canary-digest.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import { machineBuildProposalSchema } from "../schemas/build.schema.js";
import { actionPolicySchema } from "../schemas/policy.schema.js";
import { sanitizeName, sanitizeTerminalText } from "../shared/text-sanitise.js";
import { RULESET_VERSION } from "../simulator/constants.js";
import {
  GRID_RUNTIME_IDENTITY,
  LEGACY_RUNTIME_IDENTITY,
} from "../simulator/runtime-identity.js";
import type { ActionPolicy } from "../simulator/types.js";
import { validateBuild } from "../validation/build-validator.js";
import type {
  MachineBuildProposal,
  ValidatedBuild,
} from "../validation/validation.types.js";

/**
 * Generic opponent fixture schema v1 (Milestone 0.2D Phase 1).
 *
 * `OPPONENT_FIXTURE_SCHEMA_VERSION = "1"` defines the immutable, versioned,
 * runtime-neutral opponent identity contract from ADR-004. A fixture carries
 * the authoritative `build` proposal, the COMPLETE authoritative
 * `validatedBuild` snapshot produced by `validateBuild(build, CATALOGUE_V1)`,
 * the authoritative `policy`, explicit `rulesetCompatibility` bound to the
 * canonical `RULESET_VERSION`, explicit `runtimeCompatibility` bound to the
 * frozen `LEGACY_RUNTIME_IDENTITY`/`GRID_RUNTIME_IDENTITY`, and a deterministic
 * SHA-256 `fixtureChecksum` over the canonical identity serialization.
 *
 * The global build/policy Zod schemas are intentionally NOT strict at every
 * nested level, and they are not modified for this milestone. Instead the
 * fixture boundary enforces strictness itself: an exact-key preflight rejects
 * unknown fields at the fixture top level, build, build.armour, policy,
 * ruleset/runtime compatibility and the persisted validated-build snapshot
 * BEFORE the authoritative schemas run. No unknown authoritative field is
 * silently stripped. Value/enum/budget validation remains fully
 * authoritative (the build/policy schemas and `validateBuild`).
 *
 * Loading a fixture NEVER activates a runtime and NEVER executes a match;
 * compatibility is data only.
 */

export const OPPONENT_FIXTURE_SCHEMA_VERSION = "1" as const;
export const OPPONENT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export const OPPONENT_FIXTURE_MAX_JSON_BYTES = 1024 * 1024;
export const OPPONENT_FIXTURE_MAX_DISPLAY_NAME_LENGTH = 20;
export const OPPONENT_FIXTURE_MAX_DESCRIPTION_LENGTH = 500;
export const OPPONENT_FIXTURE_MAX_ARCHETYPE_INTENT_LENGTH = 200;
export const OPPONENT_FIXTURE_RULESET_STATUS = "supported" as const;
export const OPPONENT_FIXTURE_RUNTIME_STATUS = ["supported", "incompatible"] as const;

/** Canonical future fixture filename: `<opponentId>.v<fixtureVersion>.json`. */
export function opponentFixtureFileName(
  opponentId: string,
  fixtureVersion: number,
): string {
  return `${opponentId}.v${fixtureVersion}.json`;
}

/** Error for all opponent fixture input/schema/binding failures. */
export class OpponentFixtureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpponentFixtureError";
  }
}

export const opponentRulesetCompatibilityV1Schema = z
  .object({
    rulesetVersion: z.literal(RULESET_VERSION),
    status: z.literal(OPPONENT_FIXTURE_RULESET_STATUS),
  })
  .strict();

export const opponentLegacyRuntimeCompatibilityV1Schema = z
  .object({
    simulatorVersion: z.literal(LEGACY_RUNTIME_IDENTITY.simulatorVersion),
    positioningModel: z.literal(LEGACY_RUNTIME_IDENTITY.positioningModel),
    status: z.enum(OPPONENT_FIXTURE_RUNTIME_STATUS),
  })
  .strict();

export const opponentGridRuntimeCompatibilityV1Schema = z
  .object({
    simulatorVersion: z.literal(GRID_RUNTIME_IDENTITY.simulatorVersion),
    positioningModel: z.literal(GRID_RUNTIME_IDENTITY.positioningModel),
    status: z.enum(OPPONENT_FIXTURE_RUNTIME_STATUS),
  })
  .strict();

export const opponentRuntimeCompatibilityV1Schema = z
  .object({
    legacy: opponentLegacyRuntimeCompatibilityV1Schema,
    grid: opponentGridRuntimeCompatibilityV1Schema,
  })
  .strict();

/** Complete authoritative derived build snapshot (persisted form). */
export const opponentValidatedBuildV1Schema = z
  .object({
    proposal: machineBuildProposalSchema,
    totalCost: z.number().int().nonnegative(),
    armourCost: z.number().int().nonnegative(),
    totalArmourPoints: z.number().int().nonnegative(),
    catalogueVersion: z.string(),
  })
  .strict();

export const opponentFixtureV1Schema = z
  .object({
    schemaVersion: z.literal(OPPONENT_FIXTURE_SCHEMA_VERSION),
    opponentId: z.string().regex(OPPONENT_ID_PATTERN),
    fixtureVersion: z.number().int().positive(),
    displayName: z.string().min(1).max(OPPONENT_FIXTURE_MAX_DISPLAY_NAME_LENGTH),
    build: machineBuildProposalSchema,
    validatedBuild: opponentValidatedBuildV1Schema,
    policy: actionPolicySchema,
    catalogueVersion: z.string(),
    rulesetCompatibility: opponentRulesetCompatibilityV1Schema,
    runtimeCompatibility: opponentRuntimeCompatibilityV1Schema,
    description: z.string().min(1).max(OPPONENT_FIXTURE_MAX_DESCRIPTION_LENGTH),
    archetypeIntent: z.string().min(1).max(OPPONENT_FIXTURE_MAX_ARCHETYPE_INTENT_LENGTH),
    fixtureChecksum: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

export interface OpponentFixtureRulesetCompatibilityV1 {
  readonly rulesetVersion: "0.2.0";
  readonly status: "supported";
}

export interface OpponentFixtureRuntimeEntryCompatibilityV1 {
  readonly simulatorVersion: string;
  readonly positioningModel: string;
  readonly status: "supported" | "incompatible";
}

export interface OpponentFixtureRuntimeCompatibilityV1 {
  readonly legacy: OpponentFixtureRuntimeEntryCompatibilityV1;
  readonly grid: OpponentFixtureRuntimeEntryCompatibilityV1;
}

/** The complete validated opponent fixture (deeply frozen after parsing). */
export interface OpponentFixtureV1 {
  readonly schemaVersion: "1";
  readonly opponentId: string;
  readonly fixtureVersion: number;
  readonly displayName: string;
  readonly build: MachineBuildProposal;
  readonly validatedBuild: ValidatedBuild;
  readonly policy: ActionPolicy;
  readonly catalogueVersion: string;
  readonly rulesetCompatibility: OpponentFixtureRulesetCompatibilityV1;
  readonly runtimeCompatibility: OpponentFixtureRuntimeCompatibilityV1;
  readonly description: string;
  readonly archetypeIntent: string;
  readonly fixtureChecksum: string;
}

/**
 * The canonical identity payload: every authoritative fixture field except
 * `fixtureChecksum`. The COMPLETE authoritative `validatedBuild` is
 * represented (never a subset of derived fields).
 */
export interface OpponentFixtureIdentityPayloadV1 {
  readonly schemaVersion: "1";
  readonly opponentId: string;
  readonly fixtureVersion: number;
  readonly displayName: string;
  readonly build: MachineBuildProposal;
  readonly validatedBuild: ValidatedBuild;
  readonly policy: ActionPolicy;
  readonly catalogueVersion: string;
  readonly rulesetCompatibility: OpponentFixtureRulesetCompatibilityV1;
  readonly runtimeCompatibility: OpponentFixtureRuntimeCompatibilityV1;
  readonly description: string;
  readonly archetypeIntent: string;
}

/** Rejects path-like, traversal, URL, drive and encoded-traversal identifiers. */
export function assertOpponentFixtureIdentifier(opponentId: string): void {
  if (!OPPONENT_ID_PATTERN.test(opponentId)) {
    throw new OpponentFixtureError(
      `opponent identifier must match ${String(OPPONENT_ID_PATTERN)}; received ${JSON.stringify(opponentId)}`,
    );
  }
  if (
    opponentId.includes("/") ||
    opponentId.includes("\\") ||
    opponentId.includes("..") ||
    opponentId.includes(":") ||
    opponentId.includes("%") ||
    opponentId.includes("\u0000")
  ) {
    throw new OpponentFixtureError(
      "opponent identifier must not contain path, traversal, URL, drive or encoded characters",
    );
  }
}

const FIXTURE_KEYS = new Set([
  "schemaVersion",
  "opponentId",
  "fixtureVersion",
  "displayName",
  "build",
  "validatedBuild",
  "policy",
  "catalogueVersion",
  "rulesetCompatibility",
  "runtimeCompatibility",
  "description",
  "archetypeIntent",
  "fixtureChecksum",
]);
const BUILD_KEYS = new Set([
  "machineName",
  "chassisId",
  "mobilityId",
  "weaponId",
  "utilityId",
  "armour",
  "designSummary",
  "designRationale",
]);
const ARMOUR_KEYS = new Set(["front", "left", "right", "rear", "top"]);
const POLICY_KEYS = new Set([
  "opening",
  "preferredRange",
  "aggression",
  "primaryTarget",
  "secondaryTarget",
  "retreatThreshold",
  "heatThreshold",
  "fallback",
]);
const VALIDATED_BUILD_KEYS = new Set([
  "proposal",
  "totalCost",
  "armourCost",
  "totalArmourPoints",
  "catalogueVersion",
]);
const RULESET_COMPAT_KEYS = new Set(["rulesetVersion", "status"]);
const RUNTIME_COMPAT_KEYS = new Set(["legacy", "grid"]);
const RUNTIME_ENTRY_KEYS = new Set(["simulatorVersion", "positioningModel", "status"]);

/**
 * Exact-key preflight: `value` must be a plain object and every key must be
 * in `allowed`. This is the opponent-fixture strictness boundary; unknown
 * authoritative fields are rejected here and never reach (or get stripped by)
 * the non-strict global schemas.
 */
export function assertExactKeys(
  value: unknown,
  allowed: ReadonlySet<string>,
  where: string,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new OpponentFixtureError(
      `${where} must be a plain object (found ${value === null ? "null" : Array.isArray(value) ? "array" : typeof value})`,
    );
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new OpponentFixtureError(
        `${where} must not contain unknown field ${JSON.stringify(key)}`,
      );
    }
  }
}

/**
 * Deterministic recursive object-key ordering used by both the identity
 * serialization and the canonical persisted serialization. Object keys are
 * sorted at every level; array order remains authoritative and is preserved.
 * No timestamps, random IDs or environment-dependent fields exist.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      out[key] = canonicalize(source[key]);
    }
    return out;
  }
  return value;
}

/** Structural deep equality (key-order independent, array order sensitive). */
export function opponentFixtureDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!opponentFixtureDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as Record<string, unknown>).sort();
    const bKeys = Object.keys(b as Record<string, unknown>).sort();
    if (aKeys.length !== bKeys.length) return false;
    for (let i = 0; i < aKeys.length; i++) {
      const aKey = aKeys[i];
      const bKey = bKeys[i];
      if (aKey === undefined || bKey === undefined || aKey !== bKey) return false;
      if (
        !opponentFixtureDeepEqual(
          (a as Record<string, unknown>)[aKey],
          (b as Record<string, unknown>)[bKey],
        )
      ) {
        return false;
      }
    }
    return true;
  }
  return false;
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

/** Extracts the canonical identity payload (all fields except fixtureChecksum). */
export function extractOpponentFixtureIdentityPayload(
  fixture: OpponentFixtureV1,
): OpponentFixtureIdentityPayloadV1 {
  return {
    schemaVersion: fixture.schemaVersion,
    opponentId: fixture.opponentId,
    fixtureVersion: fixture.fixtureVersion,
    displayName: fixture.displayName,
    build: fixture.build,
    validatedBuild: fixture.validatedBuild,
    policy: fixture.policy,
    catalogueVersion: fixture.catalogueVersion,
    rulesetCompatibility: fixture.rulesetCompatibility,
    runtimeCompatibility: fixture.runtimeCompatibility,
    description: fixture.description,
    archetypeIntent: fixture.archetypeIntent,
  };
}

/** Canonical serialization of the identity payload (deterministic ordering). */
export function serializeOpponentFixtureIdentity(
  payload: OpponentFixtureIdentityPayloadV1,
): string {
  return JSON.stringify(canonicalize(payload), null, 2);
}

/**
 * Deterministic SHA-256 fixture checksum over the canonical identity
 * serialization. `fixtureChecksum` is deliberately NOT included in its own
 * checksum input.
 */
export function opponentFixtureChecksum(fixture: OpponentFixtureV1): string {
  return sha256Hex(
    serializeOpponentFixtureIdentity(extractOpponentFixtureIdentityPayload(fixture)),
  );
}

/**
 * Canonical persisted serialization of the complete fixture (all fields
 * including `fixtureChecksum`) with fixed deterministic key ordering and
 * formatting. A valid fixture file must already equal this byte-for-byte.
 */
export function serializeOpponentFixture(fixture: OpponentFixtureV1): string {
  return JSON.stringify(canonicalize(fixture), null, 2);
}

/**
 * Exact-key preflight for a complete build proposal. The fixture `build` and
 * the persisted `validatedBuild.proposal` are structurally identical build
 * proposals, so both MUST receive identical nested strictness: the build
 * proposal key set AND the nested armour key set. Reusing one helper for both
 * locations prevents the two authoritative build-proposal copies from
 * drifting apart in strictness later.
 */
function assertExactBuildProposalKeys(
  value: unknown,
  where: string,
): asserts value is Record<string, unknown> {
  assertExactKeys(value, BUILD_KEYS, where);
  assertExactKeys(value.armour, ARMOUR_KEYS, `${where}.armour`);
}

/**
 * Parses and validates an opponent fixture from raw JSON.
 *
 * Strictness: unknown fields are rejected at every object level (top level,
 * build, build.armour, policy, ruleset compatibility, runtime compatibility,
 * the persisted validated-build snapshot and validatedBuild.proposal.armour)
 * by the exact-key preflight, so the authoritative non-strict schemas never
 * silently strip an unknown field.
 *
 * Binding: `build` passes through the authoritative `validateBuild(...,
 * CATALOGUE_V1)`; the persisted `validatedBuild` must equal the COMPLETE
 * returned authoritative build; `catalogueVersion` must equal
 * `CATALOGUE_V1.version`; the ruleset identity must equal `RULESET_VERSION`;
 * both runtime entries must match the frozen canonical identities and at
 * least one must be `supported`; the persisted `fixtureChecksum` must equal
 * the recomputed canonical checksum.
 *
 * The returned fixture is deeply frozen. Loading never activates a runtime
 * and never executes a match.
 */
export function parseOpponentFixture(
  raw: unknown,
  expectedOpponentId: string,
): OpponentFixtureV1 {
  // 1. Exact-key preflight at every object level (the strictness boundary).
  assertExactKeys(raw, FIXTURE_KEYS, "opponent fixture");
  const data = raw;
  // `build` and `validatedBuild.proposal` receive identical nested-armour
  // strictness through the shared build-proposal preflight helper.
  assertExactBuildProposalKeys(data.build, "fixture build");
  assertExactKeys(data.policy, POLICY_KEYS, "fixture policy");
  assertExactKeys(data.validatedBuild, VALIDATED_BUILD_KEYS, "fixture validatedBuild");
  assertExactBuildProposalKeys(
    data.validatedBuild.proposal,
    "fixture validatedBuild.proposal",
  );
  assertExactKeys(
    data.rulesetCompatibility,
    RULESET_COMPAT_KEYS,
    "fixture rulesetCompatibility",
  );
  assertExactKeys(
    data.runtimeCompatibility,
    RUNTIME_COMPAT_KEYS,
    "fixture runtimeCompatibility",
  );
  assertExactKeys(
    data.runtimeCompatibility.legacy,
    RUNTIME_ENTRY_KEYS,
    "fixture runtimeCompatibility.legacy",
  );
  assertExactKeys(
    data.runtimeCompatibility.grid,
    RUNTIME_ENTRY_KEYS,
    "fixture runtimeCompatibility.grid",
  );

  // 2. Authoritative schema parse (types, enums and values stay authoritative).
  const parsed = opponentFixtureV1Schema.safeParse(raw);
  if (!parsed.success) {
    throw new OpponentFixtureError(
      `opponent fixture failed its authoritative schema: ${parsed.error.message}`,
    );
  }
  const input = parsed.data;

  // 3. Identifier binding.
  if (input.opponentId !== expectedOpponentId) {
    throw new OpponentFixtureError(
      `opponent fixture opponentId ${JSON.stringify(input.opponentId)} must equal the requested identifier ${JSON.stringify(expectedOpponentId)}`,
    );
  }

  // 4. Text safety (existing terminal sanitisation rules).
  if (sanitizeTerminalText(input.displayName) !== input.displayName) {
    throw new OpponentFixtureError(
      "opponent fixture displayName must already pass text sanitisation",
    );
  }
  if (sanitizeName(input.displayName) !== sanitizeName(input.build.machineName)) {
    throw new OpponentFixtureError(
      "opponent fixture displayName must agree with the build proposal machine name",
    );
  }
  if (sanitizeTerminalText(input.description) !== input.description) {
    throw new OpponentFixtureError(
      "opponent fixture description must already pass text sanitisation",
    );
  }
  if (sanitizeTerminalText(input.archetypeIntent) !== input.archetypeIntent) {
    throw new OpponentFixtureError(
      "opponent fixture archetypeIntent must already pass text sanitisation",
    );
  }

  // 5. Catalogue version binding.
  if (input.catalogueVersion !== CATALOGUE_V1.version) {
    throw new OpponentFixtureError(
      `opponent fixture catalogueVersion ${JSON.stringify(input.catalogueVersion)} must equal the canonical catalogue version ${JSON.stringify(CATALOGUE_V1.version)}`,
    );
  }

  // 6. Authoritative budget/catalogue validation of the build.
  const buildResult = validateBuild(input.build, CATALOGUE_V1);
  if (!buildResult.ok) {
    throw new OpponentFixtureError(
      `opponent fixture build proposal failed the authoritative catalogue-v1 validator: ${buildResult.errors.map((e) => e.message).join("; ")}`,
    );
  }

  // 7. Complete persisted validated-build binding (no subset comparison, no
  // hand-computed cost logic).
  if (!opponentFixtureDeepEqual(buildResult.build, input.validatedBuild)) {
    throw new OpponentFixtureError(
      "opponent fixture persisted validatedBuild must equal the complete authoritative catalogue-v1 validated build",
    );
  }
  if (input.validatedBuild.catalogueVersion !== CATALOGUE_V1.version) {
    throw new OpponentFixtureError(
      "opponent fixture persisted validatedBuild catalogueVersion must equal the canonical catalogue version",
    );
  }

  // 8. At least one runtime must be supported; compatibility is data only and
  // never inferred from the policy contents.
  if (
    input.runtimeCompatibility.legacy.status !== "supported" &&
    input.runtimeCompatibility.grid.status !== "supported"
  ) {
    throw new OpponentFixtureError(
      "opponent fixture must declare at least one runtime as supported",
    );
  }

  // 9. Checksum binding over the canonical identity payload.
  const fixture = deepFreeze<OpponentFixtureV1>(input as unknown as OpponentFixtureV1);
  const computed = opponentFixtureChecksum(fixture);
  if (computed !== input.fixtureChecksum) {
    throw new OpponentFixtureError(
      "opponent fixture fixtureChecksum does not match the canonical identity checksum",
    );
  }

  return fixture;
}
