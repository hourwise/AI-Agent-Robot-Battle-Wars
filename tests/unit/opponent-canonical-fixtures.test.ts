import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import {
  opponentFixtureChecksum,
  opponentFixtureDeepEqual,
  serializeOpponentFixture,
} from "../../src/opponents/opponent-fixture.js";
import { loadOpponentFixture } from "../../src/opponents/opponent-fixture-loader.js";
import { RULESET_VERSION } from "../../src/simulator/constants.js";
import {
  GRID_RUNTIME_IDENTITY,
  LEGACY_RUNTIME_IDENTITY,
} from "../../src/simulator/runtime-identity.js";
import { validateBuild } from "../../src/validation/build-validator.js";
import {
  BULWARK_BUILD_PROPOSAL,
  BULWARK_POLICY,
  createBulwarkBuild,
} from "../../src/agents/scripted/bulwark-agent.js";

/**
 * Milestone 0.2D Phase 2 — canonical opponent suite v1.
 *
 * Loads all six canonical fixtures through the real production
 * `loadOpponentFixture(id, 1)` from the fixed root `data/opponents`. No
 * simulation, no match execution. The fixture checksums and persisted-file
 * SHA-256 hashes are immutable v1 evidence anchors (D65) frozen at creation.
 */

const ROOT = join(__dirname, "..", "..");
const OPPONENT_ROOT = join(ROOT, "data", "opponents");

function fixtureFile(id: string): string {
  return join(OPPONENT_ROOT, `${id}.v1.json`);
}

interface CanonicalFixtureExpectation {
  readonly id: string;
  readonly displayName: string;
  readonly build: Record<string, unknown>;
  readonly policy: Record<string, unknown>;
  readonly legacyStatus: "supported" | "incompatible";
  readonly gridStatus: "supported" | "incompatible";
  readonly fixtureChecksum: string;
  readonly fileSha256: string;
  readonly totalCost: number;
  readonly armourCost: number;
  readonly totalArmourPoints: number;
}

