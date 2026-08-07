import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import { loadOpponentFixture } from "../../src/opponents/opponent-fixture-loader.js";
import {
  CANONICAL_OPPONENT_SUITE_V1,
  CANONICAL_OPPONENT_SUITE_V1_FIXTURE_CHECKSUMS,
  OPPONENT_SUITE_ID,
  OPPONENT_SUITE_SCHEMA_VERSION,
  OPPONENT_SUITE_V1_CHECKSUM,
  OPPONENT_SUITE_VERSION,
  OPPONENT_SUITE_V1_INCOMPATIBLE_OPPONENT_IDS,
  OPPONENT_SUITE_V1_RUNNABLE_OPPONENT_IDS,
  recomputeOpponentSuiteV1Checksum,
  serializeOpponentSuiteIdentityV1,
} from "../../src/opponents/opponent-suite-v1.js";
import { RULESET_VERSION } from "../../src/simulator/constants.js";

/**
 * Milestone 0.2D Phase 4 — canonical opponent-suite identity v1.
 *
 * Frozen suite identity: schema version 1, suiteId
 * `canonical-opponent-suite-v1`, suite version 1, exact ordered six
 * opponent IDs, fixture versions, fixture checksums and exact declared
 * legacy compatibility. The real six canonical fixtures are loaded through
 * the production fixed-root loader and required to agree exactly with the
 * suite anchors. No simulation and no match execution.
 */

const ROOT = join(__dirname, "..", "..");
const OPPONENT_ROOT = join(ROOT, "data", "opponents");

const EXPECTED_ORDER = [
  "bulwark",
  "skirmisher",
  "crusher",
  "spinner",
  "controller",
  "generalist",
] as const;

const EXPECTED_LEGACY_COMPATIBILITY: Record<string, "supported" | "incompatible"> = {
  bulwark: "supported",
  skirmisher: "incompatible",
  crusher: "supported",
  spinner: "supported",
  controller: "incompatible",
  generalist: "supported",
};

