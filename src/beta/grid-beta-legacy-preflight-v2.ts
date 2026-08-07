import { join } from "node:path";
import { z } from "zod";
import { sha256Hex } from "../canary/grid-canary-digest.js";
import {
  defaultCanaryFs,
  type CanaryFileSystem,
} from "../canary/immutable-canary-bundle.js";
import { checkFrozenComponentQualificationChecksums } from "../readiness/grid-opt-in-beta-governance-bundle.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import type { GridOptInBetaSourceCommitReader } from "../readiness/grid-source-commit-reader.js";
import { GitSourceCommitReader } from "../readiness/grid-source-commit-reader.js";
import { RULESET_VERSION, SIMULATOR_VERSION } from "../simulator/constants.js";
import {
  GRID_RUNTIME_IDENTITY,
  LEGACY_RUNTIME_IDENTITY,
} from "../simulator/runtime-identity.js";
import type { GridBetaSuspensionTrigger } from "./grid-beta-suspension.js";
import {
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BASELINE_ID,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_CONTENT_SHA256,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_FIXTURE_CHECKSUM,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_PATH,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_CHECKSUM,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_FILES,
  GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_PATHS,
  anchorGridBetaLegacyIsolationReviewedSourceV2,
  buildGridBetaLegacyIsolationReviewedSourceV2,
  type GridBetaLegacyIsolationReviewedSourceV2,
} from "./grid-beta-legacy-isolation-reviewed-source-v2.js";

/**
 * Current-source successor preflight V2 (Milestone 0.2D Phase 3C, Commit G).
 *
 * The historical V1 preflight (`grid-beta-legacy-preflight.ts`) remains the
 * immutable v1 implementation; this module is the separately-versioned
 * successor preflight bound to the v2 current-source baseline
 * `grid-beta-legacy-isolation-reviewed-source-v2` at exact Commit M.
 *
 * The V2 preflight is read-only against the current checkout and requires,
 * independently, that the successor v2 baseline anchors through the injected
 * Git commit reader AND that the current checkout exactly matches the v2
 * protected state (23 source/config paths + the canonical Bulwark fixture).
 * Every failure is classified under the existing suspension trigger
 * `legacy_default_regression` (or `canary_regression` for canary-only
 * mismatch) — no convenient bypass trigger is added.
 */

export const GRID_BETA_LEGACY_ISOLATION_PREFLIGHT_V2_SCHEMA_VERSION = "2" as const;

export const gridBetaLegacyIsolationPreflightV2Schema = z
  .object({
    schemaVersion: z.literal(GRID_BETA_LEGACY_ISOLATION_PREFLIGHT_V2_SCHEMA_VERSION),
    sourceBaselineId: z.literal(
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BASELINE_ID,
    ),
    sourceBaselineCommit: z.literal(GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT),
    sourceBaselineChecksum: z.literal(
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_CHECKSUM,
    ),
    sourceBaselineCommitAnchored: z.boolean(),
    protectedFilesEqualSuccessorSnapshot: z.boolean(),
    canonicalBulwarkFixtureAnchorValid: z.boolean(),
    normalMatchCallsLegacyRunMatch: z.boolean(),
    normalSeriesCallsLegacyRunMatch: z.boolean(),
    normalMatchUsesCanonicalBulwark: z.boolean(),
    normalSeriesUsesCanonicalBulwark: z.boolean(),
    neitherNormalPathInvokesGridOrBeta: z.boolean(),
    packageRoutingPreservesLegacyDefault: z.boolean(),
    globalVersions020020: z.boolean(),
    catalogueStill1: z.boolean(),
    qualificationFrozen: z.boolean(),
    gridIdentitySeparate: z.boolean(),
    bothCanarySourcesFrozen: z.boolean(),
    schemaV2LegacyConversionPresent: z.boolean(),
    schemaV3GridConversionAndReplayPresent: z.boolean(),
    status: z.enum(["pass", "fail"]),
    trigger: z.custom<GridBetaSuspensionTrigger | null>((value) => value === null),
    failures: z.array(z.string()),
  })
  .strict();

