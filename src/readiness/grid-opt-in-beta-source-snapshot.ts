import { sha256Hex } from "../canary/grid-canary-digest.js";
import type { GridOptInBetaSourceCommitReader } from "./grid-source-commit-reader.js";

/**
 * Reviewed grid opt-in beta source snapshot (Milestone 0.2C Phase 3F.1,
 * Phase 2).
 *
 * The snapshot binds the exact source bytes at the reviewed commit
 * `5173fd0f…` to every file that materially establishes the approval
 * criteria: legacy default routing, schema-v2/v3 persistence, grid replay
 * availability, grid runtime identity, C1/C2/AB2 checksums and C2 default,
 * canary isolation and the absence of automatic/default grid selection.
 *
 * For every file the snapshot retains the repository-relative path, the Git
 * blob SHA and the SHA-256 of the exact committed bytes. A deterministic
 * snapshot checksum covers the snapshot ID, repository, source commit, and
 * the ordered file paths, blob hashes and content hashes. No working-tree
 * byte may be substituted for a commit-object byte: the only source of bytes
 * is the injected commit-object reader.
 */

export const GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_ID =
  "grid-opt-in-beta-reviewed-source-v1" as const;

export const GRID_OPT_IN_BETA_REVIEWED_SOURCE_REPOSITORY =
  "hourwise/AI-Agent-Robot-Battle-Wars" as const;

export const GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT =
  "5173fd0f287465e1181969dbad2f37cee10fd47e" as const;

/** Ordered reviewed source paths (frozen; the exact snapshot file set). */
export const GRID_OPT_IN_BETA_REVIEWED_SOURCE_PATHS: readonly string[] = Object.freeze([
  "package.json",
  "src/app/run-match.ts",
  "src/app/run-series.ts",
  "src/simulator/simulator.ts",
  "src/simulator/constants.ts",
  "src/simulator/runtime-identity.ts",
  "src/simulator/component-qualification-registry.ts",
  "src/catalogue/catalogue.v1.ts",
  "src/persistence/match-converter.ts",
  "src/schemas/match-record.schema.ts",
  "src/replay/positioning-model.ts",
  "src/replay/text-replay-renderer.ts",
  "src/replay/ascii/arena-renderer.ts",
  "src/replay/ascii/ascii-replay-renderer.ts",
  "src/schemas/positioning.schema.ts",
  "src/app/grid-match-canary.ts",
  "src/canary/grid-series-canary-core.ts",
  "src/canary/canary-output-root.ts",
  "src/simulator/grid-runtime.ts",
  "src/app/run-benchmark.ts",
  "src/app/run-lifecycle-benchmark.ts",
  "src/app/run-grid-canary-match.ts",
  "src/app/run-grid-series-canary.ts",
  "src/app/run-grid-activation-readiness.ts",
  "src/app/run-grid-grapple-coverage-supplement.ts",
  "src/readiness/grid-grapple-supplement-bundle.ts",
]);

export interface GridOptInBetaReviewedSourceFileV1 {
  /** Repository-relative path (forward slashes). */
  readonly path: string;
  /** Git blob SHA at the reviewed commit. */
  readonly blobSha: string;
  /** SHA-256 of the exact committed bytes. */
  readonly contentSha256: string;
}

export interface GridOptInBetaReviewedSourceSnapshotV1 {
  readonly snapshotId: "grid-opt-in-beta-reviewed-source-v1";
  readonly repository: "hourwise/AI-Agent-Robot-Battle-Wars";
  readonly sourceCommit: "5173fd0f287465e1181969dbad2f37cee10fd47e";
  readonly files: readonly GridOptInBetaReviewedSourceFileV1[];
  /** Deterministic snapshot checksum (frozen for the reviewed snapshot). */
  readonly checksum: string;
}

