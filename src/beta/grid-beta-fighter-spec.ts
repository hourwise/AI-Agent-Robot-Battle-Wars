import { dirname, join, resolve, sep } from "node:path";
import { z } from "zod";
import { fsEntryKind, type CanaryFileSystem } from "../canary/immutable-canary-bundle.js";
import { sha256Hex } from "../canary/grid-canary-digest.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import { machineBuildProposalSchema } from "../schemas/build.schema.js";
import { actionPolicySchema } from "../schemas/policy.schema.js";
import { sanitizeName, sanitizeTerminalText } from "../shared/text-sanitise.js";
import { validateBuild } from "../validation/build-validator.js";
import type { ValidatedBuild } from "../validation/validation.types.js";
import type { ActionPolicy } from "../simulator/types.js";

/**
 * Versioned local fighter specification (Milestone 0.2C Phase 3G, Phase 3).
 *
 * `GridBetaFighterSpecV1` is the strict, local-scripted, provider-free fighter
 * input for the explicitly selected grid beta. It reuses the authoritative
 * catalogue-v1 build validator and the authoritative policy schema — no
 * duplicated budget, catalogue or policy-validation logic — and is loaded by
 * identifier from the fixed root `data/beta/grid-fighters/<fighterId>.json`
 * with strict path/entry security. User/input/schema failures are
 * `GridBetaFighterSpecError` and never engage the beta suspension marker.
 */

export const GRID_BETA_FIGHTER_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export const GRID_BETA_FIGHTER_SPEC_SCHEMA_VERSION = "1" as const;
export const GRID_BETA_FIGHTER_SOURCE_KIND = "local-scripted" as const;
export const GRID_BETA_FIGHTER_MAX_JSON_BYTES = 512 * 1024;

export const gridBetaFighterSpecV1Schema = z
  .object({
    schemaVersion: z.literal(GRID_BETA_FIGHTER_SPEC_SCHEMA_VERSION),
    sourceKind: z.literal(GRID_BETA_FIGHTER_SOURCE_KIND),
    fighterId: z.string().regex(GRID_BETA_FIGHTER_ID_PATTERN),
    displayName: z.string().min(1).max(20),
    buildProposal: machineBuildProposalSchema,
    policy: actionPolicySchema,
  })
  .strict();

export interface GridBetaFighterSpecV1 {
  readonly schemaVersion: "1";
  readonly sourceKind: "local-scripted";
  readonly fighterId: string;
  readonly displayName: string;
  readonly buildProposal: ValidatedBuild["proposal"];
  readonly policy: ActionPolicy;
}

export class GridBetaFighterSpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridBetaFighterSpecError";
  }
}

/** Canonical JSON serialization of the parsed spec (deterministic field order). */
export function serializeGridBetaFighterSpec(spec: GridBetaFighterSpecV1): string {
  return JSON.stringify(
    {
      schemaVersion: spec.schemaVersion,
      sourceKind: spec.sourceKind,
      fighterId: spec.fighterId,
      displayName: spec.displayName,
      buildProposal: spec.buildProposal,
      policy: spec.policy,
    },
    null,
    2,
  );
}