const CANONICAL_FIXTURES: readonly CanonicalFixtureExpectation[] = [
  {
    id: "bulwark",
    displayName: "The Bulwark",
    build: {
      machineName: "The Bulwark",
      chassisId: "heavy",
      mobilityId: "tracks",
      weaponId: "ram",
      utilityId: "reinforced_drive",
      armour: { front: 60, left: 15, right: 15, rear: 0, top: 0 },
      designSummary: "An unstoppable forward assault machine with heavy frontal armour.",
      designRationale:
        "Maximise frontal protection and close-range ram damage. Accept rear vulnerability.",
    },
    policy: {
      opening: "rush",
      preferredRange: "close",
      aggression: 85,
      primaryTarget: "front",
      secondaryTarget: "front",
      retreatThreshold: 10,
      heatThreshold: 90,
      fallback: "desperate_attack",
    },
    legacyStatus: "supported",
    gridStatus: "supported",
    fixtureChecksum: "053e61e867d00015371e852dbe571af666cc8ac99a514b2364be323d54a8d987",
    fileSha256: "d109c73a2f0880a5298fa6784abe4644f10c6ec395d4f4007179cc2d4e50256a",
    totalCost: 94,
    armourCost: 9,
    totalArmourPoints: 90,
  },
  {
    id: "skirmisher",
    displayName: "Iron Cicada",
    build: {
      machineName: "Iron Cicada",
      chassisId: "light",
      mobilityId: "wheels",
      weaponId: "grappler",
      utilityId: "traction_boost",
      armour: { front: 20, left: 10, right: 10, rear: 10, top: 10 },
      designSummary: "A light mobile control machine built to seek lateral angles.",
      designRationale:
        "Use wheels and a grappler to pursue lateral pressure without relying on heavy armour.",
    },
    policy: {
      opening: "flank",
      preferredRange: "close",
      aggression: 70,
      primaryTarget: "rear",
      secondaryTarget: "left",
      retreatThreshold: 35,
      heatThreshold: 80,
      fallback: "retreat",
    },
    legacyStatus: "incompatible",
    gridStatus: "supported",
    fixtureChecksum: "86e05148c57cabad2e9cf916475462acf7b132d1686904c0e5e197db9c1129cc",
    fileSha256: "c078b792cc46aaaf30f9ed34ae5e7f772d99d65bd8745018ac969657bf8cd0b7",
    totalCost: 63,
    armourCost: 6,
    totalArmourPoints: 60,
  },
  {
    id: "crusher",
    displayName: "Hammerfall",
    build: {
      machineName: "Hammerfall",
      chassisId: "heavy",
      mobilityId: "tracks",
      weaponId: "hammer",
      utilityId: "cooling",
      armour: { front: 30, left: 20, right: 20, rear: 15, top: 15 },
      designSummary:
        "A heavy hammer platform built around deliberate high-impact attacks.",
      designRationale:
        "Use a heavy chassis, tracks, hammer and cooling with broad armour coverage for a cautious impact-focused profile.",
    },
    policy: {
      opening: "cautious",
      preferredRange: "medium",
      aggression: 55,
      primaryTarget: "top",
      secondaryTarget: "front",
      retreatThreshold: 20,
      heatThreshold: 70,
      fallback: "defend",
    },
    legacyStatus: "supported",
    gridStatus: "supported",
    fixtureChecksum: "754f8c3a70106f320483f74d52626b56b451885dfc16c777ca8442ceb7f60b6c",
    fileSha256: "42f0397595dc88fd8edb12d7e8aba155f179fcb5feea84c3ff93f797903099a0",
    totalCost: 100,
    armourCost: 10,
    totalArmourPoints: 100,
  },
  {
    id: "spinner",
    displayName: "Whirlwind",
    build: {
      machineName: "Whirlwind",
      chassisId: "medium",
      mobilityId: "wheels",
      weaponId: "horizontal_spinner",
      utilityId: "cooling",
      armour: { front: 25, left: 15, right: 15, rear: 10, top: 15 },
      designSummary:
        "A medium mobile spinner platform built for aggressive burst pressure.",
      designRationale:
        "Pair a horizontal spinner with wheels and cooling, using moderate distributed armour without asserting balance.",
    },
    policy: {
      opening: "rush",
      preferredRange: "close",
      aggression: 75,
      primaryTarget: "front",
      secondaryTarget: "left",
      retreatThreshold: 20,
      heatThreshold: 75,
      fallback: "desperate_attack",
    },
    legacyStatus: "supported",
    gridStatus: "supported",
    fixtureChecksum: "4bde756805abfc9152cd5b64c76fefd26cbc1a2aae9db7ff7a96675b734783b5",
    fileSha256: "ea9319b3fd4df6610c24e60bff23e4add73717092688063c2f53c69b5e1521f6",
    totalCost: 85,
    armourCost: 8,
    totalArmourPoints: 80,
  },
  {
    id: "controller",
    displayName: "Lockdown",
    build: {
      machineName: "Lockdown",
      chassisId: "medium",
      mobilityId: "legs",
      weaponId: "grappler",
      utilityId: "traction_boost",
      armour: { front: 20, left: 15, right: 15, rear: 10, top: 10 },
      designSummary:
        "A medium grappler platform built around control and repositioning intent.",
      designRationale:
        "Pair legs and traction support with a grappler to express grid control intent; no performance claim is implied.",
    },
    policy: {
      opening: "cautious",
      preferredRange: "close",
      aggression: 60,
      primaryTarget: "rear",
      secondaryTarget: "left",
      retreatThreshold: 30,
      heatThreshold: 80,
      fallback: "defend",
    },
    legacyStatus: "incompatible",
    gridStatus: "supported",
    fixtureChecksum: "d4940517943b440cc68bc7822c85051ff2d864530a13281d16a15ad770bece23",
    fileSha256: "82a1235ecd85a891169841e15051d30ffdd026acf0197a58c2ecc5ced3a43773",
    totalCost: 87,
    armourCost: 7,
    totalArmourPoints: 70,
  },
  {
    id: "generalist",
    displayName: "Sentinel",
    build: {
      machineName: "Sentinel",
      chassisId: "medium",
      mobilityId: "wheels",
      weaponId: "flipper",
      utilityId: "cooling",
      armour: { front: 20, left: 15, right: 15, rear: 15, top: 15 },
      designSummary: "A medium mixed-purpose platform with no extreme component choice.",
      designRationale:
        "Use a moderate chassis, mobility, flipper, cooling and distributed armour as a descriptive generalist, not a balance baseline.",
    },
    policy: {
      opening: "hold",
      preferredRange: "medium",
      aggression: 65,
      primaryTarget: "front",
      secondaryTarget: "top",
      retreatThreshold: 30,
      heatThreshold: 80,
      fallback: "defend",
    },
    legacyStatus: "supported",
    gridStatus: "supported",
    fixtureChecksum: "07c2f77237bcf868e8297c2e5be12c67cd848f9def48c486ee40a58222908172",
    fileSha256: "c887ef2ac1d9201753539d57b036c56e4f3a0b56a4da9ded42b1305a79b8fa50",
    totalCost: 80,
    armourCost: 8,
    totalArmourPoints: 80,
  },
];

