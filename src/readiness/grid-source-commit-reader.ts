import { execFile } from "node:child_process";
import { promisify } from "node:util";

/**
 * Git commit-object source reader (Milestone 0.2C Phase 3F.1, Phase 3).
 *
 * Reads exact file bytes from a Git commit object, never from the working
 * tree. Used only by the governance provenance tooling to bind the reviewed
 * source snapshot to commit `5173fd0f…`.
 *
 * Invariants:
 * - requires the exact commit object to exist locally (rejects shallow and
 *   missing objects instead of silently falling back to the working tree);
 * - reads blob bytes with `git cat-file blob <sha>` after resolving the blob
 *   SHA with `git rev-parse --verify <commit>:<path>`, so the returned bytes
 *   are always the committed object bytes;
 * - never modifies the repository (`GIT_OPTIONAL_LOCKS=0`, plumbing commands
 *   only);
 * - never accesses the network (all commands operate on local object
 *   databases);
 * - never invokes a shell with interpolated input: every process is spawned
 *   through the argument-array `execFile` API and every commit/path value is
 *   passed as a separate argument.
 */

const execFileAsync = promisify(execFile);

/** Abstraction over exact-commit-object source reads (injectable in tests). */
export interface GridOptInBetaSourceCommitReader {
  /**
   * True iff the exact commit object exists locally as a full commit object
   * and the repository is not shallow (a shallow object database cannot prove
   * the full reviewed tree is present).
   */
  commitAvailable(commit: string): Promise<boolean>;
  /** True iff the path resolves to a blob inside the given commit object. */
  blobAvailable(commit: string, path: string): Promise<boolean>;
  /** Returns the Git blob SHA for the path inside the given commit. Throws if absent. */
  readBlobSha(commit: string, path: string): Promise<string>;
  /** Returns the exact committed bytes for the path inside the given commit. Throws if absent. */
  readBlobBytes(commit: string, path: string): Promise<Uint8Array>;
}

export interface GitSourceCommitReaderOptions {
  /** The git executable (defaults to `git` on PATH). */
  readonly gitBinary?: string;
  /** The repository root (defaults to the current working directory). */
  readonly repoRoot?: string;
}

const MAX_GIT_OUTPUT_BYTES = 256 * 1024 * 1024;

export class GitSourceCommitReader implements GridOptInBetaSourceCommitReader {
  private readonly git: string;
  private readonly cwd: string;

  constructor(options: GitSourceCommitReaderOptions = {}) {
    this.git = options.gitBinary ?? "git";
    this.cwd = options.repoRoot ?? process.cwd();
  }

  private async runText(args: readonly string[]): Promise<string> {
    const { stdout } = await execFileAsync(this.git, [...args], {
      cwd: this.cwd,
      encoding: "utf-8",
      maxBuffer: MAX_GIT_OUTPUT_BYTES,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    });
    return stdout;
  }

  private async runBuffer(args: readonly string[]): Promise<Buffer> {
    const { stdout } = await execFileAsync(this.git, [...args], {
      cwd: this.cwd,
      encoding: "buffer",
      maxBuffer: MAX_GIT_OUTPUT_BYTES,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    });
    return stdout;
  }

  async commitAvailable(commit: string): Promise<boolean> {
    try {
      const type = (await this.runText(["cat-file", "-t", commit])).trim();
      if (type !== "commit") return false;
      const shallow = (
        await this.runText(["rev-parse", "--is-shallow-repository"])
      ).trim();
      if (shallow === "true") return false;
      return true;
    } catch {
      return false;
    }
  }

  async blobAvailable(commit: string, path: string): Promise<boolean> {
    try {
      await this.runText(["cat-file", "-e", `${commit}:${path}`]);
      return true;
    } catch {
      return false;
    }
  }

  async readBlobSha(commit: string, path: string): Promise<string> {
    let out: string;
    try {
      out = (await this.runText(["rev-parse", "--verify", `${commit}:${path}`])).trim();
    } catch (e) {
      throw new Error(
        `Git blob SHA unavailable for ${path} at commit ${commit}: ${
          e instanceof Error ? e.message : String(e)
        }`,
        { cause: e },
      );
    }
    if (!/^[0-9a-f]{40,64}$/.test(out)) {
      throw new Error(
        `Git blob SHA for ${path} at commit ${commit} is not a valid object id: ${out}`,
      );
    }
    return out;
  }

  async readBlobBytes(commit: string, path: string): Promise<Uint8Array> {
    const blobSha = await this.readBlobSha(commit, path);
    let buf: Buffer;
    try {
      buf = await this.runBuffer(["cat-file", "blob", blobSha]);
    } catch (e) {
      throw new Error(
        `Git blob bytes unavailable for ${path} (${blobSha}) at commit ${commit}: ${
          e instanceof Error ? e.message : String(e)
        }`,
        { cause: e },
      );
    }
    return new Uint8Array(buf);
  }
}
