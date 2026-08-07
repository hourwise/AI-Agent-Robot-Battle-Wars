import { sha256Hex } from "../canary/grid-canary-digest.js";
import {
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT,
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM,
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_ID,
} from "../readiness/grid-opt-in-beta-source-snapshot.js";
import type { GridOptInBetaSourceCommitReader } from "../readiness/grid-source-commit-reader.js";
import { GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ID } from "./grid-beta-identity.js";

/**
 * Successor source baseline v2 (Milestone 0.2D Phase 3C, Commit G).
 *
 * D66 governs source evolution through the sequence Commit M → independent
 * review of M → Commit G. This module freezes the separately-versioned
 * current-source compatibility baseline
 * `grid-beta-legacy-isolation-reviewed-source-v2` bound exactly to the
 * accepted migration candidate Commit M (`e6d981f9…`). It proves that the
 * reviewed evolved source preserves the invariants material to the original
 * v1 grid-beta authorisation.
 *
 * Two independent claims remain required for beta execution after G:
 *   1. original v1 governance authority (immutable) — valid;
 *   2. successor v2 source baseline — valid AND the current checkout exactly
 *      matches the v2 protected state.
 * Failure of any part fails closed.
 *
 * The v1 snapshot module (`grid-opt-in-beta-source-snapshot.ts`) is NEVER
 * modified; this module only references its frozen identity constants.
 */

export const GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BASELINE_ID =
  "grid-beta-legacy-isolation-reviewed-source-v2" as const;
export const GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_REPOSITORY =
  "hourwise/AI-Agent-Robot-Battle-Wars" as const;
export const GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT =
  "e6d981f98ae1bde418810a4fcefae09490344073" as const;

/** Exact canonical Bulwark data anchor (Phase 2 evidence, D65). */
export const GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_PATH =
  "data/opponents/bulwark.v1.json" as const;
export const GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_BLOB_SHA =
  "dbfed21541a47ec0d5f1c7163795a8a8b21b9275" as const;
export const GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_CONTENT_SHA256 =
  "d109c73a2f0880a5298fa6784abe4644f10c6ec395d4f4007179cc2d4e50256a" as const;
export const GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_FIXTURE_CHECKSUM =
  "053e61e867d00015371e852dbe571af666cc8ac99a514b2364be323d54a8d987" as const;

/**
 * Exact ordered v2 protected source set (23 paths). This is every currently
 * active legacy-isolation protected path, plus `package.json` (command
 * routing can select application/runtime entry points), the historical
 * Bulwark equivalence anchor, and the complete new canonical opponent
 * loading/compatibility chain. No unrelated benchmark/readiness paths are
 * included.
 */
export const GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_PATHS: readonly string[] =
  Object.freeze([
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
    "src/simulator/grid-runtime.ts",
    "src/agents/scripted/bulwark-agent.ts",
    "src/opponents/opponent-fixture.ts",
    "src/opponents/opponent-fixture-loader.ts",
    "src/opponents/opponent-runtime-compatibility.ts",
    "src/opponents/legacy-bulwark.ts",
  ]);

export interface GridBetaLegacyIsolationReviewedSourceFileV2 {
  readonly path: string;
  readonly blobSha: string;
  readonly contentSha256: string;
}

