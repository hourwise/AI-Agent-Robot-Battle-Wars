import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultCanaryFs } from "../../src/canary/immutable-canary-bundle.js";
import { sha256Hex } from "../../src/canary/grid-canary-digest.js";
import {
  GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_DIR,
  runGridBetaMatch,
} from "../../src/app/grid-beta-match.js";
import {
  GRID_BETA_MATCH_BUNDLE_ENTRIES,
  GRID_BETA_MATCH_MANIFEST_FILE,
  GRID_BETA_MATCH_NON_MANIFEST_ARTIFACTS,
} from "../../src/beta/grid-beta-match-bundle.js";
import { GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES } from "../../src/readiness/grid-opt-in-beta-governance-bundle.js";
import { buildInMemoryReviewedSourceReader } from "./grid-opt-in-beta-governance-builder.js";

export const BETA_TEST_MATCH_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const BETA_TEST_CREATED_AT = "2026-08-06T00:00:00.000Z";
export const BETA_TEST_SEED = 12345;

function buildProposal(machineName: string): Record<string, unknown> {
  return {
    machineName,
    chassisId: "heavy",
    mobilityId: "tracks",
    weaponId: "ram",
    utilityId: "reinforced_drive",
    armour: { front: 60, left: 15, right: 15, rear: 0, top: 0 },
    designSummary: "A forward assault machine with heavy frontal armour.",
    designRationale: "Maximise frontal protection and close-range ram damage.",
  };
}

/** A valid local-scripted fighter spec (fighterId `alpha`). */
export const ALPHA_FIGHTER_SPEC: Record<string, unknown> = {
  schemaVersion: "1",
  sourceKind: "local-scripted",
  fighterId: "alpha",
  displayName: "Alpha",
  buildProposal: buildProposal("Alpha"),
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
};

/** A second valid local-scripted fighter spec (fighterId `beta`). */
export const BETA_FIGHTER_SPEC: Record<string, unknown> = {
  schemaVersion: "1",
  sourceKind: "local-scripted",
  fighterId: "beta",
  displayName: "Beta",
  buildProposal: buildProposal("Beta"),
  policy: {
    opening: "cautious",
    preferredRange: "medium",
    aggression: 55,
    primaryTarget: "front",
    secondaryTarget: "front",
    retreatThreshold: 25,
    heatThreshold: 80,
    fallback: "defend",
  },
};

export function officialGovernanceBundleAvailable(): boolean {
  return existsSync(GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_DIR);
}

export interface BetaTempEnvironment {
  readonly root: string;
  readonly fighterRoot: string;
  readonly outputRoot: string;
  readonly markerPath: string;
  readonly governanceDir: string;
  readonly sourceReader: Awaited<ReturnType<typeof buildInMemoryReviewedSourceReader>>;
  cleanup: () => Promise<void>;
}

/**
 * Creates a hermetic temporary beta environment: fighter root (with the alpha
 * and beta specs), output root, suspension marker path, and a byte-for-byte
 * copy of the official seven-file governance bundle. Never writes to real
 * beta or official storage.
 */
export async function createBetaTempEnvironment(): Promise<BetaTempEnvironment> {
  const root = await mkdtemp(join(tmpdir(), "beta-test-"));
  const fighterRoot = join(root, "fighters");
  const outputRoot = join(root, "matches");
  const governanceDir = join(root, "governance");
  const markerPath = join(root, "GRID_BETA_SUSPENDED");
  await mkdir(fighterRoot);
  // The external temp output root must already exist as a real directory for
  // the physical-root guard.
  await mkdir(outputRoot);
  await mkdir(governanceDir);
  for (const name of GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_ENTRIES) {
    const text = readFileSync(
      join(GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_DIR, name),
      "utf-8",
    );
    await writeFile(join(governanceDir, name), text, "utf-8");
  }
  await writeFile(
    join(fighterRoot, "alpha.json"),
    JSON.stringify(ALPHA_FIGHTER_SPEC, null, 2),
    "utf-8",
  );
  await writeFile(
    join(fighterRoot, "beta.json"),
    JSON.stringify(BETA_FIGHTER_SPEC, null, 2),
    "utf-8",
  );
  const sourceReader = await buildInMemoryReviewedSourceReader();
  return {
    root,
    fighterRoot,
    outputRoot,
    markerPath,
    governanceDir,
    sourceReader,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

/** Runs one real beta match into the temp output root with fixed identity. */
export async function runBetaMatchToTemp(
  env: BetaTempEnvironment,
  options: {
    seed?: number;
    fighterA?: string;
    fighterB?: string;
    markerPath?: string;
  } = {},
) {
  return runGridBetaMatch(
    {
      seed: options.seed ?? BETA_TEST_SEED,
      fighterA: options.fighterA ?? "alpha",
      fighterB: options.fighterB ?? "beta",
      acknowledgement: true,
      outputRoot: env.outputRoot,
      fighterRoot: env.fighterRoot,
      governanceBundleDir: env.governanceDir,
      suspensionMarkerPath: options.markerPath ?? env.markerPath,
    },
    {
      createUuid: () => BETA_TEST_MATCH_ID,
      now: () => new Date(BETA_TEST_CREATED_AT),
      fs: defaultCanaryFs,
      sourceCommitReader: env.sourceReader,
    },
  );
}

/** Reads the ten persisted beta bundle files from an artifact directory. */
export async function readBetaBundle(dir: string): Promise<Record<string, string>> {
  const contents: Record<string, string> = {};
  for (const name of GRID_BETA_MATCH_BUNDLE_ENTRIES) {
    contents[name] = await readFile(join(dir, name), "utf-8");
  }
  return contents;
}

/** Coherently redigests a mutated beta bundle so no stale digest is the reason. */
export function redigestBetaBundle(
  corrupted: Record<string, string>,
): Record<string, string> {
  const manifest = JSON.parse(corrupted[GRID_BETA_MATCH_MANIFEST_FILE]!) as {
    digests: Record<string, string>;
  };
  for (const name of GRID_BETA_MATCH_NON_MANIFEST_ARTIFACTS) {
    manifest.digests[name] = sha256Hex(corrupted[name]!);
  }
  corrupted[GRID_BETA_MATCH_MANIFEST_FILE] = JSON.stringify(manifest, null, 2);
  return corrupted;
}