/** Deterministic SHA-256 checksum of the canonical spec serialization. */
export function gridBetaFighterSpecChecksum(spec: GridBetaFighterSpecV1): string {
  return sha256Hex(serializeGridBetaFighterSpec(spec));
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

/**
 * Parses and validates a fighter spec from raw JSON. Input/schema failures
 * throw `GridBetaFighterSpecError` (never a suspension trigger). The returned
 * spec is deeply frozen; the checksum is deterministic over the canonical
 * serialization.
 */
export function parseGridBetaFighterSpec(
  raw: unknown,
  expectedFighterId: string,
): { spec: GridBetaFighterSpecV1; checksum: string } {
  const parsed = gridBetaFighterSpecV1Schema.safeParse(raw);
  if (!parsed.success) {
    throw new GridBetaFighterSpecError(
      `grid beta fighter spec failed its authoritative schema: ${parsed.error.message}`,
    );
  }
  const input = parsed.data;

  if (input.fighterId !== expectedFighterId) {
    throw new GridBetaFighterSpecError(
      `fighter spec fighterId ${JSON.stringify(input.fighterId)} must equal the requested identifier ${JSON.stringify(expectedFighterId)}`,
    );
  }

  // Display name must already pass the existing text sanitisation rules.
  if (sanitizeTerminalText(input.displayName) !== input.displayName) {
    throw new GridBetaFighterSpecError(
      "grid beta fighter displayName must already pass text sanitisation",
    );
  }
  // Display name must agree with the build proposal's machine name under the
  // application's display-name convention.
  if (sanitizeName(input.displayName) !== sanitizeName(input.buildProposal.machineName)) {
    throw new GridBetaFighterSpecError(
      "grid beta fighter displayName must agree with the build proposal machine name",
    );
  }

  const buildResult = validateBuild(input.buildProposal, CATALOGUE_V1);
  if (!buildResult.ok) {
    throw new GridBetaFighterSpecError(
      `grid beta fighter build proposal failed the authoritative catalogue-v1 validator: ${buildResult.errors.map((e) => e.message).join("; ")}`,
    );
  }

  const spec: GridBetaFighterSpecV1 = deepFreeze({
    schemaVersion: GRID_BETA_FIGHTER_SPEC_SCHEMA_VERSION,
    sourceKind: GRID_BETA_FIGHTER_SOURCE_KIND,
    fighterId: input.fighterId,
    displayName: input.displayName,
    buildProposal: input.buildProposal,
    policy: input.policy,
  });
  return { spec, checksum: gridBetaFighterSpecChecksum(spec) };
}

/** Rejects path-like, traversal, URL, drive and encoded-traversal identifiers. */
export function assertGridBetaFighterIdentifier(fighterId: string): void {
  if (!GRID_BETA_FIGHTER_ID_PATTERN.test(fighterId)) {
    throw new GridBetaFighterSpecError(
      `fighter identifier must match ${String(GRID_BETA_FIGHTER_ID_PATTERN)}; received ${JSON.stringify(fighterId)}`,
    );
  }
  if (
    fighterId.includes("/") ||
    fighterId.includes("\\") ||
    fighterId.includes("..") ||
    fighterId.includes(":") ||
    fighterId.includes("%") ||
    fighterId.includes("\u0000")
  ) {
    throw new GridBetaFighterSpecError(
      `fighter identifier must not contain path, traversal, URL, drive or encoded characters`,
    );
  }
}

function isInsideOrEqual(child: string, parent: string): boolean {
  const c = resolve(child);
  const p = resolve(parent);
  if (c === p) return true;
  const prefix = p.endsWith(sep) ? p : `${p}${sep}`;
  return c.startsWith(prefix);
}

/** Every path from the filesystem root down to `absPath`, inclusive. */
function ancestryPaths(absPath: string): string[] {
  const paths: string[] = [];
  let current = resolve(absPath);
  for (;;) {
    paths.unshift(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return paths;
}

/**
 * Inspects the complete fighter-input ancestry from the filesystem root
 * through the fighter root and every nested directory down to (but excluding)
 * the target fighter file. `lstat` is used throughout (via `fsEntryKind`), so
 * symbolic links and junctions are detected without ever being followed.
 * Rejects symbolic-link or junction parents above the fighter root, a
 * symbolic-link fighter root, symbolic-link nested directories, and
 * non-directory or missing ancestry components. The target file itself is
 * validated separately as a regular file.
 */
async function assertNoSymlinkJunctionAncestry(
  fs: CanaryFileSystem,
  _root: string,
  target: string,
): Promise<void> {
  const paths = ancestryPaths(resolve(target));
  // The final component is the target file itself (checked separately as a
  // regular file); every component above it must be a real directory.
  const ancestry = paths.slice(0, -1);
  for (const path of ancestry) {
    const kind = await fsEntryKind(fs, path);
    if (kind === "symbolic link") {
      throw new GridBetaFighterSpecError(
        `fighter input ancestry must not contain a symbolic link or junction: ${path}`,
      );
    }
    if (kind === "file" || kind === "other" || kind === null) {
      throw new GridBetaFighterSpecError(
        `fighter input ancestry contains a missing or non-directory entry: ${path}`,
      );
    }
  }
}

export interface GridBetaFighterLoadResult {
  readonly spec: GridBetaFighterSpecV1;
  readonly checksum: string;
}

/**
 * Loads a fighter spec by identifier from the fixed fighter root.
 *
 * Security: identifiers only (never arbitrary paths); the resolved final path
 * must remain under the exact fighter root; symbolic links/junctions and
 * non-directory entries in the ancestry are rejected; the entry must be a
 * regular file; a maximum JSON size is enforced; the file basename must agree
 * with the internal `fighterId`. All failures are input errors and never
 * suspend the beta.
 */
export async function loadGridBetaFighterSpec(
  root: string,
  fighterId: string,
  fs: CanaryFileSystem,
): Promise<GridBetaFighterLoadResult> {
  assertGridBetaFighterIdentifier(fighterId);

  const fileName = `${fighterId}.json`;
  const target = join(root, fileName);
  if (!isInsideOrEqual(target, root)) {
    throw new GridBetaFighterSpecError(
      `fighter path resolves outside the fighter root: ${resolve(target)}`,
    );
  }
  await assertNoSymlinkJunctionAncestry(fs, root, target);

  const kind = await fsEntryKind(fs, resolve(target));
  if (kind === null) {
    throw new GridBetaFighterSpecError(`fighter spec is missing: ${resolve(target)}`);
  }
  if (kind !== "file") {
    throw new GridBetaFighterSpecError(
      `fighter spec must be a regular file (found ${kind}): ${resolve(target)}`,
    );
  }

  const text = await fs.readFile(resolve(target), "utf-8");
  if (Buffer.byteLength(text, "utf-8") > GRID_BETA_FIGHTER_MAX_JSON_BYTES) {
    throw new GridBetaFighterSpecError(
      `fighter spec exceeds the maximum size of ${GRID_BETA_FIGHTER_MAX_JSON_BYTES} bytes`,
    );
  }

  // Recheck the final file entry after reading to reduce substitution races;
  // a changed or replaced entry (including a newly introduced symbolic link)
  // fails closed rather than being followed silently.
  const afterReadKind = await fsEntryKind(fs, resolve(target));
  if (afterReadKind !== "file") {
    throw new GridBetaFighterSpecError(
      `fighter spec changed while being read (found ${afterReadKind ?? "nothing"}): ${resolve(target)}`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new GridBetaFighterSpecError(
      `fighter spec is not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  return parseGridBetaFighterSpec(raw, fighterId);
}

export interface GridBetaFighterExecutionValues {
  readonly build: ValidatedBuild;
  readonly policy: ActionPolicy;
}

/**
 * Fresh mutable validated build and policy values for one simulation. Reuses
 * the authoritative catalogue-v1 build validator (never duplicates logic); the
 * shared parsed spec stays deeply frozen.
 */
export function createGridBetaFighterExecutionValues(
  spec: GridBetaFighterSpecV1,
): GridBetaFighterExecutionValues {
  const buildResult = validateBuild(spec.buildProposal, CATALOGUE_V1);
  if (!buildResult.ok) {
    throw new GridBetaFighterSpecError(
      `grid beta fighter build proposal failed validation on execution: ${buildResult.errors.map((e) => e.message).join("; ")}`,
    );
  }
  return {
    build: buildResult.build,
    policy: { ...spec.policy },
  };
}
