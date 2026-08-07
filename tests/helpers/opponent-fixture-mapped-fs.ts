import { resolve, sep } from "node:path";
import {
  defaultCanaryFs,
  type CanaryFileSystem,
} from "../../src/canary/immutable-canary-bundle.js";
import { OPPONENT_FIXTURE_ROOT } from "../../src/opponents/opponent-fixture-loader.js";

/**
 * Test-only path-remapping `CanaryFileSystem` (Milestone 0.2D Phase 1).
 *
 * Production `loadOpponentFixture` always uses the frozen canonical logical
 * root `data/opponents` and exposes no alternate-root API. Tests still need
 * temporary storage, so this wrapper transparently redirects that canonical
 * logical root onto an external temporary directory:
 *
 *   <repo>/data/opponents  ->  <temp>
 *
 * Every other path — including the ordinary repository reads used by the
 * fixture ancestry inspection above `data/opponents` — passes through to the
 * genuine checkout untouched. This remapping exists only in test code;
 * production source contains no alternate-root API and no real
 * `data/opponents/` directory is ever created by tests.
 */
export interface OpponentFixtureMappedFsTargets {
  /** Temporary directory standing in for the real `data/opponents`. */
  readonly fixtureRoot: string;
}

/**
 * Maps a canonical logical opponent-fixture path to the corresponding
 * temporary path. Paths outside the fixture root pass through unchanged.
 */
export function opponentFixtureMappedPath(
  targets: OpponentFixtureMappedFsTargets,
  logicalPath: string,
): string {
  const normalized = resolve(logicalPath);
  const logical = resolve(OPPONENT_FIXTURE_ROOT);
  const temp = resolve(targets.fixtureRoot);
  if (normalized === logical) return temp;
  if (normalized.startsWith(logical + sep))
    return temp + normalized.slice(logical.length);
  return logicalPath;
}

export function createOpponentFixtureMappedFs(
  targets: OpponentFixtureMappedFsTargets,
): CanaryFileSystem {
  const map = (path: string): string => opponentFixtureMappedPath(targets, path);
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