/** Frozen v2 protected file identities at exact Commit M (Git objects only). */
export const GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_FILES: readonly GridBetaLegacyIsolationReviewedSourceFileV2[] =
  Object.freeze([
    {
      path: "package.json",
      blobSha: "04663b64134e7f75cc90a31908278431998e5d09",
      contentSha256: "35cf8605ca4f32f32a57e1844d2d64e4c134f7902503b68774c339a9d0bcd9f1",
    },
    {
      path: "src/app/run-match.ts",
      blobSha: "6fe3bfc7c033f3332d2fdefd1196f8f08435630c",
      contentSha256: "12e156e89abd6a2e643ea4efa5412a51c28f263e8662f7f3a251f8e97a3ebb99",
    },
    {
      path: "src/app/run-series.ts",
      blobSha: "0aaae272343281bbb288bbaa87aef8410d59667c",
      contentSha256: "81b928206881120cd5aae3c78a28f8e3b2125ca136fa1edff8a2929896fd04e0",
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
      path: "src/simulator/grid-runtime.ts",
      blobSha: "dbd4406303f43658da33167c0fa6a74dc0df7664",
      contentSha256: "273973a7312590058b9369b21659a15de0b491d9283b7a6e15e08681434781f1",
    },
    {
      path: "src/agents/scripted/bulwark-agent.ts",
      blobSha: "3cbb91a03c1ff777b169f5bed8dea8e3cc243087",
      contentSha256: "e9ef70097eaf25621b40b7fd5de7a87aab4cceb91a9e2a0fc04cf77d3a2e3d72",
    },
    {
      path: "src/opponents/opponent-fixture.ts",
      blobSha: "84e7180d14f017092f95edd86301892c93d239af",
      contentSha256: "25365cfdf834501157eb9f350683a631aff92117ee273d23c4fd8a5abf7944ae",
    },
    {
      path: "src/opponents/opponent-fixture-loader.ts",
      blobSha: "0cbe12199a7944ce1959528d57ef4131e88f6897",
      contentSha256: "f36b1616d589848c2c85e779c3b8f03227b184e0738de6e01c6f393e63dea901",
    },
    {
      path: "src/opponents/opponent-runtime-compatibility.ts",
      blobSha: "e41d7a9660aea373faf9de25155a352c762ed18d",
      contentSha256: "bad39f4f630857f118f305fff9dcf7e637c337050ef53dbb059f7f5e69d44e8b",
    },
    {
      path: "src/opponents/legacy-bulwark.ts",
      blobSha: "f38c6c2b9963bc9e9ff17921a148461df9a7f3f2",
      contentSha256: "9ddfdd565677c4d36b51692447591a441023d5066eac19267fa1cfb234fbe656",
    },
  ]);

export interface GridBetaLegacyIsolationReviewedSourceV2 {
  readonly baselineId: "grid-beta-legacy-isolation-reviewed-source-v2";
  readonly repository: "hourwise/AI-Agent-Robot-Battle-Wars";
  readonly sourceCommit: "e6d981f98ae1bde418810a4fcefae09490344073";
  readonly originalAuthority: {
    readonly snapshotId: "grid-opt-in-beta-reviewed-source-v1";
    readonly sourceCommit: "5173fd0f287465e1181969dbad2f37cee10fd47e";
    readonly snapshotChecksum: string;
    readonly governanceDecisionId: string;
  };
  readonly files: ReadonlyArray<GridBetaLegacyIsolationReviewedSourceFileV2>;
  readonly canonicalBulwark: {
    readonly path: "data/opponents/bulwark.v1.json";
    readonly blobSha: string;
    readonly contentSha256: string;
    readonly fixtureChecksum: string;
  };
}

/** Frozen deterministic checksum of the successor source baseline v2. */
export const GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_CHECKSUM =
  "134e7ce29650a170d8965b2fdde691e75afd2420620de143ba720601c666909e";

/**
 * Deterministic baseline serialization: baseline ID, repository, source
 * Commit M, the immutable original-v1 authority identity, the ordered 23 file
 * identities and the canonical Bulwark anchor. Never includes the baseline
 * checksum field itself.
 */
