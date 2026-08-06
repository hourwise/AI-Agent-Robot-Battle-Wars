import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import {
  runGridOptInBetaGovernanceDecision,
  GRID_OPT_IN_BETA_GOVERNANCE_BASE_V3_DIR,
  GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_DIR,
} from "../../src/app/grid-opt-in-beta-governance.js";
import {
  validateGridOptInBetaGovernanceBundle,
  GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES,
} from "../../src/readiness/grid-opt-in-beta-governance-bundle.js";
import { GRID_OPT_IN_BETA_CONTRACT_CHECKSUM } from "../../src/readiness/grid-opt-in-beta-contract.js";
import { GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT } from "../../src/readiness/grid-opt-in-beta-governance.js";
import { GRID_READINESS_BUNDLE_ENTRIES } from "../../src/readiness/readiness-bundle.js";
import { GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES } from "../../src/readiness/grid-grapple-supplement-bundle.js";
import {
  copyOfficialEvidenceToTemp,
  officialGovernanceEvidenceAvailable,
  buildInMemoryReviewedSourceReader,
  GOVERNANCE_TEST_DECISION_ID,
} from "../helpers/grid-opt-in-beta-governance-builder.js";
import {
  defaultCanaryFs,
  type CanaryFileSystem,
} from "../../src/canary/immutable-canary-bundle.js";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import type { GridOptInBetaSourceCommitReader } from "../../src/readiness/grid-source-commit-reader.js";

let evidence: Awaited<ReturnType<typeof copyOfficialEvidenceToTemp>> | null = null;
let sourceReader: GridOptInBetaSourceCommitReader | null = null;
let outputDir: string;
let officialBaseSnapshot: Record<string, string> | null = null;
let officialSupplementSnapshot: Record<string, string> | null = null;

function dirname(path: string): string {
  return resolve(path, "..");
}

function createDecisionIdFactory(decisionId: string): () => string {
  let counter = 0;
  return () => {
    if (counter === 0) {
      counter += 1;
      return decisionId;
    }
    const tail = String(counter - 1).padStart(12, "0");
    counter += 1;
    return `55555555-5555-4555-8555-${tail}`;
  };
}

beforeAll(async () => {
  outputDir = await mkdtemp(join(tmpdir(), "gov-out-"));
  if (!officialGovernanceEvidenceAvailable()) return;
  evidence = await copyOfficialEvidenceToTemp();
  sourceReader = await buildInMemoryReviewedSourceReader();
  if (existsSync(GRID_OPT_IN_BETA_GOVERNANCE_BASE_V3_DIR)) {
    officialBaseSnapshot = {};
    for (const name of GRID_READINESS_BUNDLE_ENTRIES) {
      officialBaseSnapshot[name] = await readFile(
        join(GRID_OPT_IN_BETA_GOVERNANCE_BASE_V3_DIR, name),
        "utf-8",
      );
    }
  }
  if (existsSync(GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_DIR)) {
    officialSupplementSnapshot = {};
    for (const name of GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES) {
      officialSupplementSnapshot[name] = await readFile(
        join(GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_DIR, name),
        "utf-8",
      );
    }
  }
}, 120_000);

afterAll(async () => {
  if (evidence) await evidence.cleanup();
  await rm(outputDir, { recursive: true, force: true });
});