describe("canonical opponent suite identity v1 (0.2D Phase 4)", () => {
  it("freezes the exact suite identity constants", () => {
    expect(OPPONENT_SUITE_SCHEMA_VERSION).toBe("1");
    expect(OPPONENT_SUITE_ID).toBe("canonical-opponent-suite-v1");
    expect(OPPONENT_SUITE_VERSION).toBe(1);
  });

  it("declares exactly the six canonical fixtures in the exact frozen order", () => {
    expect(CANONICAL_OPPONENT_SUITE_V1.map((e) => e.opponentId)).toEqual([
      ...EXPECTED_ORDER,
    ]);
    expect(CANONICAL_OPPONENT_SUITE_V1.length).toBe(6);
    for (const entry of CANONICAL_OPPONENT_SUITE_V1) {
      expect(entry.fixtureVersion).toBe(1);
      expect(entry.fixtureChecksum).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("freezes the exact six fixture checksums", () => {
    expect(CANONICAL_OPPONENT_SUITE_V1_FIXTURE_CHECKSUMS.bulwark).toBe(
      "053e61e867d00015371e852dbe571af666cc8ac99a514b2364be323d54a8d987",
    );
    expect(CANONICAL_OPPONENT_SUITE_V1_FIXTURE_CHECKSUMS.skirmisher).toBe(
      "86e05148c57cabad2e9cf916475462acf7b132d1686904c0e5e197db9c1129cc",
    );
    expect(CANONICAL_OPPONENT_SUITE_V1_FIXTURE_CHECKSUMS.crusher).toBe(
      "754f8c3a70106f320483f74d52626b56b451885dfc16c777ca8442ceb7f60b6c",
    );
    expect(CANONICAL_OPPONENT_SUITE_V1_FIXTURE_CHECKSUMS.spinner).toBe(
      "4bde756805abfc9152cd5b64c76fefd26cbc1a2aae9db7ff7a96675b734783b5",
    );
    expect(CANONICAL_OPPONENT_SUITE_V1_FIXTURE_CHECKSUMS.controller).toBe(
      "d4940517943b440cc68bc7822c85051ff2d864530a13281d16a15ad770bece23",
    );
    expect(CANONICAL_OPPONENT_SUITE_V1_FIXTURE_CHECKSUMS.generalist).toBe(
      "07c2f77237bcf868e8297c2e5be12c67cd848f9def48c486ee40a58222908172",
    );
  });

  it("freezes the exact declared legacy compatibility classification", () => {
    for (const entry of CANONICAL_OPPONENT_SUITE_V1) {
      expect(entry.legacyCompatibility).toBe(
        EXPECTED_LEGACY_COMPATIBILITY[entry.opponentId],
      );
    }
    expect([...OPPONENT_SUITE_V1_RUNNABLE_OPPONENT_IDS]).toEqual([
      "bulwark",
      "crusher",
      "spinner",
      "generalist",
    ]);
    expect([...OPPONENT_SUITE_V1_INCOMPATIBLE_OPPONENT_IDS]).toEqual([
      "skirmisher",
      "controller",
    ]);
  });

  it("freezes the deterministic suite checksum and verifies it by recomputation", () => {
    expect(OPPONENT_SUITE_V1_CHECKSUM).toBe(
      "2a276edc8fe6958cb06b0f2a844dd261a878ccf092da238f8ddc2b381c1b8fae",
    );
    // The checksum must equal SHA-256 over the canonical identity serialization.
    expect(recomputeOpponentSuiteV1Checksum()).toBe(OPPONENT_SUITE_V1_CHECKSUM);
    expect(sha256Hex(serializeOpponentSuiteIdentityV1())).toBe(
      OPPONENT_SUITE_V1_CHECKSUM,
    );
  });

  it("binds the canonical identity (schema, suite, order, versions, checksums, compatibility) into the checksum input", () => {
    const identity = JSON.parse(serializeOpponentSuiteIdentityV1()) as {
      schemaVersion: unknown;
      suiteId: unknown;
      suiteVersion: unknown;
      rulesetVersion: unknown;
      opponents: Array<{
        opponentId: unknown;
        fixtureVersion: unknown;
        fixtureChecksum: unknown;
        legacyCompatibility: unknown;
      }>;
    };
    expect(identity.schemaVersion).toBe("1");
    expect(identity.suiteId).toBe(OPPONENT_SUITE_ID);
    expect(identity.suiteVersion).toBe(1);
    expect(identity.rulesetVersion).toBe(RULESET_VERSION);
    expect(identity.opponents.map((o) => o.opponentId)).toEqual([...EXPECTED_ORDER]);
    for (const entry of identity.opponents) {
      expect(entry.fixtureVersion).toBe(1);
      expect(entry.fixtureChecksum).toMatch(/^[0-9a-f]{64}$/);
      expect(["supported", "incompatible"]).toContain(entry.legacyCompatibility);
    }
  });

  it("contains no subjective/balance fields anywhere in the suite identity", () => {
    const text = serializeOpponentSuiteIdentityV1();
    for (const word of [
      "strength",
      "balance",
      "winRate",
      "ranking",
      "tier",
      "difficulty",
      "power",
      "recommended",
      "meta",
      "optimal",
      "best",
      "worst",
    ]) {
      expect(text.toLowerCase().includes(word), word).toBe(false);
    }
  });

  it("loads the six real canonical fixtures and requires exact agreement with the suite anchors", async () => {
    for (const entry of CANONICAL_OPPONENT_SUITE_V1) {
      const fixture = await loadOpponentFixture(entry.opponentId, entry.fixtureVersion);
      expect(fixture.opponentId).toBe(entry.opponentId);
      expect(fixture.fixtureVersion).toBe(entry.fixtureVersion);
      expect(fixture.fixtureChecksum).toBe(entry.fixtureChecksum);
      // The persisted fixture file is deeply frozen and unchanged on disk.
      const fileBytes = readFileSync(
        join(OPPONENT_ROOT, `${entry.opponentId}.v1.json`),
        "utf-8",
      );
      expect(fixture.fixtureChecksum).toBe(entry.fixtureChecksum);
      expect(fileBytes.length).toBeGreaterThan(0);
    }
  });

  it("deeply freezes the suite definition", () => {
    expect(Object.isFrozen(CANONICAL_OPPONENT_SUITE_V1)).toBe(true);
    for (const entry of CANONICAL_OPPONENT_SUITE_V1) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
    expect(Object.isFrozen(CANONICAL_OPPONENT_SUITE_V1_FIXTURE_CHECKSUMS)).toBe(true);
    expect(Object.isFrozen(OPPONENT_SUITE_V1_RUNNABLE_OPPONENT_IDS)).toBe(true);
    expect(Object.isFrozen(OPPONENT_SUITE_V1_INCOMPATIBLE_OPPONENT_IDS)).toBe(true);
  });
});
