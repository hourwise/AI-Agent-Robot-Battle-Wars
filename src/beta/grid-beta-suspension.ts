import { z } from "zod";
import { fsEntryKind, type CanaryFileSystem } from "../canary/immutable-canary-bundle.js";
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

export interface CreateGridBetaSuspensionMarkerInput {
  trigger: GridBetaSuspensionTrigger;
  message: string;
  createdAt: string;
}

/**
 * Atomically creates the suspension marker. Never overwrites an existing
 * marker: the final path is checked before and immediately before the atomic
 * rename; the marker contents are written to a temporary sibling first. A
 * malformed trigger or an already-existing marker fails closed.
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
  const existing = await fsEntryKind(fs, markerPath);
  if (existing !== null) {
    throw new GridBetaSuspensionError(
      `suspension marker already exists (${existing}) at ${markerPath}; refusing to overwrite`,
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
  const tmpPath = `${markerPath}.tmp`;
  const tmpExisting = await fsEntryKind(fs, tmpPath);
  if (tmpExisting !== null) {
    throw new GridBetaSuspensionError(
      `suspension marker temporary path already exists (${tmpExisting}): ${tmpPath}`,
    );
  }
  await fs.writeFile(tmpPath, serialized, "utf-8");
  const recheck = await fsEntryKind(fs, markerPath);
  if (recheck !== null) {
    await fs.rm(tmpPath, { force: true });
    throw new GridBetaSuspensionError(
      `suspension marker appeared before publication (${recheck}) at ${markerPath}; refusing to overwrite`,
    );
  }
  await fs.rename(tmpPath, markerPath);
}
