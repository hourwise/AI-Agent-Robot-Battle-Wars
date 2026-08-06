import { sha256Hex } from "../canary/grid-canary-digest.js";
import {
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT,
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES,
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_ID,
  GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM,
  type GridOptInBetaReviewedSourceSnapshotV1,
} from "./grid-opt-in-beta-source-snapshot.js";

/**
 * Reviewed grid opt-in beta source facts (Milestone 0.2C Phase 3F.1, Phase 4).
 *
 * `GridOptInBetaReviewedSourceFactsV1` carries the snapshot identity and every
 * explicit source fact reconstructed from the exact committed bytes of the
 * reviewed snapshot. Nothing here is hard-coded independently of the source:
 * the canary source-isolation booleans are derived from the reviewed snapshot
 * and its frozen file hashes, the qualification checksums are recomputed from
 * the committed registry source, and the routing/identity/replay facts are
 * derived from the committed file contents.
 */

export interface GridOptInBetaReviewedRuntimeIdentity {
  readonly simulatorVersion: string;
  readonly positioningModel: string;
  readonly rulesetVersion: string;
  readonly catalogueVersion: string;
}

export interface GridOptInBetaReviewedSourceFactsV1 {
  readonly snapshotId: "grid-opt-in-beta-reviewed-source-v1";
  readonly sourceCommit: "5173fd0f287465e1181969dbad2f37cee10fd47e";
  readonly snapshotChecksum: string;

  // routing facts
  readonly normalMatchPathUsesLegacyRunMatch: boolean;
  readonly normalSeriesPathUsesLegacyRunMatch: boolean;
  readonly neitherNormalPathInvokesRunGridMatch: boolean;
  readonly gridExistsOnlyAsExplicitAlternateRunGridMatch: boolean;
  readonly noNormalCommandAutomaticallySelectsGrid: boolean;

  // identity facts (derived from the committed source text)
  readonly globalSimulatorVersion: string;
  readonly globalRulesetVersion: string;
  readonly catalogueVersion: string;
  readonly gridRuntimeIdentity: GridOptInBetaReviewedRuntimeIdentity;
  readonly normalRuntimeIdentity: GridOptInBetaReviewedRuntimeIdentity;

  // persistence / replay facts
  readonly schemaV2LegacyConverterPathPresent: boolean;
  readonly schemaV3GridConverterPathPresent: boolean;
  readonly schemaV3ReplayDispatchPresent: boolean;

  // canary facts (derived from the snapshot + frozen file hashes)
  readonly bothCanarySourcesMatchReviewedSnapshot: boolean;
  readonly matchCanaryIsolated: boolean;
  readonly seriesCanaryIsolated: boolean;

  // qualification facts (recomputed from the committed registry source)
  readonly c1ChecksumIsFrozen: boolean;
  readonly c2ChecksumIsFrozen: boolean;
  readonly ab2ChecksumIsFrozen: boolean;
  readonly c2IsDefault: boolean;
}

// ── Committed-source text extraction helpers ────────────────────────────────

function extractStringLiteral(source: string, name: string): string {
  const pattern = new RegExp(`\\b${name}\\s*(?::|=(?!=))\\s*"([^"]+)"`);
  const match = pattern.exec(source);
  if (!match) {
    throw new Error(`Reviewed source does not define string constant ${name}`);
  }
  return match[1]!;
}

function extractNumberLiteral(source: string, name: string): number {
  const pattern = new RegExp(`\\b${name}\\s*:\\s*(\\d+(?:\\.\\d+)?)`);
  const match = pattern.exec(source);
  if (!match) {
    throw new Error(`Reviewed source does not define number constant ${name}`);
  }
  return Number(match[1]);
}

function extractIdentityBlock(
  source: string,
  blockName: string,
): { simulatorVersion: string; positioningModel: string } {
  const start = source.indexOf(blockName);
  if (start < 0) {
    throw new Error(`Reviewed source does not define identity block ${blockName}`);
  }
  const block = source.slice(start, start + 300);
  return {
    simulatorVersion: extractStringLiteral(block, "simulatorVersion"),
    positioningModel: extractStringLiteral(block, "positioningModel"),
  };
}

// ── Qualification config reconstruction from committed source ───────────────

interface ReviewedLinearQualificationConfig {
  readonly schemaVersion: "1";
  readonly id: "component-impact-c1" | "component-impact-c2";
  readonly model: "linear-component-impact";
  readonly armourFactor: number;
  readonly minimumImpact: number;
  readonly criticalThreshold: number;
  readonly highImpactThreshold: number;
}

