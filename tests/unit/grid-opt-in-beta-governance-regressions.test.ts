import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import {
  GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_DECISION_ID,
  GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_IDENTITY,
} from "../../src/readiness/grid-opt-in-beta-official-identity.js";
import {
  GRID_OPT_IN_BETA_CONTRACT_CHECKSUM,
  GRID_OPT_IN_BETA_CONTRACT_ID,
} from "../../src/readiness/grid-opt-in-beta-contract.js";
import { GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS } from "../../src/readiness/grid-opt-in-beta-source-facts.js";
import { GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM } from "../../src/readiness/grid-opt-in-beta-source-snapshot.js";
import {
  GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES,
  GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT,
} from "../../src/readiness/grid-opt-in-beta-governance-bundle.js";
import { GRID_OPT_IN_BETA_GOVERNANCE_DEFAULT_ROOT } from "../../src/app/grid-opt-in-beta-governance.js";
import { SIMULATOR_VERSION, RULESET_VERSION } from "../../src/simulator/constants.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import {
  GRID_RUNTIME_IDENTITY,
  LEGACY_RUNTIME_IDENTITY,
} from "../../src/simulator/runtime-identity.js";
import {
  DEFAULT_COMPONENT_QUALIFICATION_ID,
  getComponentQualificationConfig,
  getComponentQualificationConfigChecksum,
} from "../../src/simulator/component-qualification-registry.js";

const ROOT = join(__dirname, "..", "..");

/** Governance provenance modules introduced by Phase 3F.1. */
const PROVENANCE_FILES = [
  "src/readiness/grid-source-commit-reader.ts",
  "src/readiness/grid-opt-in-beta-source-snapshot.ts",
  "src/readiness/grid-opt-in-beta-source-facts.ts",
  "src/readiness/grid-opt-in-beta-source-state-provenance.ts",
  "src/readiness/grid-opt-in-beta-official-identity.ts",
];

const OFFICIAL_BUNDLE_DIR = join(
  GRID_OPT_IN_BETA_GOVERNANCE_DEFAULT_ROOT,
  GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_DECISION_ID,
);

