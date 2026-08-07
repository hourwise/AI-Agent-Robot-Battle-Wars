import { join, resolve, sep } from "node:path";
import {
  defaultCanaryFs,
  type CanaryFileSystem,
} from "../../src/canary/immutable-canary-bundle.js";
import {
  GRID_OPT_IN_BETA_FIGHTER_ROOT,
  GRID_OPT_IN_BETA_MATCH_OUTPUT_ROOT,
  GRID_OPT_IN_BETA_SUSPENSION_MARKER_PATH,
} from "../../src/beta/grid-beta-identity.js";
import { GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_DIR } from "../../src/app/grid-beta-match.js";

/**
 * Test-only path-remapping `CanaryFileSystem` (Milestone 0.2C Phase 3G.1.2,
 * Phase 2).
 *
 * Production `runGridBetaMatch` always uses the frozen canonical beta paths
 * (`data/beta/grid-fighters`, `data/beta/grid-matches`,
 * `data/readiness/grid-governance/<official-id>` and
 * `data/beta/GRID_BETA_SUSPENDED`) and exposes no alternate-root API. Tests
 * still need temporary storage, so this wrapper transparently redirects
 * those canonical logical paths onto an external temporary directory:
 *
 *   <repo>/data/beta/grid-fighters            -> <temp>/fighters
 *   <repo>/data/beta/grid-matches             -> <temp>/matches
 *   <repo>/data/beta/GRID_BETA_SUSPENDED      -> <temp>/marker
 *   <repo>/data/readiness/grid-governance/<id> -> <temp>/governance
 *
 * The marker parent `<repo>/data/beta` is redirected to the temporary root
 * (the marker parent directory), so no real `data/beta` tree is ever created.
 * Every other path — including the ordinary repository/source-file reads used
 * by the protected legacy-source preflight — passes through to the genuine
 * checkout untouched. This remapping exists only in test code; production
 * source contains no alternate-root API.
 */
export interface GridBetaMappedFsTargets {
  readonly fighterRoot: string;
  readonly outputRoot: string;
  readonly governanceDir: string;
  readonly markerPath: string;
  /** Temp directory standing in for the real `data/beta` (marker parent). */
  readonly dataBetaDir?: string;
}

/** Builds the ordered logical→temp prefix mappings (most specific first). */
function buildGridBetaMappings(
  targets: GridBetaMappedFsTargets,
): ReadonlyArray<{ logical: string; temp: string }> {
  const dataBetaDir = resolve(targets.dataBetaDir ?? resolve(targets.markerPath, ".."));
  return [
    {
      logical: resolve(GRID_OPT_IN_BETA_SUSPENSION_MARKER_PATH),
      temp: resolve(targets.markerPath),
    },
    {
      logical: resolve(GRID_OPT_IN_BETA_FIGHTER_ROOT),
      temp: resolve(targets.fighterRoot),
    },
    {
      logical: resolve(GRID_OPT_IN_BETA_MATCH_OUTPUT_ROOT),
      temp: resolve(targets.outputRoot),
    },
    {
      logical: resolve(GRID_OPT_IN_BETA_GOVERNANCE_BUNDLE_DIR),
      temp: resolve(targets.governanceDir),
    },
    { logical: resolve(join(process.cwd(), "data", "beta")), temp: dataBetaDir },
  ];
}

/**
 * Maps a canonical logical beta path to the corresponding temporary path for
 * the given targets. Paths outside the beta roots pass through unchanged.
 */
export function gridBetaMappedPath(
  targets: GridBetaMappedFsTargets,
  logicalPath: string,
): string {
  const normalized = resolve(logicalPath);
  for (const { logical, temp } of buildGridBetaMappings(targets)) {
    if (normalized === logical) return temp;
    if (normalized.startsWith(logical + sep))
      return temp + normalized.slice(logical.length);
  }
  return logicalPath;
}

export function createGridBetaMappedFs(
  targets: GridBetaMappedFsTargets,
): CanaryFileSystem {
  const mappings = buildGridBetaMappings(targets);
  const map = (path: string): string => {
    const normalized = resolve(path);
    for (const { logical, temp } of mappings) {
      if (normalized === logical) return temp;
      if (normalized.startsWith(logical + sep))
        return temp + normalized.slice(logical.length);
    }
    return path;
  };
  return {
    mkdir: async (path, options) => defaultCanaryFs.mkdir(map(path), options),
    writeFile: async (path, data, encoding) =>
      defaultCanaryFs.writeFile(map(path), data, encoding),
    writeFileExclusive: async (path, data, encoding) =>
      defaultCanaryFs.writeFileExclusive(map(path), data, encoding),
    readFile: async (path, encoding) => defaultCanaryFs.readFile(map(path), encoding),
    readdir: async (path) => defaultCanaryFs.readdir(map(path)),
    lstat: async (path) => defaultCanaryFs.lstat(map(path)),
    rename: async (from, to) => defaultCanaryFs.rename(map(from), map(to)),
    rm: async (path, options) => defaultCanaryFs.rm(map(path), options),
  };
}