interface ReviewedArmourBandDefinition {
  readonly id: string;
  readonly minArmourInclusive: number;
  readonly maxArmourInclusive: number | null;
  readonly criticalThreshold: number;
  readonly highImpactThreshold: number;
}

interface ReviewedArmourBandQualificationConfig {
  readonly schemaVersion: "1";
  readonly id: "component-impact-ab2";
  readonly model: "armour-band-component-impact";
  readonly armourFactor: number;
  readonly minimumImpact: number;
  readonly bands: readonly ReviewedArmourBandDefinition[];
}

function extractLinearQualificationConfig(
  source: string,
  id: "component-impact-c1" | "component-impact-c2",
): ReviewedLinearQualificationConfig {
  const marker = `"${id}": freezeLinear({`;
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`Reviewed source does not define qualification config ${id}`);
  }
  const block = source.slice(start, start + 300);
  return {
    schemaVersion: "1",
    id,
    model: "linear-component-impact",
    armourFactor: extractNumberLiteral(block, "armourFactor"),
    minimumImpact: extractNumberLiteral(block, "minimumImpact"),
    criticalThreshold: extractNumberLiteral(block, "criticalThreshold"),
    highImpactThreshold: extractNumberLiteral(block, "highImpactThreshold"),
  };
}

function extractArmourBandQualificationConfig(
  source: string,
): ReviewedArmourBandQualificationConfig {
  const marker = `"component-impact-ab2": freezeArmourBand({`;
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(
      "Reviewed source does not define qualification config component-impact-ab2",
    );
  }
  const block = source.slice(start, start + 1200);
  const bands: ReviewedArmourBandDefinition[] = [];
  const bandPattern =
    /\{\s*id:\s*"([^"]+)"\s*,\s*minArmourInclusive:\s*(\d+)\s*,\s*maxArmourInclusive:\s*(\d+|null)\s*,\s*criticalThreshold:\s*(\d+)\s*,\s*highImpactThreshold:\s*(\d+)\s*,?\s*\}/g;
  let match: RegExpExecArray | null;
  while ((match = bandPattern.exec(block)) !== null) {
    bands.push({
      id: match[1]!,
      minArmourInclusive: Number(match[2]),
      maxArmourInclusive: match[3] === "null" ? null : Number(match[3]),
      criticalThreshold: Number(match[4]),
      highImpactThreshold: Number(match[5]),
    });
  }
  return {
    schemaVersion: "1",
    id: "component-impact-ab2",
    model: "armour-band-component-impact",
    armourFactor: extractNumberLiteral(block, "armourFactor"),
    minimumImpact: extractNumberLiteral(block, "minimumImpact"),
    bands,
  };
}

/** Mirrors the registry's canonical stringify (sorted keys, JSON values). */
function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalStringify(entry)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function qualificationChecksum(config: unknown): string {
  return sha256Hex(canonicalStringify(config)).slice(0, 16);
}

// ── Canonical facts (frozen; computed from the reviewed commit bytes) ───────

export const GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS: GridOptInBetaReviewedSourceFactsV1 =
  Object.freeze({
    snapshotId: "grid-opt-in-beta-reviewed-source-v1",
    sourceCommit: "5173fd0f287465e1181969dbad2f37cee10fd47e",
    snapshotChecksum: "1f984801f6e7ed1809080f88e84004e8dc426de31c2e877dfbbcb09967c3680c",
    normalMatchPathUsesLegacyRunMatch: true,
    normalSeriesPathUsesLegacyRunMatch: true,
    neitherNormalPathInvokesRunGridMatch: true,
    gridExistsOnlyAsExplicitAlternateRunGridMatch: true,
    noNormalCommandAutomaticallySelectsGrid: true,
    globalSimulatorVersion: "0.2.0",
    globalRulesetVersion: "0.2.0",
    catalogueVersion: "1",
    gridRuntimeIdentity: {
      simulatorVersion: "0.3.0",
      positioningModel: "grid-3x3-v1",
      rulesetVersion: "0.2.0",
      catalogueVersion: "1",
    },
    normalRuntimeIdentity: {
      simulatorVersion: "0.2.0",
      positioningModel: "legacy-five-zone-v1",
      rulesetVersion: "0.2.0",
      catalogueVersion: "1",
    },
    schemaV2LegacyConverterPathPresent: true,
    schemaV3GridConverterPathPresent: true,
    schemaV3ReplayDispatchPresent: true,
    bothCanarySourcesMatchReviewedSnapshot: true,
    matchCanaryIsolated: true,
    seriesCanaryIsolated: true,
    c1ChecksumIsFrozen: true,
    c2ChecksumIsFrozen: true,
    ab2ChecksumIsFrozen: true,
    c2IsDefault: true,
  });

