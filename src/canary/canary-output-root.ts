import { dirname, resolve, sep } from "node:path";
import type { CanaryFileSystem } from "./immutable-canary-bundle.js";
import { fsEntryKind } from "./immutable-canary-bundle.js";

/**
 * Kind-aware output-root isolation and physical-root guard for the grid
 * canaries and the grid activation-readiness evaluation (Milestone 0.2C Phase
 * 3D2A.1 / 3D2A.2 / 3D2B / 3E1).
 *
 * Lexical isolation:
 *
 *   - within the repository `data` tree, the service-level output root must
 *     resolve to exactly the selected canonical root
 *     (`data/canary/grid-match`, `data/canary/grid-series`,
 *     `data/readiness/grid` or `data/readiness/grid-supplements`);
 *   - a grid-match service may not use the grid-series root, and vice versa;
 *   - the grid-readiness service must reject normal match/series storage,
 *     both canary roots, and every other in-repository data root, and
 *     descendants of the canonical readiness root are never valid service
 *     roots;
 *   - the grid-readiness-supplement service must reject normal match/series
 *     storage, both canary roots, the official readiness root
 *     (`data/readiness/grid`) and every other in-repository data root, and
 *     descendants of the canonical supplement root are never valid service
 *     roots;
 *   - the grid-readiness-governance service must reject normal match/series
 *     storage, both canary roots, the official readiness root
 *     (`data/readiness/grid`), the official supplement root
 *     (`data/readiness/grid-supplements`) and every other in-repository data
 *     root, and descendants of the canonical governance root are never valid
 *     service roots;
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
export type CanaryRootKind =
  | "grid-match"
  | "grid-series"
  | "grid-readiness"
  | "grid-readiness-supplement"
  | "grid-readiness-governance";

const CANONICAL_ROOT_SEGMENTS: Record<CanaryRootKind, readonly string[]> = {
  "grid-match": ["canary", "grid-match"],
  "grid-series": ["canary", "grid-series"],
  "grid-readiness": ["readiness", "grid"],
  "grid-readiness-supplement": ["readiness", "grid-supplements"],
  "grid-readiness-governance": ["readiness", "grid-governance"],
};

export class GridCanaryOutputRootError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridCanaryOutputRootError";
  }
}

/** The canonical repository output root for a selected kind. */
export function getCanaryCanonicalOutputRoot(kind: CanaryRootKind): string {
  return resolve(process.cwd(), "data", ...CANONICAL_ROOT_SEGMENTS[kind]);
}

/** The protected normal-storage roots the canaries must never write to. */
export function getCanaryProtectedOutputRoots(): { matches: string; series: string } {
  const cwd = resolve(process.cwd());
  return {
    matches: resolve(cwd, "data", "matches"),
    series: resolve(cwd, "data", "series"),
  };
}

/**
 * The protected roots for a selected kind. The grid-readiness kind must also
 * reject both existing canary roots; the grid-readiness-supplement kind must
 * additionally reject the official readiness root.
 */
function getKindProtectedRoots(kind: CanaryRootKind): string[] {
  const protectedRoots = getCanaryProtectedOutputRoots();
  const roots = [protectedRoots.matches, protectedRoots.series];
  if (kind === "grid-readiness" || kind === "grid-readiness-supplement") {
    roots.push(getCanaryCanonicalOutputRoot("grid-match"));
    roots.push(getCanaryCanonicalOutputRoot("grid-series"));
  }
  if (kind === "grid-readiness-supplement") {
    roots.push(getCanaryCanonicalOutputRoot("grid-readiness"));
  }
  if (kind === "grid-readiness-governance") {
    roots.push(getCanaryCanonicalOutputRoot("grid-match"));
    roots.push(getCanaryCanonicalOutputRoot("grid-series"));
    roots.push(getCanaryCanonicalOutputRoot("grid-readiness"));
    roots.push(getCanaryCanonicalOutputRoot("grid-readiness-supplement"));
  }
  return roots;
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
  const protectedRoots = getKindProtectedRoots(kind);
  const canonicalRoot = getCanaryCanonicalOutputRoot(kind);

  for (const protectedRoot of protectedRoots) {
    if (!isInsideOrEqual(outputRoot, protectedRoot)) continue;
    const protectedBase = getCanaryProtectedOutputRoots();
    if (protectedRoot === protectedBase.matches) {
      throw new GridCanaryOutputRootError(
        `Grid canary output root must not be inside protected match storage: ${resolve(outputRoot)}`,
      );
    }
    if (protectedRoot === protectedBase.series) {
      throw new GridCanaryOutputRootError(
        `Grid canary output root must not be inside protected series storage: ${resolve(outputRoot)}`,
      );
    }
    throw new GridCanaryOutputRootError(
      `Grid output root must not be inside protected storage (${protectedRoot}): ${resolve(outputRoot)}`,
    );
  }

  // Within the repository data tree the service-level output root is accepted
  // only when it resolves to exactly the selected canonical root. Descendants
  // (publication destinations and internal temporary locations) are never
  // valid service roots, and the other kinds' roots are not valid here.
  if (isInsideOrEqual(outputRoot, dataDir)) {
    if (!isEqualNormalized(outputRoot, canonicalRoot)) {
      throw new GridCanaryOutputRootError(
        `Grid output root inside the repository data tree must be exactly ${canonicalRoot}; received ${resolve(outputRoot)}`,
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
