import { dirname, resolve } from "node:path";
import { z } from "zod";
import {
  fsEntryKind,
  isFsCode,
  type CanaryFileSystem,
} from "../canary/immutable-canary-bundle.js";
import { GRID_OPT_IN_BETA_MATCH_IMPLEMENTATION_ID } from "./grid-beta-identity.js";

/**
 * One immediate deterministic suspension switch (Milestone 0.2C Phase 3G,
 * Phase 5).
 *
 * A single marker at `data/beta/GRID_BETA_SUSPENDED` suspends only new
 * grid-beta matches. Any filesystem entry at the exact marker path — file,
 * directory, symbolic link, junction or malformed contents — means suspended
 * and fails closed. Legacy matches and series are unaffected; existing beta
 * records and replays remain readable. No command in this phase clears or
 * bypasses the marker.
 */

export type GridBetaSuspensionTrigger =
  | "governance_anchor_failure"
  | "legacy_default_regression"
  | "canary_regression"
  | "nondeterministic_result"
  | "runtime_identity_mismatch"
  | "schema_v3_validation_failure"
  | "record_report_disagreement"
  | "replay_reconstruction_disagreement"
  | "silent_runtime_fallback"
  | "cross_root_persistence_failure"
  | "bundle_integrity_failure"
  | "corrupt_or_unreplayable_v3_record";

export const GRID_BETA_SUSPENSION_TRIGGERS: readonly GridBetaSuspensionTrigger[] =
  Object.freeze([
    "governance_anchor_failure",
    "legacy_default_regression",
    "canary_regression",
    "nondeterministic_result",
    "runtime_identity_mismatch",
    "schema_v3_validation_failure",
    "record_report_disagreement",
    "replay_reconstruction_disagreement",
    "silent_runtime_fallback",
    "cross_root_persistence_failure",
    "bundle_integrity_failure",
    "corrupt_or_unreplayable_v3_record",
  ]);

export function isGridBetaSuspensionTrigger(
  value: unknown,
): value is GridBetaSuspensionTrigger {
  return (
    typeof value === "string" &&
    (GRID_BETA_SUSPENSION_TRIGGERS as readonly string[]).includes(value)
  );
}

export const gridBetaSuspensionMarkerV1Schema = z.object({
  schemaVersion: z.literal("1"),
  kind: z.literal("grid-beta-suspension"),
  implementationId: z.literal(GRID_OPT_IN_BETA_MATCH_IMPLEMENTATION_ID),
  contractId: z.literal("grid-opt-in-beta-contract-v1"),
  governanceDecisionId: z.literal("58e8cd87-504e-4b5f-9bac-f6b81d82377b"),
  trigger: z.custom<GridBetaSuspensionTrigger>((value) =>
    isGridBetaSuspensionTrigger(value),
  ),
  message: z.string().min(1),
  createdAt: z.string().datetime(),
});

export interface GridBetaSuspensionMarkerV1 {
  readonly schemaVersion: "1";
  readonly kind: "grid-beta-suspension";
  readonly implementationId: "grid-opt-in-beta-match-v1";
  readonly contractId: "grid-opt-in-beta-contract-v1";
  readonly governanceDecisionId: "58e8cd87-504e-4b5f-9bac-f6b81d82377b";
  readonly trigger: GridBetaSuspensionTrigger;
  readonly message: string;
  readonly createdAt: string;
}

export class GridBetaSuspensionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridBetaSuspensionError";
  }
}

/**
 * Typed internal safety error (Milestone 0.2C Phase 3G.1, Phase 2). Carries
 * the frozen suspension trigger and the human-readable safety message so the
 * application service can create the suspension marker exactly once with the
 * original safety classification (never collapsing every publication-gate
 * failure into `bundle_integrity_failure`).
 */
export class GridBetaSafetyError extends Error {
  readonly trigger: GridBetaSuspensionTrigger;

  constructor(trigger: GridBetaSuspensionTrigger, message: string) {
    super(message);
    this.name = "GridBetaSafetyError";
    this.trigger = trigger;
  }
}