/** Frozen reviewed file identities (blob SHA + content SHA-256 at 5173fd0f…). */
export const GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES: readonly GridOptInBetaReviewedSourceFileV1[] =
  Object.freeze([
    {
      path: "package.json",
      blobSha: "cfa165f926a025ba6214421ad73c6f3a0d549c5b",
      contentSha256: "e8a00290d636b68861598e61a69b6cba14b86ffa5dc721380bf34843f9abe54c",
    },
    {
      path: "src/app/run-match.ts",
      blobSha: "e690d0ba6ef8e76cc7c76d658709dd36c2cff406",
      contentSha256: "dbb964bc6fb64e3f31407e5551cd9d7462d6f5b2e31c362f6c72c14f61bc1f91",
    },
    {
      path: "src/app/run-series.ts",
      blobSha: "68665f7e26a90e9e2277e5561b9fbf68b7c7cb60",
      contentSha256: "eb503003b44636dbf757f0cc2d032a09eae66cbc4d4db5f640aa6c8cf15f1c13",
    },
    {
      path: "src/simulator/simulator.ts",
      blobSha: "271666a4d9ca689848c88dbe4fce419e42a37cc3",
      contentSha256: "89394b83e56d5761aa90d3d99ed2cc09ec84fd9ac0574fe875cdcc275c8a0a7d",
    },
    {
      path: "src/simulator/constants.ts",
      blobSha: "d2424271d91cd320dc952808e8aaca930f896edf",
      contentSha256: "fa055715261b7642d09043bbc3f46612b80c0104ad7abe38103861191c985e9b",
    },
    {
      path: "src/simulator/runtime-identity.ts",
      blobSha: "77f4b558f1ae2557009dd5bd64799532c13358b6",
      contentSha256: "28f2de2b8b2597093ac761670e3e8f4e42e23fe3132c139606a05393b788300b",
    },
    {
      path: "src/simulator/component-qualification-registry.ts",
      blobSha: "d531434f14802fc1b67a4af9be910e7f0b47fcbd",
      contentSha256: "566d4dd73039371e78be8a869fdf8c4fd0f1d1e0bd05c1c2573c030cfd414b76",
    },
    {
      path: "src/catalogue/catalogue.v1.ts",
      blobSha: "39bd0e01111ce6e2a9e103eb6090662fa7caf04c",
      contentSha256: "67dfb506fd32e39219ec1aedf4603608ea3aa1202422e28a2a4e96a9c2f63227",
    },
    {
      path: "src/persistence/match-converter.ts",
      blobSha: "718944dbc86b02cc643e832abe08557a9939fccd",
      contentSha256: "7bf317d32ea9a901cdec536b61b23b7e0c5641f2e33d4eabbac733e2e8bfea3f",
    },
    {
      path: "src/schemas/match-record.schema.ts",
      blobSha: "1618c7551a6edf753c8d2cee65b8ce959ae68a23",
      contentSha256: "7bff0d9adc0b7b22a4234157fd2c989d540657f793f5801ffb9212c801400996",
    },
    {
      path: "src/replay/positioning-model.ts",
      blobSha: "749786f125d5ac74a6bc7bad5f3eecb36f4363c1",
      contentSha256: "cfacdde60591390acfc4f0ec5eddf117fdc00cc0ff0a4b7acfd2b068d6d55023",
    },
    {
      path: "src/replay/text-replay-renderer.ts",
      blobSha: "9718adaf4dd635a74b68a6a1c33668f0a2bc5b23",
      contentSha256: "941cfbea6ff885f05fb2754e0091a246b80851e125bb302666cf243bb6951906",
    },
    {
      path: "src/replay/ascii/arena-renderer.ts",
      blobSha: "a0ff532bea860fb43f415ad82ab32206fafd4880",
      contentSha256: "c5c10489993430e1e83462092eea35c4f19395d6b35c01eb131576ddaa73e86d",
    },
    {
      path: "src/replay/ascii/ascii-replay-renderer.ts",
      blobSha: "a8e8aca51383033d3d9a8a45746638be4799a54f",
      contentSha256: "2cc851c8743421e77a092f12b6b2b9b6b9dcda1b76ac309aca03e82fffc36a2f",
    },
    {
      path: "src/schemas/positioning.schema.ts",
      blobSha: "f3394f11f20ed17e9195ff6cd226a1df06a1bb09",
      contentSha256: "f5f4a86258f3c5c4422cf492a0cf0ffcb98953ddae431e852eb3601c35d8af48",
    },
    {
      path: "src/app/grid-match-canary.ts",
      blobSha: "033f4c94368d7e355e0cf4b491ed817ee639f66b",
      contentSha256: "4ce94b9ceee7b7f4a4db1e50c367109d82a43cdc88d4f1dba9cc79bb447e6671",
    },
    {
      path: "src/canary/grid-series-canary-core.ts",
      blobSha: "7993b58d9980f06064b2a3b453ffd0e1ebf3d681",
      contentSha256: "41cd26315e2d006c1499f939062d35001072837907f993689607a016e38cffec",
    },
    {
      path: "src/canary/canary-output-root.ts",
      blobSha: "9cb94d7645a3e1dd6049e25f84d44ca13f67cb80",
      contentSha256: "2d70ba9f41dc30dd5b5617fbdb50f604c081ffbf4812e1ea3e73e765455d8cc9",
    },
    {
      path: "src/simulator/grid-runtime.ts",
      blobSha: "dbd4406303f43658da33167c0fa6a74dc0df7664",
      contentSha256: "273973a7312590058b9369b21659a15de0b491d9283b7a6e15e08681434781f1",
    },
    {
      path: "src/app/run-benchmark.ts",
      blobSha: "618222b872b2d77d32178fcddfd62fa16d953b8e",
      contentSha256: "6abe2db3835dbbf90bb77eeb501dfc1b59df532d6b60176facffe572a1bd6067",
    },
    {
      path: "src/app/run-lifecycle-benchmark.ts",
      blobSha: "2ce74fb81ac93191e41aba24a5725e5b82fbf217",
      contentSha256: "a87a44609d2295a08cd1fd8096327c324a281d6f99a1a57b116c9e48f3fbeee9",
    },
    {
      path: "src/app/run-grid-canary-match.ts",
      blobSha: "fd85dd393f7aab36687a6e54960a959e8554d129",
      contentSha256: "46fa0319a83dee7bbcbaf03e0760af13f9c53490305170bdcb5b80e7cdb65a01",
    },
    {
      path: "src/app/run-grid-series-canary.ts",
      blobSha: "032dcd1ac78753248b6bb76653971c87ef6058e5",
      contentSha256: "d834af36a250b0b682fdc6977ccab741039d9f8b3d8d3adf53c48af50fe1bb67",
    },
    {
      path: "src/app/run-grid-activation-readiness.ts",
      blobSha: "8289742fd1bf0cdf092e54ac53fc8f008d53c95c",
      contentSha256: "4497e52a68faf254703be572f2214426502c19c512575457bd0941342b3c4c48",
    },
    {
      path: "src/app/run-grid-grapple-coverage-supplement.ts",
      blobSha: "5ce6d0146ed00d2e8548d28a914633c5133f19d8",
      contentSha256: "19ec15fbdd97e77481e08fbed2ce27241553f756bfdec02b11f4b115f614fb9c",
    },
    {
      path: "src/readiness/grid-grapple-supplement-bundle.ts",
      blobSha: "d7098fb4e281764013620dc41a9cca4f95473b76",
      contentSha256: "4d482da728f3596ee01d55c49be34fd10887719fcd746a700a4cccbc2a576d40",
    },
  ]);

