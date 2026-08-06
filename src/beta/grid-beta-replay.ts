import { join } from "node:path";
import {
  defaultCanaryFs,
  type CanaryFileSystem,
} from "../canary/immutable-canary-bundle.js";
import {
  GRID_BETA_MATCH_BUNDLE_ENTRIES,
  validateGridBetaMatchBundle,
  type GridBetaMatchBundleValidationResult,
} from "./grid-beta-match-bundle.js";

/**
 * Read-only grid beta replay (Milestone 0.2C Phase 3G, Phase 11).
 *
 * Loads a stored beta match bundle from the fixed root, validates the
 * complete ten-file bundle before anything is displayed, and returns the
 * contents for rendering. It performs no simulation, calls no provider, does
 * not read normal match storage and intentionally ignores the suspension
 * marker so existing v3 beta replays remain readable while the beta is
 * suspended.
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