/**
 * Requires the suspension marker to be absent. Any filesystem entry at the
 * exact marker path (file, directory, symbolic link, junction, malformed
 * contents) means the beta is suspended and fails closed.
 */
export async function assertSuspensionMarkerAbsent(
  fs: CanaryFileSystem,
  markerPath: string,
): Promise<void> {
  const kind = await fsEntryKind(fs, markerPath);
  if (kind !== null) {
    throw new GridBetaSuspensionError(
      `Grid beta is suspended: a ${kind} exists at the suspension marker path ${markerPath}`,
    );
  }
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
 * Securely creates the marker parent when missing and inspects the complete
 * ancestry from the filesystem root. Symbolic links, junctions and
 * non-directory components are rejected. Runs before exclusive marker
 * creation and again immediately after creation.
 */
async function assertSecureMarkerParent(
  fs: CanaryFileSystem,
  markerPath: string,
): Promise<void> {
  const parent = dirname(resolve(markerPath));
  await fs.mkdir(parent, { recursive: true });
  for (const path of ancestryPaths(parent)) {
    const kind = await fsEntryKind(fs, path);
    if (kind === null) {
      throw new GridBetaSuspensionError(
        `suspension marker parent component does not exist: ${path}`,
      );
    }
    if (kind !== "directory") {
      throw new GridBetaSuspensionError(
        `suspension marker parent component is not a real directory (${kind}; symbolic links and junctions are rejected): ${path}`,
      );
    }
  }
}

export interface CreateGridBetaSuspensionMarkerInput {
  trigger: GridBetaSuspensionTrigger;
  message: string;
  createdAt: string;
}

/**
 * Creates the suspension marker exclusively (Milestone 0.2C Phase 3G.1,
 * Phase 3).
 *
 * The marker parent is securely created when missing and the complete
 * ancestry is inspected from the filesystem root before and after creation
 * (rejecting symbolic links, junctions and non-directory components). The
 * final marker path is then created directly with an exclusive/no-clobber
 * write (`wx`): it can never replace an existing file, malformed marker,
 * directory, symbolic link or junction; concurrent creators result in
 * exactly one created marker and one closed failure; a partial marker still
 * means suspended. No temporary-marker rename is used and the existing
 * marker bytes are never replaced.
 */
export async function createGridBetaSuspensionMarker(
  fs: CanaryFileSystem,
  markerPath: string,
  input: CreateGridBetaSuspensionMarkerInput,
): Promise<void> {
  if (!isGridBetaSuspensionTrigger(input.trigger)) {
    throw new GridBetaSuspensionError(
      `suspension trigger ${String(input.trigger)} is not a frozen trigger code`,
    );
  }
  const marker: GridBetaSuspensionMarkerV1 = {
    schemaVersion: "1",
    kind: "grid-beta-suspension",
    implementationId: GRID_OPT_IN_BETA_MATCH_IMPLEMENTATION_ID,
    contractId: "grid-opt-in-beta-contract-v1",
    governanceDecisionId: "58e8cd87-504e-4b5f-9bac-f6b81d82377b",
    trigger: input.trigger,
    message: input.message,
    createdAt: input.createdAt,
  };
  const parsed = gridBetaSuspensionMarkerV1Schema.safeParse(marker);
  if (!parsed.success) {
    throw new GridBetaSuspensionError(
      `generated suspension marker failed its authoritative schema: ${parsed.error.message}`,
    );
  }
  const serialized = JSON.stringify(parsed.data, null, 2);

  // Securely create the marker parent (allowed to be missing) and inspect the
  // complete ancestry from the filesystem root before the exclusive create.
  await assertSecureMarkerParent(fs, markerPath);

  try {
    await fs.writeFileExclusive(markerPath, serialized, "utf-8");
  } catch (e) {
    if (isFsCode(e, "EEXIST")) {
      throw new GridBetaSuspensionError(
        `suspension marker already exists at ${markerPath}; refusing to overwrite`,
      );
    }
    throw new GridBetaSuspensionError(
      `suspension marker exclusive creation failed at ${markerPath}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // Re-inspect the complete ancestry after creation.
  await assertSecureMarkerParent(fs, markerPath);
}
