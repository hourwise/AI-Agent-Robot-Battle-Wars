import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertValidBundleDeclaration,
  ImmutableBundleDeclarationError,
  publishImmutableBundle,
  type ImmutableBundleArtifact,
} from "../../src/canary/immutable-canary-bundle.js";

const tempRoots: string[] = [];

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "bundle-decl-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

const MANIFEST = "manifest.json";
const ENTRIES = ["manifest.json", "a.json", "b.json"];
const ARTIFACTS: readonly ImmutableBundleArtifact[] = [
  { name: "a.json", content: "{}" },
  { name: "b.json", content: "[]" },
];

function declaration(overrides?: {
  manifestFileName?: string;
  entryNames?: readonly string[];
  artifacts?: readonly ImmutableBundleArtifact[];
}) {
  return {
    manifestFileName: overrides?.manifestFileName ?? MANIFEST,
    entryNames: overrides?.entryNames ?? ENTRIES,
    artifacts: overrides?.artifacts ?? ARTIFACTS,
  };
}

describe("immutable bundle publisher declaration contract (Phase 3D2B.1)", () => {
  it("accepts a well-formed declaration", () => {
    expect(() => assertValidBundleDeclaration(declaration())).not.toThrow();
  });

  it("rejects duplicate entry names", () => {
    expect(() =>
      assertValidBundleDeclaration(
        declaration({ entryNames: ["manifest.json", "a.json", "a.json"] }),
      ),
    ).toThrow(ImmutableBundleDeclarationError);
    expect(() =>
      assertValidBundleDeclaration(
        declaration({ entryNames: ["manifest.json", "manifest.json", "a.json"] }),
      ),
    ).toThrow(/unique/);
  });

  it("rejects a manifest filename absent from entryNames", () => {
    expect(() =>
      assertValidBundleDeclaration(
        declaration({
          manifestFileName: "missing.json",
          entryNames: ["manifest.json", "a.json", "b.json"],
        }),
      ),
    ).toThrow(/exactly once/);
  });

  it("rejects duplicate artifact names", () => {
    expect(() =>
      assertValidBundleDeclaration(
        declaration({
          artifacts: [
            { name: "a.json", content: "1" },
            { name: "a.json", content: "2" },
          ],
        }),
      ),
    ).toThrow(/unique/);
  });

  it("rejects an artifact using the manifest filename", () => {
    expect(() =>
      assertValidBundleDeclaration(
        declaration({
          artifacts: [
            { name: "manifest.json", content: "{}" },
            { name: "a.json", content: "1" },
          ],
        }),
      ),
    ).toThrow(/must not use the manifest filename/);
  });

  it("rejects an artifact not declared in entryNames", () => {
    expect(() =>
      assertValidBundleDeclaration(
        declaration({
          artifacts: [
            { name: "a.json", content: "1" },
            { name: "zzz.json", content: "2" },
          ],
        }),
      ),
    ).toThrow(/not declared in entryNames/);
  });

  it("rejects a missing artifact for a non-manifest entry", () => {
    expect(() =>
      assertValidBundleDeclaration(
        declaration({
          entryNames: ["manifest.json", "a.json", "b.json"],
          artifacts: [{ name: "a.json", content: "1" }],
        }),
      ),
    ).toThrow(/missing an artifact|exactly one artifact/);
  });

  it("rejects path-like, traversal, absolute and empty names", () => {
    for (const badName of [
      "a/b.json",
      "a\\b.json",
      "..",
      "sub/..",
      "/abs",
      "\\abs",
      "C:\\abs",
      "",
    ]) {
      expect(() =>
        assertValidBundleDeclaration(
          declaration({
            entryNames: ["manifest.json", "a.json", badName],
            artifacts: [
              { name: "a.json", content: "1" },
              { name: badName, content: "2" },
            ],
          }),
        ),
      ).toThrow(ImmutableBundleDeclarationError);
    }
  });

  it("rejects an empty entry list", () => {
    expect(() => assertValidBundleDeclaration(declaration({ entryNames: [] }))).toThrow(
      /at least one entry/,
    );
  });
});

describe("immutable bundle publisher declaration validation before filesystem activity (Phase 3D2B.1)", () => {
  it("rejects a malformed declaration before writing anything", async () => {
    const root = await makeTempRoot();
    const canaryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await expect(
      publishImmutableBundle({
        fs: undefined as never,
        outputRoot: root,
        canaryId,
        manifestFileName: MANIFEST,
        entryNames: ["manifest.json", "a.json", "a.json"],
        artifacts: [{ name: "a.json", content: "x" }],
        serializedManifest: "{}",
        verify: async () => {},
      }),
    ).rejects.toThrow(ImmutableBundleDeclarationError);
    // No directory, no temp path, no final path was created.
    expect(await readdir(root)).toEqual([]);
  });

  it("publishes a valid declaration atomically with exact inventory", async () => {
    const root = await makeTempRoot();
    const canaryId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const dir = await publishImmutableBundle({
      fs: (await import("../../src/canary/immutable-canary-bundle.js")).defaultCanaryFs,
      outputRoot: root,
      canaryId,
      manifestFileName: MANIFEST,
      entryNames: ENTRIES,
      artifacts: ARTIFACTS,
      serializedManifest: JSON.stringify({ ok: true }, null, 2),
      verify: async ({ contents }) => {
        expect(contents["a.json"]).toBe("{}");
        expect(contents["b.json"]).toBe("[]");
      },
    });
    const files = (await readdir(dir)).sort();
    expect(files).toEqual(["a.json", "b.json", "manifest.json"]);
    expect(await readFile(join(dir, "a.json"), "utf-8")).toBe("{}");
    expect(await readFile(join(dir, "manifest.json"), "utf-8")).toBe(
      JSON.stringify({ ok: true }, null, 2),
    );
  });
});