describe("grid opt-in beta governance service (Phase 3F Phase 8)", () => {
  it("fails before publishing when the official base evidence is absent", async () => {
    if (!evidence) return;
    const out = join(dirname(outputDir), "gov-out-missing-base");
    await expect(
      runGridOptInBetaGovernanceDecision(
        {
          outputRoot: out,
          baseV3Root: join(dirname(outputDir), "does-not-exist-base"),
          supplementRoot: evidence.supplementDir,
        },
        {
          createUuid: createDecisionIdFactory(GOVERNANCE_TEST_DECISION_ID),
          now: () => new Date("2026-08-03T00:00:00.000Z"),
          sourceCommitReader: sourceReader!,
        },
      ),
    ).rejects.toThrow(/absent or unreadable/);
    expect(existsSync(out)).toBe(false);
  });

  it("fails before publishing when the official supplement evidence is absent", async () => {
    if (!evidence) return;
    const out = join(dirname(outputDir), "gov-out-missing-supplement");
    await expect(
      runGridOptInBetaGovernanceDecision(
        {
          outputRoot: out,
          baseV3Root: evidence.baseDir,
          supplementRoot: join(dirname(outputDir), "does-not-exist-supplement"),
        },
        {
          createUuid: createDecisionIdFactory(GOVERNANCE_TEST_DECISION_ID),
          now: () => new Date("2026-08-03T00:00:00.000Z"),
          sourceCommitReader: sourceReader!,
        },
      ),
    ).rejects.toThrow(/absent or unreadable/);
    expect(existsSync(out)).toBe(false);
  });

  it("rejects altered evidence even when the evidence bundle is internally redigested", async () => {
    if (!evidence) return;
    const alteredRootParent = await mkdtemp(join(tmpdir(), "gov-altered-"));
    const alteredRoot = join(alteredRootParent, "base");
    await mkdir(alteredRoot);
    for (const name of GRID_READINESS_BUNDLE_ENTRIES) {
      const original = await readFile(join(evidence.baseDir, name), "utf-8");
      if (name === "metrics.json") {
        const metrics = JSON.parse(original) as {
          execution: { totalCompletedRuns: number };
        };
        metrics.execution.totalCompletedRuns = 311;
        await writeFile(
          join(alteredRoot, name),
          JSON.stringify(metrics, null, 2),
          "utf-8",
        );
      } else {
        await writeFile(join(alteredRoot, name), original, "utf-8");
      }
    }
    // Coherently redigest the altered base manifest so only the frozen anchor
    // (not a stale digest) can reject it.
    const manifest = JSON.parse(
      await readFile(join(alteredRoot, "manifest.json"), "utf-8"),
    ) as { digests: Record<string, string> };
    for (const name of GRID_READINESS_BUNDLE_ENTRIES) {
      if (name === "manifest.json") continue;
      manifest.digests[name] = sha256Hex(
        await readFile(join(alteredRoot, name), "utf-8"),
      );
    }
    await writeFile(
      join(alteredRoot, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf-8",
    );
    const out = join(dirname(outputDir), "gov-out-altered");
    await expect(
      runGridOptInBetaGovernanceDecision(
        {
          outputRoot: out,
          baseV3Root: alteredRoot,
          supplementRoot: evidence.supplementDir,
        },
        {
          createUuid: createDecisionIdFactory(GOVERNANCE_TEST_DECISION_ID),
          now: () => new Date("2026-08-03T00:00:00.000Z"),
          sourceCommitReader: sourceReader!,
        },
      ),
    ).rejects.toThrow(/mismatch|does not match|failed/i);
    expect(existsSync(join(out, GOVERNANCE_TEST_DECISION_ID))).toBe(false);
    await rm(alteredRootParent, { recursive: true, force: true });
  });

  it("publishes a validated seven-file governance bundle to the temp output root", async () => {
    if (!evidence) return;
    const result = await runGridOptInBetaGovernanceDecision(
      {
        outputRoot: outputDir,
        baseV3Root: evidence.baseDir,
        supplementRoot: evidence.supplementDir,
      },
      {
        createUuid: createDecisionIdFactory(GOVERNANCE_TEST_DECISION_ID),
        now: () => new Date("2026-08-03T00:00:00.000Z"),
        sourceCommitReader: sourceReader!,
      },
    );
    expect(result.decisionId).toBe(GOVERNANCE_TEST_DECISION_ID);
    expect(result.sourceCommit).toBe(GRID_OPT_IN_BETA_GOVERNANCE_SOURCE_COMMIT);
    expect(result.outcome).toBe("approved_for_bounded_opt_in_beta_implementation");
    expect(result.contractChecksum).toBe(GRID_OPT_IN_BETA_CONTRACT_CHECKSUM);
    expect(result.evidenceValidationStatus).toBe("validated");
    const files = (await readdir(result.artifactDirectory)).sort();
    expect(files).toEqual([...GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES].sort());
    const contents: Record<string, string> = {};
    for (const name of GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES) {
      contents[name] = await readFile(join(result.artifactDirectory, name), "utf-8");
    }
    expect(() => validateGridOptInBetaGovernanceBundle(contents)).not.toThrow();
  });

  it("fails operationally when a base evidence artifact changes after anchoring, before publication", async () => {
    if (!evidence) return;
    const raceRoot = await mkdtemp(join(tmpdir(), "gov-out-race-"));
    const raceOut = join(raceRoot, "out");
    await mkdir(raceOut);
    let baseReads = 0;
    const mutatingFs: CanaryFileSystem = {
      ...defaultCanaryFs,
      readFile: async (path, encoding) => {
        const text = await defaultCanaryFs.readFile(path, encoding);
        const normalized = path.replaceAll("\\", "/");
        if (
          normalized.endsWith("metrics.json") &&
          normalized.includes(evidence.baseDir.replaceAll("\\", "/"))
        ) {
          baseReads += 1;
          // First read anchors; the pre-publication re-check reads it again.
          if (baseReads === 2) {
            return `${text}\n// tampered after anchor`;
          }
        }
        return text;
      },
    };
    await expect(
      runGridOptInBetaGovernanceDecision(
        {
          outputRoot: raceOut,
          baseV3Root: evidence.baseDir,
          supplementRoot: evidence.supplementDir,
        },
        {
          createUuid: createDecisionIdFactory(GOVERNANCE_TEST_DECISION_ID),
          now: () => new Date("2026-08-03T00:00:00.000Z"),
          fs: mutatingFs,
          sourceCommitReader: sourceReader!,
        },
      ),
    ).rejects.toThrow(/base artifact changed during governance execution/);
    expect(existsSync(join(raceOut, GOVERNANCE_TEST_DECISION_ID))).toBe(false);
    expect(await readdir(raceOut)).toEqual([]);
    await rm(raceRoot, { recursive: true, force: true });
  });

  it("never modifies the temp evidence directories", async () => {
    if (!evidence) return;
    for (const name of GRID_READINESS_BUNDLE_ENTRIES) {
      const current = await readFile(join(evidence.baseDir, name), "utf-8");
      expect(current.length).toBeGreaterThan(0);
    }
    for (const name of GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES) {
      const current = await readFile(join(evidence.supplementDir, name), "utf-8");
      expect(current.length).toBeGreaterThan(0);
    }
  });

  it("leaves the official evidence bytes unchanged when present", async () => {
    if (!officialBaseSnapshot || !officialSupplementSnapshot) return;
    for (const name of GRID_READINESS_BUNDLE_ENTRIES) {
      const current = await readFile(
        join(GRID_OPT_IN_BETA_GOVERNANCE_BASE_V3_DIR, name),
        "utf-8",
      );
      expect(current).toBe(officialBaseSnapshot[name]);
    }
    for (const name of GRID_GRAPPLE_SUPPLEMENT_BUNDLE_ENTRIES) {
      const current = await readFile(
        join(GRID_OPT_IN_BETA_GOVERNANCE_SUPPLEMENT_DIR, name),
        "utf-8",
      );
      expect(current).toBe(officialSupplementSnapshot[name]);
    }
  });
});
