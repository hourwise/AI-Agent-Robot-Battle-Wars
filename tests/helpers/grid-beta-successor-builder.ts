import {
  GitSourceCommitReader,
  type GridOptInBetaSourceCommitReader,
} from "../../src/readiness/grid-source-commit-reader.js";
import {
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT,
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_PATHS,
} from "../../src/readiness/grid-opt-in-beta-source-snapshot.js";
import {
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_PATH,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_PATHS,
} from "../../src/beta/grid-beta-legacy-isolation-reviewed-source-v2.js";

/**
 * Test-only dual-commit Git-object reader (Milestone 0.2D Phase 3C, Commit G).
 *
 * The grid-beta service now validates BOTH the original governance reviewed
 * commit (`5173fd0f…`) and the successor source Commit M (`e6d981f…`). This
 * helper serves exact committed bytes for BOTH commits (read once through the
 * real Git reader and cached), with independent explicit test-only corruption
 * controls for each commit's bytes. Production APIs gain no alternate
 * source-root or untrusted snapshot injection.
 */

interface CommitBlob {
  sha: string;
  bytes: Uint8Array;
}

let cache: { v1: Map<string, CommitBlob>; v2: Map<string, CommitBlob> } | null = null;

async function loadCommit(
  commit: string,
  paths: readonly string[],
): Promise<Map<string, CommitBlob>> {
  const real = new GitSourceCommitReader();
  const map = new Map<string, CommitBlob>();
  for (const path of paths) {
    const sha = await real.readBlobSha(commit, path);
    const bytes = await real.readBlobBytes(commit, path);
    map.set(path, { sha, bytes });
  }
  return map;
}

async function getDualData(): Promise<{
  v1: Map<string, CommitBlob>;
  v2: Map<string, CommitBlob>;
}> {
  if (cache !== null) return cache;
  const v2Paths: readonly string[] = [
    ...GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_PATHS,
    GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_PATH,
  ];
  cache = {
    v1: await loadCommit(
      GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT,
      GRID_OPT_IN_BETA_REVIEWED_SOURCE_PATHS,
    ),
    v2: await loadCommit(GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT, v2Paths),
  };
  return cache;
}

export interface DualCommitReaderOverrides {
  /** Override committed bytes for selected original-v1 commit paths. */
  readonly v1?: Record<string, string>;
  /** Override committed bytes for selected successor Commit-M paths. */
  readonly v2?: Record<string, string>;
  /** Commits reported unavailable (missing/shallow) for fail-closed tests. */
  readonly unavailableCommits?: readonly string[];
}

/**
 * Builds an in-memory reader serving exact committed bytes for both the
 * original v1 commit and the successor Commit M. `overrides` replace the
 * committed bytes independently per commit/path while retaining the commit
 * label (used by coherent corruption tests).
 */
export async function buildDualCommitInMemorySourceReader(
  overrides: DualCommitReaderOverrides = {},
): Promise<GridOptInBetaSourceCommitReader> {
  const data = await getDualData();
  const commits = new Map<string, Map<string, CommitBlob>>([
    [GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT, data.v1],
    [GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT, data.v2],
  ]);
  const ov1 = overrides.v1 ?? {};
  const ov2 = overrides.v2 ?? {};
  const unavailable = overrides.unavailableCommits ?? [];
  return {
    commitAvailable: async (c) => !unavailable.includes(c) && commits.has(c),
    blobAvailable: async (c, p) => commits.get(c)?.has(p) ?? false,
    readBlobSha: async (c, p) => {
      const entry = commits.get(c)?.get(p);
      if (!entry) throw new Error(`blob ${p} unavailable at commit ${c}`);
      return entry.sha;
    },
    readBlobBytes: async (c, p) => {
      const entry = commits.get(c)?.get(p);
      if (!entry) throw new Error(`blob ${p} unavailable at commit ${c}`);
      const override = c === GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT ? ov1[p] : ov2[p];
      if (override !== undefined) return new TextEncoder().encode(override);
      return entry.bytes;
    },
  };
}

/** A reader reporting both commits unavailable (missing/shallow). */
export function buildDualUnavailableCommitReader(): GridOptInBetaSourceCommitReader {
  return {
    commitAvailable: async () => false,
    blobAvailable: async () => false,
    readBlobSha: async (_c, p) => {
      throw new Error(`blob ${p} unavailable`);
    },
    readBlobBytes: async (_c, p) => {
      throw new Error(`blob ${p} unavailable`);
    },
  };
}
