import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import {
  parseOpponentFixture,
  serializeOpponentFixture,
  serializeOpponentFixtureIdentity,
  type OpponentFixtureIdentityPayloadV1,
} from "../../src/opponents/opponent-fixture.js";
import { RULESET_VERSION } from "../../src/simulator/constants.js";
import {
  GRID_RUNTIME_IDENTITY,
  LEGACY_RUNTIME_IDENTITY,
} from "../../src/simulator/runtime-identity.js";
import { validateBuild } from "../../src/validation/build-validator.js";

/**
 * Test-only synthetic opponent fixture construction (Milestone 0.2D Phase 1).
 *
 * Phase 1 deliberately ships NO canonical opponent fixture; positive tests use
 * synthetic test-only objects. The helper derives the authoritative
 * `validatedBuild` through the production `validateBuild(..., CATALOGUE_V1)`
 * and the canonical `fixtureChecksum` through the production identity
 * serialization, so every produced fixture is semantically valid and its
 * checksum is correct unless a test explicitly overrides it.
 */

export function syntheticBuildProposal(machineName: string): Record<string, unknown> {
  return {
    machineName,
    chassisId: "medium",
    mobilityId: "wheels",
    weaponId: "ram",
    utilityId: "none",
    armour: { front: 40, left: 15, right: 15, rear: 10, top: 5 },
    designSummary: "A synthetic test-only opponent build.",
    designRationale: "A synthetic test-only opponent build within budget.",
  };
}

export function syntheticPolicy(): Record<string, unknown> {
  return {
    opening: "rush",
    preferredRange: "close",
    aggression: 70,
    primaryTarget: "front",
    secondaryTarget: "front",
    retreatThreshold: 20,
    heatThreshold: 85,
    fallback: "defend",
  };
}

export function syntheticRulesetCompatibility(): Record<string, unknown> {
  return {
    rulesetVersion: RULESET_VERSION,
    status: "supported",
  };
}

export function syntheticRuntimeCompatibility(
  overrides: {
    legacyStatus?: "supported" | "incompatible";
    gridStatus?: "supported" | "incompatible";
  } = {},
): Record<string, unknown> {
  return {
    legacy: {
      simulatorVersion: LEGACY_RUNTIME_IDENTITY.simulatorVersion,
      positioningModel: LEGACY_RUNTIME_IDENTITY.positioningModel,
      status: overrides.legacyStatus ?? "supported",
    },
    grid: {
      simulatorVersion: GRID_RUNTIME_IDENTITY.simulatorVersion,
      positioningModel: GRID_RUNTIME_IDENTITY.positioningModel,
      status: overrides.gridStatus ?? "supported",
    },
  };
}

export interface SyntheticOpponentFixtureOverrides {
  readonly opponentId?: string;
  readonly fixtureVersion?: number;
  readonly displayName?: string;
  readonly machineName?: string;
  readonly build?: Record<string, unknown>;
  readonly validatedBuild?: Record<string, unknown>;
  readonly policy?: Record<string, unknown>;
  readonly catalogueVersion?: string;
  readonly rulesetCompatibility?: Record<string, unknown>;
  readonly runtimeCompatibility?: Record<string, unknown>;
  readonly description?: string;
  readonly archetypeIntent?: string;
  readonly fixtureChecksum?: string;
}

/** Builds a full synthetic fixture object (correct checksum by default). */
export function makeSyntheticOpponentFixture(
  overrides: SyntheticOpponentFixtureOverrides = {},
): Record<string, unknown> {
  const opponentId = overrides.opponentId ?? "synthetic";
  const machineName = overrides.machineName ?? "Synthetic";
  const displayName = overrides.displayName ?? machineName;
  const build = overrides.build ?? syntheticBuildProposal(machineName);
  const policy = overrides.policy ?? syntheticPolicy();
  const catalogueVersion = overrides.catalogueVersion ?? CATALOGUE_V1.version;
  const validatedBuild =
    overrides.validatedBuild ??
    (() => {
      const result = validateBuild(
        build as Parameters<typeof validateBuild>[0],
        CATALOGUE_V1,
      );
      if (!result.ok) {
        throw new Error(
          `synthetic fixture build must validate: ${result.errors
            .map((e) => e.message)
            .join("; ")}`,
        );
      }
      return result.build;
    })();
  const rulesetCompatibility =
    overrides.rulesetCompatibility ?? syntheticRulesetCompatibility();
  const runtimeCompatibility =
    overrides.runtimeCompatibility ?? syntheticRuntimeCompatibility();
  const description = overrides.description ?? "A synthetic test-only opponent fixture.";
  const archetypeIntent = overrides.archetypeIntent ?? "frontal pressure";
  const fixtureVersion = overrides.fixtureVersion ?? 1;

  const payload: OpponentFixtureIdentityPayloadV1 = {
    schemaVersion: "1",
    opponentId,
    fixtureVersion,
    displayName,
    build: build as OpponentFixtureIdentityPayloadV1["build"],
    validatedBuild: validatedBuild as OpponentFixtureIdentityPayloadV1["validatedBuild"],
    policy: policy as OpponentFixtureIdentityPayloadV1["policy"],
    catalogueVersion,
    rulesetCompatibility:
      rulesetCompatibility as OpponentFixtureIdentityPayloadV1["rulesetCompatibility"],
    runtimeCompatibility:
      runtimeCompatibility as OpponentFixtureIdentityPayloadV1["runtimeCompatibility"],
    description,
    archetypeIntent,
  };
  const fixtureChecksum =
    overrides.fixtureChecksum ?? sha256Hex(serializeOpponentFixtureIdentity(payload));

  return {
    schemaVersion: "1",
    opponentId,
    fixtureVersion,
    displayName,
    build,
    validatedBuild,
    policy,
    catalogueVersion,
    rulesetCompatibility,
    runtimeCompatibility,
    description,
    archetypeIntent,
    fixtureChecksum,
  };
}

/** Canonical persisted bytes for a synthetic fixture object. */
export function canonicalSyntheticFixtureBytes(fixture: Record<string, unknown>): string {
  const parsed = parseOpponentFixture(fixture, fixture.opponentId as string);
  return serializeOpponentFixture(parsed);
}
