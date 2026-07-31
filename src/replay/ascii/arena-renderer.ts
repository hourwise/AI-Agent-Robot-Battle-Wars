import type { ReplayPositioningModel } from "../positioning-model.js";
import { isGridReplayPositioningModel } from "../positioning-model.js";
import { renderArenaSnapshot } from "./arena-snapshot-renderer.js";
import type { FighterVisualState } from "./ascii.types.js";
import {
  renderGridArenaSnapshot,
  type GridFighterVisualState,
} from "./grid-arena-snapshot-renderer.js";

export type ArenaFighterVisualState = FighterVisualState | GridFighterVisualState;

/**
 * Version-aware arena rendering dispatch. Legacy records render through the
 * existing five-zone renderer; v3 grid records render through the 3×3 grid
 * renderer. The model is resolved from record identity elsewhere and never
 * inferred from zone values here.
 */
export function renderArenaForModel(
  model: ReplayPositioningModel,
  fighterA: ArenaFighterVisualState,
  fighterB: ArenaFighterVisualState,
): string {
  if (isGridReplayPositioningModel(model)) {
    return renderGridArenaSnapshot(
      fighterA as GridFighterVisualState,
      fighterB as GridFighterVisualState,
    );
  }
  return renderArenaSnapshot(
    fighterA as FighterVisualState,
    fighterB as FighterVisualState,
  );
}
