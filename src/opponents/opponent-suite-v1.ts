import { sha256Hex } from "../canary/grid-canary-digest.js";
import { RULESET_VERSION } from "../simulator/constants.js";

/**
 * Frozen canonical opponent-suite definition v1 (Milestone 0.2D Phase 4).
 *
 * ADR-004 defines six conceptual archetype envelopes; Phase 2 (D65) created
 * the six canonical fixtures; D64 frozen the selection. This module freezes
 * the complete suite identity: the exact ordered six opponent IDs, fixture
 * versions, fixture checksums and the exact declared legacy compatibility
 * (from the canonical fixtures' `runtimeCompatibility.legacy.status`).
 *
 * The suite definition includes ALL six fixtures even though only four are
 * runnable in the legacy runtime — the two incompatible fixtures are visible
 * factual suite members with status `incompatible`; they are never silently
 * removed from suite identity.
 *
 * The deterministic suite checksum binds: schema version, suite ID, suite
 * version, the exact ordered six opponent IDs, fixture versions, fixture
 * checksums and the exact declared legacy compatibility. It never includes
 * calculated match outcomes. The checksum is frozen in source and recorded
 * in D70.
 *
 * This module is data/governance only. It never executes a match and never
 * activates a runtime.
 */

export const OPPONENT_SUITE_SCHEMA_VERSION = "1" as const;
export const OPPONENT_SUITE_ID = "canonical-opponent-suite-v1" as const;
export const OPPONENT_SUITE_VERSION = 1 as const;
/** Every canonical suite fixture is fixtureVersion 1. */
export const OPPONENT_SUITE_FIXTURE_VERSION = 1 as const;
/** The only runtime authorised for the Phase 4 development runner. */
export const OPPONENT_SUITE_LEGACY_RUNTIME = "legacy" as const;

/** Exact frozen canonical fixture checksums (D65 evidence anchors). */
export const CANONICAL_OPPONENT_SUITE_V1_FIXTURE_CHECKSUMS: Readonly<{
  bulwark: string;
  skirmisher: string;
  crusher: string;
  spinner: string;
  controller: string;
  generalist: string;
}> = Object.freeze({
  bulwark: "053e61e867d00015371e852dbe571af666cc8ac99a514b2364be323d54a8d987",
  skirmisher: "86e05148c57cabad2e9cf916475462acf7b132d1686904c0e5e197db9c1129cc",
  crusher: "754f8c3a70106f320483f74d52626b56b451885dfc16c777ca8442ceb7f60b6c",
  spinner: "4bde756805abfc9152cd5b64c76fefd26cbc1a2aae9db7ff7a96675b734783b5",
  controller: "d4940517943b440cc68bc7822c85051ff2d864530a13281d16a15ad770bece23",
  generalist: "07c2f77237bcf868e8297c2e5be12c67cd848f9def48c486ee40a58222908172",
});

export type OpponentSuiteLegacyCompatibilityV1 = "supported" | "incompatible";

export interface OpponentSuiteEntryV1 {
  readonly opponentId: string;
  readonly fixtureVersion: number;
  readonly fixtureChecksum: string;
  readonly legacyCompatibility: OpponentSuiteLegacyCompatibilityV1;
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

/**
 * Exact ordered canonical suite members (all six fixtures, including the two
 * legacy-incompatible ones). Order is part of the frozen suite identity and
 * the deterministic suite checksum.
 */
export const CANONICAL_OPPONENT_SUITE_V1: readonly OpponentSuiteEntryV1[] = deepFreeze([
  {
    opponentId: "bulwark",
    fixtureVersion: OPPONENT_SUITE_FIXTURE_VERSION,
    fixtureChecksum: CANONICAL_OPPONENT_SUITE_V1_FIXTURE_CHECKSUMS.bulwark,
    legacyCompatibility: "supported",
  },
  {
    opponentId: "skirmisher",
    fixtureVersion: OPPONENT_SUITE_FIXTURE_VERSION,
    fixtureChecksum: CANONICAL_OPPONENT_SUITE_V1_FIXTURE_CHECKSUMS.skirmisher,
    legacyCompatibility: "incompatible",
  },
  {
    opponentId: "crusher",
    fixtureVersion: OPPONENT_SUITE_FIXTURE_VERSION,
    fixtureChecksum: CANONICAL_OPPONENT_SUITE_V1_FIXTURE_CHECKSUMS.crusher,
    legacyCompatibility: "supported",
  },
  {
    opponentId: "spinner",
    fixtureVersion: OPPONENT_SUITE_FIXTURE_VERSION,
    fixtureChecksum: CANONICAL_OPPONENT_SUITE_V1_FIXTURE_CHECKSUMS.spinner,
    legacyCompatibility: "supported",
  },
  {
    opponentId: "controller",
    fixtureVersion: OPPONENT_SUITE_FIXTURE_VERSION,
    fixtureChecksum: CANONICAL_OPPONENT_SUITE_V1_FIXTURE_CHECKSUMS.controller,
    legacyCompatibility: "incompatible",
  },
  {
    opponentId: "generalist",
    fixtureVersion: OPPONENT_SUITE_FIXTURE_VERSION,
    fixtureChecksum: CANONICAL_OPPONENT_SUITE_V1_FIXTURE_CHECKSUMS.generalist,
    legacyCompatibility: "supported",
  },
]);

/** Exact four legacy-runnable opponent IDs (in plan order). */
export const OPPONENT_SUITE_V1_RUNNABLE_OPPONENT_IDS: readonly string[] = Object.freeze([
  "bulwark",
  "crusher",
  "spinner",
  "generalist",
]);

/** Exact two legacy-incompatible opponent IDs (visible, never executed). */
export const OPPONENT_SUITE_V1_INCOMPATIBLE_OPPONENT_IDS: readonly string[] =
  Object.freeze(["skirmisher", "controller"]);

/** Canonical deterministic suite-identity serialization (checksum input). */
export function serializeOpponentSuiteIdentityV1(): string {
  return JSON.stringify(
    {
      schemaVersion: OPPONENT_SUITE_SCHEMA_VERSION,
      suiteId: OPPONENT_SUITE_ID,
      suiteVersion: OPPONENT_SUITE_VERSION,
      rulesetVersion: RULESET_VERSION,
      opponents: CANONICAL_OPPONENT_SUITE_V1.map((entry) => ({
        opponentId: entry.opponentId,
        fixtureVersion: entry.fixtureVersion,
        fixtureChecksum: entry.fixtureChecksum,
        legacyCompatibility: entry.legacyCompatibility,
      })),
    },
    null,
    2,
  );
}

/**
 * Deterministic SHA-256 suite checksum over the exact canonical suite
 * identity. Binds schema version, suite ID, suite version, ruleset version,
 * the exact ordered six opponent IDs, fixture versions, fixture checksums
 * and the exact declared legacy compatibility. Never includes calculated
 * match outcomes. Frozen at creation; recorded in D70.
 */
export const OPPONENT_SUITE_V1_CHECKSUM =
  "2a276edc8fe6958cb06b0f2a844dd261a878ccf092da238f8ddc2b381c1b8fae" as const;

/** Recomputed checksum over the current canonical suite identity (verifiable). */
export function recomputeOpponentSuiteV1Checksum(): string {
  return sha256Hex(serializeOpponentSuiteIdentityV1());
}
