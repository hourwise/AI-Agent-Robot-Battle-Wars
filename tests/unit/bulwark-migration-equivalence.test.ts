import { describe, expect, it } from "vitest";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import { RULESET_VERSION } from "../../src/simulator/constants.js";
import { runMatch } from "../../src/simulator/simulator.js";
import type { MatchResult } from "../../src/simulator/types.js";
import { validateBuild } from "../../src/validation/build-validator.js";
import {
  BULWARK_BUILD_PROPOSAL,
  BULWARK_POLICY,
  createBulwarkBuild,
  getBulwarkOpponentSummary,
} from "../../src/agents/scripted/bulwark-agent.js";
import { loadLegacyBulwark } from "../../src/opponents/legacy-bulwark.js";
import {
  opponentFixtureDeepEqual,
  serializeOpponentFixture,
} from "../../src/opponents/opponent-fixture.js";

/**
 * Milestone 0.2D Phase 3 (Commit M) — canonical Bulwark migration
 * equivalence. This is the ONLY simulator execution authorised by Commit M,
 * and it is TEST-ONLY equivalence evidence. No results are written to
 * data/matches, no winners are reported, no win rates are calculated, no
 * benchmark/held-out seeds are used, and no performance interpretation is
 * made. The single conclusion is: historical Bulwark input and canonical
 * fixture input are behaviourally identical under the unchanged legacy
 * runMatch.
 *
 * Predeclared fixed migration-regression seeds (no evaluation meaning):
 * 32001, 32002, 32003.
 */

const MIGRATION_SEEDS = [32001, 32002, 32003];

/** One ordinary legal TEST-ONLY synthetic fighter (not one of the six canonical opponents). */
function syntheticFighter(): {
  build: MatchResult["config"]["fighterA"]["build"];
  policy: MatchResult["config"]["fighterA"]["policy"];
} {
  const proposal = {
    machineName: "Zephyr",
    chassisId: "light" as const,
    mobilityId: "wheels" as const,
    weaponId: "hammer" as const,
    utilityId: "cooling" as const,
    armour: { front: 25, left: 15, right: 15, rear: 10, top: 5 },
    designSummary: "A synthetic test-only migration fighter.",
    designRationale:
      "A synthetic legal fighter used only for migration equivalence testing.",
  };
  const result = validateBuild(proposal, CATALOGUE_V1);
  if (!result.ok) {
    throw new Error(
      `synthetic migration fighter must validate: ${result.errors
        .map((e) => e.message)
        .join("; ")}`,
    );
  }
  return {
    build: result.build,
    policy: {
      opening: "cautious",
      preferredRange: "medium",
      aggression: 60,
      primaryTarget: "front",
      secondaryTarget: "front",
      retreatThreshold: 25,
      heatThreshold: 80,
      fallback: "defend",
    },
  };
}

function expectIdentical(historical: MatchResult, canonical: MatchResult): void {
  expect(canonical.runtime).toEqual(historical.runtime);
  expect(canonical.config).toEqual(historical.config);
  expect(canonical.initialState).toEqual(historical.initialState);
  expect(canonical.events).toEqual(historical.events);
  expect(canonical.result).toEqual(historical.result);
  expect(canonical.rounds).toBe(historical.rounds);
}

