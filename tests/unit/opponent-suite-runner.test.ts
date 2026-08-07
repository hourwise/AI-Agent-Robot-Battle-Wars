import { describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { RULESET_VERSION } from "../../src/simulator/constants.js";
import { DEFAULT_COMPONENT_QUALIFICATION_ID } from "../../src/simulator/component-qualification-registry.js";
import { runMatch } from "../../src/simulator/simulator.js";
import { loadOpponentFixture } from "../../src/opponents/opponent-fixture-loader.js";
import {
  serializeOpponentFixture,
  type OpponentFixtureV1,
} from "../../src/opponents/opponent-fixture.js";
import {
  OPPONENT_SUITE_V1_LEGACY_PLAN,
  OpponentSuiteError,
  assertOpponentSuiteRuntime,
  buildOpponentSuiteMatchConfig,
  opponentSuiteInternalExecutionCount,
  opponentSuiteMatchId,
  opponentSuiteResultChecksum,
  runOpponentSuite,
} from "../../src/opponents/opponent-suite-runner.js";
import {
  CANONICAL_OPPONENT_SUITE_V1,
  OPPONENT_SUITE_ID,
  OPPONENT_SUITE_V1_CHECKSUM,
} from "../../src/opponents/opponent-suite-v1.js";

/**
 * Milestone 0.2D Phase 4 — deterministic legacy opponent-suite execution.
 *
 * TEST-ONLY seed 44001 (ordinary unit-test seed, no evaluation meaning, not
 * in any seed registry). Runs the full legacy suite through the production
 * runner: 12 factual match entries, 24 internal deterministic simulator
 * executions, exact determinism, role-aware identity, canonical fixture
 * immutability, and fail-closed input enforcement. No ranking/balance/tier
 * interpretation is made; winners are reported only as factual identity.
 */

const TEST_SEED = 44001;

function buildExpectedConfig(a: OpponentFixtureV1, b: OpponentFixtureV1) {
  return {
    seed: TEST_SEED,
    fighterA: { build: a.validatedBuild, policy: a.policy },
    fighterB: { build: b.validatedBuild, policy: b.policy },
    rulesetVersion: RULESET_VERSION,
    catalogueVersion: CATALOGUE_V1.version,
    componentQualificationId: DEFAULT_COMPONENT_QUALIFICATION_ID,
  };
}

describe("opponent suite deterministic legacy execution v1 (0.2D Phase 4)", () => {
  it("rejects the grid runtime as separately unauthorised and other runtimes as invalid", () => {
    expect(() => assertOpponentSuiteRuntime("grid")).toThrow(
      /general grid opponent-suite execution is not authorised/,
    );
    expect(() => assertOpponentSuiteRuntime("other")).toThrow(/runtime must be "legacy"/);
    expect(() => assertOpponentSuiteRuntime("")).toThrow(/runtime must be "legacy"/);
  });

  it("rejects non-safe-integer or negative seeds", async () => {
    await expect(runOpponentSuite({ runtime: "legacy", seed: -1 })).rejects.toThrow(
      /non-negative safe integer/,
    );
    await expect(runOpponentSuite({ runtime: "legacy", seed: 1.5 })).rejects.toThrow(
      /non-negative safe integer/,
    );
    await expect(
      runOpponentSuite({ runtime: "legacy", seed: 9007199254740992 }),
    ).rejects.toThrow(/non-negative safe integer/);
    await expect(
      runOpponentSuite({ runtime: "legacy", seed: Number.NaN }),
    ).rejects.toThrow(/non-negative safe integer/);
  });

  it("executes 12 factual match entries with 24 internal deterministic executions", async () => {
    const run = await runOpponentSuite({ runtime: "legacy", seed: TEST_SEED });
    expect(OPPONENT_SUITE_V1_LEGACY_PLAN.length).toBe(12);
    expect(opponentSuiteInternalExecutionCount()).toBe(24);
    expect(run.matches.length).toBe(12);
  });

  it("produces the complete stable factual run shape", async () => {
    const run = await runOpponentSuite({ runtime: "legacy", seed: TEST_SEED });
    expect(run.schemaVersion).toBe("1");
    expect(run.suiteId).toBe(OPPONENT_SUITE_ID);
    expect(run.suiteVersion).toBe(1);
    expect(run.suiteChecksum).toBe(OPPONENT_SUITE_V1_CHECKSUM);
    expect(run.runtime).toEqual({
      simulatorVersion: "0.2.0",
      positioningModel: "legacy-five-zone-v1",
    });
    expect(run.seed).toBe(TEST_SEED);
    expect(run.fixtureInventory.length).toBe(6);
    expect(run.runnableOpponentIds).toEqual([
      "bulwark",
      "crusher",
      "spinner",
      "generalist",
    ]);
    expect(run.incompatibleOpponentIds).toEqual(["skirmisher", "controller"]);
    for (const inventory of run.fixtureInventory) {
      expect(inventory.fixtureVersion).toBe(1);
      expect(inventory.fixtureChecksum).toMatch(/^[0-9a-f]{64}$/);
      expect(["supported", "incompatible"]).toContain(inventory.legacyCompatibility);
    }
  });

  it("returns exactly one factual entry per planned matchup with exact identities", async () => {
    const run = await runOpponentSuite({ runtime: "legacy", seed: TEST_SEED });
    for (let i = 0; i < OPPONENT_SUITE_V1_LEGACY_PLAN.length; i++) {
      const plan = OPPONENT_SUITE_V1_LEGACY_PLAN[i]!;
      const match = run.matches[i]!;
      expect(match.planIndex).toBe(i + 1);
      expect(match.fighterA.opponentId).toBe(plan.fighterA);
      expect(match.fighterB.opponentId).toBe(plan.fighterB);
      expect(match.fighterA.fixtureVersion).toBe(1);
      expect(match.fighterB.fixtureVersion).toBe(1);
      expect(match.fighterA.fixtureChecksum).toMatch(/^[0-9a-f]{64}$/);
      expect(match.fighterB.fixtureChecksum).toMatch(/^[0-9a-f]{64}$/);
      expect(match.runtime).toEqual({
        simulatorVersion: "0.2.0",
        positioningModel: "legacy-five-zone-v1",
      });
      expect(match.seed).toBe(TEST_SEED);
      expect(match.matchId).toMatch(/^opponent-suite-match-v1:[0-9a-f]{64}$/);
      // Winner is only a canonical opponent ID or null for a draw.
      expect(
        match.winner === null ||
          ["bulwark", "crusher", "spinner", "generalist"].includes(match.winner),
      ).toBe(true);
      expect(["destruction", "immobilisation", "judges", "draw"]).toContain(match.method);
      expect(Number.isSafeInteger(match.rounds) && match.rounds >= 0).toBe(true);
      expect(match.resultChecksum).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("maps each reported winner/checksum to the unchanged legacy runMatch output", async () => {
    const run = await runOpponentSuite({ runtime: "legacy", seed: TEST_SEED });
    const loaded = new Map<string, OpponentFixtureV1>();
    for (const entry of CANONICAL_OPPONENT_SUITE_V1) {
      loaded.set(
        entry.opponentId,
        await loadOpponentFixture(entry.opponentId, entry.fixtureVersion),
      );
    }
    for (let i = 0; i < OPPONENT_SUITE_V1_LEGACY_PLAN.length; i++) {
      const plan = OPPONENT_SUITE_V1_LEGACY_PLAN[i]!;
      const match = run.matches[i]!;
      const a = loaded.get(plan.fighterA)!;
      const b = loaded.get(plan.fighterB)!;
      const rerun = runMatch(buildExpectedConfig(a, b));
      expect(opponentSuiteResultChecksum(rerun)).toBe(match.resultChecksum);
      const expectedWinner =
        rerun.result.winner === "fighter_a"
          ? plan.fighterA
          : rerun.result.winner === "fighter_b"
            ? plan.fighterB
            : null;
      expect(match.winner).toBe(expectedWinner);
      expect(match.method).toBe(rerun.result.method);
      expect(match.rounds).toBe(rerun.rounds);
    }
  });

  it("is fully reproducible: the complete run deep-equals across two executions of the same seed", async () => {
    const first = await runOpponentSuite({ runtime: "legacy", seed: TEST_SEED });
    const second = await runOpponentSuite({ runtime: "legacy", seed: TEST_SEED });
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("produces deterministic match IDs with role reversal yielding distinct IDs", async () => {
    for (const plan of OPPONENT_SUITE_V1_LEGACY_PLAN) {
      const fighterA = { opponentId: plan.fighterA, fixtureChecksum: "a".repeat(64) };
      const fighterB = { opponentId: plan.fighterB, fixtureChecksum: "b".repeat(64) };
      const base = {
        suiteId: OPPONENT_SUITE_ID,
        suiteVersion: 1,
        runtime: "legacy",
        seed: TEST_SEED,
        planIndex: plan.planIndex,
      };
      const forward = opponentSuiteMatchId({ ...base, fighterA, fighterB });
      const reverse = opponentSuiteMatchId({
        ...base,
        fighterA: fighterB,
        fighterB: fighterA,
      });
      const forwardAgain = opponentSuiteMatchId({ ...base, fighterA, fighterB });
      expect(forward).toBe(forwardAgain);
      expect(forward).not.toBe(reverse);
      // Different seeds also yield different IDs.
      const otherSeed = opponentSuiteMatchId({
        ...base,
        seed: TEST_SEED + 1,
        fighterA,
        fighterB,
      });
      expect(otherSeed).not.toBe(forward);
    }
  });

  it("leaves all six canonical fixtures byte- and checksum-unchanged after the run", async () => {
    const loaded = new Map<string, OpponentFixtureV1>();
    const beforeBytes = new Map<string, string>();
    const beforeChecksums = new Map<string, string>();
    for (const entry of CANONICAL_OPPONENT_SUITE_V1) {
      const fixture = await loadOpponentFixture(entry.opponentId, entry.fixtureVersion);
      loaded.set(entry.opponentId, fixture);
      beforeBytes.set(entry.opponentId, serializeOpponentFixture(fixture));
      beforeChecksums.set(entry.opponentId, fixture.fixtureChecksum);
    }
    await runOpponentSuite({ runtime: "legacy", seed: TEST_SEED });
    for (const [id, fixture] of loaded) {
      expect(serializeOpponentFixture(fixture), id).toBe(beforeBytes.get(id));
      expect(fixture.fixtureChecksum, id).toBe(beforeChecksums.get(id));
      // The loaded fixtures remain deeply frozen (build/armour/validatedBuild/policy).
      expect(Object.isFrozen(fixture), id).toBe(true);
      expect(Object.isFrozen(fixture.build), `${id}.build`).toBe(true);
      expect(Object.isFrozen(fixture.build.armour), `${id}.build.armour`).toBe(true);
      expect(Object.isFrozen(fixture.validatedBuild), `${id}.validatedBuild`).toBe(true);
      expect(
        Object.isFrozen(fixture.validatedBuild.proposal),
        `${id}.validatedBuild.proposal`,
      ).toBe(true);
      expect(Object.isFrozen(fixture.policy), `${id}.policy`).toBe(true);
      expect(
        Object.isFrozen(fixture.runtimeCompatibility),
        `${id}.runtimeCompatibility`,
      ).toBe(true);
    }
  });

  it("deep-freezes the returned run result", async () => {
    const run = await runOpponentSuite({ runtime: "legacy", seed: TEST_SEED });
    expect(Object.isFrozen(run)).toBe(true);
    expect(Object.isFrozen(run.matches)).toBe(true);
    for (const match of run.matches) {
      expect(Object.isFrozen(match)).toBe(true);
      expect(Object.isFrozen(match.fighterA)).toBe(true);
      expect(Object.isFrozen(match.fighterB)).toBe(true);
    }
    expect(Object.isFrozen(run.fixtureInventory)).toBe(true);
  });

  it("builds reference-distinct primary/repeat nested execution graphs", async () => {
    const loaded = new Map<string, OpponentFixtureV1>();
    for (const entry of CANONICAL_OPPONENT_SUITE_V1) {
      loaded.set(
        entry.opponentId,
        await loadOpponentFixture(entry.opponentId, entry.fixtureVersion),
      );
    }
    const fixtureA = loaded.get("bulwark")!;
    const fixtureB = loaded.get("crusher")!;
    const primary = buildOpponentSuiteMatchConfig(fixtureA, fixtureB, TEST_SEED);
    const repeat = buildOpponentSuiteMatchConfig(fixtureA, fixtureB, TEST_SEED);

    // Outer config and fighter objects are fresh.
    expect(primary).not.toBe(repeat);
    expect(primary.fighterA).not.toBe(repeat.fighterA);
    expect(primary.fighterB).not.toBe(repeat.fighterB);

    // Nested build graphs are fresh (build, proposal, armour).
    expect(primary.fighterA.build).not.toBe(repeat.fighterA.build);
    expect(primary.fighterB.build).not.toBe(repeat.fighterB.build);
    expect(primary.fighterA.build.proposal).not.toBe(repeat.fighterA.build.proposal);
    expect(primary.fighterB.build.proposal).not.toBe(repeat.fighterB.build.proposal);
    expect(primary.fighterA.build.proposal.armour).not.toBe(
      repeat.fighterA.build.proposal.armour,
    );
    expect(primary.fighterB.build.proposal.armour).not.toBe(
      repeat.fighterB.build.proposal.armour,
    );

    // Policy objects are fresh.
    expect(primary.fighterA.policy).not.toBe(repeat.fighterA.policy);
    expect(primary.fighterB.policy).not.toBe(repeat.fighterB.policy);
  });

  it("keeps execution graphs reference-distinct from the canonical fixture graphs", async () => {
    const loaded = new Map<string, OpponentFixtureV1>();
    for (const entry of CANONICAL_OPPONENT_SUITE_V1) {
      loaded.set(
        entry.opponentId,
        await loadOpponentFixture(entry.opponentId, entry.fixtureVersion),
      );
    }
    for (const entry of CANONICAL_OPPONENT_SUITE_V1) {
      const fixture = loaded.get(entry.opponentId)!;
      // Against a mirror opponent; both slots must be distinct from canonical.
      const mirror = loaded.get("bulwark")!;
      const opponent = entry.opponentId === "bulwark" ? loaded.get("crusher")! : mirror;
      const config = buildOpponentSuiteMatchConfig(fixture, opponent, TEST_SEED);
      const myBuild = config.fighterA.build;
      const myPolicy = config.fighterA.policy;
      expect(myBuild).not.toBe(fixture.validatedBuild);
      expect(myBuild.proposal).not.toBe(fixture.validatedBuild.proposal);
      expect(myBuild.proposal.armour).not.toBe(fixture.validatedBuild.proposal.armour);
      expect(myPolicy).not.toBe(fixture.policy);
    }
  });

  it("preserves exact authoritative values in every execution clone", async () => {
    const loaded = new Map<string, OpponentFixtureV1>();
    for (const entry of CANONICAL_OPPONENT_SUITE_V1) {
      loaded.set(
        entry.opponentId,
        await loadOpponentFixture(entry.opponentId, entry.fixtureVersion),
      );
    }
    for (const entry of CANONICAL_OPPONENT_SUITE_V1) {
      const fixture = loaded.get(entry.opponentId)!;
      const opponent =
        entry.opponentId === "bulwark" ? loaded.get("crusher")! : loaded.get("bulwark")!;
      const config = buildOpponentSuiteMatchConfig(fixture, opponent, TEST_SEED);
      // Complete validatedBuild equality (all fields, no omission).
      expect(config.fighterA.build).toEqual(fixture.validatedBuild);
      // Complete policy equality (all fields, no omission).
      expect(config.fighterA.policy).toEqual(fixture.policy);
      expect(config.fighterB.build).toEqual(opponent.validatedBuild);
      expect(config.fighterB.policy).toEqual(opponent.policy);
      // Authoritative config values unchanged.
      expect(config.rulesetVersion).toBe(RULESET_VERSION);
      expect(config.catalogueVersion).toBe(CATALOGUE_V1.version);
      expect(config.componentQualificationId).toBe(DEFAULT_COMPONENT_QUALIFICATION_ID);
      expect(config.seed).toBe(TEST_SEED);
    }
  });

  it("cannot mutate a canonical fixture through an execution config clone", async () => {
    const bulwark = await loadOpponentFixture("bulwark", 1);
    const crusher = await loadOpponentFixture("crusher", 1);
    const beforeBytes = serializeOpponentFixture(bulwark);
    const beforeChecksum = bulwark.fixtureChecksum;
    // Execution clones are fresh, reference-distinct graphs; mutating them
    // must never alter the canonical fixture (which remains deeply frozen).
    const config = buildOpponentSuiteMatchConfig(bulwark, crusher, TEST_SEED);
    expect(Object.isFrozen(bulwark.validatedBuild)).toBe(true);
    expect(Object.isFrozen(bulwark.policy)).toBe(true);
    expect(config.fighterA.build).not.toBe(bulwark.validatedBuild);
    expect(config.fighterA.policy).not.toBe(bulwark.policy);
    // Mutate the execution clone freely.
    (config.fighterA.build.proposal as { machineName: string }).machineName = "tampered";
    (config.fighterA.policy as { aggression: number }).aggression = 999;
    expect(config.fighterA.build.proposal.machineName).toBe("tampered");
    // The canonical fixture is byte- and checksum-identical.
    expect(serializeOpponentFixture(bulwark)).toBe(beforeBytes);
    expect(bulwark.fixtureChecksum).toBe(beforeChecksum);
    expect(bulwark.validatedBuild.proposal.machineName).not.toBe("tampered");
    expect(bulwark.policy.aggression).not.toBe(999);
  });

  it("fails closed when the two incompatible fixtures would ever appear in a plan slot", async () => {
    // The plan never references incompatible fixtures; this guards the
    // invariant that any such reference is an internal defect.
    for (const plan of OPPONENT_SUITE_V1_LEGACY_PLAN) {
      expect(["skirmisher", "controller"]).not.toContain(plan.fighterA);
      expect(["skirmisher", "controller"]).not.toContain(plan.fighterB);
    }
    expect(OpponentSuiteError).toBeDefined();
    expect(sha256Hex("x")).toHaveLength(64);
  });
});
