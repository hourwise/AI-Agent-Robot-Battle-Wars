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
  // missing artifact). An eleventh file, a hidden file, a nested directory, a
  // symbolic-link artifact or a changed artifact between inventory inspection
  // and read-back all reject before display.
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
    try {
      contents[name] = await fs.readFile(join(dir, name), "utf-8");
    } catch (e) {
      throw new GridBetaReplayError(
        `Grid beta replay bundle is missing or unreadable at ${join(dir, name)}: ${
          e instanceof Error ? e.message : String(e)
        }`,
        { cause: e },
      );
    }
  }
  const validation = validateGridBetaMatchBundle(contents);
  return { contents, validation };
}