describe("canonical opponent suite v1 (0.2D Phase 2)", () => {
  it("loads every canonical fixture through production loadOpponentFixture with frozen identity and immutable evidence anchors", async () => {
    for (const expected of CANONICAL_FIXTURES) {
      const loaded = await loadOpponentFixture(expected.id, 1);
      const fileBytes = readFileSync(fixtureFile(expected.id), "utf-8");

      // Exact identity.
      expect(loaded.opponentId).toBe(expected.id);
      expect(loaded.fixtureVersion).toBe(1);
      expect(loaded.schemaVersion).toBe("1");
      expect(loaded.displayName).toBe(expected.displayName);
      expect(loaded.catalogueVersion).toBe(CATALOGUE_V1.version);

      // Exact ruleset identity.
      expect(loaded.rulesetCompatibility.rulesetVersion).toBe(RULESET_VERSION);
      expect(loaded.rulesetCompatibility.status).toBe("supported");

      // Exact runtime compatibility (complete frozen identities).
      expect(loaded.runtimeCompatibility.legacy).toEqual({
        simulatorVersion: LEGACY_RUNTIME_IDENTITY.simulatorVersion,
        positioningModel: LEGACY_RUNTIME_IDENTITY.positioningModel,
        status: expected.legacyStatus,
      });
      expect(loaded.runtimeCompatibility.grid).toEqual({
        simulatorVersion: GRID_RUNTIME_IDENTITY.simulatorVersion,
        positioningModel: GRID_RUNTIME_IDENTITY.positioningModel,
        status: expected.gridStatus,
      });

      // Exact frozen build and policy.
      expect(loaded.build).toEqual(expected.build);
      expect(loaded.policy).toEqual(expected.policy);

      // Complete authoritative validated-build agreement.
      const authoritative = validateBuild(loaded.build, CATALOGUE_V1);
      expect(authoritative.ok).toBe(true);
      if (!authoritative.ok) return;
      expect(opponentFixtureDeepEqual(loaded.validatedBuild, authoritative.build)).toBe(
        true,
      );
      expect(loaded.validatedBuild.totalCost).toBe(expected.totalCost);
      expect(loaded.validatedBuild.armourCost).toBe(expected.armourCost);
      expect(loaded.validatedBuild.totalArmourPoints).toBe(expected.totalArmourPoints);

      // Checksum recomputes exactly and matches the frozen anchor.
      expect(loaded.fixtureChecksum).toBe(expected.fixtureChecksum);
      expect(opponentFixtureChecksum(loaded)).toBe(expected.fixtureChecksum);

      // Canonical persisted bytes equal the source file bytes byte-for-byte.
      expect(serializeOpponentFixture(loaded)).toBe(fileBytes);

      // Persisted-file SHA-256 matches the frozen anchor.
      expect(sha256Hex(fileBytes)).toBe(expected.fileSha256);

      // Deeply frozen result.
      expect(Object.isFrozen(loaded)).toBe(true);
      expect(Object.isFrozen(loaded.build)).toBe(true);
      expect(Object.isFrozen(loaded.build.armour)).toBe(true);
      expect(Object.isFrozen(loaded.validatedBuild)).toBe(true);
      expect(Object.isFrozen(loaded.validatedBuild.proposal)).toBe(true);
      expect(Object.isFrozen(loaded.policy)).toBe(true);
      expect(Object.isFrozen(loaded.rulesetCompatibility)).toBe(true);
      expect(Object.isFrozen(loaded.runtimeCompatibility)).toBe(true);
    }
  });

  it("binds the bulwark fixture to the historical build/policy and authoritative validated build (data migration only)", async () => {
    const loaded = await loadOpponentFixture("bulwark", 1);
    expect(opponentFixtureDeepEqual(loaded.build, BULWARK_BUILD_PROPOSAL)).toBe(true);
    expect(opponentFixtureDeepEqual(loaded.policy, BULWARK_POLICY)).toBe(true);
    expect(opponentFixtureDeepEqual(loaded.validatedBuild, createBulwarkBuild())).toBe(
      true,
    );
    expect(loaded.build.machineName).toBe("The Bulwark");
  });

  it("records factual structural diversity without balance claims", async () => {
    const ids = CANONICAL_FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(6);

    // All five catalogue weapon IDs appear at least once.
    const weapons = CANONICAL_FIXTURES.map((f) => f.build.weaponId as string);
    for (const weapon of ["ram", "hammer", "horizontal_spinner", "grappler", "flipper"]) {
      expect(weapons).toContain(weapon);
    }

    // More than one chassis/mobility/utility appears.
    expect(
      new Set(CANONICAL_FIXTURES.map((f) => f.build.chassisId)).size,
    ).toBeGreaterThan(1);
    expect(
      new Set(CANONICAL_FIXTURES.map((f) => f.build.mobilityId)).size,
    ).toBeGreaterThan(1);
    expect(
      new Set(CANONICAL_FIXTURES.map((f) => f.build.utilityId)).size,
    ).toBeGreaterThan(1);

    // Exactly two fixtures are grid-only (legacy incompatible).
    const gridOnly = CANONICAL_FIXTURES.filter((f) => f.legacyStatus === "incompatible")
      .map((f) => f.id)
      .sort();
    expect(gridOnly).toEqual(["controller", "skirmisher"]);

    // Four fixtures are dual-compatible.
    const dual = CANONICAL_FIXTURES.filter(
      (f) => f.legacyStatus === "supported" && f.gridStatus === "supported",
    )
      .map((f) => f.id)
      .sort();
    expect(dual).toEqual(["bulwark", "crusher", "generalist", "spinner"]);
  });
});