// ── Fact derivation from the exact committed bytes ──────────────────────────

/**
 * Reconstructs the reviewed source facts from the exact committed bytes.
 *
 * - every reviewed file must be present and hash to its snapshot identity;
 * - routing, identity, persistence, replay and qualification facts are
 *   derived from the committed text (never the working tree);
 * - the canary source-isolation booleans are derived from the snapshot's
 *   canary file hashes against the frozen reviewed canary hashes — they are
 *   never hard-coded to `true`.
 */
export function deriveGridOptInBetaReviewedSourceFacts(
  snapshot: GridOptInBetaReviewedSourceSnapshotV1,
  contents: Record<string, string>,
): GridOptInBetaReviewedSourceFactsV1 {
  for (const file of snapshot.files) {
    const text = contents[file.path];
    if (text === undefined) {
      throw new Error(`Reviewed source content is missing for ${file.path}`);
    }
    if (sha256Hex(text) !== file.contentSha256) {
      throw new Error(
        `Reviewed source content for ${file.path} does not match its snapshot hash`,
      );
    }
  }

  const runMatchSource = contents["src/app/run-match.ts"]!;
  const runSeriesSource = contents["src/app/run-series.ts"]!;
  const gridRuntimeSource = contents["src/simulator/grid-runtime.ts"]!;

  const normalMatchPathUsesLegacyRunMatch =
    /\brunMatch\s*\(/.test(runMatchSource) && !/\brunGridMatch\s*\(/.test(runMatchSource);
  const normalSeriesPathUsesLegacyRunMatch =
    /\brunMatch\s*\(/.test(runSeriesSource) &&
    !/\brunGridMatch\s*\(/.test(runSeriesSource);
  const neitherNormalPathInvokesRunGridMatch =
    !/\brunGridMatch\s*\(/.test(runMatchSource) &&
    !/\brunGridMatch\s*\(/.test(runSeriesSource);
  const gridExistsOnlyAsExplicitAlternateRunGridMatch =
    /export function runGridMatch\s*\(/.test(gridRuntimeSource) &&
    neitherNormalPathInvokesRunGridMatch;
  const noNormalCommandAutomaticallySelectsGrid =
    neitherNormalPathInvokesRunGridMatch && gridExistsOnlyAsExplicitAlternateRunGridMatch;

  const constantsSource = contents["src/simulator/constants.ts"]!;
  const globalSimulatorVersion = extractStringLiteral(
    constantsSource,
    "SIMULATOR_VERSION",
  );
  const globalRulesetVersion = extractStringLiteral(constantsSource, "RULESET_VERSION");

  const catalogueSource = contents["src/catalogue/catalogue.v1.ts"]!;
  const catalogueVersion = extractStringLiteral(catalogueSource, "version");

  const runtimeIdentitySource = contents["src/simulator/runtime-identity.ts"]!;
  const gridIdentity = extractIdentityBlock(
    runtimeIdentitySource,
    "GRID_RUNTIME_IDENTITY",
  );
  const normalIdentity = extractIdentityBlock(
    runtimeIdentitySource,
    "LEGACY_RUNTIME_IDENTITY",
  );

  const converterSource = contents["src/persistence/match-converter.ts"]!;
  const schemaV2LegacyConverterPathPresent =
    /\bmatchResultToRecord\s*\(/.test(converterSource) &&
    !/\brunGridMatch\s*\(/.test(converterSource);
  const schemaV3GridConverterPathPresent =
    /positioningModel === "grid-3x3-v1"/.test(converterSource) &&
    /schemaVersion: "3"/.test(converterSource);

  const replayPositioningSource = contents["src/replay/positioning-model.ts"]!;
  const schemaV3ReplayDispatchPresent =
    /\bisGridReplayPositioningModel\s*\(/.test(replayPositioningSource) &&
    /grid-3x3-v1/.test(replayPositioningSource);

  const frozenMatchCanary = GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES.find(
    (file) => file.path === "src/app/grid-match-canary.ts",
  );
  const frozenSeriesCanary = GRID_OPT_IN_BETA_REVIEWED_SOURCE_FILES.find(
    (file) => file.path === "src/canary/grid-series-canary-core.ts",
  );
  const matchCanaryInSnapshot = snapshot.files.find(
    (file) => file.path === "src/app/grid-match-canary.ts",
  );
  const seriesCanaryInSnapshot = snapshot.files.find(
    (file) => file.path === "src/canary/grid-series-canary-core.ts",
  );
  const matchCanaryIsolated =
    frozenMatchCanary !== undefined &&
    matchCanaryInSnapshot !== undefined &&
    matchCanaryInSnapshot.contentSha256 === frozenMatchCanary.contentSha256;
  const seriesCanaryIsolated =
    frozenSeriesCanary !== undefined &&
    seriesCanaryInSnapshot !== undefined &&
    seriesCanaryInSnapshot.contentSha256 === frozenSeriesCanary.contentSha256;
  const bothCanarySourcesMatchReviewedSnapshot =
    matchCanaryIsolated && seriesCanaryIsolated;

  const registrySource = contents["src/simulator/component-qualification-registry.ts"]!;
  const defaultQualificationMatch =
    /DEFAULT_COMPONENT_QUALIFICATION_ID\s*=\s*"([^"]+)"/.exec(registrySource);
  const c2IsDefault = defaultQualificationMatch?.[1] === "component-impact-c2";
  const c1 = extractLinearQualificationConfig(registrySource, "component-impact-c1");
  const c2 = extractLinearQualificationConfig(registrySource, "component-impact-c2");
  const ab2 = extractArmourBandQualificationConfig(registrySource);
  const c1ChecksumIsFrozen = qualificationChecksum(c1) === "2a40a56f97062ca3";
  const c2ChecksumIsFrozen = qualificationChecksum(c2) === "13548462df34a183";
  const ab2ChecksumIsFrozen = qualificationChecksum(ab2) === "6b9f70450d3f10b8";

  return {
    snapshotId: GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_ID,
    sourceCommit: GRID_OPT_IN_BETA_REVIEWED_SOURCE_COMMIT,
    snapshotChecksum: snapshot.checksum,
    normalMatchPathUsesLegacyRunMatch,
    normalSeriesPathUsesLegacyRunMatch,
    neitherNormalPathInvokesRunGridMatch,
    gridExistsOnlyAsExplicitAlternateRunGridMatch,
    noNormalCommandAutomaticallySelectsGrid,
    globalSimulatorVersion,
    globalRulesetVersion,
    catalogueVersion,
    gridRuntimeIdentity: {
      simulatorVersion: gridIdentity.simulatorVersion,
      positioningModel: gridIdentity.positioningModel,
      rulesetVersion: globalRulesetVersion,
      catalogueVersion,
    },
    normalRuntimeIdentity: {
      simulatorVersion: normalIdentity.simulatorVersion,
      positioningModel: normalIdentity.positioningModel,
      rulesetVersion: globalRulesetVersion,
      catalogueVersion,
    },
    schemaV2LegacyConverterPathPresent,
    schemaV3GridConverterPathPresent,
    schemaV3ReplayDispatchPresent,
    bothCanarySourcesMatchReviewedSnapshot,
    matchCanaryIsolated,
    seriesCanaryIsolated,
    c1ChecksumIsFrozen,
    c2ChecksumIsFrozen,
    ab2ChecksumIsFrozen,
    c2IsDefault,
  };
}

/** Returns the canonical-facts mismatches as precise messages (empty when canonical). */
export function gridOptInBetaReviewedSourceFactsFailures(
  facts: GridOptInBetaReviewedSourceFactsV1,
): string[] {
  const failures: string[] = [];
  const expected = GRID_OPT_IN_BETA_CANONICAL_SOURCE_FACTS;
  const keys = Object.keys(expected) as Array<keyof GridOptInBetaReviewedSourceFactsV1>;
  for (const key of keys) {
    if (JSON.stringify(facts[key]) !== JSON.stringify(expected[key])) {
      failures.push(
        `reviewed source fact ${key} is ${JSON.stringify(facts[key])}, canonical is ${JSON.stringify(expected[key])}`,
      );
    }
  }
  if (facts.snapshotChecksum !== GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM) {
    failures.push(
      `reviewed source snapshot checksum ${facts.snapshotChecksum} is not the frozen ${GRID_OPT_IN_BETA_REVIEWED_SOURCE_SNAPSHOT_CHECKSUM}`,
    );
  }
  return failures;
}

/** Requires the reviewed source facts to equal the frozen canonical facts. */
export function assertGridOptInBetaReviewedSourceFactsCanonical(
  facts: GridOptInBetaReviewedSourceFactsV1,
): void {
  const failures = gridOptInBetaReviewedSourceFactsFailures(facts);
  if (failures.length > 0) {
    throw new Error(
      `Reviewed source facts are not the frozen canonical reviewed source facts: ${failures.join("; ")}`,
    );
  }
}
