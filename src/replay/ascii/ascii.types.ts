import type {
  MatchConfig,
  CompetitionResult,
  SimulationEvent,
} from "../../simulator/types.js";
import type { ValidatedBuild } from "../../validation/validation.types.js";

export type ReplayMode = "ascii";

export interface AsciiReplayInput {
  readonly config: MatchConfig;
  readonly initialState: CompetitionState;
  readonly events: readonly SimulationEvent[];
  readonly result: CompetitionResult;
  readonly rounds: number;
}

export interface CompetitionState {
  readonly fighterA: FighterVisualState;
  readonly fighterB: FighterVisualState;
}

export interface FighterVisualState {
  readonly fighterId: string;
  readonly build: ValidatedBuild;
  readonly integrity: number;
  readonly maxIntegrity: number;
  readonly energy: number;
  readonly heat: number;
  readonly zone: string;
  readonly facing: string;
  readonly conditions: readonly string[];
  readonly components: {
    readonly mobilityDisabled: boolean;
    readonly weaponDisabled: boolean;
    readonly utilityDisabled: boolean;
    /** v2: component is damaged (but not disabled). */
    readonly mobilityDamaged: boolean;
    readonly weaponDamaged: boolean;
    readonly utilityDamaged: boolean;
  };
  readonly armour: {
    readonly front: number;
    readonly left: number;
    readonly right: number;
    readonly rear: number;
    readonly top: number;
  };
}

export interface HighlightMoment {
  readonly round: number;
  readonly title: string;
  readonly events: readonly SimulationEvent[];
  readonly stateBefore?: CompetitionState;
  readonly stateAfter: CompetitionState;
  readonly priority: number;
  readonly stableOrder: number;
}

export interface AsciiRenderOptions {
  readonly mode: ReplayMode;
  readonly maxWidth?: number;
  readonly maxHighlights?: number;
}

export interface PortraitData {
  readonly machineName: string;
  readonly chassisId: string;
  readonly mobilityId: string;
  readonly weaponId: string;
  readonly utilityId: string;
  readonly totalCost: number;
  readonly armour: {
    readonly front: number;
    readonly left: number;
    readonly right: number;
    readonly rear: number;
    readonly top: number;
  };
}
