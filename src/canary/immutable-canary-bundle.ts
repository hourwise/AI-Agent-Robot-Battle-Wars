import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Shared immutable canary bundle publication (Milestone 0.2C Phase 3D2B).
 *
 * Neutral, reusable filesystem-publication mechanics used by both the
 * single-match grid canary and the grid adaptive-series canary. It provides:
 *
 *   - an exact declared artifact inventory (regular files only);
 *   - no symbolic-link artifacts;
 *   - `lstat` collision detection for final and temporary paths;
 *   - exclusive temporary-directory creation (non-recursive `mkdir`);
 *   - invocation-owned cleanup (never removes pre-existing paths);
 *   - manifest-last writing;
 *   - complete read-back of every file;
 *   - byte-for-byte comparison of every read-back string;
 *   - a caller-provided bundle validation hook;
 *   - temporary and final verification;
 *   - atomic rename;
 *   - preservation of the original error.
 *
 * The publisher never interprets artifact semantics; callers supply the exact
 * entry inventory, the non-manifest artifact contents, the serialized manifest
 * and a `verify` callback that performs schema/digest/cross-agreement checks.
 */
export interface CanaryFsEntry {
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

export interface CanaryFileSystem {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  writeFile(path: string, data: string, encoding?: "utf-8"): Promise<void>;
  readFile(path: string, encoding: "utf-8"): Promise<string>;
  readdir(path: string): Promise<string[]>;
  lstat(path: string): Promise<CanaryFsEntry>;
  rename(from: string, to: string): Promise<void>;
  rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
}

export const defaultCanaryFs: CanaryFileSystem = {
  mkdir: async (path, options) => {
    await mkdir(path, options);
  },
  writeFile: (path, data, encoding) => writeFile(path, data, encoding),
  readFile: (path, encoding) => readFile(path, encoding),
  readdir: (path) => readdir(path),
  lstat: (path) => lstat(path),
  rename: (from, to) => rename(from, to),
  rm: (path, options) => rm(path, options),
};

export function isFsCode(e: unknown, code: string): boolean {
  return e instanceof Error && "code" in e && (e as { code?: string }).code === code;
}

/**
 * Describes a filesystem entry at `path` via `lstat` (so symbolic links and
 * broken symbolic links count as existing entries), or `null` when the path
 * does not exist. `lstat` is used, never `stat`, so collisions are detected
 * for the entry itself without following links.
 */
export async function fsEntryKind(
  fs: CanaryFileSystem,
  path: string,
): Promise<"directory" | "file" | "symbolic link" | "other" | null> {
  try {
    const entry = await fs.lstat(path);
    if (entry.isSymbolicLink()) return "symbolic link";
    if (entry.isDirectory()) return "directory";
    if (entry.isFile()) return "file";
    return "other";
  } catch (e) {
    if (isFsCode(e, "ENOENT")) return null;
    throw e;
  }
}

export interface ImmutableBundleArtifact {
  name: string;
  content: string;
}

/** Read-back contents of every declared bundle entry (exact UTF-8 strings). */
export interface ImmutableBundleVerifyInput {
  dir: string;
  contents: Record<string, string>;
}

/**
 * Requires `dir` to contain exactly the declared entries, all regular files,
 * and nothing else (no missing artifact, no additional file, no additional
 * directory, no nested data, no symbolic link). Names are sorted before
 * comparison.
 */
export async function assertExactBundleInventory(
  fs: CanaryFileSystem,
  dir: string,
  expectedEntries: readonly string[],
): Promise<void> {
  const names = (await fs.readdir(dir)).sort();
  const expected = [...expectedEntries].sort();
  if (names.length !== expected.length || names.some((n, i) => n !== expected[i])) {
    throw new Error(
      `Canary bundle inventory mismatch in ${dir}: expected exactly ${expected.join(", ")}; found ${names.length === 0 ? "nothing" : names.join(", ")}`,
    );
  }
  for (const name of names) {
    const entry = await fs.lstat(join(dir, name));
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Canary bundle artifact ${name} must be a regular file, not a symbolic link`,
      );
    }
    if (!entry.isFile()) {
      throw new Error(
        `Canary bundle artifact ${name} must be a regular file, not a directory`,
      );
    }
  }
}

export interface PublishImmutableBundleParams {
  fs: CanaryFileSystem;
  outputRoot: string;
  canaryId: string;
  manifestFileName: string;
  /** Exact entry inventory: every bundle file name, including the manifest. */
  entryNames: readonly string[];
  /** Non-manifest artifacts with the exact strings to write. */
  artifacts: readonly ImmutableBundleArtifact[];
  serializedManifest: string;
  /**
   * Caller-provided bundle validation. Runs against the read-back contents of
   * the temporary directory and again against the final directory after the
   * atomic rename. Must throw on any schema, digest or cross-agreement
   * failure.
   */
  verify: (input: ImmutableBundleVerifyInput) => Promise<void> | void;
  /**
   * Runs after the output root is created (recursively) and before any
   * artifact is written. Used for the physical-root re-inspection.
   */
  afterRootCreated?: () => Promise<void>;
}

/**
 * Publishes one immutable canary bundle atomically and exclusively.
 *
 * The final path `outputRoot/<canaryId>` and the temporary path
 * `outputRoot/.tmp-<canaryId>` are preflighted with `lstat` and must not exist
 * as any filesystem entry. The temporary directory is created **exclusively**
 * with non-recursive `mkdir`, the declared non-manifest artifacts are written,
 * the manifest is written last, then every declared file is read back and
 * compared byte-for-byte with the written strings, the exact inventory and
 * regular-file checks run, and the caller-provided `verify` hook validates the
 * bundle. Only then is the completed temporary directory atomically renamed to
 * `<canaryId>`, after which the same inventory, byte and verification checks
 * run at the final path. Cleanup applies only to invocation-owned paths; the
 * original error is preserved if cleanup also fails.
 */
export async function publishImmutableBundle(
  params: PublishImmutableBundleParams,
): Promise<string> {
  const { fs, outputRoot, canaryId, manifestFileName, entryNames, artifacts } = params;
  const finalDir = join(outputRoot, canaryId);
  const tmpDir = join(outputRoot, `.tmp-${canaryId}`);

  const runVerification = async (dir: string): Promise<void> => {
    await assertExactBundleInventory(fs, dir, entryNames);

    const contents: Record<string, string> = {};
    for (const name of entryNames) {
      contents[name] = await fs.readFile(join(dir, name), "utf-8");
    }
    for (const artifact of artifacts) {
      if (contents[artifact.name] !== artifact.content) {
        throw new Error(
          `Canary read-back: ${artifact.name} does not byte-for-byte match the written artifact`,
        );
      }
    }
    if (contents[manifestFileName] !== params.serializedManifest) {
      throw new Error(
        `Canary read-back: ${manifestFileName} does not byte-for-byte match the written manifest`,
      );
    }
    await params.verify({ dir, contents });
  };

  // lstat-based preflight: neither path may exist as any filesystem entry.
  const finalCollision = await fsEntryKind(fs, finalDir);
  if (finalCollision !== null) {
    throw new Error(
      `Canary final path already exists (${finalCollision}) and must not be modified or removed: ${finalDir}`,
    );
  }
  const tmpCollision = await fsEntryKind(fs, tmpDir);
  if (tmpCollision !== null) {
    throw new Error(
      `Canary temporary path already exists (${tmpCollision}) and must not be reused or removed: ${tmpDir}`,
    );
  }

  // Invocation ownership tracking.
  let tmpCreatedByThisInvocation = false;
  let finalPublishedByThisInvocation = false;

  await fs.mkdir(outputRoot, { recursive: true });
  if (params.afterRootCreated) await params.afterRootCreated();

  try {
    // Create the temporary directory exclusively (non-recursive), so a raced
    // entry between preflight and creation fails with EEXIST.
    await fs.mkdir(tmpDir, { recursive: false });
    tmpCreatedByThisInvocation = true;

    for (const artifact of artifacts) {
      await fs.writeFile(join(tmpDir, artifact.name), artifact.content, "utf-8");
    }
    // The manifest is written last.
    await fs.writeFile(
      join(tmpDir, manifestFileName),
      params.serializedManifest,
      "utf-8",
    );

    // Verify the complete temporary bundle before publishing.
    await runVerification(tmpDir);

    // Atomically publish the completed temporary directory.
    await fs.rename(tmpDir, finalDir);
    finalPublishedByThisInvocation = true;

    // Verify the exact final bundle at the published path.
    await runVerification(finalDir);
  } catch (e) {
    // Cleanup applies only to invocation-owned paths, and the original
    // operational or verification error is preserved if cleanup also fails.
    if (finalPublishedByThisInvocation) {
      try {
        await fs.rm(finalDir, { recursive: true, force: true });
      } catch {
        // best-effort removal of the invocation-published final directory
      }
    }
    if (tmpCreatedByThisInvocation) {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup of the invocation-created temporary directory
      }
    }
    throw e;
  }

  return finalDir;
}
