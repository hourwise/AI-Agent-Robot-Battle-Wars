import { describe, expect, it } from "vitest";
import {
  GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS,
  assertGridOptInBetaReviewedSourceFactsCanonical,
  deriveGridOptInBetaReviewedSourceFacts,
} from "../../src/readiness/grid-opt-in-beta-source-facts.js";
import {
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT,
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM,
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_ID,
  buildGridOptInBetaReviewedSourceSnapshot,
} from "../../src/readiness/grid-opt-in-beta-source-snapshot.js";
import { buildInMemoryReviewedSourceReader } from "../helpers/grid-opt-in-beta-governance-builder.js";

describe("grid opt in beta reviewed source facts (Phase 3F.1 Phase 4)", () => {
  it("derives the canonical facts from the exact committed bytes", async () => {
    const reader = await buildInMemoryReviewedSourceReader();
    const built = await buildGridOptInBetaReviewedSourceSnapshot(reader);
    const facts = deriveGridOptInBetaReviewedSourceFacts(built.snapshot, built.contents);
    expect(facts.snapshotId).toBe(GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_ID);
    expect(facts.sourceCommit).toBe(GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT);
    expect(facts.snapshotChecksum).toBe(
      GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM,
    );
    expect(facts).toEqual(GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS);
    expect(() => assertGridOptInBetaReviewedSourceFactsCanonical(facts)).not.toThrow();
  });

  it("carries every explicit required source fact", () => {
    const facts = GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS;
    expect(facts.snapshotId).toBe("grid-opt-in-beta-reviewed-source-v1");
    expect(facts.sourceCommit).toBe("5173fd0f287465e1181969dbad2f37cee10fd47e");
    expect(facts.normalMatchPathUsesLegacyRunMatch).toBe(true);
    expect(facts.normalSeriesPathUsesLegacyRunMatch).toBe(true);
    expect(facts.neitherNormalPathInvokesRunGridMatch).toBe(true);
    expect(facts.gridExistsOnlyAsExplicitAlternateRunGridMatch).toBe(true);
    expect(facts.noNormalCommandAutomaticallySelectsGrid).toBe(true);
    expect(facts.globalSimulatorVersion).toBe("0.2.0");
    expect(facts.globalRulesetVersion).toBe("0.2.0");
    expect(facts.catalogueVersion).toBe("1");
    expect(facts.gridRuntimeIdentity).toEqual({
      simulatorVersion: "0.3.0",
      positioningModel: "grid-3x3-v1",
      rulesetVersion: "0.2.0",
      catalogueVersion: "1",
    });
    expect(facts.normalRuntimeIdentity).toEqual({
      simulatorVersion: "0.2.0",
      positioningModel: "legacy-five-zone-v1",
      rulesetVersion: "0.2.0",
      catalogueVersion: "1",
    });
    expect(facts.schemaV2LegacyConverterPathPresent).toBe(true);
    expect(facts.schemaV3GridConverterPathPresent).toBe(true);
    expect(facts.schemaV3ReplayDispatchPresent).toBe(true);
    expect(facts.bothCanarySourcesMatchReviewedSnapshot).toBe(true);
    expect(facts.matchCanaryIsolated).toBe(true);
    expect(facts.seriesCanaryIsolated).toBe(true);
    expect(facts.c1ChecksumIsFrozen).toBe(true);
    expect(facts.c2ChecksumIsFrozen).toBe(true);
    expect(facts.ab2ChecksumIsFrozen).toBe(true);
    expect(facts.c2IsDefault).toBe(true);
  });

  it("does not hard-code the canary booleans: they are derived from the snapshot and frozen hashes", async () => {
    const reader = await buildInMemoryReviewedSourceReader({
      "src/app/grid-match-canary.ts": "// altered canary source\n",
    });
    const built = await buildGridOptInBetaReviewedSourceSnapshot(reader);
    const facts = deriveGridOptInBetaReviewedSourceFacts(built.snapshot, built.contents);
    expect(facts.matchCanaryIsolated).toBe(false);
    expect(facts.seriesCanaryIsolated).toBe(true);
    expect(facts.bothCanarySourcesMatchReviewedSnapshot).toBe(false);
    expect(() => assertGridOptInBetaReviewedSourceFactsCanonical(facts)).toThrow(
      /canonical/,
    );
  });

  it("rejects committed content that does not hash to its snapshot entry", async () => {
    const reader = await buildInMemoryReviewedSourceReader();
    const built = await buildGridOptInBetaReviewedSourceSnapshot(reader);
    const tampered = {
      ...built.contents,
      "src/simulator/constants.ts": `${built.contents["src/simulator/constants.ts"]}\n// tampered`,
    };
    expect(() =>
      deriveGridOptInBetaReviewedSourceFacts(built.snapshot, tampered),
    ).toThrow(/does not match its snapshot hash/);
  });

  it("derives non-canonical facts from an altered reviewed source and rejects through the canonical rule", async () => {
    const reader = await buildInMemoryReviewedSourceReader({
      "src/simulator/constants.ts":
        'export const SIMULATOR_VERSION = "0.3.0" as const;\nexport const RULESET_VERSION = "0.2.0" as const;\n',
    });
    const built = await buildGridOptInBetaReviewedSourceSnapshot(reader);
    const facts = deriveGridOptInBetaReviewedSourceFacts(built.snapshot, built.contents);
    expect(facts.globalSimulatorVersion).toBe("0.3.0");
    expect(facts.normalMatchPathUsesLegacyRunMatch).toBe(true);
    expect(() => assertGridOptInBetaReviewedSourceFactsCanonical(facts)).toThrow(
      /reviewed source fact globalSimulatorVersion/,
    );
  });

  it("derives C1/C2/AB2 checksums and the C2 default from the committed registry source", async () => {
    const facts = GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS;
    expect(facts.c1ChecksumIsFrozen).toBe(true);
    expect(facts.c2ChecksumIsFrozen).toBe(true);
    expect(facts.ab2ChecksumIsFrozen).toBe(true);
    expect(facts.c2IsDefault).toBe(true);
  });
});
