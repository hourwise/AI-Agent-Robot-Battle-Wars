import { join } from "node:path";
import {
  defaultCanaryFs,
  type CanaryFileSystem,
} from "../canary/immutable-canary-bundle.js";
import { sha256Hex } from "../canary/grid-canary-digest.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import { checkFrozenComponentQualificationChecksums } from "../readiness/grid-opt-in-beta-governance-bundle.js";
import { GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES } from "../readiness/grid-opt-in-beta-source-snapshot.js";
import { RULESET_VERSION, SIMULATOR_VERSION } from "../simulator/constants.js";
import {
  GRID_RUNTIME_IDENTITY,
  LEGACY_RUNTIME_IDENTITY,
} from "../simulator/runtime-identity.js";
import type { GridBetaSuspensionTrigger } from "./grid-beta-suspension.js";

/**
 * Current legacy-isolation preflight (Milestone 0.2C Phase 3G, Phase 6).
 *
 * A read-only preflight against the current checkout run before every beta
 * simulation. Using the frozen reviewed-source identities, the current bytes
 * of every protected file that this implementation is not authorised to alter
 * must remain unchanged, and the normal match/series paths must still call
 * legacy `runMatch` and never the beta service or `runGridMatch`. The check
 * is computed from the actual current file bytes (frozen content-hash
 * comparison plus source-level checks) — never from mutable persisted
 * booleans alone. A mismatch maps to `legacy_default_regression` or
 * `canary_regression` and suspends the beta.
 */

/** Protected files this implementation may not alter (frozen reviewed paths). */
export const GRID_BETA_LEGACY_ISOLATION_PROTECTED_PATHS: readonly string[] =
  Object.freeze([
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
  ]);

const CANARY_PATHS: readonly string[] = Object.freeze([
  "src/app/grid-match-canary.ts",
  "src/canary/grid-series-canary-core.ts",
]);

export interface GridBetaLegacyIsolationPreflightV1 {
  readonly status: "pass" | "fail";
  readonly trigger: GridBetaSuspensionTrigger | null;
  readonly failures: readonly string[];
  readonly protectedFilesEqualReviewedSnapshot: boolean;
  readonly normalMatchCallsLegacyRunMatch: boolean;
  readonly normalSeriesCallsLegacyRunMatch: boolean;
  readonly neitherNormalPathInvokesGridOrBeta: boolean;
  readonly globalVersions020020: boolean;
  readonly catalogueStill1: boolean;
  readonly qualificationFrozen: boolean;
  readonly gridIdentitySeparate: boolean;
  readonly bothCanarySourcesFrozen: boolean;
  readonly schemaV2LegacyConversionPresent: boolean;
  readonly schemaV3GridConversionAndReplayPresent: boolean;
}

function currentSourcePath(path: string): string {
  return join(process.cwd(), path);
}

/**
 * Normalises CRLF checkout line endings to the committed LF form before the
 * frozen content-hash comparison. The reviewed snapshot hashes are over the
 * committed (LF) bytes; a `core.autocrlf` checkout renders the same content
 * with CRLF. Line-ending normalisation therefore detects real content
 * changes without false-suspending a clean checkout.
 */
function normaliseLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

async function readCurrentSource(path: string, fs: CanaryFileSystem): Promise<string> {
  return fs.readFile(currentSourcePath(path), "utf-8");
}

function frozenContentHash(path: string): string | undefined {
  return GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES.find((f) => f.path === path)
    ?.contentSha256;
}

/**
 * Read-only current-checkout legacy-isolation preflight. Computes the result
 * from the actual current protected-file bytes and source-level checks.
 */
export async function runGridBetaLegacyIsolationPreflight(
  fs: CanaryFileSystem = defaultCanaryFs,
): Promise<GridBetaLegacyIsolationPreflightV1> {
  const failures: string[] = [];

  // 1. Every protected file must equal its frozen reviewed-source bytes.
  const differingProtected: string[] = [];
  for (const path of GRID_BETA_LEGACY_ISOLATION_PROTECTED_PATHS) {
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
  const protectedFilesEqualReviewedSnapshot = differingProtected.length === 0;
  if (!protectedFilesEqualReviewedSnapshot) {
    failures.push(
      `protected files differ from the reviewed source snapshot: ${differingProtected.join(", ")}`,
    );
  }

  // 2. Source-level checks on the current normal match/series bytes.
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
  const neitherNormalPathInvokesGridOrBeta =
    !/\brunGridMatch\s*\(/.test(runMatchSource) &&
    !/\brunGridMatch\s*\(/.test(runSeriesSource) &&
    !runMatchSource.includes("grid-beta-match") &&
    !runMatchSource.includes("grid-opt-in-beta") &&
    !runSeriesSource.includes("grid-beta-match") &&
    !runSeriesSource.includes("grid-opt-in-beta");
  if (!normalMatchCallsLegacyRunMatch) {
    failures.push("normal match path no longer calls legacy runMatch");
  }
  if (!normalSeriesCallsLegacyRunMatch) {
    failures.push("normal series path no longer calls legacy runMatch");
  }
  if (!neitherNormalPathInvokesGridOrBeta) {
    failures.push("a normal path imports or invokes the grid runtime or beta service");
  }

  // 3. Frozen global/qualification/identity facts.
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

  // 4. Canary sources frozen (explicit canary regression classification).
  const differingCanaries = differingProtected.filter((path) =>
    CANARY_PATHS.includes(path),
  );
  const bothCanarySourcesFrozen = differingCanaries.length === 0;
  if (!bothCanarySourcesFrozen) {
    failures.push(
      `canary sources differ from the reviewed snapshot: ${differingCanaries.join(", ")}`,
    );
  }

  // 5. Persistence/replay support (already covered by frozen hashes; retained
  //    as explicit facts for the selection artifact).
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
    !protectedFilesEqualReviewedSnapshot ||
    !normalMatchCallsLegacyRunMatch ||
    !normalSeriesCallsLegacyRunMatch ||
    !neitherNormalPathInvokesGridOrBeta ||
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
    status: failures.length === 0 ? "pass" : "fail",
    trigger,
    failures: Object.freeze([...failures]),
    protectedFilesEqualReviewedSnapshot,
    normalMatchCallsLegacyRunMatch,
    normalSeriesCallsLegacyRunMatch,
    neitherNormalPathInvokesGridOrBeta,
    globalVersions020020,
    catalogueStill1,
    qualificationFrozen,
    gridIdentitySeparate,
    bothCanarySourcesFrozen,
    schemaV2LegacyConversionPresent,
    schemaV3GridConversionAndReplayPresent,
  };
}

/** Throws when the current-checkout legacy isolation preflight fails. */
export function assertGridBetaLegacyIsolationPasses(
  preflight: GridBetaLegacyIsolationPreflightV1,
): void {
  if (preflight.status !== "pass") {
    throw new Error(
      `Grid beta legacy-isolation preflight failed (${preflight.trigger ?? "unknown"}): ${preflight.failures.join("; ")}`,
    );
  }
}
