import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import {
  GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_DECISION_ID,
  GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_IDENTITY,
  GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_OUTCOME,
  anchorOfficialGridOptInBetaGovernanceDecision,
} from "../../src/readiness/grid-opt-in-beta-official-identity.js";
import { GRID_OPT_IN_BETA_CONTRACT_CHECKSUM } from "../../src/readiness/grid-opt-in-beta-contract.js";
import {
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT,
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM,
  buildGridOptInBetaReviewedSourceSnapshot,
} from "../../src/readiness/grid-opt-in-beta-source-snapshot.js";
import {
  GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS,
  deriveGridOptInBetaReviewedSourceFacts,
} from "../../src/readiness/grid-opt-in-beta-source-facts.js";
import {
  GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES,
  GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE,
  GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT,
} from "../../src/readiness/grid-opt-in-beta-governance-bundle.js";
import { GRID_OPT_IN_BETA_GOVERNANCE_DEFAULT_ROOT } from "../../src/app/grid-opt-in-beta-governance.js";
import {
  buildGovernanceFixture,
  buildInMemoryReviewedSourceReader,
  officialGovernanceEvidenceAvailable,
} from "../helpers/grid-opt-in-beta-governance-builder.js";

const OFFICIAL_BUNDLE_DIR = join(
  GRID_OPT_IN_BETA_GOVERNANCE_DEFAULT_ROOT,
  GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_DECISION_ID,
);

function readOfficialBundle(): Record<string, string> {
  const contents: Record<string, string> = {};
  for (const name of GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES) {
    contents[name] = readFileSync(join(OFFICIAL_BUNDLE_DIR, name), "utf-8");
  }
  return contents;
}

describe("grid opt in beta official governance identity and anchor (Phase 3F.1 Phases 1 and 6)", () => {
  it("freezes the exact official governance identity", () => {
    const identity = GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_IDENTITY;
    expect(identity.decisionId).toBe("58e8cd87-504e-4b5f-9bac-f6b81d82377b");
    expect(identity.reviewedSourceCommit).toBe(
      "5173fd0f287465e1181969dbad2f37cee10fd47e",
    );
    expect(identity.outcome).toBe("approved_for_bounded_opt_in_beta_implementation");
    expect(identity.contractId).toBe("grid-opt-in-beta-contract-v1");
    expect(identity.contractChecksum).toBe(GRID_OPT_IN_BETA_CONTRACT_CHECKSUM);
    for (const name of GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES) {
      expect(identity.artifactHashes[name], `${name} hash`).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("anchors the unchanged official governance bundle when present", async () => {
    if (!existsSync(OFFICIAL_BUNDLE_DIR)) return;
    const contents = readOfficialBundle();
    const reader = await buildInMemoryReviewedSourceReader();
    const identity = await anchorOfficialGridOptInBetaGovernanceDecision(contents, {
      sourceCommitReader: reader,
    });
    expect(identity).toEqual(GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_IDENTITY);
    expect(identity.outcome).toBe(GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_OUTCOME);
  });

  it("requires the exact official decision ID (rejects a generic coherent bundle)", async () => {
    if (!officialGovernanceEvidenceAvailable()) return;
    const fixture = buildGovernanceFixture();
    const reader = await buildInMemoryReviewedSourceReader();
    await expect(
      anchorOfficialGridOptInBetaGovernanceDecision(fixture.contents, {
        sourceCommitReader: reader,
      }),
    ).rejects.toThrow(/official decision ID/);
  });

  it("requires the reviewed source snapshot to validate (rejects an altered source)", async () => {
    if (!existsSync(OFFICIAL_BUNDLE_DIR)) return;
    const contents = readOfficialBundle();
    const reader = await buildInMemoryReviewedSourceReader({
      "src/simulator/constants.ts":
        'export const SIMULATOR_VERSION = "0.3.0" as const;\nexport const RULESET_VERSION = "0.2.0" as const;\n',
    });
    await expect(
      anchorOfficialGridOptInBetaGovernanceDecision(contents, {
        sourceCommitReader: reader,
      }),
    ).rejects.toThrow(/frozen reviewed source snapshot|canonical/);
  });

  it("requires canonical reviewed source facts (rejects non-canonical facts)", async () => {
    if (!existsSync(OFFICIAL_BUNDLE_DIR)) return;
    const contents = readOfficialBundle();
    const reader = await buildInMemoryReviewedSourceReader();
    const alteredReader = await buildInMemoryReviewedSourceReader({
      "src/simulator/constants.ts":
        'export const SIMULATOR_VERSION = "0.3.0" as const;\nexport const RULESET_VERSION = "0.2.0" as const;\n',
    });
    const built = await buildGridOptInBetaReviewedSourceSnapshot(alteredReader);
    const alteredFacts = deriveGridOptInBetaReviewedSourceFacts(
      built.snapshot,
      built.contents,
    );
    const canonicalBuilt = await buildGridOptInBetaReviewedSourceSnapshot(reader);
    await expect(
      anchorOfficialGridOptInBetaGovernanceDecision(contents, {
        snapshot: canonicalBuilt.snapshot,
        facts: alteredFacts,
      }),
    ).rejects.toThrow(/canonical reviewed source facts/);
  });

  it("rejects a tampered official artifact byte even when present", async () => {
    if (!existsSync(OFFICIAL_BUNDLE_DIR)) return;
    const contents = readOfficialBundle();
    const reader = await buildInMemoryReviewedSourceReader();
    const built = await buildGridOptInBetaReviewedSourceSnapshot(reader);
    const facts = deriveGridOptInBetaReviewedSourceFacts(built.snapshot, built.contents);
    const tampered = {
      ...contents,
      [GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT]: `${contents[GRID_OPT_IN_BETA_GOVERNANCE_REPORT_ARTIFACT]}\ntampered`,
    };
    await expect(
      anchorOfficialGridOptInBetaGovernanceDecision(tampered, {
        snapshot: built.snapshot,
        facts,
      }),
    ).rejects.toThrow(/report|hash/);
  });

  it("freezes the seven official artifact hashes equal to the persisted bundle when present", () => {
    if (!existsSync(OFFICIAL_BUNDLE_DIR)) return;
    const contents = readOfficialBundle();
    for (const name of GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES) {
      expect(sha256Hex(contents[name]!)).toBe(
        GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_IDENTITY.artifactHashes[name],
      );
    }
  });

  it("binds the anchor to the exact reviewed source snapshot checksum", () => {
    expect(GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_IDENTITY.reviewedSourceCommit).toBe(
      GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT,
    );
    expect(GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS.snapshotChecksum).toBe(
      GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM,
    );
    void GRID_OPT_IN_BETA_GOVERNANCE_MANIFEST_FILE;
  });
});
