import type { ValidatedBuild } from "../validation/validation.types.js";

export type Direction = "north" | "south" | "east" | "west";
export type ArenaZone =
  "center" | "north_edge" | "south_edge" | "east_edge" | "west_edge";
export type DistanceBand = "close" | "medium" | "far";

export type Condition = "overturned" | "immobilised" | "overheated" | "stunned";

export interface ArmourState {
  front: number;
  left: number;
  right: number;
  rear: number;
  top: number;
}

export interface ComponentState {
  mobilityDisabled: boolean;
  weaponDisabled: boolean;
  utilityDisabled: boolean;
}

export interface FighterState {
  fighterId: string;
  build: ValidatedBuild;
  integrity: number;
  maxIntegrity: number;
  energy: number;
  heat: number;
  zone: ArenaZone;
  facing: Direction;
  weaponCooldown: number;
  utilityCooldown: number;
  armour: ArmourState;
  components: ComponentState;
  conditions: Condition[];
}

export type OpeningBehaviour = "rush" | "cautious" | "flank" | "hold";
export type PreferredRange = "close" | "medium" | "far";
export type PrimaryTarget = "front" | "rear" | "left" | "right" | "top";
export type SecondaryTarget = "front" | "rear" | "left" | "right" | "top";
export type FallbackBehaviour = "retreat" | "defend" | "desperate_attack";

export interface ActionPolicy {
  opening: OpeningBehaviour;
  preferredRange: PreferredRange;
  aggression: number;
  primaryTarget: PrimaryTarget;
  secondaryTarget: SecondaryTarget;
  retreatThreshold: number;
  heatThreshold: number;
  fallback: FallbackBehaviour;
}

export type MovementAction =
  "advance" | "retreat" | "circle_left" | "circle_right" | "hold";
export type CombatAction = "attack" | "defend" | "idle";

export interface RoundAction {
  movement: MovementAction;
  combat: CombatAction;
}

export interface RoundActions {
  fighterA: RoundAction;
  fighterB: RoundAction;
}

export interface MatchConfig {
  seed: number;
  fighterA: { build: ValidatedBuild; policy: ActionPolicy };
  fighterB: { build: ValidatedBuild; policy: ActionPolicy };
  rulesetVersion: string;
  catalogueVersion: string;
}

export type VictoryMethod = "destruction" | "immobilisation" | "judges" | "draw";

export interface CompetitionResult {
  winner: string | null;
  loser: string | null;
  method: VictoryMethod;
  judgeScores?: { fighterA: JudgeScore; fighterB: JudgeScore };
}

export interface JudgeScore {
  damageInflicted: number;
  mobilityRemaining: number;
  weaponFunctional: boolean;
  aggression: number;
  integrityRemaining: number;
  normalised: {
    damage: number;
    mobility: number;
    weapon: number;
    aggression: number;
    integrity: number;
    total: number;
  };
}

export interface MatchResult {
  config: MatchConfig;
  events: SimulationEvent[];
  result: CompetitionResult;
  rounds: number;
  initialState: { fighterA: FighterState; fighterB: FighterState };
}

export interface SimulationEvent {
  readonly schemaVersion: string;
  readonly sequence: number;
  readonly round: number;
  readonly timestampMs: number;
  readonly type: string;
  readonly actorId?: string;
  readonly targetId?: string;
  readonly data: Record<string, unknown>;
}
