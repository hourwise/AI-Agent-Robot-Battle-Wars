import { describe, expect, it } from "vitest";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { RULESET_VERSION } from "../../src/simulator/constants.js";
import {
  GRID_RUNTIME_IDENTITY,
  LEGACY_RUNTIME_IDENTITY,
} from "../../src/simulator/runtime-identity.js";
import { validateBuild } from "../../src/validation/build-validator.js";
import {
  OPPONENT_FIXTURE_SCHEMA_VERSION,
  opponentFixtureChecksum,
  opponentFixtureDeepEqual,
  parseOpponentFixture,
  serializeOpponentFixture,
  type OpponentFixtureV1,
} from "../../src/opponents/opponent-fixture.js";
import {
  makeSyntheticOpponentFixture,
  syntheticRuntimeCompatibility,
} from "../helpers/opponent-fixture-builder.js";

/**
 * Milestone 0.2D Phase 1 — opponent fixture schema, canonical identity and
 * semantic binding. Positive and corruption tests use synthetic test-only
 * fixture objects; no canonical opponent fixture exists.
 */

describe("opponent fixture schema v1 (0.2D Phase 1)", () => {
  it("binds the schema to the canonical frozen versions", () => {
    expect(OPPONENT_FIXTURE_SCHEMA_VERSION).toBe("1");
    expect(RULESET_VERSION).toBe("0.2.0");
    expect(CATALOGUE_V1.version).toBe("1");
    expect(LEGACY_RUNTIME_IDENTITY.simulatorVersion).toBe("0.2.0");
    expect(LEGACY_RUNTIME_IDENTITY.positioningModel).toBe("legacy-five-zone-v1");
    expect(GRID_RUNTIME_IDENTITY.simulatorVersion).toBe("0.3.0");
    expect(GRID_RUNTIME_IDENTITY.positioningModel).toBe("grid-3x3-v1");
  });

  it("parses a valid dual-compatible fixture deterministically and deeply freezes it", () => {
    const raw = makeSyntheticOpponentFixture();
    const fixture = parse(raw, "synthetic");

    expect(fixture.schemaVersion).toBe("1");
    expect(fixture.opponentId).toBe("synthetic");
    expect(fixture.fixtureVersion).toBe(1);
    expect(fixture.displayName).toBe("Synthetic");
    expect(fixture.catalogueVersion).toBe("1");
    expect(fixture.rulesetCompatibility.rulesetVersion).toBe("0.2.0");
    expect(fixture.rulesetCompatibility.status).toBe("supported");
    expect(fixture.runtimeCompatibility.legacy.status).toBe("supported");
    expect(fixture.runtimeCompatibility.grid.status).toBe("supported");
    expect(fixture.fixtureChecksum).toMatch(/^[0-9a-f]{64}$/);

    // Deep freeze at every required level.
    expect(Object.isFrozen(fixture)).toBe(true);
    expect(Object.isFrozen(fixture.build)).toBe(true);
    expect(Object.isFrozen(fixture.build.armour)).toBe(true);
    expect(Object.isFrozen(fixture.validatedBuild)).toBe(true);
    expect(Object.isFrozen(fixture.validatedBuild.proposal)).toBe(true);
    expect(Object.isFrozen(fixture.policy)).toBe(true);
    expect(Object.isFrozen(fixture.rulesetCompatibility)).toBe(true);
    expect(Object.isFrozen(fixture.runtimeCompatibility)).toBe(true);
    expect(Object.isFrozen(fixture.runtimeCompatibility.legacy)).toBe(true);
    expect(Object.isFrozen(fixture.runtimeCompatibility.grid)).toBe(true);

    // Deterministic across re-parses.
    const again = parse(makeSyntheticOpponentFixture(), "synthetic");
    expect(opponentFixtureDeepEqual(fixture, again)).toBe(true);
    expect(again.fixtureChecksum).toBe(fixture.fixtureChecksum);
  });

  it("computes a deterministic canonical serialization and checksum", () => {
    const fixture = parse(makeSyntheticOpponentFixture(), "synthetic");
    const bytes = serializeOpponentFixture(fixture);
    expect(bytes).toBe(serializeOpponentFixture(parse(JSON.parse(bytes), "synthetic")));
    expect(opponentFixtureChecksum(fixture)).toBe(fixture.fixtureChecksum);
    expect(opponentFixtureChecksum(parse(JSON.parse(bytes), "synthetic"))).toBe(
      fixture.fixtureChecksum,
    );
    // No timestamps, no random identifiers, no environment-dependent fields.
    expect(bytes).not.toMatch(/timestamp|createdAt|uuid|random/i);
  });

  it("round-trips exactly: canonical bytes re-parse to an equivalent identity", () => {
    const fixture = parse(makeSyntheticOpponentFixture(), "synthetic");
    const bytes = serializeOpponentFixture(fixture);
    const reparsed = parse(JSON.parse(bytes), "synthetic");
    expect(opponentFixtureDeepEqual(reparsed, fixture)).toBe(true);
    expect(serializeOpponentFixture(reparsed)).toBe(bytes);
  });

  it("binds the catalogue-validator-derived validated build completely", () => {
    const fixture = parse(makeSyntheticOpponentFixture(), "synthetic");
    const authoritative = validateBuild(fixture.build, CATALOGUE_V1);
    expect(authoritative.ok).toBe(true);
    if (!authoritative.ok) return;
    expect(opponentFixtureDeepEqual(fixture.validatedBuild, authoritative.build)).toBe(
      true,
    );
    expect(fixture.validatedBuild.proposal).toEqual(fixture.build);
    expect(fixture.validatedBuild.catalogueVersion).toBe(CATALOGUE_V1.version);
    expect(fixture.catalogueVersion).toBe(CATALOGUE_V1.version);
  });

  it("validates a legacy-only compatible fixture", () => {
    const raw = makeSyntheticOpponentFixture({
      runtimeCompatibility: syntheticRuntimeCompatibility({
        legacyStatus: "supported",
        gridStatus: "incompatible",
      }),
    });
    const fixture = parse(raw, "synthetic");
    expect(fixture.runtimeCompatibility.legacy.status).toBe("supported");
    expect(fixture.runtimeCompatibility.grid.status).toBe("incompatible");
  });

  it("validates a grid-only compatible fixture", () => {
    const raw = makeSyntheticOpponentFixture({
      runtimeCompatibility: syntheticRuntimeCompatibility({
        legacyStatus: "incompatible",
        gridStatus: "supported",
      }),
    });
    const fixture = parse(raw, "synthetic");
    expect(fixture.runtimeCompatibility.legacy.status).toBe("incompatible");
    expect(fixture.runtimeCompatibility.grid.status).toBe("supported");
  });

  it("validates a dual-compatible fixture", () => {
    const fixture = parse(makeSyntheticOpponentFixture(), "synthetic");
    expect(fixture.runtimeCompatibility.legacy.status).toBe("supported");
    expect(fixture.runtimeCompatibility.grid.status).toBe("supported");
  });

  it("rejects mutation attempts and keeps later parses checksum-stable", () => {
    const bytes = serializeOpponentFixture(
      parse(makeSyntheticOpponentFixture(), "synthetic"),
    );
    const fixture = parse(JSON.parse(bytes), "synthetic");
    const originalChecksum = fixture.fixtureChecksum;

    const attempts: Array<() => void> = [
      () => {
        (fixture as { opponentId: string }).opponentId = "mutated";
      },
      () => {
        (fixture.build as { machineName: string }).machineName = "Mutated";
      },
      () => {
        (fixture.build.armour as { front: number }).front = 0;
      },
      () => {
        (fixture.validatedBuild as { totalCost: number }).totalCost = 0;
      },
      () => {
        (fixture.validatedBuild.proposal as { machineName: string }).machineName =
          "Mutated";
      },
      () => {
        (fixture.policy as { opening: string }).opening = "hold";
      },
      () => {
        (fixture.runtimeCompatibility.grid as { status: string }).status = "incompatible";
      },
      () => {
        (fixture.rulesetCompatibility as { rulesetVersion: string }).rulesetVersion =
          "9.9.9";
      },
    ];
    for (const attempt of attempts) {
      expect(attempt).toThrow(TypeError);
    }

    // A later parse of the same canonical bytes is unaffected and stable.
    const later = parse(JSON.parse(bytes), "synthetic");
    expect(later.fixtureChecksum).toBe(originalChecksum);
    expect(opponentFixtureDeepEqual(later, fixture)).toBe(true);
  });

  it("enforces the text bounds and terminal safety of display fields", () => {
    // displayName too long.
    expect(() =>
      parse(makeSyntheticOpponentFixture({ displayName: "S".repeat(21) }), "synthetic"),
    ).toThrow(/authoritative schema/);
    // description too long.
    expect(() =>
      parse(makeSyntheticOpponentFixture({ description: "d".repeat(501) }), "synthetic"),
    ).toThrow(/authoritative schema/);
    // archetypeIntent too long.
    expect(() =>
      parse(
        makeSyntheticOpponentFixture({ archetypeIntent: "a".repeat(201) }),
        "synthetic",
      ),
    ).toThrow(/authoritative schema/);
    // Unsafe display text.
    expect(() =>
      parse(
        makeSyntheticOpponentFixture({ displayName: "Synthetic\x1b[31m" }),
        "synthetic",
      ),
    ).toThrow(/displayName must already pass text sanitisation/);
    expect(() =>
      parse(makeSyntheticOpponentFixture({ description: "line\nbreak" }), "synthetic"),
    ).toThrow(/description must already pass text sanitisation/);
    expect(() =>
      parse(makeSyntheticOpponentFixture({ archetypeIntent: "tab\there" }), "synthetic"),
    ).toThrow(/archetypeIntent must already pass text sanitisation/);
  });

  it("rejects a displayName that disagrees with the build machine name", () => {
    expect(() =>
      parse(makeSyntheticOpponentFixture({ displayName: "Not Synthetic" }), "synthetic"),
    ).toThrow(/displayName must agree with the build proposal machine name/);
  });

  it("rejects a wrong internal opponentId", () => {
    expect(() =>
      parse(makeSyntheticOpponentFixture({ opponentId: "other" }), "synthetic"),
    ).toThrow(/must equal the requested identifier/);
  });

  it("rejects unknown fields at the fixture top level (e.g. tier)", () => {
    const raw = makeSyntheticOpponentFixture() as Record<string, unknown>;
    raw.tier = "S";
    expect(() => parse(raw, "synthetic")).toThrow(
      /must not contain unknown field "tier"/,
    );
  });

  it("rejects a subjective balance field such as tier with a coherent checksum", () => {
    const raw = makeSyntheticOpponentFixture() as Record<string, unknown>;
    raw.tier = "S";
    // The checksum is untouched and still valid for the original identity, so
    // rejection must come from the strictness boundary, not stale checksum.
    expect(raw.fixtureChecksum).toMatch(/^[0-9a-f]{64}$/);
    expect(() => parse(raw, "synthetic")).toThrow(/unknown field "tier"/);
  });

  it("rejects unknown build fields", () => {
    const raw = makeSyntheticOpponentFixture();
    (raw.build as Record<string, unknown>).speed = 99;
    expect(() => parse(raw, "synthetic")).toThrow(
      /fixture build must not contain unknown field "speed"/,
    );
  });

  it("rejects unknown armour fields", () => {
    const raw = makeSyntheticOpponentFixture();
    ((raw.build as Record<string, unknown>).armour as Record<string, unknown>).bottom = 1;
    expect(() => parse(raw, "synthetic")).toThrow(
      /fixture build\.armour must not contain unknown field "bottom"/,
    );
  });

  it("rejects unknown policy fields", () => {
    const raw = makeSyntheticOpponentFixture();
    (raw.policy as Record<string, unknown>).strategy = "rush";
    expect(() => parse(raw, "synthetic")).toThrow(
      /fixture policy must not contain unknown field "strategy"/,
    );
  });

  it("rejects unknown compatibility fields", () => {
    const rawRuleset = makeSyntheticOpponentFixture();
    (rawRuleset.rulesetCompatibility as Record<string, unknown>).extra = 1;
    expect(() => parse(rawRuleset, "synthetic")).toThrow(
      /fixture rulesetCompatibility must not contain unknown field "extra"/,
    );

    const rawRuntime = makeSyntheticOpponentFixture();
    (
      (rawRuntime.runtimeCompatibility as Record<string, unknown>).legacy as Record<
        string,
        unknown
      >
    ).extra = 1;
    expect(() => parse(rawRuntime, "synthetic")).toThrow(
      /fixture runtimeCompatibility\.legacy must not contain unknown field "extra"/,
    );
  });

  it("rejects unknown fields in the persisted validated-build snapshot", () => {
    const raw = makeSyntheticOpponentFixture();
    (raw.validatedBuild as Record<string, unknown>).rawCost = 99;
    expect(() => parse(raw, "synthetic")).toThrow(
      /fixture validatedBuild must not contain unknown field "rawCost"/,
    );

    const rawProposal = makeSyntheticOpponentFixture();
    const validatedBuild = JSON.parse(
      JSON.stringify(rawProposal.validatedBuild),
    ) as Record<string, unknown>;
    (validatedBuild.proposal as Record<string, unknown>).extra = 1;
    const rawProposalTampered = makeSyntheticOpponentFixture({ validatedBuild });
    expect(() => parse(rawProposalTampered, "synthetic")).toThrow(
      /fixture validatedBuild\.proposal must not contain unknown field "extra"/,
    );
  });

  it("rejects an unsupported catalogue version", () => {
    const raw = makeSyntheticOpponentFixture({ catalogueVersion: "2" });
    expect(raw.fixtureChecksum).toMatch(/^[0-9a-f]{64}$/);
    expect(() => parse(raw, "synthetic")).toThrow(
      /catalogueVersion "2" must equal the canonical catalogue version "1"/,
    );
  });

  it("rejects a wrong ruleset identity with a coherent checksum", () => {
    const raw = makeSyntheticOpponentFixture();
    (raw.rulesetCompatibility as Record<string, unknown>).rulesetVersion = "0.2.1";
    // Coherent checksum: recomputed over the tampered ruleset identity so the
    // rejection proves semantic binding rather than stale-checksum detection.
    raw.fixtureChecksum = opponentFixtureChecksum(raw as unknown as OpponentFixtureV1);
    expect(raw.fixtureChecksum).toBe(
      opponentFixtureChecksum(raw as unknown as OpponentFixtureV1),
    );
    expect(() => parse(raw, "synthetic")).toThrow(/authoritative schema/);
  });

  it("rejects a wrong legacy runtime identity with a coherent checksum", () => {
    const raw = makeSyntheticOpponentFixture();
    (
      (raw.runtimeCompatibility as Record<string, unknown>).legacy as Record<
        string,
        unknown
      >
    ).simulatorVersion = "9.9.9";
    raw.fixtureChecksum = opponentFixtureChecksum(raw as unknown as OpponentFixtureV1);
    expect(raw.fixtureChecksum).toBe(
      opponentFixtureChecksum(raw as unknown as OpponentFixtureV1),
    );
    expect(() => parse(raw, "synthetic")).toThrow(/authoritative schema/);
  });

  it("rejects a wrong grid runtime identity with a coherent checksum", () => {
    const raw = makeSyntheticOpponentFixture();
    (
      (raw.runtimeCompatibility as Record<string, unknown>).grid as Record<
        string,
        unknown
      >
    ).positioningModel = "grid-9x9-v1";
    raw.fixtureChecksum = opponentFixtureChecksum(raw as unknown as OpponentFixtureV1);
    expect(raw.fixtureChecksum).toBe(
      opponentFixtureChecksum(raw as unknown as OpponentFixtureV1),
    );
    expect(() => parse(raw, "synthetic")).toThrow(/authoritative schema/);
  });

  it("rejects both runtimes incompatible with a coherent checksum", () => {
    const raw = makeSyntheticOpponentFixture({
      runtimeCompatibility: syntheticRuntimeCompatibility({
        legacyStatus: "incompatible",
        gridStatus: "incompatible",
      }),
    });
    expect(raw.fixtureChecksum).toBe(
      opponentFixtureChecksum(raw as unknown as OpponentFixtureV1),
    );
    expect(() => parse(raw, "synthetic")).toThrow(
      /must declare at least one runtime as supported/,
    );
  });

  it("rejects an invalid build budget through the authoritative validator", () => {
    const build = {
      ...(makeSyntheticOpponentFixture().build as Record<string, unknown>),
      armour: { front: 60, left: 60, right: 60, rear: 0, top: 0 },
    };
    const raw = makeSyntheticOpponentFixture({
      build,
      // Any structurally-valid validatedBuild; the authoritative validator
      // must reject the over-budget build before the binding step.
      validatedBuild: {
        proposal: build,
        totalCost: 1,
        armourCost: 1,
        totalArmourPoints: 1,
        catalogueVersion: "1",
      },
    });
    // Coherent checksum over the tampered payload.
    expect(raw.fixtureChecksum).toBe(
      opponentFixtureChecksum(raw as unknown as OpponentFixtureV1),
    );
    expect(() => parse(raw, "synthetic")).toThrow(/catalogue-v1 validator/);
  });

  it("rejects a persisted validatedBuild totalCost mismatch with a coherent checksum", () => {
    const base = parse(makeSyntheticOpponentFixture(), "synthetic");
    const validatedBuild = JSON.parse(JSON.stringify(base.validatedBuild)) as Record<
      string,
      unknown
    >;
    validatedBuild.totalCost = (validatedBuild.totalCost as number) + 1;
    const raw = makeSyntheticOpponentFixture({ validatedBuild });
    expect(raw.fixtureChecksum).toBe(
      opponentFixtureChecksum(raw as unknown as OpponentFixtureV1),
    );
    expect(() => parse(raw, "synthetic")).toThrow(
      /persisted validatedBuild must equal the complete authoritative/,
    );
  });

  it("rejects a persisted validatedBuild armourCost mismatch with a coherent checksum", () => {
    const base = parse(makeSyntheticOpponentFixture(), "synthetic");
    const validatedBuild = JSON.parse(JSON.stringify(base.validatedBuild)) as Record<
      string,
      unknown
    >;
    validatedBuild.armourCost = (validatedBuild.armourCost as number) + 1;
    const raw = makeSyntheticOpponentFixture({ validatedBuild });
    expect(raw.fixtureChecksum).toBe(
      opponentFixtureChecksum(raw as unknown as OpponentFixtureV1),
    );
    expect(() => parse(raw, "synthetic")).toThrow(
      /persisted validatedBuild must equal the complete authoritative/,
    );
  });

  it("rejects a persisted validatedBuild armour-points mismatch with a coherent checksum", () => {
    const base = parse(makeSyntheticOpponentFixture(), "synthetic");
    const validatedBuild = JSON.parse(JSON.stringify(base.validatedBuild)) as Record<
      string,
      unknown
    >;
    validatedBuild.totalArmourPoints = (validatedBuild.totalArmourPoints as number) + 1;
    const raw = makeSyntheticOpponentFixture({ validatedBuild });
    expect(raw.fixtureChecksum).toBe(
      opponentFixtureChecksum(raw as unknown as OpponentFixtureV1),
    );
    expect(() => parse(raw, "synthetic")).toThrow(
      /persisted validatedBuild must equal the complete authoritative/,
    );
  });

  it("rejects a persisted validatedBuild proposal mismatch with a coherent checksum", () => {
    const base = parse(makeSyntheticOpponentFixture(), "synthetic");
    const validatedBuild = JSON.parse(JSON.stringify(base.validatedBuild)) as Record<
      string,
      unknown
    >;
    (validatedBuild.proposal as Record<string, unknown>).machineName = "Mutated";
    const raw = makeSyntheticOpponentFixture({ validatedBuild });
    expect(raw.fixtureChecksum).toBe(
      opponentFixtureChecksum(raw as unknown as OpponentFixtureV1),
    );
    expect(() => parse(raw, "synthetic")).toThrow(
      /persisted validatedBuild must equal the complete authoritative/,
    );
  });

  it("rejects a persisted validatedBuild catalogue mismatch with a coherent checksum", () => {
    const base = parse(makeSyntheticOpponentFixture(), "synthetic");
    const validatedBuild = JSON.parse(JSON.stringify(base.validatedBuild)) as Record<
      string,
      unknown
    >;
    validatedBuild.catalogueVersion = "9";
    const raw = makeSyntheticOpponentFixture({ validatedBuild });
    expect(raw.fixtureChecksum).toBe(
      opponentFixtureChecksum(raw as unknown as OpponentFixtureV1),
    );
    expect(() => parse(raw, "synthetic")).toThrow(
      /persisted validatedBuild must equal the complete authoritative/,
    );
  });

  it("rejects a wrong fixture checksum", () => {
    const raw = makeSyntheticOpponentFixture({
      fixtureChecksum: "0".repeat(64),
    });
    expect(() => parse(raw, "synthetic")).toThrow(
      /fixtureChecksum does not match the canonical identity checksum/,
    );
  });

  it("rejects a non-hex or malformed fixtureChecksum through the schema", () => {
    expect(() =>
      parse(
        makeSyntheticOpponentFixture({ fixtureChecksum: "not-a-checksum" }),
        "synthetic",
      ),
    ).toThrow(/authoritative schema/);
  });

  it("rejects non-object roots and arrays", () => {
    expect(() => parse(null, "synthetic")).toThrow(/must be a plain object/);
    expect(() => parse([], "synthetic")).toThrow(/must be a plain object/);
    expect(() => parse("synthetic", "synthetic")).toThrow(/must be a plain object/);
  });
});

function parse(raw: unknown, opponentId: string): OpponentFixtureV1 {
  return parseOpponentFixture(raw, opponentId);
}