export interface GridBetaLegacyIsolationPreflightV2 {
  readonly schemaVersion: "2";
  readonly sourceBaselineId: "grid-beta-legacy-isolation-reviewed-source-v2";
  readonly sourceBaselineCommit: "e6d981f98ae1bde418810a4fcefae09490344073";
  readonly sourceBaselineChecksum: string;
  readonly sourceBaselineCommitAnchored: boolean;
  readonly protectedFilesEqualSuccessorSnapshot: boolean;
  readonly canonicalBulwarkFixtureAnchorValid: boolean;
  readonly normalMatchCallsLegacyRunMatch: boolean;
  readonly normalSeriesCallsLegacyRunMatch: boolean;
  readonly normalMatchUsesCanonicalBulwark: boolean;
  readonly normalSeriesUsesCanonicalBulwark: boolean;
  readonly neitherNormalPathInvokesGridOrBeta: boolean;
  readonly packageRoutingPreservesLegacyDefault: boolean;
  readonly globalVersions020020: boolean;
  readonly catalogueStill1: boolean;
  readonly qualificationFrozen: boolean;
  readonly gridIdentitySeparate: boolean;
  readonly bothCanarySourcesFrozen: boolean;
  readonly schemaV2LegacyConversionPresent: boolean;
  readonly schemaV3GridConversionAndReplayPresent: boolean;
  readonly status: "pass" | "fail";
  readonly trigger: GridBetaSuspensionTrigger | null;
  readonly failures: readonly string[];
}

const CANARY_PATHS: readonly string[] = Object.freeze([
  "src/app/grid-match-canary.ts",
  "src/canary/grid-series-canary-core.ts",
]);

function currentSourcePath(path: string): string {
  return join(process.cwd(), path);
}

function normaliseLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

async function readCurrentSource(path: string, fs: CanaryFileSystem): Promise<string> {
  return fs.readFile(currentSourcePath(path), "utf-8");
}

function frozenContentHash(path: string): string | undefined {
  return GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_FILES.find((f) => f.path === path)
    ?.contentSha256;
}

/**
 * Current-checkout successor preflight V2. Computes the result from the
 * actual current protected-file bytes, the exact successor baseline anchored
 * through the injected Git commit reader, the canonical Bulwark fixture bytes
 * and source-level routing checks. `trigger` is `legacy_default_regression`
 * (or `canary_regression` for canary-only mismatch); no bypass trigger exists.
 */