/** Frozen deterministic checksum of the reviewed source snapshot. */
export const GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM =
  "1f984801f6e7ed1809080f88e84004e8dc426de31c2e877dfbbcb09967c3680c";

/**
 * Deterministic snapshot serialization: snapshot ID, repository, source
 * commit and the ordered file identities. Never includes the checksum field
 * itself.
 */
export function serializeGridOptInBetaReviewedSourceSnapshot(
  snapshot: GridOptInBetaReviewedSourceSnapshotV1,
): string {
  return JSON.stringify(
    {
      snapshotId: snapshot.snapshotId,
      repository: snapshot.repository,
      sourceCommit: snapshot.sourceCommit,
      files: snapshot.files.map((file) => ({
        path: file.path,
        blobSha: file.blobSha,
        contentSha256: file.contentSha256,
      })),
    },
    null,
    2,
  );
}

export function gridOptInBetaReviewedSourceSnapshotChecksum(
  snapshot: GridOptInBetaReviewedSourceSnapshotV1,
): string {
  return sha256Hex(serializeGridOptInBetaReviewedSourceSnapshot(snapshot));
}

function snapshotEntryMatchesFrozen(
  file: GridOptInBetaReviewedSourceFileV1,
  frozen: GridOptInBetaReviewedSourceFileV1,
): boolean {
  return (
    file.path === frozen.path &&
    file.blobSha === frozen.blobSha &&
    file.contentSha256 === frozen.contentSha256
  );
}

/**
 * Requires the snapshot to equal the frozen reviewed source snapshot exactly:
 * snapshot ID, repository, source commit, ordered file paths, blob hashes,
 * content hashes and the deterministic checksum. Throws with a precise reason
 * on any mismatch.
 */
