import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import {
  assertCanaryOutputRootIsolation,
  assertCanaryPhysicalRoot,
  getCanaryCanonicalOutputRoot,
  GridCanaryOutputRootError,
  type CanaryFileSystem,
  type CanaryFsEntry,
} from "../../src/canary/canary-output-root.js";

const CWD = resolve(process.cwd());

function inRepo(path: string): string {
  return resolve(CWD, path);
}

describe("grid readiness output-root guard (Phase 3E1)", () => {
  it("maps the grid-readiness kind to the canonical data/readiness/grid root", () => {
    expect(getCanaryCanonicalOutputRoot("grid-readiness")).toBe(
      inRepo("data/readiness/grid"),
    );
    expect(getCanaryCanonicalOutputRoot("grid-match")).toBe(
      inRepo("data/canary/grid-match"),
    );
    expect(getCanaryCanonicalOutputRoot("grid-series")).toBe(
      inRepo("data/canary/grid-series"),
    );
  });

  it("rejects normal match and series storage as service roots", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(inRepo("data/matches"), "grid-readiness"),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(inRepo("data/series"), "grid-readiness"),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(inRepo("data/matches/sub"), "grid-readiness"),
    ).toThrow(GridCanaryOutputRootError);
  });

  it("rejects both existing canary roots for the readiness service", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(inRepo("data/canary/grid-match"), "grid-readiness"),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/canary/grid-series"),
        "grid-readiness",
      ),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(inRepo("data/canary"), "grid-readiness"),
    ).toThrow(GridCanaryOutputRootError);
  });

  it("rejects any other in-repository data root and descendants of the canonical readiness root as service roots", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(inRepo("data"), "grid-readiness"),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(inRepo("data/readiness"), "grid-readiness"),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/readiness/grid/sub"),
        "grid-readiness",
      ),
    ).toThrow(GridCanaryOutputRootError);
    expect(() =>
      assertCanaryOutputRootIsolation(
        inRepo("data/canary/grid-match/x"),
        "grid-readiness",
      ),
    ).toThrow(GridCanaryOutputRootError);
  });

  it("accepts only the exact canonical readiness root within the repository", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(
        getCanaryCanonicalOutputRoot("grid-readiness"),
        "grid-readiness",
      ),
    ).not.toThrow();
  });

  it("rejects symlink or junction ancestry and external symlink roots", async () => {
    const symlinkEntry: CanaryFsEntry = {
      isFile: () => false,
      isDirectory: () => false,
      isSymbolicLink: () => true,
    };
    const realDir: CanaryFsEntry = {
      isFile: () => false,
      isDirectory: () => true,
      isSymbolicLink: () => false,
    };
    const fs: CanaryFileSystem = {
      mkdir: async () => undefined,
      writeFile: async () => undefined,
      readFile: async () => "",
      readdir: async () => [],
      lstat: async (path: string) => {
        if (path === resolve(CWD, "data") || path === resolve(CWD, "data", "readiness")) {
          return symlinkEntry;
        }
        return realDir;
      },
      rename: async () => undefined,
      rm: async () => undefined,
    };
    // An ancestry component that is a symlink must be rejected.
    await expect(
      assertCanaryPhysicalRoot(
        getCanaryCanonicalOutputRoot("grid-readiness"),
        "grid-readiness",
        fs,
      ),
    ).rejects.toThrow(GridCanaryOutputRootError);

    // An external root that is itself a symlink must be rejected.
    const extFs: CanaryFileSystem = { ...fs, lstat: async () => symlinkEntry };
    await expect(
      assertCanaryPhysicalRoot(resolve(CWD, "external-root"), "grid-readiness", extFs),
    ).rejects.toThrow(GridCanaryOutputRootError);

    // An external real directory root is accepted.
    const realFs: CanaryFileSystem = { ...fs, lstat: async () => realDir };
    await expect(
      assertCanaryPhysicalRoot(resolve(CWD, "external-root"), "grid-readiness", realFs),
    ).resolves.toBeUndefined();
  });

  it("keeps the existing match/series canary kinds unaffected", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(inRepo("data/canary/grid-match"), "grid-match"),
    ).not.toThrow();
    expect(() =>
      assertCanaryOutputRootIsolation(inRepo("data/canary/grid-series"), "grid-series"),
    ).not.toThrow();
  });
});