export async function runGridBetaLegacyIsolationPreflightV2(
  fs: CanaryFileSystem = defaultCanaryFs,
  sourceCommitReader: GridOptInBetaSourceCommitReader = new GitSourceCommitReader(),
): Promise<GridBetaLegacyIsolationPreflightV2> {
  const failures: string[] = [];

  // 1. Anchor the exact successor v2 snapshot through the injected Git commit
  //    reader (never working-tree substitutes; requires exact Commit M).
  let snapshot: GridBetaLegacyIsolationReviewedSourceV2 | null = null;
  let sourceBaselineCommitAnchored = false;
  try {
    snapshot = await buildGridBetaLegacyIsolationReviewedSourceV2(sourceCommitReader);
    anchorGridBetaLegacyIsolationReviewedSourceV2(snapshot);
    sourceBaselineCommitAnchored = true;
  } catch (e) {
    failures.push(
      `successor source baseline v2 could not be anchored: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  // 2. Compare current checkout bytes of all 23 protected paths against v2.
  const differingProtected: string[] = [];
  if (snapshot) {
    for (const path of GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_PATHS) {
      const frozen = frozenContentHash(path);
      let currentHash: string;
      try {
        currentHash = sha256Hex(
          normaliseLineEndings(await fs.readFile(join(process.cwd(), path), "utf-8")),
        );
      } catch {
        differingProtected.push(path);
        continue;
      }
      if (frozen === undefined || currentHash !== frozen) {
        differingProtected.push(path);
      }
    }
  }
  const protectedFilesEqualSuccessorSnapshot = differingProtected.length === 0;
  if (!protectedFilesEqualSuccessorSnapshot) {
    failures.push(
      `protected files differ from the successor v2 snapshot: ${differingProtected.join(", ")}`,
    );
  }

  // 3/4. Canonical Bulwark fixture: current bytes equal the frozen persisted
  //       SHA-256 AND the current JSON declares the exact frozen
  //       fixtureChecksum.
  let canonicalBulwarkFixtureAnchorValid = false;
  try {
    const bulwarkBytes = await fs.readFile(
      currentSourcePath(GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_PATH),
      "utf-8",
    );
    if (
      sha256Hex(normaliseLineEndings(bulwarkBytes)) !==
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_CONTENT_SHA256
    ) {
      failures.push(
        "canonical bulwark fixture bytes do not match the frozen persisted SHA-256",
      );
    } else {
      let parsed: { fixtureChecksum?: unknown };
      try {
        parsed = JSON.parse(bulwarkBytes) as { fixtureChecksum?: unknown };
      } catch {
        parsed = {};
      }
      if (
        parsed.fixtureChecksum !==
        GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BULWARK_FIXTURE_CHECKSUM
      ) {
        failures.push(
          "canonical bulwark fixtureChecksum does not match the frozen v2 anchor",
        );
      } else {
        canonicalBulwarkFixtureAnchorValid = true;
      }
    }
  } catch (e) {
    failures.push(
      `canonical bulwark fixture is unreadable: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  // 5–8. Source-level routing checks on the current normal match/series bytes.
  let runMatchSource = "";
  let runSeriesSource = "";
  try {
    runMatchSource = await readCurrentSource("src/app/run-match.ts", fs);
    runSeriesSource = await readCurrentSource("src/app/run-series.ts", fs);
  } catch {
    failures.push("normal match/series source is unreadable");
  }
  const normalMatchCallsLegacyRunMatch =
    /\brunMatch\s*\(/.test(runMatchSource) && !/\brunGridMatch\s*\(/.test(runMatchSource);
  const normalSeriesCallsLegacyRunMatch =
    /\brunMatch\s*\(/.test(runSeriesSource) &&
    !/\brunGridMatch\s*\(/.test(runSeriesSource);
  const normalMatchUsesCanonicalBulwark = /loadLegacyBulwark/.test(runMatchSource);
  const normalSeriesUsesCanonicalBulwark = /loadLegacyBulwark/.test(runSeriesSource);
  const neitherNormalPathInvokesGridOrBeta =
    !/\brunGridMatch\s*\(/.test(runMatchSource) &&
    !/\brunGridMatch\s*\(/.test(runSeriesSource) &&
    !runMatchSource.includes("grid-beta-match") &&
    !runMatchSource.includes("grid-opt-in-beta") &&
    !runSeriesSource.includes("grid-beta-match") &&
    !runSeriesSource.includes("grid-opt-in-beta");
  // No historical Bulwark constants as normal-path combat configuration.
  const noHistoricalBulwarkCombatInput =
    !runMatchSource.includes("createBulwarkBuild") &&
    !runMatchSource.includes("BULWARK_POLICY") &&
    !runSeriesSource.includes("createBulwarkBuild") &&
    !runSeriesSource.includes("BULWARK_POLICY");
  if (!normalMatchCallsLegacyRunMatch) {
    failures.push("normal match path no longer calls legacy runMatch");
  }
  if (!normalSeriesCallsLegacyRunMatch) {
    failures.push("normal series path no longer calls legacy runMatch");
  }
  if (!normalMatchUsesCanonicalBulwark || !normalSeriesUsesCanonicalBulwark) {
    failures.push("a normal path no longer loads the canonical legacy Bulwark fixture");
  }
  if (!neitherNormalPathInvokesGridOrBeta) {
    failures.push("a normal path imports or invokes the grid runtime or beta service");
  }
  if (!noHistoricalBulwarkCombatInput) {
    failures.push("a normal path uses historical Bulwark constants as combat input");
  }

  // 9. Package routing: match → normal run-match, series → normal run-series,
  //    match:grid:beta separate and explicit.
  let packageRoutingPreservesLegacyDefault = false;
  try {
    const pkg = JSON.parse(
      await fs.readFile(currentSourcePath("package.json"), "utf-8"),
    ) as { scripts?: Record<string, string> };
    packageRoutingPreservesLegacyDefault =
      pkg.scripts?.["match"]?.includes("src/app/run-match.ts") === true &&
      pkg.scripts?.["series"]?.includes("src/app/run-series.ts") === true &&
      pkg.scripts?.["match:grid:beta"]?.includes("run-grid-beta-match") === true;
  } catch {
    failures.push("package.json scripts are unreadable or not parseable");
  }
  if (!packageRoutingPreservesLegacyDefault) {
    failures.push("package command routing no longer preserves the legacy default");
  }

  // 10. Frozen global/qualification/identity facts.
  const globalVersions020020 =
    SIMULATOR_VERSION === "0.2.0" && RULESET_VERSION === "0.2.0";
  if (!globalVersions020020) {
    failures.push("global simulator/ruleset versions are no longer 0.2.0 / 0.2.0");
  }
  const catalogueStill1 = CATALOGUE_V1.version === "1";
  if (!catalogueStill1) {
    failures.push("catalogue version is no longer 1");
  }
  const qualificationFrozen = checkFrozenComponentQualificationChecksums();
  if (!qualificationFrozen) {
    failures.push("C1/C2/AB2 checksums or the C2 default changed");
  }
  const gridIdentitySeparate =
    GRID_RUNTIME_IDENTITY.simulatorVersion === "0.3.0" &&
    GRID_RUNTIME_IDENTITY.positioningModel === "grid-3x3-v1" &&
    LEGACY_RUNTIME_IDENTITY.simulatorVersion === "0.2.0";
  if (!gridIdentitySeparate) {
    failures.push("grid/legacy runtime identities are no longer separate");
  }

  // 11. Canary sources frozen (explicit canary regression classification).
  const differingCanaries = differingProtected.filter((path) =>
    CANARY_PATHS.includes(path),
  );
  const bothCanarySourcesFrozen = differingCanaries.length === 0;
  if (!bothCanarySourcesFrozen) {
    failures.push(
      `canary sources differ from the successor snapshot: ${differingCanaries.join(", ")}`,
    );
  }

  // 12. Persistence/replay support.
  let converterSource = "";
  let positioningSource = "";
  try {
    converterSource = await readCurrentSource("src/persistence/match-converter.ts", fs);
    positioningSource = await readCurrentSource("src/replay/positioning-model.ts", fs);
  } catch {
    // Left as empty strings: the source checks below fail closed.
  }
  const schemaV2LegacyConversionPresent =
    !differingProtected.includes("src/persistence/match-converter.ts") &&
    /matchResultToRecord/.test(converterSource);
  const schemaV3GridConversionAndReplayPresent =
    !differingProtected.includes("src/persistence/match-converter.ts") &&
    !differingProtected.includes("src/replay/positioning-model.ts") &&
    /positioningModel === "grid-3x3-v1"/.test(converterSource) &&
    /isGridReplayPositioningModel/.test(positioningSource);
  if (!schemaV2LegacyConversionPresent) {
    failures.push("schema-v2 legacy conversion is no longer present");
  }
  if (!schemaV3GridConversionAndReplayPresent) {
    failures.push("schema-v3 grid conversion/replay support is no longer present");
  }

  const canaryRegression = !bothCanarySourcesFrozen;
  const legacyRegression =
    !sourceBaselineCommitAnchored ||
    !protectedFilesEqualSuccessorSnapshot ||
    !canonicalBulwarkFixtureAnchorValid ||
    !normalMatchCallsLegacyRunMatch ||
    !normalSeriesCallsLegacyRunMatch ||
    !normalMatchUsesCanonicalBulwark ||
    !normalSeriesUsesCanonicalBulwark ||
    !neitherNormalPathInvokesGridOrBeta ||
    !noHistoricalBulwarkCombatInput ||
    !packageRoutingPreservesLegacyDefault ||
    !globalVersions020020 ||
    !catalogueStill1 ||
    !qualificationFrozen ||
    !gridIdentitySeparate ||
    !schemaV2LegacyConversionPresent ||
    !schemaV3GridConversionAndReplayPresent;

  const trigger: GridBetaSuspensionTrigger | null = canaryRegression
    ? "canary_regression"
    : legacyRegression
      ? "legacy_default_regression"
      : null;

  return {
    schemaVersion: GRID_BETA_LEGACY_ISOLATION_PREFLIGHT_V2_SCHEMA_VERSION,
    sourceBaselineId: GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BASELINE_ID,
    sourceBaselineCommit: GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT,
    sourceBaselineChecksum: GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_CHECKSUM,
    sourceBaselineCommitAnchored,
    protectedFilesEqualSuccessorSnapshot,
    canonicalBulwarkFixtureAnchorValid,
    normalMatchCallsLegacyRunMatch,
    normalSeriesCallsLegacyRunMatch,
    normalMatchUsesCanonicalBulwark,
    normalSeriesUsesCanonicalBulwark,
    neitherNormalPathInvokesGridOrBeta,
    packageRoutingPreservesLegacyDefault,
    globalVersions020020,
    catalogueStill1,
    qualificationFrozen,
    gridIdentitySeparate,
    bothCanarySourcesFrozen,
    schemaV2LegacyConversionPresent,
    schemaV3GridConversionAndReplayPresent,
    status: failures.length === 0 ? "pass" : "fail",
    trigger,
    failures: Object.freeze([...failures]),
  };
}

/**
 * Exact canonical successful V2-preflight assertion. For a published beta
 * match the persisted V2 preflight must be `status: pass`, `trigger: null`,
 * `failures: []`, `sourceBaselineCommitAnchored: true` and every detailed
 * boolean exactly `true`. `status: pass` with contradictory detailed values is
 * never accepted.
 */
export function assertCanonicalGridBetaPreflightV2Pass(
  preflight: GridBetaLegacyIsolationPreflightV2,
): void {
  const allDetailedTrue =
    preflight.sourceBaselineCommitAnchored === true &&
    preflight.protectedFilesEqualSuccessorSnapshot === true &&
    preflight.canonicalBulwarkFixtureAnchorValid === true &&
    preflight.normalMatchCallsLegacyRunMatch === true &&
    preflight.normalSeriesCallsLegacyRunMatch === true &&
    preflight.normalMatchUsesCanonicalBulwark === true &&
    preflight.normalSeriesUsesCanonicalBulwark === true &&
    preflight.neitherNormalPathInvokesGridOrBeta === true &&
    preflight.packageRoutingPreservesLegacyDefault === true &&
    preflight.globalVersions020020 === true &&
    preflight.catalogueStill1 === true &&
    preflight.qualificationFrozen === true &&
    preflight.gridIdentitySeparate === true &&
    preflight.bothCanarySourcesFrozen === true &&
    preflight.schemaV2LegacyConversionPresent === true &&
    preflight.schemaV3GridConversionAndReplayPresent === true;
  if (
    preflight.status !== "pass" ||
    preflight.trigger !== null ||
    preflight.failures.length !== 0 ||
    preflight.sourceBaselineId !==
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_BASELINE_ID ||
    preflight.sourceBaselineCommit !==
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_COMMIT ||
    preflight.sourceBaselineChecksum !==
      GRID_BETA_LEGACY_ISOLATION_REVIEWED_SOURCE_V2_CHECKSUM ||
    !allDetailedTrue
  ) {
    throw new Error(
      "grid beta successor preflight v2 is not the canonical pass (status/trigger/failures/detailed booleans disagree)",
    );
  }
}
