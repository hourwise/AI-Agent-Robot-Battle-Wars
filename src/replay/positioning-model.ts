import type { MatchRecord } from "../schemas/match-record.schema.js";
import {
  POSITIONING_MODEL_GRID,
  POSITIONING_MODEL_LEGACY,
} from "../schemas/positioning.schema.js";
import type { AnyMatchResult } from "../simulator/types.js";

/**
 * Explicit replay positioning discriminator.
 *
 * The model is always chosen from persisted record identity (schema version),
 * never guessed from zone string values — `center` exists in both models.
 * Schema v1 and v2 are legacy-five-zone records; schema v3 (which requires
 * `positioningModel: "grid-3x3-v1"`) is a grid record.
 */
export type ReplayPositioningModel = "legacy-five-zone-v1" | "grid-3x3-v1";

export function resolveRecordPositioningModel(
  record: MatchRecord,
): ReplayPositioningModel {
  return record.schemaVersion === "3" ? POSITIONING_MODEL_GRID : POSITIONING_MODEL_LEGACY;
}

/**
 * Resolves the positioning model for a raw in-memory match result from its
 * explicit immutable runtime identity. Zone strings are never inspected.
 */
export function resolveMatchResultPositioningModel(
  result: AnyMatchResult,
): ReplayPositioningModel {
  return result.runtime.positioningModel;
}

export function isGridReplayPositioningModel(model: ReplayPositioningModel): boolean {
  return model === POSITIONING_MODEL_GRID;
}
