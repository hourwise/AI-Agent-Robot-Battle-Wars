import { join } from "node:path";
import {
  assertExactBundleInventory,
  defaultCanaryFs,
  type CanaryFileSystem,
} from "../canary/immutable-canary-bundle.js";
import {
  GRID_BETA_MATCH_BUNDLE_ENTRIES,
  validateGridBetaMatchBundle,
  type GridBetaMatchBundleValidationResult,
} from "./grid-beta-match-bundle.js";

/**
 * Read-only grid beta replay (Milestone 0.2C Phase 3G, Phase 11; Phase 3G.1,
 * Phase 13).
 *
 * Loads a stored beta match bundle from the fixed root. The physical match
 * directory must contain exactly the ten expected entries — regular files
 * only, no symbolic links, no directories, no hidden or unexpected file and
 * no missing artifact — before any content is read. The complete ten-file
 * bundle is then validated before anything is displayed. It performs no
 * simulation, calls no provider, does not read normal match storage and
 * intentionally ignores the suspension marker so existing v3 beta replays
 * remain readable while the beta is suspended.
 */

export class GridBetaReplayError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GridBetaReplayError";
  }
}

export interface LoadedGridBetaReplayBundle {
  readonly contents: Record<string, string>;
  readonly validation: GridBetaMatchBundleValidationResult;
}

/**
 * Reads and fully validates a stored beta match bundle. The complete bundle
 * is validated before any replay text is displayed.
 *
 * Physical regular-file identity is required before and after every read
 * (Milestone 0.2C Phase 3G.1.1, Phase 3): the exact ten-entry inventory is
 * required first, then each artifact is `lstat`-verified as a regular
 * non-symbolic-link file before reading, read exactly, and `lstat`-verified
 * again immediately after reading, then the exact inventory is required once
 * more before semantic validation. A substitution from regular file to
 * symbolic link — even when the read returns the original bytes — rejects
 * through the physical regular-file rule, never through semantic corruption.
 */
export async function loadValidatedGridBetaReplayBundle(
  outputRoot: string,
  matchId: string,
  fs: CanaryFileSystem = defaultCanaryFs,
): Promise<LoadedGridBetaReplayBundle> {
  const dir = join(outputRoot, matchId);
  // Phase 13: before reading any replay content, require the physical match
  // directory to contain exactly the ten expected entries as regular files
  // (no symbolic links, no directories, no hidden or unexpected file, no
  // missing artifact).
  try {
    await assertExactBundleInventory(fs, dir, GRID_BETA_MATCH_BUNDLE_ENTRIES);
  } catch (e) {
    throw new GridBetaReplayError(
      `Grid beta replay bundle inventory is invalid at ${dir}: ${e instanceof Error ? e.message : String(e)}`,
      { cause: e },
    );
  }
  const contents: Record<string, string> = {};
  for (const name of GRID_BETA_MATCH_BUNDLE_ENTRIES) {
    const path = join(dir, name);
    try {
      // lstat before read: require a regular non-symbolic-link file.
      const before = await fs.lstat(path);
      if (before.isSymbolicLink() || !before.isFile()) {
        throw new GridBetaReplayError(
          `Grid beta replay artifact ${name} must be a regular file, not a symbolic link or directory (before read): ${path}`,
        );
      }
      // Read the exact contents.
      contents[name] = await fs.readFile(path, "utf-8");
      // lstat after read: require a regular non-symbolic-link file again.
      const after = await fs.lstat(path);
      if (after.isSymbolicLink() || !after.isFile()) {
        throw new GridBetaReplayError(
          `Grid beta replay artifact ${name} changed while being read (not a regular file after read): ${path}`,
        );
      }
    } catch (e) {
      if (e instanceof GridBetaReplayError) throw e;
      throw new GridBetaReplayError(
        `Grid beta replay bundle is missing or unreadable at ${path}: ${
          e instanceof Error ? e.message : String(e)
        }`,
        { cause: e },
      );
    }
  }
  // Re-run the exact inventory after all ten reads, before semantic
  // validation, so any physical inventory change while the bundle was being
  // read rejects.
  try {
    await assertExactBundleInventory(fs, dir, GRID_BETA_MATCH_BUNDLE_ENTRIES);
  } catch (e) {
    throw new GridBetaReplayError(
      `Grid beta replay bundle inventory changed while it was being read at ${dir}: ${e instanceof Error ? e.message : String(e)}`,
      { cause: e },
    );
  }
  const validation = validateGridBetaMatchBundle(contents);
  return { contents, validation };
}
