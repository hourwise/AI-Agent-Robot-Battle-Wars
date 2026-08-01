import { resolve, sep } from "node:path";

/**
 * Output-root isolation guard for the grid match canary (Milestone 0.2C Phase
 * 3D2A.1).
 *
 * The canary service must never be pointed at normal match or series storage,
 * and within the repository `data` tree the only accepted grid-match canary
 * root is the canonical `data/canary/grid-match`. Arbitrary temporary roots
 * outside the repository remain allowed for tests.
 *
 * The guard is pure and runs before any directory is created or any match is
 * executed. It resolves and normalises absolute paths (handling path
 * traversal and equivalent forms), and on Windows comparisons are
 * case-insensitive for drive and path behaviour.
 */
export class GridCanaryOutputRootError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridCanaryOutputRootError";
  }
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

/** The protected normal-storage roots the canary must never write to. */
export function getCanaryProtectedOutputRoots(): { matches: string; series: string } {
  const cwd = resolve(process.cwd());
  return {
    matches: resolve(cwd, "data", "matches"),
    series: resolve(cwd, "data", "series"),
  };
}

/** The canonical repository grid-match canary root. */
export function getCanaryCanonicalOutputRoot(): string {
  return resolve(process.cwd(), "data", "canary", "grid-match");
}

export function assertCanaryOutputRootIsolation(outputRoot: string): void {
  const cwd = resolve(process.cwd());
  const dataDir = resolve(cwd, "data");
  const protectedRoots = getCanaryProtectedOutputRoots();
  const canonicalRoot = getCanaryCanonicalOutputRoot();

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

  // Within the repository data tree the only accepted grid-match canary root
  // is the canonical data/canary/grid-match root (or a run directory under it).
  if (isInsideOrEqual(outputRoot, dataDir)) {
    if (!isInsideOrEqual(outputRoot, canonicalRoot)) {
      throw new GridCanaryOutputRootError(
        `Grid canary output root inside the repository data tree must be ${canonicalRoot}; received ${resolve(outputRoot)}`,
      );
    }
  }
}
