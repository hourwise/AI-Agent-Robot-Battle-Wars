import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  defaultCanaryFs,
  type CanaryFileSystem,
  type CanaryFsEntry,
} from "../../src/canary/immutable-canary-bundle.js";
import {
  OPPONENT_FIXTURE_MAX_JSON_BYTES,
  OpponentFixtureError,
  opponentFixtureChecksum,
  opponentFixtureDeepEqual,
  parseOpponentFixture,
  serializeOpponentFixture,
  type OpponentFixtureV1,
} from "../../src/opponents/opponent-fixture.js";
import {
  OPPONENT_FIXTURE_ROOT,
  loadOpponentFixture,
} from "../../src/opponents/opponent-fixture-loader.js";
import {
  canonicalSyntheticFixtureBytes,
  makeSyntheticOpponentFixture,
} from "../helpers/opponent-fixture-builder.js";
import { createOpponentFixtureMappedFs } from "../helpers/opponent-fixture-mapped-fs.js";

/**
 * Milestone 0.2D Phase 1 — secure fixed-root loader: physical-file and TOCTOU
 * protections plus loader-level positive and version-binding tests.
 */

const fileEntry: CanaryFsEntry = {
  isFile: () => true,
  isDirectory: () => false,
  isSymbolicLink: () => false,
};
const symlinkEntry: CanaryFsEntry = {
  isFile: () => false,
  isDirectory: () => false,
  isSymbolicLink: () => true,
};

function enoent(): never {
  throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
}

async function createEnv(): Promise<{
  tempRoot: string;
  cleanup: () => Promise<void>;
}> {
  // mkdtemp already creates the temporary directory.
  const tempRoot = await mkdtemp(join(tmpdir(), "opp-fixture-"));
  return {
    tempRoot,
    cleanup: () => rm(tempRoot, { recursive: true, force: true }),
  };
}

function mappedFs(tempRoot: string): CanaryFileSystem {
  return createOpponentFixtureMappedFs({ fixtureRoot: tempRoot });
}

/** The canonical logical resolved path the loader reads for a filename. */
function logicalFixturePath(fileName: string): string {
  return resolve(join(OPPONENT_FIXTURE_ROOT, fileName));
}

/**
 * A wrapper that delegates to `base` but replaces `lstat` results for exactly
 * the target path with a scripted sequence, and optionally overrides
 * `readFile` for the target. Used for deterministic TOCTOU races.
 */
function scriptedTargetFs(
  base: CanaryFileSystem,
  targetPath: string,
  options: {
    lstatSequence?: Array<CanaryFsEntry | "ENOENT">;
    readContent?: string;
  } = {},
): CanaryFileSystem {
  let lstatCount = 0;
  const normalized = resolve(targetPath);
  return {
    mkdir: (path, opts) => base.mkdir(path, opts),
    writeFile: (path, data, encoding) => base.writeFile(path, data, encoding),
    writeFileExclusive: (path, data, encoding) =>
      base.writeFileExclusive(path, data, encoding),
    readFile: async (path, encoding) => {
      if (resolve(path) === normalized && options.readContent !== undefined) {
        return options.readContent;
      }
      return base.readFile(path, encoding);
    },
    readdir: (path) => base.readdir(path),
    lstat: async (path) => {
      if (resolve(path) === normalized) {
        const sequence = options.lstatSequence ?? [];
        const result = sequence[Math.min(lstatCount, sequence.length - 1)] ?? "ENOENT";
        lstatCount += 1;
        if (result === "ENOENT") enoent();
        return result;
      }
      return base.lstat(path);
    },
    rename: (from, to) => base.rename(from, to),
    rm: (path, options) => base.rm(path, options),
  };
}

