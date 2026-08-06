import { afterAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { GitSourceCommitReader } from "../../src/readiness/grid-source-commit-reader.js";

/**
 * Git commit-object reader tests (Milestone 0.2C Phase 3F.1, Phase 3).
 *
 * Uses real temporary Git repositories so the reader is exercised against
 * actual commit objects: committed bytes, working-tree substitution, missing
 * objects, non-commit object ids and repository non-modification.
 */

interface TempGitRepo {
  dir: string;
  commit: string;
  cleanup: () => Promise<void>;
}

const cleanups: Array<() => Promise<void>> = [];

async function createTempGitRepo(files: Record<string, string>): Promise<TempGitRepo> {
  const dir = await mkdtemp(join(tmpdir(), "git-src-reader-"));
  const run = (args: string[]): string =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  run(["init", "-q"]);
  run(["config", "user.email", "provenance-test@example.com"]);
  run(["config", "user.name", "Provenance Test"]);
  run(["config", "commit.gpgsign", "false"]);
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf-8");
  }
  run(["add", "-A"]);
  run(["commit", "-q", "-m", "fixture"]);
  const commit = run(["rev-parse", "HEAD"]).trim();
  const cleanup = async (): Promise<void> => {
    await rm(dir, { recursive: true, force: true });
  };
  cleanups.push(cleanup);
  return { dir, commit, cleanup };
}

afterAll(async () => {
  await Promise.all(cleanups.map((cleanup) => cleanup()));
});

describe("GitSourceCommitReader (Phase 3F.1 Phase 3)", () => {
  it("reads the exact committed bytes, never the working-tree bytes", async () => {
    const repo = await createTempGitRepo({ "src/a.ts": "content A\n" });
    const reader = new GitSourceCommitReader({ repoRoot: repo.dir });
    // Overwrite the working tree AFTER the commit so committed and working
    // tree bytes differ.
    await writeFile(join(repo.dir, "src", "a.ts"), "content B (working tree)\n", "utf-8");
    expect(await reader.commitAvailable(repo.commit)).toBe(true);
    expect(await reader.blobAvailable(repo.commit, "src/a.ts")).toBe(true);
    const bytes = await reader.readBlobBytes(repo.commit, "src/a.ts");
    expect(Buffer.from(bytes).toString("utf-8")).toBe("content A\n");
    const sha = await reader.readBlobSha(repo.commit, "src/a.ts");
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it("reports a missing commit object as unavailable", async () => {
    const repo = await createTempGitRepo({ "src/a.ts": "x\n" });
    const reader = new GitSourceCommitReader({ repoRoot: repo.dir });
    expect(await reader.commitAvailable("0000000000000000000000000000000000000000")).toBe(
      false,
    );
  });

  it("reports a missing path inside the commit as unavailable", async () => {
    const repo = await createTempGitRepo({ "src/a.ts": "x\n" });
    const reader = new GitSourceCommitReader({ repoRoot: repo.dir });
    expect(await reader.blobAvailable(repo.commit, "src/missing.ts")).toBe(false);
    await expect(reader.readBlobSha(repo.commit, "src/missing.ts")).rejects.toThrow(
      /unavailable/,
    );
    await expect(reader.readBlobBytes(repo.commit, "src/missing.ts")).rejects.toThrow(
      /unavailable/,
    );
  });

  it("rejects a non-commit object as a commit", async () => {
    const repo = await createTempGitRepo({ "src/a.ts": "x\n" });
    const reader = new GitSourceCommitReader({ repoRoot: repo.dir });
    const blobSha = await reader.readBlobSha(repo.commit, "src/a.ts");
    // A blob SHA is not a commit object.
    expect(await reader.commitAvailable(blobSha)).toBe(false);
  });

  it("never modifies the repository while reading", async () => {
    const repo = await createTempGitRepo({ "src/a.ts": "x\n" });
    const reader = new GitSourceCommitReader({ repoRoot: repo.dir });
    const before = execFileSync("git", ["status", "--porcelain"], {
      cwd: repo.dir,
      encoding: "utf-8",
    });
    await reader.readBlobBytes(repo.commit, "src/a.ts");
    await reader.readBlobSha(repo.commit, "src/a.ts");
    const after = execFileSync("git", ["status", "--porcelain"], {
      cwd: repo.dir,
      encoding: "utf-8",
    });
    expect(after).toBe(before);
    expect(await readFile(join(repo.dir, "src", "a.ts"), "utf-8")).toBe("x\n");
  });

  it("rejects shallow object databases rather than substituting current files", async () => {
    const repo = await createTempGitRepo({ "src/a.ts": "x\n" });
    const reader = new GitSourceCommitReader({ repoRoot: repo.dir });
    // Simulate a shallow repository by writing the shallow marker.
    const shallowFile = join(repo.dir, ".git", "shallow");
    await writeFile(shallowFile, `${repo.commit}\n`, "utf-8");
    expect(await reader.commitAvailable(repo.commit)).toBe(false);
    await rm(shallowFile, { force: true });
  });
});