export function serializeGridBetaLegacyIsolationReviewedSourceV2(
  snapshot: GridBetaLegacyIsolationReviewedSourceV2,
): string {
  return JSON.stringify(
    {
      baselineId: snapshot.baselineId,
      repository: snapshot.repository,
      sourceCommit: snapshot.sourceCommit,
      originalAuthority: {
        snapshotId: snapshot.originalAuthority.snapshotId,
        sourceCommit: snapshot.originalAuthority.sourceCommit,
        snapshotChecksum: snapshot.originalAuthority.snapshotChecksum,
        governanceDecisionId: snapshot.originalAuthority.governanceDecisionId,
      },
      files: snapshot.files.map((file) => ({
        path: file.path,
        blobSha: file.blobSha,
        contentSha256: file.contentSha256,
      })),
      canonicalBulwark: {
        path: snapshot.canonicalBulwark.path,
        blobSha: snapshot.canonicalBulwark.blobSha,
        contentSha256: snapshot.canonicalBulwark.contentSha256,
        fixtureChecksum: snapshot.canonicalBulwark.fixtureChecksum,
      },
    },
    null,
    2,
  );
}

export function gridBetaLegacyIsolationReviewedSourceV2Checksum(
  snapshot: GridBetaLegacyIsolationReviewedSourceV2,
): string {
  return sha256Hex(serializeGridBetaLegacyIsolationReviewedSourceV2(snapshot));
}

function sameFile(
  a: GridBetaLegacyIsolationReviewedSourceFileV2,
  b: GridBetaLegacyIsolationReviewedSourceFileV2,
): boolean {
  return (
    a.path === b.path && a.blobSha === b.blobSha && a.contentSha256 === b.contentSha256
  );
}

/**
 * Builds the successor source baseline v2 from exact Git objects at Commit M
 * (never working-tree substitutes). Requires the exact commit, every reviewed
 * path, exact blob SHAs and exact content hashes, and reads the canonical
 * Bulwark JSON from the commit, validating its persisted byte hash and
 * requiring its internal `fixtureChecksum`. Missing/shallow/wrong commit
 * fails closed.
 */
export async function buildGridBetaLegacyIsolationReviewedSourceV2(
  reader: GridOptInBetaSourceCommitReader,
): Promise<GridBetaLegacyIsolationReviewedSourceV2> {
  const commit = GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT;
  if (!(await reader.commitAvailable(commit))) {
    throw new Error(
      `successor source commit ${commit} is unavailable or the repository is shallow`,
    );
  }
  const files: GridBetaLegacyIsolationReviewedSourceFileV2[] = [];
  for (const path of GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_PATHS) {
    if (!(await reader.blobAvailable(commit, path))) {
      throw new Error(`successor reviewed path is missing at commit ${commit}: ${path}`);
    }
    const blobSha = await reader.readBlobSha(commit, path);
    const bytes = await reader.readBlobBytes(commit, path);
    const contentSha256 = sha256Hex(
      new TextDecoder().decode(bytes).replace(/\r\n/g, "\n"),
    );
    files.push({ path, blobSha, contentSha256 });
  }

  const bulwarkPath = GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_PATH;
  if (!(await reader.blobAvailable(commit, bulwarkPath))) {
    throw new Error(
      `canonical bulwark fixture is missing at commit ${commit}: ${bulwarkPath}`,
    );
  }
  const bulwarkBlobSha = await reader.readBlobSha(commit, bulwarkPath);
  const bulwarkBytes = await reader.readBlobBytes(commit, bulwarkPath);
  const bulwarkContent = new TextDecoder().decode(bulwarkBytes).replace(/\r\n/g, "\n");
  const bulwarkContentSha256 = sha256Hex(bulwarkContent);
  let bulwarkJson: { fixtureChecksum?: unknown };
  try {
    bulwarkJson = JSON.parse(bulwarkContent) as { fixtureChecksum?: unknown };
  } catch (e) {
    throw new Error(
      `canonical bulwark fixture is not valid JSON at commit ${commit}: ${
        e instanceof Error ? e.message : String(e)
      }`,
      { cause: e },
    );
  }
  if (
    typeof bulwarkJson.fixtureChecksum !== "string" ||
    !/^[0-9a-f]{64}$/.test(bulwarkJson.fixtureChecksum)
  ) {
    throw new Error("canonical bulwark fixture does not declare a valid fixtureChecksum");
  }

  return {
    baselineId: GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BASELINE_ID,
    repository: GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_REPOSITORY,
    sourceCommit: commit,
    originalAuthority: {
      snapshotId: GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_ID,
      sourceCommit: GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT,
      snapshotChecksum: GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM,
      governanceDecisionId: GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ID,
    },
    files,
    canonicalBulwark: {
      path: bulwarkPath,
      blobSha: bulwarkBlobSha,
      contentSha256: bulwarkContentSha256,
      fixtureChecksum: bulwarkJson.fixtureChecksum,
    },
  };
}