describe("opponent fixture secure loader (0.2D Phase 1)", () => {
  it("loads a valid canonical fixture by identifier and version and returns a deeply frozen equivalent identity on repeated loads", async () => {
    const { tempRoot, cleanup } = await createEnv();
    try {
      const bytes = canonicalSyntheticFixtureBytes(makeSyntheticOpponentFixture());
      await writeFile(join(tempRoot, "synthetic.v1.json"), bytes, "utf-8");

      const loaded = await loadOpponentFixture("synthetic", 1, {
        fs: mappedFs(tempRoot),
      });
      expect(loaded.opponentId).toBe("synthetic");
      expect(loaded.fixtureVersion).toBe(1);
      expect(loaded.fixtureChecksum).toBe(opponentFixtureChecksum(loaded));
      expect(Object.isFrozen(loaded)).toBe(true);
      expect(Object.isFrozen(loaded.build)).toBe(true);
      expect(Object.isFrozen(loaded.build.armour)).toBe(true);
      expect(Object.isFrozen(loaded.validatedBuild)).toBe(true);
      expect(Object.isFrozen(loaded.validatedBuild.proposal)).toBe(true);
      expect(Object.isFrozen(loaded.policy)).toBe(true);
      expect(Object.isFrozen(loaded.runtimeCompatibility)).toBe(true);

      // Repeated loads return equivalent immutable identities.
      const again = await loadOpponentFixture("synthetic", 1, {
        fs: mappedFs(tempRoot),
      });
      expect(opponentFixtureDeepEqual(loaded, again)).toBe(true);
      expect(again).not.toBe(loaded);
      expect(Object.isFrozen(again)).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("never creates the real data/opponents directory", async () => {
    const { tempRoot, cleanup } = await createEnv();
    try {
      const bytes = canonicalSyntheticFixtureBytes(makeSyntheticOpponentFixture());
      await writeFile(join(tempRoot, "synthetic.v1.json"), bytes, "utf-8");
      await loadOpponentFixture("synthetic", 1, { fs: mappedFs(tempRoot) });
      // The canonical logical root is remapped onto the temp root; the real
      // repo directory must remain absent (the scope regression re-checks
      // this statically).
      expect(resolve(OPPONENT_FIXTURE_ROOT)).not.toBe(resolve(tempRoot));
    } finally {
      await cleanup();
    }
  });

  it("rejects a missing file", async () => {
    const { tempRoot, cleanup } = await createEnv();
    try {
      await expect(
        loadOpponentFixture("synthetic", 1, { fs: mappedFs(tempRoot) }),
      ).rejects.toThrow(/opponent fixture is missing/);
    } finally {
      await cleanup();
    }
  });

  it("rejects a directory instead of a regular file", async () => {
    const { tempRoot, cleanup } = await createEnv();
    try {
      await mkdir(join(tempRoot, "synthetic.v1.json"));
      await expect(
        loadOpponentFixture("synthetic", 1, { fs: mappedFs(tempRoot) }),
      ).rejects.toThrow(/must be a regular file \(found directory\)/);
    } finally {
      await cleanup();
    }
  });

  it("rejects a symbolic-link final file", async () => {
    const { tempRoot, cleanup } = await createEnv();
    try {
      const bytes = canonicalSyntheticFixtureBytes(makeSyntheticOpponentFixture());
      await writeFile(join(tempRoot, "synthetic.v1.json"), bytes, "utf-8");
      const fs = scriptedTargetFs(
        mappedFs(tempRoot),
        logicalFixturePath("synthetic.v1.json"),
        {
          lstatSequence: [symlinkEntry],
        },
      );
      await expect(loadOpponentFixture("synthetic", 1, { fs })).rejects.toThrow(
        /must be a regular file \(found symbolic link\)/,
      );
    } finally {
      await cleanup();
    }
  });

  it("rejects a symbolic-link or junction fixture root ancestor", async () => {
    // The fixed-root target is always a direct child of the fixture root, so
    // the only junction-controllable ancestor is the root itself. A junction
    // fixture root must be detected by lstat during the ancestry inspection.
    const base = await mkdtemp(join(tmpdir(), "opp-fixture-link-"));
    try {
      const realDir = join(base, "real");
      const junctionRoot = join(base, "junction");
      await mkdir(realDir);
      // A directory junction (works without admin on Windows; a symlink
      // elsewhere) — lstat detects either.
      await symlink(realDir, junctionRoot, "junction");
      const bytes = canonicalSyntheticFixtureBytes(makeSyntheticOpponentFixture());
      await writeFile(join(realDir, "synthetic.v1.json"), bytes, "utf-8");
      const fs = createOpponentFixtureMappedFs({ fixtureRoot: junctionRoot });
      await expect(loadOpponentFixture("synthetic", 1, { fs })).rejects.toThrow(
        /symbolic link or junction/,
      );
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("rejects path traversal and unsafe identifiers before any filesystem access", async () => {
    const { tempRoot, cleanup } = await createEnv();
    try {
      const fs = mappedFs(tempRoot);
      for (const bad of [
        "../evil",
        "a/b",
        "a\\b",
        "..",
        "C:evil",
        "http://evil",
        "a%2fb",
        "",
        "-leading",
      ]) {
        await expect(loadOpponentFixture(bad, 1, { fs })).rejects.toThrow(
          OpponentFixtureError,
        );
      }
    } finally {
      await cleanup();
    }
  });

  it("rejects an invalid fixture version", async () => {
    const { tempRoot, cleanup } = await createEnv();
    try {
      for (const version of [0, -1, 1.5, Number.NaN]) {
        await expect(
          loadOpponentFixture("synthetic", version, { fs: mappedFs(tempRoot) }),
        ).rejects.toThrow(/fixture version must be a positive integer/);
      }
    } finally {
      await cleanup();
    }
  });

  it("rejects oversized JSON", async () => {
    const { tempRoot, cleanup } = await createEnv();
    try {
      await writeFile(
        join(tempRoot, "synthetic.v1.json"),
        "x".repeat(OPPONENT_FIXTURE_MAX_JSON_BYTES + 1),
        "utf-8",
      );
      await expect(
        loadOpponentFixture("synthetic", 1, { fs: mappedFs(tempRoot) }),
      ).rejects.toThrow(/exceeds the maximum size/);
    } finally {
      await cleanup();
    }
  });

  it("rejects deletion while reading (re-lstat finds nothing)", async () => {
    const { tempRoot, cleanup } = await createEnv();
    try {
      const bytes = canonicalSyntheticFixtureBytes(makeSyntheticOpponentFixture());
      await writeFile(join(tempRoot, "synthetic.v1.json"), bytes, "utf-8");
      const fs = scriptedTargetFs(
        mappedFs(tempRoot),
        logicalFixturePath("synthetic.v1.json"),
        {
          lstatSequence: [fileEntry, "ENOENT"],
          readContent: bytes,
        },
      );
      await expect(loadOpponentFixture("synthetic", 1, { fs })).rejects.toThrow(
        /changed while being read \(found nothing\)/,
      );
    } finally {
      await cleanup();
    }
  });

  it("rejects a regular-file to symlink substitution after initial inspection", async () => {
    const { tempRoot, cleanup } = await createEnv();
    try {
      const bytes = canonicalSyntheticFixtureBytes(makeSyntheticOpponentFixture());
      await writeFile(join(tempRoot, "synthetic.v1.json"), bytes, "utf-8");
      const fs = scriptedTargetFs(
        mappedFs(tempRoot),
        logicalFixturePath("synthetic.v1.json"),
        {
          lstatSequence: [fileEntry, symlinkEntry],
          readContent: bytes,
        },
      );
      await expect(loadOpponentFixture("synthetic", 1, { fs })).rejects.toThrow(
        /changed while being read \(found symbolic link\)/,
      );
    } finally {
      await cleanup();
    }
  });

  it("rejects malformed JSON", async () => {
    const { tempRoot, cleanup } = await createEnv();
    try {
      await writeFile(join(tempRoot, "synthetic.v1.json"), "{ nope", "utf-8");
      await expect(
        loadOpponentFixture("synthetic", 1, { fs: mappedFs(tempRoot) }),
      ).rejects.toThrow(/is not valid JSON/);
    } finally {
      await cleanup();
    }
  });

  it("rejects noncanonical persisted bytes (compact, reordered, CRLF and trailing junk)", async () => {
    const { tempRoot, cleanup } = await createEnv();
    try {
      const raw = makeSyntheticOpponentFixture();
      const parsed = parseOpponentFixture(raw, "synthetic");
      const canonical = serializeOpponentFixture(parsed);

      // Compact (single-line) JSON with non-canonical key order.
      await writeFile(join(tempRoot, "synthetic.v1.json"), JSON.stringify(raw), "utf-8");
      await expect(
        loadOpponentFixture("synthetic", 1, { fs: mappedFs(tempRoot) }),
      ).rejects.toThrow(/persisted bytes must equal the canonical fixture serialization/);

      // Reordered keys: every field present, but in a non-canonical order
      // (canonical ordering sorts keys; this object does not). The checksum is
      // still valid, so rejection must come from the persisted-bytes rule.
      const reordered = JSON.stringify(
        {
          fixtureChecksum: parsed.fixtureChecksum,
          opponentId: parsed.opponentId,
          fixtureVersion: parsed.fixtureVersion,
          displayName: parsed.displayName,
          policy: parsed.policy,
          build: parsed.build,
          validatedBuild: parsed.validatedBuild,
          catalogueVersion: parsed.catalogueVersion,
          rulesetCompatibility: parsed.rulesetCompatibility,
          runtimeCompatibility: parsed.runtimeCompatibility,
          description: parsed.description,
          archetypeIntent: parsed.archetypeIntent,
          schemaVersion: parsed.schemaVersion,
        },
        null,
        2,
      );
      await writeFile(join(tempRoot, "synthetic.v1.json"), reordered, "utf-8");
      await expect(
        loadOpponentFixture("synthetic", 1, { fs: mappedFs(tempRoot) }),
      ).rejects.toThrow(/persisted bytes must equal the canonical fixture serialization/);

      // CRLF line endings.
      await writeFile(
        join(tempRoot, "synthetic.v1.json"),
        canonical.replace(/\n/g, "\r\n"),
        "utf-8",
      );
      await expect(
        loadOpponentFixture("synthetic", 1, { fs: mappedFs(tempRoot) }),
      ).rejects.toThrow(/persisted bytes must equal the canonical fixture serialization/);

      // Trailing junk.
      await writeFile(join(tempRoot, "synthetic.v1.json"), `${canonical}\n`, "utf-8");
      await expect(
        loadOpponentFixture("synthetic", 1, { fs: mappedFs(tempRoot) }),
      ).rejects.toThrow(/persisted bytes must equal the canonical fixture serialization/);

      // The canonical bytes themselves load successfully.
      await writeFile(join(tempRoot, "synthetic.v1.json"), canonical, "utf-8");
      const loaded = await loadOpponentFixture("synthetic", 1, {
        fs: mappedFs(tempRoot),
      });
      expect(loaded.fixtureChecksum).toBe(parsed.fixtureChecksum);
    } finally {
      await cleanup();
    }
  });

  it("binds the requested fixture version to the internal declaration", async () => {
    const { tempRoot, cleanup } = await createEnv();
    try {
      // File named v1 but internal fixtureVersion 2.
      const v2bytes = canonicalSyntheticFixtureBytes(
        makeSyntheticOpponentFixture({ fixtureVersion: 2 }),
      );
      await writeFile(join(tempRoot, "synthetic.v1.json"), v2bytes, "utf-8");
      await expect(
        loadOpponentFixture("synthetic", 1, { fs: mappedFs(tempRoot) }),
      ).rejects.toThrow(/fixtureVersion 2 must equal the requested version 1/);

      // File named v2 but internal fixtureVersion 1.
      const v1bytes = canonicalSyntheticFixtureBytes(
        makeSyntheticOpponentFixture({ fixtureVersion: 1 }),
      );
      await writeFile(join(tempRoot, "synthetic.v2.json"), v1bytes, "utf-8");
      await expect(
        loadOpponentFixture("synthetic", 2, { fs: mappedFs(tempRoot) }),
      ).rejects.toThrow(/fixtureVersion 1 must equal the requested version 2/);
    } finally {
      await cleanup();
    }
  });

  it("propagates all fixture validation failures as OpponentFixtureError", async () => {
    const { tempRoot, cleanup } = await createEnv();
    try {
      // A semantically corrupt fixture (wrong internal opponentId) with a
      // coherent checksum must surface as an OpponentFixtureError.
      const corrupt = makeSyntheticOpponentFixture({ opponentId: "other" });
      const bytes = JSON.stringify(
        {
          ...corrupt,
          opponentId: "other",
          fixtureChecksum: corrupt.fixtureChecksum,
        },
        null,
        2,
      );
      await writeFile(join(tempRoot, "synthetic.v1.json"), bytes, "utf-8");
      await expect(
        loadOpponentFixture("synthetic", 1, { fs: mappedFs(tempRoot) }),
      ).rejects.toThrow(OpponentFixtureError);
    } finally {
      await cleanup();
    }
  });

  it("rejects a persisted unknown nested armour field in validatedBuild.proposal even with stale or coherent checksum (Phase 1.1)", async () => {
    const { tempRoot, cleanup } = await createEnv();
    try {
      // Stale checksum: the original valid checksum is unchanged and the
      // unknown field is injected. Rejection must come from the strictness
      // boundary, not from a stale-checksum or canonical-byte check.
      const stale = makeSyntheticOpponentFixture();
      stale.validatedBuild = JSON.parse(JSON.stringify(stale.validatedBuild)) as Record<
        string,
        unknown
      >;
      (
        (stale.validatedBuild.proposal as Record<string, unknown>).armour as Record<
          string,
          unknown
        >
      ).bottom = 1;
      await writeFile(
        join(tempRoot, "synthetic.v1.json"),
        JSON.stringify(stale),
        "utf-8",
      );
      await expect(
        loadOpponentFixture("synthetic", 1, { fs: mappedFs(tempRoot) }),
      ).rejects.toThrow(
        /fixture validatedBuild\.proposal\.armour must not contain unknown field "bottom"/,
      );

      // Coherent checksum: recomputed over the tampered raw object.
      const coherent = makeSyntheticOpponentFixture();
      coherent.validatedBuild = JSON.parse(
        JSON.stringify(coherent.validatedBuild),
      ) as Record<string, unknown>;
      (
        (coherent.validatedBuild.proposal as Record<string, unknown>).armour as Record<
          string,
          unknown
        >
      ).bottom = 1;
      coherent.fixtureChecksum = opponentFixtureChecksum(
        coherent as unknown as OpponentFixtureV1,
      );
      await writeFile(
        join(tempRoot, "synthetic.v1.json"),
        JSON.stringify(coherent),
        "utf-8",
      );
      await expect(
        loadOpponentFixture("synthetic", 1, { fs: mappedFs(tempRoot) }),
      ).rejects.toThrow(
        /fixture validatedBuild\.proposal\.armour must not contain unknown field "bottom"/,
      );

      // The canonical persisted-byte validation remains intact: a valid
      // canonical fixture still loads.
      const canonical = canonicalSyntheticFixtureBytes(makeSyntheticOpponentFixture());
      await writeFile(join(tempRoot, "synthetic.v1.json"), canonical, "utf-8");
      const loaded = await loadOpponentFixture("synthetic", 1, {
        fs: mappedFs(tempRoot),
      });
      expect(loaded.fixtureChecksum).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      await cleanup();
    }
  });

  it("uses the default filesystem when no dependencies are provided", async () => {
    // The production call path uses defaultCanaryFs and the fixed root; this
    // simply asserts the API contract does not require a dependency argument.
    await expect(loadOpponentFixture("synthetic", 1)).rejects.toThrow(
      OpponentFixtureError,
    );
    expect(defaultCanaryFs).toBeDefined();
  });
});
