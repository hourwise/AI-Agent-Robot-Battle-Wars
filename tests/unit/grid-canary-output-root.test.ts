import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  GridCanaryOutputRootError,
  assertCanaryOutputRootIsolation,
  getCanaryCanonicalOutputRoot,
  getCanaryProtectedOutputRoots,
} from "../../src/app/grid-canary-output-root.js";

const CANONICAL = getCanaryCanonicalOutputRoot();

describe("grid canary output-root isolation (Phase 3D2A.1)", () => {
  it("accepts the canonical default root", () => {
    expect(() => assertCanaryOutputRootIsolation(CANONICAL)).not.toThrow();
    expect(() => assertCanaryOutputRootIsolation(resolve(CANONICAL))).not.toThrow();
  });

  it("rejects the exact data/matches root", () => {
    const root = resolve(process.cwd(), "data", "matches");
    expect(() => assertCanaryOutputRootIsolation(root)).toThrow(
      GridCanaryOutputRootError,
    );
    expect(() => assertCanaryOutputRootIsolation(root)).toThrow(/match storage/);
  });

  it("rejects a child of data/matches", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(resolve(process.cwd(), "data", "matches", "child")),
    ).toThrow(/match storage/);
  });

  it("rejects the exact data/series root", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(resolve(process.cwd(), "data", "series")),
    ).toThrow(/series storage/);
  });

  it("rejects a child of data/series", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(resolve(process.cwd(), "data", "series", "child")),
    ).toThrow(/series storage/);
  });

  it("rejects the repository data root itself", () => {
    expect(() => assertCanaryOutputRootIsolation(resolve(process.cwd(), "data"))).toThrow(
      /must be .*data[/\\]canary[/\\]grid-match/,
    );
  });

  it("rejects another non-canary child under repository data", () => {
    for (const child of ["bench-fixtures", "seeds", "canary", "canary/other"]) {
      expect(() =>
        assertCanaryOutputRootIsolation(
          resolve(process.cwd(), "data", ...child.split("/")),
        ),
      ).toThrow();
    }
  });

  it("rejects traversal resolving into a protected directory", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(
        resolve(process.cwd(), "data", "canary", "..", "matches"),
      ),
    ).toThrow(/match storage/);
    expect(() =>
      assertCanaryOutputRootIsolation(
        resolve(process.cwd(), "data", "canary", "grid-match", "..", "..", "matches"),
      ),
    ).toThrow(/match storage/);
  });

  it("rejects case-insensitive protected paths on Windows", () => {
    if (process.platform !== "win32") return;
    expect(() =>
      assertCanaryOutputRootIsolation(resolve(process.cwd(), "DATA", "MATCHES")),
    ).toThrow(/match storage/);
    expect(() =>
      assertCanaryOutputRootIsolation(resolve(process.cwd(), "Data", "Series")),
    ).toThrow(/series storage/);
  });

  it("accepts an external temporary directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "canary-guard-"));
    try {
      expect(() => assertCanaryOutputRootIsolation(root)).not.toThrow();
    } finally {
      const { rm } = await import("node:fs/promises");
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects an external temporary directory that is actually a repository data descendant", () => {
    // Even a path that starts outside but resolves inside is rejected.
    const matches = getCanaryProtectedOutputRoots().matches;
    expect(() => assertCanaryOutputRootIsolation(join(matches, "..", "matches"))).toThrow(
      /match storage/,
    );
  });
});
