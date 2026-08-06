import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ALPHA_FIGHTER_SPEC, BETA_FIGHTER_SPEC } from "../helpers/grid-beta-builder.js";
import { defaultCanaryFs } from "../../src/canary/immutable-canary-bundle.js";
import {
  GRID_BETA_FIGHTER_MAX_JSON_BYTES,
  GridBetaFighterSpecError,
  assertGridBetaFighterIdentifier,
  createGridBetaFighterExecutionValues,
  gridBetaFighterSpecChecksum,
  loadGridBetaFighterSpec,
  parseGridBetaFighterSpec,
} from "../../src/beta/grid-beta-fighter-spec.js";

async function writeFighterToTemp(
  spec: Record<string, unknown>,
  fighterId: string,
): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(join(tmpdir(), "beta-fighter-"));
  await writeFile(
    join(root, `${fighterId}.json`),
    JSON.stringify(spec, null, 2),
    "utf-8",
  );
  return {
    root,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

describe("grid beta fighter spec (Phase 3G Phase 3)", () => {
  it("parses and deeply freezes a valid local-scripted spec with a deterministic checksum", async () => {
    const { spec, checksum } = parseGridBetaFighterSpec(ALPHA_FIGHTER_SPEC, "alpha");
    expect(spec.schemaVersion).toBe("1");
    expect(spec.sourceKind).toBe("local-scripted");
    expect(spec.fighterId).toBe("alpha");
    expect(spec.displayName).toBe("Alpha");
    expect(Object.isFrozen(spec)).toBe(true);
    expect(Object.isFrozen(spec.buildProposal)).toBe(true);
    expect(Object.isFrozen(spec.policy)).toBe(true);
    expect(checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(checksum).toBe(gridBetaFighterSpecChecksum(spec));
    // Deterministic across re-parses.
    const again = parseGridBetaFighterSpec(ALPHA_FIGHTER_SPEC, "alpha");
    expect(again.checksum).toBe(checksum);
  });

  it("supports a mirror match: the same fighter may occupy both slots", () => {
    const { spec } = parseGridBetaFighterSpec(ALPHA_FIGHTER_SPEC, "alpha");
    const executionA = createGridBetaFighterExecutionValues(spec);
    const executionB = createGridBetaFighterExecutionValues(spec);
    expect(executionA.build.proposal.machineName).toBe("Alpha");
    expect(executionB.build.proposal.machineName).toBe("Alpha");
    // Fresh mutable values per simulation, never the frozen shared spec.
    expect(executionA.build).not.toBe(executionB.build);
    expect(executionA.policy).not.toBe(spec.policy);
  });

  it("rejects a fighterId that does not match the requested identifier", () => {
    expect(() => parseGridBetaFighterSpec(ALPHA_FIGHTER_SPEC, "beta")).toThrow(
      /must equal the requested identifier/,
    );
  });

  it("rejects a displayName that disagrees with the machine name", () => {
    const bad = {
      ...ALPHA_FIGHTER_SPEC,
      displayName: "Not Alpha",
    };
    expect(() => parseGridBetaFighterSpec(bad, "alpha")).toThrow(
      /displayName must agree with the build proposal machine name/,
    );
  });

  it("rejects a displayName that does not pass text sanitisation", () => {
    const bad = {
      ...ALPHA_FIGHTER_SPEC,
      displayName: "Alpha\x1b[31m",
    };
    expect(() => parseGridBetaFighterSpec(bad, "alpha")).toThrow(
      /already pass text sanitisation/,
    );
  });

  it("rejects an invalid build proposal through the authoritative catalogue validator", () => {
    const bad = {
      ...ALPHA_FIGHTER_SPEC,
      buildProposal: {
        ...(ALPHA_FIGHTER_SPEC.buildProposal as Record<string, unknown>),
        // Schema-valid enums but an over-budget armour distribution: only the
        // catalogue-v1 budget validator can reject it.
        armour: { front: 100000, left: 0, right: 0, rear: 0, top: 0 },
      },
    };
    expect(() => parseGridBetaFighterSpec(bad, "alpha")).toThrow(
      /catalogue-v1 validator/,
    );
  });

  it("rejects an invalid policy through the authoritative policy schema", () => {
    const bad = {
      ...ALPHA_FIGHTER_SPEC,
      policy: {
        ...(ALPHA_FIGHTER_SPEC.policy as Record<string, unknown>),
        opening: "bad",
      },
    };
    expect(() => parseGridBetaFighterSpec(bad, "alpha")).toThrow(/authoritative schema/);
  });

  it("rejects an unsupported schemaVersion or sourceKind", () => {
    expect(() =>
      parseGridBetaFighterSpec({ ...ALPHA_FIGHTER_SPEC, schemaVersion: "2" }, "alpha"),
    ).toThrow(/authoritative schema/);
    expect(() =>
      parseGridBetaFighterSpec({ ...ALPHA_FIGHTER_SPEC, sourceKind: "ai" }, "alpha"),
    ).toThrow(/authoritative schema/);
  });

  it("rejects path-like, traversal, URL, drive and encoded identifiers", () => {
    for (const bad of [
      "../secret",
      "a/b",
      "a\\b",
      "C:evil",
      "http://x",
      "%2e%2e",
      "a..b",
      "UPPER",
    ]) {
      expect(() => assertGridBetaFighterIdentifier(bad), bad).toThrow(
        GridBetaFighterSpecError,
      );
    }
  });

  it("loads a valid spec from the fighter root with basename agreement", async () => {
    const { root, cleanup } = await writeFighterToTemp(ALPHA_FIGHTER_SPEC, "alpha");
    try {
      const loaded = await loadGridBetaFighterSpec(root, "alpha", defaultCanaryFs);
      expect(loaded.spec.fighterId).toBe("alpha");
      expect(loaded.checksum).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      await cleanup();
    }
  });

  it("rejects a missing fighter file", async () => {
    const { root, cleanup } = await writeFighterToTemp(ALPHA_FIGHTER_SPEC, "alpha");
    try {
      await expect(
        loadGridBetaFighterSpec(root, "ghost", defaultCanaryFs),
      ).rejects.toThrow(/missing/);
    } finally {
      await cleanup();
    }
  });

  it("rejects a non-regular fighter entry", async () => {
    const root = await mkdtemp(join(tmpdir(), "beta-fighter-dir-"));
    await mkdir(join(root, "alpha.json"));
    try {
      await expect(
        loadGridBetaFighterSpec(root, "alpha", defaultCanaryFs),
      ).rejects.toThrow(/regular file/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a symbolic-link or junction fighter root", async () => {
    const root = await mkdtemp(join(tmpdir(), "beta-fighter-linkroot-"));
    const outside = await mkdtemp(join(tmpdir(), "beta-fighter-outside-"));
    const junctionRoot = join(root, "fighters-link");
    await writeFile(
      join(outside, "alpha.json"),
      JSON.stringify(ALPHA_FIGHTER_SPEC, null, 2),
      "utf-8",
    );
    // A directory junction (works without admin on Windows; a symlink on
    // other platforms). The loader must reject the root ancestry.
    await symlink(outside, junctionRoot, "junction");
    try {
      await expect(
        loadGridBetaFighterSpec(junctionRoot, "alpha", defaultCanaryFs),
      ).rejects.toThrow(/symbolic link or junction/);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("rejects an oversized fighter file", async () => {
    const root = await mkdtemp(join(tmpdir(), "beta-fighter-big-"));
    const big = {
      ...ALPHA_FIGHTER_SPEC,
      buildProposal: {
        ...(ALPHA_FIGHTER_SPEC.buildProposal as Record<string, unknown>),
        designSummary: "x".repeat(GRID_BETA_FIGHTER_MAX_JSON_BYTES + 10),
      },
    };
    await writeFile(join(root, "alpha.json"), JSON.stringify(big), "utf-8");
    try {
      await expect(
        loadGridBetaFighterSpec(root, "alpha", defaultCanaryFs),
      ).rejects.toThrow(/exceeds the maximum size/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a basename/internal fighterId disagreement", async () => {
    // Write the BETA spec (fighterId "beta") under alpha.json so the file
    // exists but its internal fighterId disagrees with the requested id.
    const root = await mkdtemp(join(tmpdir(), "beta-fighter-idmismatch-"));
    await writeFile(
      join(root, "alpha.json"),
      JSON.stringify(BETA_FIGHTER_SPEC, null, 2),
      "utf-8",
    );
    try {
      await expect(
        loadGridBetaFighterSpec(root, "alpha", defaultCanaryFs),
      ).rejects.toThrow(/must equal the requested identifier/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("is an input error: spec failures are GridBetaFighterSpecError, never a suspension trigger", () => {
    expect(() =>
      parseGridBetaFighterSpec({ ...ALPHA_FIGHTER_SPEC, fighterId: "x/y" }, "alpha"),
    ).toThrow(GridBetaFighterSpecError);
  });

  it("rejects unknown fields through the strict fighter schema (Phase 3G.1 Phase 4)", () => {
    for (const field of [
      "provider",
      "model",
      "runtime",
      "outputRoot",
      "ranked",
      "tournament",
      "balanceQualified",
    ]) {
      expect(() =>
        parseGridBetaFighterSpec({ ...ALPHA_FIGHTER_SPEC, [field]: "x" }, "alpha"),
      ).toThrow(/authoritative schema/);
    }
  });

  it("rejects a symbolic-link parent above the configured fighter root (Phase 3G.1 Phase 12)", async () => {
    const root = await mkdtemp(join(tmpdir(), "beta-fighter-linkabove-"));
    const outside = await mkdtemp(join(tmpdir(), "beta-fighter-above-out-"));
    await mkdir(join(outside, "fighters"));
    await writeFile(
      join(outside, "fighters", "alpha.json"),
      JSON.stringify(ALPHA_FIGHTER_SPEC, null, 2),
      "utf-8",
    );
    const junctionParent = join(root, "level");
    await symlink(outside, junctionParent, "junction");
    const fighterRoot = join(junctionParent, "fighters");
    try {
      await expect(
        loadGridBetaFighterSpec(fighterRoot, "alpha", defaultCanaryFs),
      ).rejects.toThrow(/symbolic link or junction/);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("rejects a fighter entry that changes to a symbolic link while being read (Phase 3G.1 Phase 12)", async () => {
    const root = await mkdtemp(join(tmpdir(), "beta-fighter-swap-"));
    await writeFile(
      join(root, "alpha.json"),
      JSON.stringify(ALPHA_FIGHTER_SPEC, null, 2),
      "utf-8",
    );
    try {
      const symlinkEntry = {
        isFile: () => false,
        isDirectory: () => false,
        isSymbolicLink: () => true,
      };
      const realFileEntry = {
        isFile: () => true,
        isDirectory: () => false,
        isSymbolicLink: () => false,
      };
      let fileLstats = 0;
      const swappingFs = {
        ...defaultCanaryFs,
        lstat: async (path: string) => {
          if (path.replaceAll("\\", "/").endsWith("/alpha.json")) {
            fileLstats += 1;
            // The pre-read lstat sees a regular file; the recheck lstat after
            // reading sees a symbolic link, so the substitution is not
            // followed silently.
            return fileLstats >= 2 ? symlinkEntry : realFileEntry;
          }
          return defaultCanaryFs.lstat(path);
        },
      };
      await expect(loadGridBetaFighterSpec(root, "alpha", swappingFs)).rejects.toThrow(
        /changed while being read/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
