import { dirname, resolve, sep } from "node:path";
import type { CanaryFileSystem } from "./immutable-canary-bundle.js";
import { fsEntryKind } from "./immutable-canary-bundle.js";

/**
 * Kind-aware output-root isolation and physical-root guard for the grid
 * canaries (Milestone 0.2C Phase 3D2A.1 / 3D2A.2 / 3D2B).
 *
 * Lexical isolation:
 *
 *   - within the repository `data` tree, the service-level output root must
 *     resolve to exactly the selected canonical root
 *     (`data/canary/grid-match` or `data/canary/grid-series`);
 *   - a grid-match service may not use the grid-series root, and vice versa;
 *   - `data/matches`, `data/series` and every descendant, the `data` root and
 *     every other in-repository data path are rejected;
 *   - external temporary roots outside the repository remain allowed.
 *
 * Physical-root guard (async, uses the injectable filesystem):
 *
 *   - every existing path component relevant to an in-repository root must be
 *     a real directory (inspected with `lstat`, never `stat`), and must not be
 *     a symbolic link or junction, a regular file or another entry type;
 *     missing components may be created normally;
 *   - after recursive root creation the complete root ancestry is inspected
 *     again before any artifact write;
 *   - an existing canonical root that is itself a symbolic link or junction is
 *     rejected even when it points outside the repository, as is a parent such
 *     as `data` or `data/canary` when it is a symbolic link or junction;
 *   - an external temporary root is allowed only when it resolves to an
 *     existing real directory and is not itself a symbolic link; a symbolic
 *     link supplied as the service root is never followed.
 *
 * Both guards run before combat or series execution; the physical re-inspection
 * also runs after the output root is created and before any artifact write.
 */
export type CanaryRootKind = "grid-match" | "grid-series";

const CANONICAL_DIR_NAME: Record<CanaryRootKind, string> = {
  "grid-match": "grid-match",
  "grid-series": "grid-series",
};

export class GridCanaryOutputRootError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridCanaryOutputRootError";
  }
}

/** The canonical repository grid-match canary root. */
export function getCanaryCanonicalOutputRoot(kind: CanaryRootKind): string {
  return resolve(process.cwd(), "data", "canary", CANONICAL_DIR_NAME[kind]);
}

/** The protected normal-storage roots the canaries must never write to. */
export function getCanaryProtectedOutputRoots(): { matches: string; series: string } {
  const cwd = resolve(process.cwd());
  return {
    matches: resolve(cwd, "data", "matches"),
    series: resolve(cwd, "data", "series"),
  };
}

function comparable(path: string): string {
  const abs = resolve(path);
  return process.platform === "win32" ? abs.toLowerCase() : abs;
}

function isInsideOrEqual(child: string, parent: string): boolean {
  const c = comparable(child);
  const p = comparable(parent);
  if (c === p) return true;
  const prefix = p.endsWith(sep) ? p : `${p}${sep}`;
  return c.startsWith(prefix);
}

function isEqualNormalized(a: string, b: string): boolean {
  return comparable(a) === comparable(b);
}

/**
 * Sync lexical guard. `kind` defaults to `"grid-match"` so existing
 * single-match canary callers remain unchanged.
 */
export function assertCanaryOutputRootIsolation(
  outputRoot: string,
  kind: CanaryRootKind = "grid-match",
): void {
  const cwd = resolve(process.cwd());
  const dataDir = resolve(cwd, "data");
  const protectedRoots = getCanaryProtectedOutputRoots();
  const canonicalRoot = getCanaryCanonicalOutputRoot(kind);

  if (isInsideOrEqual(outputRoot, protectedRoots.matches)) {
    throw new GridCanaryOutputRootError(
      `Grid canary output root must not be inside protected match storage: ${resolve(outputRoot)}`,
    );
  }
  if (isInsideOrEqual(outputRoot, protectedRoots.series)) {
    throw new GridCanaryOutputRootError(
      `Grid canary output root must not be inside protected series storage: ${resolve(outputRoot)}`,
    );
  }

  // Within the repository data tree the service-level output root is accepted
  // only when it resolves to exactly the selected canonical root. Descendants
  // (publication destinations and internal temporary locations) are never
  // valid service roots, and the other canary kind's root is not valid here.
  if (isInsideOrEqual(outputRoot, dataDir)) {
    if (!isEqualNormalized(outputRoot, canonicalRoot)) {
      throw new GridCanaryOutputRootError(
        `Grid canary output root inside the repository data tree must be exactly ${canonicalRoot}; received ${resolve(outputRoot)}`,
      );
    }
  }
}

/** Every path from the filesystem root down to `absPath`, inclusive. */
function ancestryPaths(absPath: string): string[] {
  const paths: string[] = [];
  let current = resolve(absPath);
  for (;;) {
    paths.unshift(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return paths;
}

async function requireRealDirectory(fs: CanaryFileSystem, path: string): Promise<void> {
  const kind = await fsEntryKind(fs, path);
  if (kind === null) {
    throw new GridCanaryOutputRootError(
      `Grid canary output root component does not exist: ${path}`,
    );
  }
  if (kind !== "directory") {
    throw new GridCanaryOutputRootError(
      `Grid canary output root component is not a real directory (${kind}; symbolic links and junctions are rejected): ${path}`,
    );
  }
}

async function assertInRepoPhysicalRoot(
  fs: CanaryFileSystem,
  rootPath: string,
): Promise<void> {
  const paths = ancestryPaths(rootPath);
  // First pass: every existing component must be a real directory.
  for (const path of paths) {
    const kind = await fsEntryKind(fs, path);
    if (kind === null) break; // remaining components do not exist yet
    if (kind !== "directory") {
      throw new GridCanaryOutputRootError(
        `Grid canary output root ancestry component is not a real directory (${kind}; symbolic links and junctions are rejected): ${path}`,
      );
    }
  }
  // Create missing components normally, then re-inspect the complete ancestry.
  await fs.mkdir(rootPath, { recursive: true });
  for (const path of paths) {
    await requireRealDirectory(fs, path);
  }
}

async function assertExternalPhysicalRoot(
  fs: CanaryFileSystem,
  rootPath: string,
): Promise<void> {
  // External test roots must already exist as a real directory and must not be
  // a symbolic link; a symlink supplied as the service root is never followed.
  await requireRealDirectory(fs, rootPath);
}

/**
 * Async physical-root guard. Inspects the root ancestry with `lstat` so
 * symbolic links and junctions are detected before combat/series execution and
 * again (for in-repository roots) after recursive root creation.
 */
export async function assertCanaryPhysicalRoot(
  outputRoot: string,
  kind: CanaryRootKind,
  fs: CanaryFileSystem,
): Promise<void> {
  const resolved = resolve(outputRoot);
  const dataDir = resolve(process.cwd(), "data");
  if (isInsideOrEqual(outputRoot, dataDir)) {
    // Defence in depth: an in-repository root must match the selected kind's
    // canonical root exactly before its ancestry is inspected.
    const canonicalRoot = getCanaryCanonicalOutputRoot(kind);
    if (!isEqualNormalized(outputRoot, canonicalRoot)) {
      throw new GridCanaryOutputRootError(
        `Grid canary output root inside the repository data tree must be exactly ${canonicalRoot}; received ${resolved}`,
      );
    }
    await assertInRepoPhysicalRoot(fs, resolved);
  } else {
    await assertExternalPhysicalRoot(fs, resolved);
  }
}