/**
 * Requires the snapshot to equal the frozen successor source baseline v2
 * exactly: baseline ID, repository, exact Commit M, immutable original-v1
 * authority identity, ordered 23 file identities (path/blob/content), the
 * canonical Bulwark anchor and the deterministic baseline checksum. Throws
 * with a precise reason on any mismatch.
 */
export function anchorGridBetaLegacyIsolationReviewedSourceV2(
  snapshot: GridBetaLegacyIsolationReviewedSourceV2,
): void {
  const failures: string[] = [];
  if (snapshot.baselineId !== GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BASELINE_ID) {
    failures.push(
      `baseline ID ${snapshot.baselineId} is not ${GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BASELINE_ID}`,
    );
  }
  if (snapshot.repository !== GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_REPOSITORY) {
    failures.push(
      `baseline repository ${snapshot.repository} is not ${GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_REPOSITORY}`,
    );
  }
  if (snapshot.sourceCommit !== GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT) {
    failures.push(
      `baseline source commit ${snapshot.sourceCommit} is not ${GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT}`,
    );
  }
  const original = snapshot.originalAuthority;
  if (original.snapshotId !== GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_ID) {
    failures.push(
      `original snapshot ID is not ${GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_ID}`,
    );
  }
  if (original.sourceCommit !== GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT) {
    failures.push(
      `original source commit ${original.sourceCommit} is not ${GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT}`,
    );
  }
  if (original.snapshotChecksum !== GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM) {
    failures.push("original snapshot checksum is not the frozen v1 checksum");
  }
  if (original.governanceDecisionId !== GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ID) {
    failures.push(
      `original governance decision ID ${original.governanceDecisionId} is not ${GRID_OPT_IN_BETA_GOVERNANCE_DECISION_ID}`,
    );
  }
  if (
    snapshot.files.length !== GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_FILES.length
  ) {
    failures.push(
      `baseline file count ${snapshot.files.length} is not the frozen ${GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_FILES.length}`,
    );
  } else {
    for (let i = 0; i < snapshot.files.length; i++) {
      if (
        !sameFile(
          snapshot.files[i]!,
          GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_FILES[i]!,
        )
      ) {
        failures.push(
          `baseline file identity at index ${i} (${snapshot.files[i]!.path}) does not match the frozen v2 identity`,
        );
      }
    }
  }
  const bulwark = snapshot.canonicalBulwark;
  if (bulwark.path !== GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_PATH) {
    failures.push("canonical bulwark path is not the frozen path");
  }
  if (
    bulwark.blobSha !== GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_BLOB_SHA
  ) {
    failures.push("canonical bulwark Git blob SHA does not match the frozen v2 identity");
  }
  if (
    bulwark.contentSha256 !==
    GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_CONTENT_SHA256
  ) {
    failures.push(
      "canonical bulwark persisted content SHA-256 does not match the frozen v2 identity",
    );
  }
  if (
    bulwark.fixtureChecksum !==
    GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_FIXTURE_CHECKSUM
  ) {
    failures.push(
      "canonical bulwark fixtureChecksum does not match the frozen v2 identity",
    );
  }
  const computed = gridBetaLegacyIsolationReviewedSourceV2Checksum(snapshot);
  if (computed !== GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_CHECKSUM) {
    failures.push(
      `baseline checksum ${computed} does not equal the frozen v2 baseline checksum`,
    );
  }
  if (failures.length > 0) {
    throw new Error(
      `grid beta successor source baseline v2 anchor failed: ${failures.join("; ")}`,
    );
  }
}