export function anchorGridOptInBetaReviewedSourceSnapshot(
  snapshot: GridOptInBetaReviewedSourceSnapshotV1,
): void {
  const failures: string[] = [];
  if (snapshot.snapshotId !== GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_ID) {
    failures.push(
      `snapshot ID ${snapshot.snapshotId} is not ${GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_ID}`,
    );
  }
  if (snapshot.repository !== GRID_OPT_IN_BETA_REVIEWED_SOURCE_REPOSITORY) {
    failures.push(
      `snapshot repository ${snapshot.repository} is not ${GRID_OPT_IN_BETA_REVIEWED_SOURCE_REPOSITORY}`,
    );
  }
  if (snapshot.sourceCommit !== GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT) {
    failures.push(
      `snapshot source commit ${snapshot.sourceCommit} is not ${GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT}`,
    );
  }
  if (
    snapshot.files.length !== GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES.length ||
    snapshot.files.some(
      (file, index) =>
        !snapshotEntryMatchesFrozen(file, GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES[index]!),
    )
  ) {
    failures.push(
      "snapshot ordered file identities do not match the frozen reviewed source files",
    );
  }
  if (snapshot.checksum !== GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM) {
    failures.push(
      `snapshot checksum ${snapshot.checksum} is not the frozen ${GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM}`,
    );
  }
  if (failures.length > 0) {
    throw new Error(
      `Reviewed grid opt-in beta source snapshot is not the frozen reviewed snapshot: ${failures.join("; ")}`,
    );
  }
}

export interface BuiltGridOptInBetaReviewedSourceSnapshot {
  readonly snapshot: GridOptInBetaReviewedSourceSnapshotV1;
  /** Exact committed bytes decoded as UTF-8, keyed by reviewed path. */
  readonly contents: Record<string, string>;
}

/**
 * Reads the reviewed source snapshot from the exact Git commit object.
 *
 * - requires commit `5173fd0f…` to exist locally (never the working tree);
 * - requires every reviewed path to exist in that commit;
 * - rejects shallow/missing objects instead of silently using current files;
 * - never modifies the repository and never accesses the network.
 *
 * The returned snapshot is built from whatever the injected reader reports;
 * `anchorGridOptInBetaReviewedSourceSnapshot` then requires it to equal the
 * frozen reviewed snapshot exactly.
 */
export async function buildGridOptInBetaReviewedSourceSnapshot(
  reader: GridOptInBetaSourceCommitReader,
  commit: string = GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT,
): Promise<BuiltGridOptInBetaReviewedSourceSnapshot> {
  if (commit !== GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT) {
    throw new Error(
      `Reviewed source snapshot requires the exact authorised commit ${GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT}; received ${commit}`,
    );
  }
  if (!(await reader.commitAvailable(commit))) {
    throw new Error(
      `Reviewed source commit ${commit} is not available locally (missing or shallow); refusing to substitute working-tree bytes`,
    );
  }
  const files: GridOptInBetaReviewedSourceFileV1[] = [];
  const contents: Record<string, string> = {};
  for (const path of GRID_OPT_IN_BETA_REVIEWED_SOURCE_PATHS) {
    if (!(await reader.blobAvailable(commit, path))) {
      throw new Error(
        `Reviewed source path ${path} does not exist at commit ${commit}; refusing to substitute working-tree bytes`,
      );
    }
    const blobSha = await reader.readBlobSha(commit, path);
    const bytes = await reader.readBlobBytes(commit, path);
    const content = Buffer.from(bytes).toString("utf-8");
    const contentSha256 = sha256Hex(content);
    files.push({ path, blobSha, contentSha256 });
    contents[path] = content;
  }
  const partial: Omit<GridOptInBetaReviewedSourceSnapshotV1, "checksum"> = {
    snapshotId: GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_ID,
    repository: GRID_OPT_IN_BETA_REVIEWED_SOURCE_REPOSITORY,
    sourceCommit: commit,
    files,
  };
  const checksum = gridOptInBetaReviewedSourceSnapshotChecksum({
    ...partial,
    checksum: "",
  });
  const snapshot: GridOptInBetaReviewedSourceSnapshotV1 = {
    ...partial,
    checksum,
  };
  return { snapshot, contents };
}
