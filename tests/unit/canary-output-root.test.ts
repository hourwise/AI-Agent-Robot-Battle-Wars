import { afterEach, describe, expect, it } from "vitest";
import { lstat, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GridCanaryOutputRootError,
  assertCanaryOutputRootIsolation,
  assertCanaryPhysicalRoot,
  getCanaryCanonicalOutputRoot,
  getCanaryProtectedOutputRoots,
  type CanaryRootKind,
} from "../../src/canary/canary-output-root.js";
import {
  defaultCanaryFs,
  type CanaryFileSystem,
} from "../../src/canary/immutable-canary-bundle.js";

const tempRoots: string[] = [];

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "canary-root-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

const canonicalFor = (kind: CanaryRootKind) => getCanaryCanonicalOutputRoot(kind);

describe("kind-aware output-root isolation (Phase 3D2B)", () => {
  it("accepts each kind's canonical root", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(canonicalFor("grid-match"), "grid-match"),
    ).not.toThrow();
    expect(() =>
      assertCanaryOutputRootIsolation(canonicalFor("grid-series"), "grid-series"),
    ).not.toThrow();
  });

  it("rejects the other kind's canonical root (cross-kind)", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(canonicalFor("grid-series"), "grid-match"),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(canonicalFor("grid-match"), "grid-series"),
    ).toThrow(GridCanaryOutputRootError);
  });

  it("rejects the grid-series root when no kind is supplied (default grid-match)", () => {
    expect(() => assertCanaryOutputRootIsolation(canonicalFor("grid-series"))).toThrow(
      /must be exactly/,
    );
  });

  it("rejects protected normal storage for both kinds", () => {
    const protectedRoots = getCanaryProtectedOutputRoots();
    for (const kind of ["grid-match", "grid-series"] as const) {
      expect(() => assertCanaryOutputRootIsolation(protectedRoots.matches, kind)).toThrow(
        /match storage/,
      );
      expect(() => assertCanaryOutputRootIsolation(protectedRoots.series, kind)).toThrow(
        /series storage/,
      );
    }
  });

  it("accepts external temporary roots", async () => {
    const root = await makeTempRoot();
    expect(() => assertCanaryOutputRootIsolation(root, "grid-series")).not.toThrow();
    expect(() => assertCanaryOutputRootIsolation(root, "grid-match")).not.toThrow();
  });
});

describe("physical-root guard (Phase 3D2B)", () => {
  it("accepts an existing external real directory", async () => {
    const root = await makeTempRoot();
    await expect(
      assertCanaryPhysicalRoot(root, "grid-series", defaultCanaryFs),
    ).resolves.toBeUndefined();
  });

  it("rejects a non-existent external root", async () => {
    const root = await makeTempRoot();
    const missing = join(root, "missing");
    await expect(
      assertCanaryPhysicalRoot(missing, "grid-series", defaultCanaryFs),
    ).rejects.toThrow(/does not exist/);
  });

  it("rejects an external root that is a regular file", async () => {
    const { writeFile } = await import("node:fs/promises");
    const root = await makeTempRoot();
    const file = join(root, "file.txt");
    await writeFile(file, "x", "utf-8");
    await expect(
      assertCanaryPhysicalRoot(file, "grid-series", defaultCanaryFs),
    ).rejects.toThrow(/not a real directory/);
  });

  it("rejects an external root that is a symbolic link (never followed)", async () => {
    const root = await makeTempRoot();
    const target = join(root, "target");
    await mkdir(target, { recursive: true });
    const link = join(root, "link");
    try {
      await symlink(target, link, "dir");
    } catch {
      return; // platform without symlink support
    }
    await expect(
      assertCanaryPhysicalRoot(link, "grid-series", defaultCanaryFs),
    ).rejects.toThrow(/symbolic link|not a real directory/);
  });

  it("rejects an in-repository canonical root that is a symbolic link (via lstat)", async () => {
    // Use an injected filesystem so the real repository tree is never touched.
    const canonical = canonicalFor("grid-series");
    const fakeFs: CanaryFileSystem = {
      ...defaultCanaryFs,
      lstat: async (path) => {
        const normalized = path.replace(/\\/g, "/");
        const canonicalNorm = canonical.replace(/\\/g, "/").toLowerCase();
        if (normalized.toLowerCase() === canonicalNorm) {
          return {
            isFile: () => false,
            isDirectory: () => false,
            isSymbolicLink: () => true,
          };
        }
        return lstat(path);
      },
    };
    await expect(
      assertCanaryPhysicalRoot(canonical, "grid-series", fakeFs),
    ).rejects.toThrow(/not a real directory/);
  });

  it("rejects a symlink parent (data/canary) in the in-repository ancestry", async () => {
    const canonical = canonicalFor("grid-series");
    const fakeFs: CanaryFileSystem = {
      ...defaultCanaryFs,
      lstat: async (path) => {
        const normalized = path.replace(/\\/g, "/").toLowerCase();
        if (normalized.endsWith("/data/canary")) {
          return {
            isFile: () => false,
            isDirectory: () => false,
            isSymbolicLink: () => true,
          };
        }
        return lstat(path);
      },
    };
    await expect(
      assertCanaryPhysicalRoot(canonical, "grid-series", fakeFs),
    ).rejects.toThrow(/not a real directory/);
  });

  it("rejects an in-repository canonical root that is a regular file", async () => {
    const canonical = canonicalFor("grid-match");
    const fakeFs: CanaryFileSystem = {
      ...defaultCanaryFs,
      lstat: async (path) => {
        const normalized = path.replace(/\\/g, "/");
        const canonicalNorm = canonical.replace(/\\/g, "/").toLowerCase();
        if (normalized.toLowerCase() === canonicalNorm) {
          return {
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          };
        }
        return lstat(path);
      },
    };
    await expect(
      assertCanaryPhysicalRoot(canonical, "grid-match", fakeFs),
    ).rejects.toThrow(/not a real directory/);
  });

  it("accepts the in-repository canonical root with the real filesystem", async () => {
    // The canonical root may or may not exist; the guard creates missing
    // components and re-inspects. Safe because data/canary is gitignored.
    const canonical = canonicalFor("grid-series");
    await expect(
      assertCanaryPhysicalRoot(canonical, "grid-series", defaultCanaryFs),
    ).resolves.toBeUndefined();
    const entry = await lstat(canonical);
    expect(entry.isDirectory()).toBe(true);
  });
});
