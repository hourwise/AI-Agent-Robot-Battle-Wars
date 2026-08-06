import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  assertCanaryOutputRootIsolation,
  assertCanaryPhysicalRoot,
  getCanaryCanonicalOutputRoot,
} from "../../src/canary/canary-output-root.js";
import { defaultCanaryFs } from "../../src/canary/immutable-canary-bundle.js";

const CWD = resolve(process.cwd());

describe("grid beta output-root isolation (Phase 3G Phase 9)", () => {
  it("accepts exactly the canonical beta match root", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(
        join(CWD, "data", "beta", "grid-matches"),
        "grid-beta-match",
      ),
    ).not.toThrow();
    expect(getCanaryCanonicalOutputRoot("grid-beta-match")).toBe(
      join(CWD, "data", "beta", "grid-matches"),
    );
  });

  it("rejects normal match and series storage", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(join(CWD, "data", "matches"), "grid-beta-match"),
    ).toThrow(/protected match storage|protected storage/);
    expect(() =>
      assertCanaryOutputRootIsolation(join(CWD, "data", "series"), "grid-beta-match"),
    ).toThrow(/protected series storage|protected storage/);
  });

  it("rejects both canary roots", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(
        join(CWD, "data", "canary", "grid-match"),
        "grid-beta-match",
      ),
    ).toThrow(/protected storage/);
    expect(() =>
      assertCanaryOutputRootIsolation(
        join(CWD, "data", "canary", "grid-series"),
        "grid-beta-match",
      ),
    ).toThrow(/protected storage/);
  });

  it("rejects readiness, supplement and governance roots", () => {
    for (const root of [
      join(CWD, "data", "readiness", "grid"),
      join(CWD, "data", "readiness", "grid-supplements"),
      join(CWD, "data", "readiness", "grid-governance"),
    ]) {
      expect(
        () => assertCanaryOutputRootIsolation(root, "grid-beta-match"),
        root,
      ).toThrow(/protected storage/);
    }
  });

  it("rejects the fighter-input root and the suspension-marker path", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(
        join(CWD, "data", "beta", "grid-fighters"),
        "grid-beta-match",
      ),
    ).toThrow(/protected storage/);
    expect(() =>
      assertCanaryOutputRootIsolation(
        join(CWD, "data", "beta", "GRID_BETA_SUSPENDED"),
        "grid-beta-match",
      ),
    ).toThrow(/protected storage/);
  });

  it("rejects descendants of protected roots and non-canonical data roots", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(
        join(CWD, "data", "beta", "grid-matches", "some-descendant"),
        "grid-beta-match",
      ),
    ).toThrow(/must be exactly/);
    expect(() =>
      assertCanaryOutputRootIsolation(join(CWD, "data", "beta"), "grid-beta-match"),
    ).toThrow(/must be exactly/);
  });

  it("accepts an external temporary root", () => {
    expect(() =>
      assertCanaryOutputRootIsolation(
        join(CWD, "..", "some-temp-root"),
        "grid-beta-match",
      ),
    ).not.toThrow();
  });
});

describe("grid beta physical-root guard (Phase 3G Phase 9)", () => {
  it("rejects a symbolic-link or non-directory temp root", async () => {
    const root = await mkdtemp(join(tmpdir(), "beta-root-"));
    const file = join(root, "file");
    await import("node:fs/promises").then(({ writeFile }) => writeFile(file, "x"));
    try {
      await expect(
        assertCanaryPhysicalRoot(file, "grid-beta-match", defaultCanaryFs),
      ).rejects.toThrow(/not a real directory/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("accepts an existing real temporary directory root", async () => {
    const root = await mkdtemp(join(tmpdir(), "beta-root-ok-"));
    try {
      await expect(
        assertCanaryPhysicalRoot(root, "grid-beta-match", defaultCanaryFs),
      ).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("requires the temp root to exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "beta-root-missing-"));
    const missing = join(root, "does-not-exist");
    try {
      await expect(
        assertCanaryPhysicalRoot(missing, "grid-beta-match", defaultCanaryFs),
      ).rejects.toThrow(/does not exist|not a real directory/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