describe("canonical bulwark migration equivalence (0.2D Phase 3 Commit M)", () => {
  it("preserves exact data equivalence with the historical Bulwark constants", async () => {
    const bulwark = await loadLegacyBulwark();
    expect(opponentFixtureDeepEqual(bulwark.build, BULWARK_BUILD_PROPOSAL)).toBe(true);
    expect(opponentFixtureDeepEqual(bulwark.policy, BULWARK_POLICY)).toBe(true);
    expect(opponentFixtureDeepEqual(bulwark.validatedBuild, createBulwarkBuild())).toBe(
      true,
    );

    // AI-facing summary structural facts agree with the canonical fixture.
    const summary = getBulwarkOpponentSummary();
    expect(summary.machineName).toBe(bulwark.build.machineName);
    expect(summary.chassisId).toBe(bulwark.build.chassisId);
    expect(summary.mobilityId).toBe(bulwark.build.mobilityId);
    expect(summary.weaponId).toBe(bulwark.build.weaponId);
    expect(summary.utilityId).toBe(bulwark.build.utilityId);
    expect(summary.armour).toEqual(bulwark.build.armour);
  });

  it("produces identical deterministic legacy matches for historical vs canonical Bulwark (mirror and asymmetric roles)", async () => {
    const bulwark = await loadLegacyBulwark();
    const synthetic = syntheticFighter();

    // Capture canonical immutability before simulation.
    const beforeBytes = serializeOpponentFixture(bulwark);
    const beforeChecksum = bulwark.fixtureChecksum;

    for (const seed of MIGRATION_SEEDS) {
      // Case A — Bulwark mirror: historical both slots vs canonical both slots.
      const historicalMirror = runMatch({
        seed,
        fighterA: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
        fighterB: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
        rulesetVersion: RULESET_VERSION,
        catalogueVersion: CATALOGUE_V1.version,
      });
      const canonicalMirror = runMatch({
        seed,
        fighterA: { build: bulwark.validatedBuild, policy: bulwark.policy },
        fighterB: { build: bulwark.validatedBuild, policy: bulwark.policy },
        rulesetVersion: RULESET_VERSION,
        catalogueVersion: CATALOGUE_V1.version,
      });
      expectIdentical(historicalMirror, canonicalMirror);

      // Case B — asymmetric: synthetic fighter A, Bulwark as fighter B.
      const historicalAsymB = runMatch({
        seed,
        fighterA: { build: synthetic.build, policy: synthetic.policy },
        fighterB: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
        rulesetVersion: RULESET_VERSION,
        catalogueVersion: CATALOGUE_V1.version,
      });
      const canonicalAsymB = runMatch({
        seed,
        fighterA: { build: synthetic.build, policy: synthetic.policy },
        fighterB: { build: bulwark.validatedBuild, policy: bulwark.policy },
        rulesetVersion: RULESET_VERSION,
        catalogueVersion: CATALOGUE_V1.version,
      });
      expectIdentical(historicalAsymB, canonicalAsymB);

      // Case C — reverse asymmetric: Bulwark as fighter A, synthetic fighter B.
      const historicalAsymA = runMatch({
        seed,
        fighterA: { build: createBulwarkBuild(), policy: BULWARK_POLICY },
        fighterB: { build: synthetic.build, policy: synthetic.policy },
        rulesetVersion: RULESET_VERSION,
        catalogueVersion: CATALOGUE_V1.version,
      });
      const canonicalAsymA = runMatch({
        seed,
        fighterA: { build: bulwark.validatedBuild, policy: bulwark.policy },
        fighterB: { build: synthetic.build, policy: synthetic.policy },
        rulesetVersion: RULESET_VERSION,
        catalogueVersion: CATALOGUE_V1.version,
      });
      expectIdentical(historicalAsymA, canonicalAsymA);
    }

    // Immutability through simulation: canonical bytes/checksum/freeze intact.
    expect(serializeOpponentFixture(bulwark)).toBe(beforeBytes);
    expect(bulwark.fixtureChecksum).toBe(beforeChecksum);
    expect(Object.isFrozen(bulwark)).toBe(true);
    expect(Object.isFrozen(bulwark.build)).toBe(true);
    expect(Object.isFrozen(bulwark.build.armour)).toBe(true);
    expect(Object.isFrozen(bulwark.validatedBuild)).toBe(true);
    expect(Object.isFrozen(bulwark.validatedBuild.proposal)).toBe(true);
    expect(Object.isFrozen(bulwark.policy)).toBe(true);
  });
});