describe("grid opt in beta governance provenance regressions (Phase 3F.1 Phase 10)", () => {
  it("keeps the bounded-beta contract ID and checksum frozen", () => {
    expect(GRID_OPT_IN_BETA_CONTRACT_ID).toBe("grid-opt-in-beta-contract-v1");
    expect(GRID_OPT_IN_BETA_CONTRACT_CHECKSUM).toBe(
      "5f345ce4e933a4cc1f9db7633c1e03d21e8b323d65d36eb7f52ef5251953fff6",
    );
  });

  it("keeps C1/C2/AB2 checksums and the C2 default frozen", () => {
    expect(
      getComponentQualificationConfigChecksum(
        getComponentQualificationConfig("component-impact-c1"),
      ),
    ).toBe("2a40a56f97062ca3");
    expect(
      getComponentQualificationConfigChecksum(
        getComponentQualificationConfig("component-impact-c2"),
      ),
    ).toBe("13548462df34a183");
    expect(
      getComponentQualificationConfigChecksum(
        getComponentQualificationConfig("component-impact-ab2"),
      ),
    ).toBe("6b9f70450d3f10b8");
    expect(DEFAULT_COMPONENT_QUALIFICATION_ID).toBe("component-impact-c2");
    expect(GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS.c1ChecksumIsFrozen).toBe(true);
    expect(GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS.c2ChecksumIsFrozen).toBe(true);
    expect(GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS.ab2ChecksumIsFrozen).toBe(true);
    expect(GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS.c2IsDefault).toBe(true);
  });

  it("keeps the global simulator/ruleset versions, catalogue and grid identity frozen", () => {
    expect(SIMULATOR_VERSION).toBe("0.2.0");
    expect(RULESET_VERSION).toBe("0.2.0");
    expect(CATALOGUE_V1.version).toBe("1");
    expect(GRID_RUNTIME_IDENTITY.simulatorVersion).toBe("0.3.0");
    expect(GRID_RUNTIME_IDENTITY.positioningModel).toBe("grid-3x3-v1");
    expect(LEGACY_RUNTIME_IDENTITY.simulatorVersion).toBe("0.2.0");
    expect(GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS.gridRuntimeIdentity).toEqual({
      simulatorVersion: "0.3.0",
      positioningModel: "grid-3x3-v1",
      rulesetVersion: "0.2.0",
      catalogueVersion: "1",
    });
  });

  it("proves the legacy default and explicit-only grid routing from the reviewed snapshot facts", () => {
    const facts = GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS;
    expect(facts.normalMatchPathUsesLegacyRunMatch).toBe(true);
    expect(facts.normalSeriesPathUsesLegacyRunMatch).toBe(true);
    expect(facts.neitherNormalPathInvokesRunGridMatch).toBe(true);
    expect(facts.gridExistsOnlyAsExplicitAlternateRunGridMatch).toBe(true);
    expect(facts.noNormalCommandAutomaticallySelectsGrid).toBe(true);
  });

  it("proves the schema-v2/v3 persistence and grid replay paths from the reviewed snapshot facts", () => {
    const facts = GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS;
    expect(facts.schemaV2LegacyConverterPathPresent).toBe(true);
    expect(facts.schemaV3GridConverterPathPresent).toBe(true);
    expect(facts.schemaV3ReplayDispatchPresent).toBe(true);
  });

  it("proves both canaries equal the reviewed snapshot through the source binding", () => {
    const facts = GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS;
    expect(facts.bothCanarySourcesMatchReviewedSnapshot).toBe(true);
    expect(facts.matchCanaryIsolated).toBe(true);
    expect(facts.seriesCanaryIsolated).toBe(true);
  });

  it("keeps the official governance bundle bytes unchanged when present", () => {
    if (!existsSync(OFFICIAL_BUNDLE_DIR)) return;
    for (const name of GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES) {
      const bytes = readFileSync(join(OFFICIAL_BUNDLE_DIR, name), "utf-8");
      expect(sha256Hex(bytes)).toBe(
        GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_IDENTITY.artifactHashes[name],
      );
    }
    // The beta-contract artifact is byte-identical to the frozen contract.
    const contractBytes = readFileSync(
      join(OFFICIAL_BUNDLE_DIR, GRID_OPT_IN_BETA_GOVERNANCE_BETA_CONTRACT_ARTIFACT),
      "utf-8",
    );
    expect(sha256Hex(contractBytes)).toBe(GRID_OPT_IN_BETA_CONTRACT_CHECKSUM);
  });

  it("never imports a benchmark, provider or ArenaAgent in governance provenance code", () => {
    for (const file of PROVENANCE_FILES) {
      const source = readFileSync(join(ROOT, file), "utf-8");
      expect(
        /from\s+["'][^"']*bench\//.test(source) ||
          source.includes("benchmark-100-v1.json") ||
          source.includes("--partition"),
        `${file} must not reference a benchmark or seed bank`,
      ).toBe(false);
      expect(
        /from\s+["'][^"']*arena-agent/.test(source) ||
          /\bArenaAgent\b/.test(source.replace(/\/\*[\s\S]*?\*\//g, "")),
        `${file} must not import ArenaAgent`,
      ).toBe(false);
      expect(
        /from\s+["'][^"']*deepseek/.test(source),
        `${file} must not import a provider`,
      ).toBe(false);
    }
  });

  it("never invokes the simulator or runs a match from governance provenance code", () => {
    for (const file of PROVENANCE_FILES) {
      const source = readFileSync(join(ROOT, file), "utf-8");
      expect(
        /from\s+["'][^"']*simulator\/(simulator|grid-runtime)/.test(source),
        `${file} must not import the simulator or grid runtime`,
      ).toBe(false);
      expect(
        /\brunMatch\s*\(|\brunGridMatch\s*\(|\bexecuteGrid/.test(source),
        `${file} must not invoke a match or execution core`,
      ).toBe(false);
    }
  });

  it("freezes the reviewed source snapshot checksum and the canonical facts checksum", () => {
    expect(GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM).toBe(
      "1f984801f6e7ed1809080f88e84004e8dc426de31c2e877dfbbcb09967c3680c",
    );
    expect(GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS.snapshotChecksum).toBe(
      GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM,
    );
  });
});
