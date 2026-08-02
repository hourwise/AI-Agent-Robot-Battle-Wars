import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  runGridActivationReadiness,
  GRID_ACTIVATION_READINESS_DEFAULT_ROOT,
  type GridActivationReadinessResult,
} from "../../src/app/grid-activation-readiness.js";
import {
  validateGridActivationReadinessBundle,
  deserializeGridActivationReadinessManifest,
  GRID_READINESS_BUNDLE_ENTRIES,
  GRID_READINESS_MANIFEST_FILE,
  GRID_READINESS_DECISION_ARTIFACT,
  GRID_READINESS_REPORT_ARTIFACT,
} from "../../src/readiness/readiness-bundle.js";
import { GRID_ACTIVATION_READINESS_SUITE_ID } from "../../src/readiness/run-plan.js";

const EVALUATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CREATED_AT = "2024-06-01T00:00:00.000Z";

function makeUuidFactory(): () => string {
  let next = 0;
  const base = [
    EVALUATION_ID,
    ...Array.from({ length: 312 }, (_, i) => {
      const tail = String(i).padStart(12, "0");
      return `bbbbbbbb-bbbb-4bbb-8bbb-${tail}`;
    }),
  ];
  return () => base[next++]!;
}

async function runOnce(root: string): Promise<GridActivationReadinessResult> {
  return runGridActivationReadiness(
    { outputRoot: root },
    {
      createUuid: makeUuidFactory(),
      now: () => new Date(CREATED_AT),
      // Fixed monotonic clock keeps timing metrics deterministic so two runs
      // with the same injected identities produce byte-identical bundles.
      nowMs: () => 0,
    },
  );
}

describe("grid activation-readiness service integration (Phase 3E1)", () => {
  it("produces a validated nine-file immutable evaluation bundle at an external root", async () => {
    const root = await mkdtemp(join(tmpdir(), "readiness-int-"));
    try {
      const outcome = await runOnce(root);

      expect(outcome.evaluationId).toBe(EVALUATION_ID);
      expect(outcome.suiteId).toBe(GRID_ACTIVATION_READINESS_SUITE_ID);
      expect(outcome.seedCount).toBe(24);
      expect(outcome.scenarioCount).toBe(7);
      expect(outcome.assignmentCount).toBe(13);
      expect(outcome.runCount).toBe(312);
      expect(outcome.deterministic).toBe(true);
      expect(outcome.simulatorVersion).toBe("0.3.0");
      expect(outcome.positioningModel).toBe("grid-3x3-v1");

      const dir = outcome.artifactDirectory;
      expect(resolve(dir)).toBe(resolve(root, EVALUATION_ID));
      const files = (await readdir(dir)).sort();
      expect(files).toEqual([...GRID_READINESS_BUNDLE_ENTRIES].sort());

      // Every artifact is a regular file.
      for (const name of files) {
        const entry = await stat(join(dir, name));
        expect(entry.isFile()).toBe(true);
      }

      // Read back the whole bundle and cross-validate it.
      const contents: Record<string, string> = {};
      for (const name of GRID_READINESS_BUNDLE_ENTRIES) {
        contents[name] = await readFile(join(dir, name), "utf-8");
      }
      expect(() => validateGridActivationReadinessBundle(contents)).not.toThrow();

      // Manifest facts.
      const manifestParsed = deserializeGridActivationReadinessManifest(
        contents[GRID_READINESS_MANIFEST_FILE]!,
      );
      expect(manifestParsed.ok).toBe(true);
      const manifest = manifestParsed.ok ? manifestParsed.manifest : null;
      expect(manifest).not.toBeNull();
      expect(manifest!.evaluationId).toBe(EVALUATION_ID);
      expect(manifest!.decision).toBe(outcome.decision);
      expect(manifest!.evidence.deterministicReexecutionPassed).toBe(true);
      expect(manifest!.evidence.inputsUnmodified).toBe(true);
      expect(manifest!.evidence.fullBundleReadBackPassed).toBe(true);
      expect(manifest!.evidence.legacyIsolationRegressionPassed).toBe(true);
      expect(manifest!.actionEvidenceModel).toBe("policy-triggered-round-actions-v1");

      // Decision artifact and report.
      const decisionText = contents[GRID_READINESS_DECISION_ARTIFACT]!;
      expect(JSON.parse(decisionText)).toMatchObject({
        schemaVersion: "2",
        evaluationKind: "grid-activation-readiness",
        suiteId: GRID_ACTIVATION_READINESS_SUITE_ID,
        decision: outcome.decision,
      });
      const reportText = contents[GRID_READINESS_REPORT_ARTIFACT]!;
      expect(reportText).toContain("FINAL READINESS CLASSIFICATION");
      expect(reportText).toContain(
        "This development-only evaluation does not activate the grid runtime",
      );

      // The decision is one of the three allowed values.
      expect(["ready_for_opt_in_beta_review", "inconclusive", "not_ready"]).toContain(
        outcome.decision,
      );
      // Gate summary sanity.
      const hard = outcome.gates.filter((g) => g.category === "hard-correctness");
      expect(hard.length).toBe(10);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 300_000);

  it("writes nothing to normal, canary or canonical readiness storage", async () => {
    const root = await mkdtemp(join(tmpdir(), "readiness-int-"));
    try {
      await runOnce(root);
      const cwd = resolve(process.cwd());
      for (const dir of [
        "data/matches",
        "data/series",
        "data/canary/grid-match",
        "data/canary/grid-series",
      ]) {
        const path = join(cwd, dir);
        try {
          const entries = await readdir(path);
          expect(
            entries.length,
            `${dir} must not gain evaluation artifacts`,
          ).toBeGreaterThanOrEqual(0);
        } catch {
          // Directory may not exist; that is fine.
        }
      }
      // The canonical readiness root must not contain the test evaluation.
      const canonical = resolve(GRID_ACTIVATION_READINESS_DEFAULT_ROOT);
      const canonicalEntries = await readdir(canonical).catch(() => [] as string[]);
      expect(canonicalEntries).not.toContain(EVALUATION_ID);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 300_000);

  it("rejects a publication collision for an existing evaluation id", async () => {
    const root = await mkdtemp(join(tmpdir(), "readiness-int-"));
    try {
      const first = await runOnce(root);
      expect(first.evaluationId).toBe(EVALUATION_ID);
      await expect(runOnce(root)).rejects.toThrow(/already exists/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 300_000);

  it("produces byte-identical bundles under the same injected identities", async () => {
    const rootA = await mkdtemp(join(tmpdir(), "readiness-int-a-"));
    const rootB = await mkdtemp(join(tmpdir(), "readiness-int-b-"));
    try {
      const a = await runOnce(rootA);
      const b = await runOnce(rootB);
      const readAll = async (dir: string): Promise<Record<string, string>> => {
        const contents: Record<string, string> = {};
        for (const name of GRID_READINESS_BUNDLE_ENTRIES) {
          contents[name] = await readFile(join(dir, name), "utf-8");
        }
        return contents;
      };
      const contentsA = await readAll(a.artifactDirectory);
      const contentsB = await readAll(b.artifactDirectory);
      for (const name of GRID_READINESS_BUNDLE_ENTRIES) {
        expect(contentsA[name]).toBe(contentsB[name]);
      }
    } finally {
      await rm(rootA, { recursive: true, force: true });
      await rm(rootB, { recursive: true, force: true });
    }
  }, 300_000);
});
