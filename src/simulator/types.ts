import type { ValidatedBuild } from "../validation/validation.types.js";
import type { GridZone } from "./arena-grid.js";
export type { GridZone } from "./arena-grid.js";
import type {
  ComponentQualificationId,
  ComponentQualificationMetadata,
} from "./component-qualification-registry.js";

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

export type ComponentKind = "mobility" | "weapon" | "utility";
export type ComponentStatus = "healthy" | "damaged" | "disabled";

export interface RuntimeComponentState {
  state: ComponentStatus;
}

export interface UtilityRuntimeState extends RuntimeComponentState {
  installed: boolean;
  reinforcedDriveGuard?: "available" | "spent" | "lost";
}

export interface ComponentStates {
  mobility: RuntimeComponentState;
  weapon: RuntimeComponentState;
  utility: UtilityRuntimeState;
}

/** Legacy binary projection — derived from authoritative ComponentStates. */
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
  /** Authoritative 0.2 component state map. */
  comps: ComponentStates;
  /** Legacy compatibility projection — derived from comps. */
  components: ComponentState;
  conditions: Condition[];
}

/**
 * Every fighter field except the positioning zone. Shared by the legacy
 * five-zone runtime and the opt-in 3×3 grid runtime so that damage, component,
 * energy/heat and victory logic can be reused without weakening either zone
 * type to a common unrestricted union.
 */
export type FighterCoreState = Omit<FighterState, "zone">;

/** A fighter state parameterised by its positioning zone type. */
export type ZoneFighterState<Z> = FighterCoreState & { zone: Z };

/** Grid runtime fighter state — canonical grid zone, all other facts shared. */
export interface GridFighterState extends FighterCoreState {
  zone: GridZone;
}

/**
 * Explicit immutable in-memory runtime identity. The legacy runtime reports
 * simulator 0.2.0 / legacy-five-zone-v1; the opt-in grid runtime reports
 * simulator 0.3.0 / grid-3x3-v1. Never inferred from zone string values.
 */
export type PositioningIdentity =
  | {
      readonly simulatorVersion: "0.2.0";
      readonly positioningModel: "legacy-five-zone-v1";
    }
  | {
      readonly simulatorVersion: "0.3.0";
      readonly positioningModel: "grid-3x3-v1";
    };

export type LegacyRuntimeIdentity = Extract<
  PositioningIdentity,
  { positioningModel: "legacy-five-zone-v1" }
>;
export type GridRuntimeIdentity = Extract<
  PositioningIdentity,
  { positioningModel: "grid-3x3-v1" }
>;

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
  /** Explicit registered rule identity. Omission resolves to the registry default. */
  componentQualificationId?: ComponentQualificationId;
  /** Resolved persisted metadata; omitted only by legacy inputs. */
  componentQualification?: ComponentQualificationMetadata;
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
  /** Explicit runtime identity; always populated by `runMatch`. */
  runtime: LegacyRuntimeIdentity;
}

/** Opt-in grid runtime result with grid fighter state and grid identity. */
export interface GridMatchResult {
  config: MatchConfig;
  events: SimulationEvent[];
  result: CompetitionResult;
  rounds: number;
  initialState: { fighterA: GridFighterState; fighterB: GridFighterState };
  runtime: GridRuntimeIdentity;
}

/** A result from either runtime, discriminated by `runtime`. */
export type AnyMatchResult = MatchResult | GridMatchResult;

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
