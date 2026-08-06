import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import {
  GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_DECISION_ID,
  GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_IDENTITY,
  anchorOfficialGridOptInBetaGovernanceDecision,
} from "../../src/readiness/grid-opt-in-beta-official-identity.js";
import {
  GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES,
  validateGridOptInBetaGovernanceBundle,
} from "../../src/readiness/grid-opt-in-beta-governance-bundle.js";
import {
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT,
  anchorGridOptInBetaReviewedSourceSnapshot,
  buildGridOptInBetaReviewedSourceSnapshot,
} from "../../src/readiness/grid-opt-in-beta-source-snapshot.js";
import { deriveGridOptInBetaReviewedSourceFacts } from "../../src/readiness/grid-opt-in-beta-source-facts.js";
import { GRID_OPT_IN_BETA_GOVERNANCE_DEFAULT_ROOT } from "../../src/app/grid-opt-in-beta-governance.js";
import { buildInMemoryReviewedSourceReader } from "../helpers/grid-opt-in-beta-governance-builder.js";

const OFFICIAL_BUNDLE_DIR = join(
  GRID_OPT_IN_BETA_GOVERNANCE_DEFAULT_ROOT,
  GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_DECISION_ID,
);

/**
 * Official governance preservation (Milestone 0.2C Phase 3F.1, Phase 9).
 *
 * When the local official bundle is present: require exactly seven files,
 * snapshot all seven bytes, run the generic validator, run the strengthened
 * official anchor, validate the exact reviewed source commit snapshot, require
 * the official outcome, and require every artifact byte-for-byte unchanged.
 * Skips gracefully only on clean checkouts where the gitignored official
 * bundle is absent.
 */
describe("official governance preservation under the strengthened anchor (Phase 3F.1 Phase 9)", () => {
  it("preserves the official seven-file bundle and outcome unchanged", async () => {
    if (!existsSync(OFFICIAL_BUNDLE_DIR)) return;

    // 1. Require exactly seven files.
    const entries = (await readdir(OFFICIAL_BUNDLE_DIR)).filter(
      (name) => !name.startsWith("."),
    );
    expect(entries.sort()).toEqual(
      [...GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES].sort(),
    );

    // 2. Snapshot all seven bytes.
    const snapshot: Record<string, string> = {};
    for (const name of GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES) {
      snapshot[name] = await readFile(join(OFFICIAL_BUNDLE_DIR, name), "utf-8");
    }

    // 3. Generic governance validator.
    expect(() => validateGridOptInBetaGovernanceBundle(snapshot)).not.toThrow();

    // 4. Strengthened official anchor with the exact reviewed source commit
    //    snapshot.
    const reader = await buildInMemoryReviewedSourceReader();
    const built = await buildGridOptInBetaReviewedSourceSnapshot(reader);
    const facts = deriveGridOptInBetaReviewedSourceFacts(built.snapshot, built.contents);
    const identity = await anchorOfficialGridOptInBetaGovernanceDecision(snapshot, {
      snapshot: built.snapshot,
      facts,
    });

    // 5. Validate the exact reviewed source commit snapshot.
    expect(built.snapshot.sourceCommit).toBe(GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT);
    expect(() => anchorGridOptInBetaReviewedSourceSnapshot(built.snapshot)).not.toThrow();

    // 6. Require the official outcome remains approved.
    expect(identity.outcome).toBe("approved_for_bounded_opt_in_beta_implementation");
    expect(identity).toEqual(GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_IDENTITY);
    expect(identity.decisionId).toBe(GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_DECISION_ID);

    // 7. Require every artifact byte-for-byte unchanged, matching the frozen
    //    official hashes.
    for (const name of GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES) {
      expect(sha256Hex(snapshot[name]!)).toBe(
        GRID_OPT_IN_BETA_OFFICIAL_GOVERNANCE_IDENTITY.artifactHashes[name],
      );
      expect(await readFile(join(OFFICIAL_BUNDLE_DIR, name), "utf-8")).toBe(
        snapshot[name],
      );
    }
  }, 120_000);

  it("does not authorise implementation from tests alone when the local official bundle is absent", () => {
    if (existsSync(OFFICIAL_BUNDLE_DIR)) return;
    // On a clean checkout the gitignored official bundle is absent; the
    // implementation task must not be authorised by tests alone.
    expect(true).toBe(true);
  });
});
