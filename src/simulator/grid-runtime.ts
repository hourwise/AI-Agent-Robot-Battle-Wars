/**
 * Opt-in deterministic 3×3 grid combat runtime (Milestone 0.2C Phase 3A).
 *
 * Entered only through the explicit `runGridMatch` entry point. The default
 * application path remains the legacy five-zone `runMatch`; this module is
 * never wired into normal CLI, series, battle or application commands.
 *
 * Movement, distance, exposure and repositioning are grid-specific; damage,
 * component lifecycle, energy/heat, victory and event production are shared
 * with the legacy runtime through the generic round/match cores.
 */
import type {
  GridFighterState,
  GridMatchResult,
  MatchConfig,
  MovementAction,
  Direction,
  RoundAction,
  ActionPolicy,
  ZoneFighterState,
} from "./types.js";
import { GRID_RUNTIME_IDENTITY } from "./runtime-identity.js";
import type { SeededRandom } from "./seeded-random.js";
import type { GridZone } from "./arena-grid.js";
import {
  getOrthogonalNeighbours,
  getOrthogonalPathDistance,
  findShortestGridPath,
  stepGridZone,
  getCombatProximity,
} from "./arena-grid.js";
import { rotateLeft, rotateRight } from "./movement.js";
import { calculateGridAttack } from "./damage.js";
import { deriveGridAction } from "./actions.js";
import {
  applyRoundForZone,
  type PositioningAdapter,
  type RoundState,
} from "./reducer.js";
import {
  runMatchForZone,
  type MatchRuntimeAdapter,
  createZoneFighterState,
} from "./simulator.js";
import type { ComponentQualificationConfig } from "./component-qualification-registry.js";

export interface GridMovementResult {
  zone: GridZone;
  facing: Direction;
  translated: boolean;
}

/**
 * Deterministic grid movement (ADR-001):
 *
 * - `advance`: one orthogonal step along the deterministic north→east→south→west
 *   shortest path toward the opponent; no translation when sharing a cell.
 * - `retreat`: greatest-distance orthogonal neighbour from the opponent with
 *   north→east→south→west tie-breaking; no translation when blocked.
 * - `circle_left` / `circle_right`: turn in place, no translation (Phase 3A).
 * - `hold`: preserve zone and facing.
 */
export function resolveGridMovement(
  state: GridFighterState,
  opponent: GridFighterState,
  action: MovementAction,
): GridMovementResult {
  switch (action) {
    case "advance":
      return resolveGridAdvance(state, opponent);
    case "retreat":
      return resolveGridRetreat(state, opponent);
    case "circle_left":
      return { zone: state.zone, facing: rotateLeft(state.facing), translated: false };
    case "circle_right":
      return { zone: state.zone, facing: rotateRight(state.facing), translated: false };
    case "hold":
      return { zone: state.zone, facing: state.facing, translated: false };
  }
}

function resolveGridAdvance(
  state: GridFighterState,
  opponent: GridFighterState,
): GridMovementResult {
  if (state.zone === opponent.zone) {
    return { zone: state.zone, facing: state.facing, translated: false };
  }
  const path = findShortestGridPath(state.zone, opponent.zone);
  const next = path.length >= 2 ? (path[1] ?? null) : null;
  if (next === null || next === state.zone) {
    return { zone: state.zone, facing: state.facing, translated: false };
  }
  return { zone: next, facing: state.facing, translated: true };
}

function resolveGridRetreat(
  state: GridFighterState,
  opponent: GridFighterState,
): GridMovementResult {
  const currentDistance = getOrthogonalPathDistance(state.zone, opponent.zone);
  let best: GridZone | null = null;
  let bestDistance = currentDistance;
  for (const neighbour of getOrthogonalNeighbours(state.zone)) {
    const distance = getOrthogonalPathDistance(neighbour, opponent.zone);
    if (distance > bestDistance) {
      bestDistance = distance;
      best = neighbour;
    }
  }
  return best === null
    ? { zone: state.zone, facing: state.facing, translated: false }
    : { zone: best, facing: state.facing, translated: true };
}

/**
 * Grid knockback. Different cells: greatest-distance orthogonal neighbour
 * from the attacker (north→east→south→west ties), none if blocked. Same cell:
 * one step in the attacker's facing, else the first valid neighbour in
 * north→east→south→west order, else no move. Never wraps.
 */
export function resolveGridKnockback(
  attackerZone: GridZone,
  attackerFacing: Direction,
  defenderZone: GridZone,
): GridZone | null {
  if (attackerZone === defenderZone) {
    const forward = stepGridZone(defenderZone, attackerFacing);
    if (forward !== null) return forward;
    return getOrthogonalNeighbours(defenderZone)[0] ?? null;
  }

  const defenderDistance = getOrthogonalPathDistance(defenderZone, attackerZone);
  let best: GridZone | null = null;
  let bestDistance = defenderDistance;
  for (const neighbour of getOrthogonalNeighbours(defenderZone)) {
    const distance = getOrthogonalPathDistance(neighbour, attackerZone);
    if (distance > bestDistance) {
      bestDistance = distance;
      best = neighbour;
    }
  }
  return best;
}

/**
 * Grid grapple repositioning: when the fighters occupy different cells, move
 * the target one orthogonal shortest-path step toward the attacker
 * (north→east→south→west ordering). No reposition when already sharing a cell.
 */
export function resolveGridGrapple(
  attackerZone: GridZone,
  defenderZone: GridZone,
): GridZone | null {
  if (attackerZone === defenderZone) return null;
  const path = findShortestGridPath(defenderZone, attackerZone);
  return path.length >= 2 ? (path[1] ?? null) : null;
}

/**
 * Frozen grid momentum invariant (Milestone 0.2C Phase 3B.1).
 *
 * Ram charge momentum is granted only when an `advance` action actually
 * translates the robot to another cell:
 *
 *   action = advance AND translated = true  → momentum 1
 *   all other combinations                  → momentum 0
 *
 * A translated `retreat`, `circle_left`, `circle_right`, `hold`, or any future
 * lateral action must never receive charge momentum. The synthetic
 * `translated: true` cases for circle and hold are intentional: they protect
 * the invariant against future movement changes.
 */
export function getGridMovementMomentum(
  action: MovementAction,
  translated: boolean,
): 0 | 1 {
  return action === "advance" && translated ? 1 : 0;
}

const GRID_POSITIONING_ADAPTER: PositioningAdapter<GridZone> = {
  resolveMovement: (state, opponent, action) =>
    resolveGridMovement(state as GridFighterState, opponent as GridFighterState, action),
  computeDistance: (zoneA, zoneB) => getCombatProximity(zoneA, zoneB),
  computeAttack: (attacker, defender, hitChance, momentum, rng, primary, secondary) =>
    calculateGridAttack(
      attacker as GridFighterState,
      defender as GridFighterState,
      hitChance,
      momentum,
      rng,
      primary,
      secondary,
    ),
  resolveKnockback: (attackerZone, attackerFacing, defenderZone) =>
    resolveGridKnockback(attackerZone, attackerFacing, defenderZone),
  resolveGrapple: (attackerZone, defenderZone) =>
    resolveGridGrapple(attackerZone, defenderZone),
  enableGrappleRepositioning: true,
  planFromSharedSnapshot: true,
  momentumFor: getGridMovementMomentum,
};

export function applyGridRound(
  state: RoundState<GridZone>,
  actions: { fighterA: RoundAction; fighterB: RoundAction },
  rng: SeededRandom,
  round: number,
  timestampMs: number,
  policyA: ActionPolicy | undefined,
  policyB: ActionPolicy | undefined,
  qualificationConfig: ComponentQualificationConfig,
): RoundState<GridZone> {
  return applyRoundForZone(
    state,
    actions,
    rng,
    round,
    timestampMs,
    policyA,
    policyB,
    qualificationConfig,
    GRID_POSITIONING_ADAPTER,
  );
}

const GRID_MATCH_ADAPTER: MatchRuntimeAdapter<GridZone> = {
  initialZones: { fighterA: "south", fighterB: "north" },
  initialFacing: { fighterA: "north", fighterB: "south" },
  deriveAction,
  applyRound: applyGridRound,
  competitionStartedExtra: { positioningModel: "grid-3x3-v1" },
  eventSimulatorVersion: "0.3.0",
  runtime: GRID_RUNTIME_IDENTITY,
};

function deriveAction(
  state: ZoneFighterState<GridZone>,
  policy: ActionPolicy,
  opponent: ZoneFighterState<GridZone>,
  rng: SeededRandom,
): RoundAction {
  return deriveGridAction(
    state as GridFighterState,
    policy,
    opponent as GridFighterState,
    rng,
  );
}

/**
 * Opt-in deterministic grid match entry point. Returns a grid result with
 * explicit simulator `0.3.0` / `grid-3x3-v1` identity; persists as schema v3.
 *
 * The grid version contract (Phase 3B) is enforced here: the 3×3 positioning
 * change is a *simulator* version change (`0.3.0`) and does not introduce a
 * new balance ruleset in this milestone, so a valid grid configuration must
 * run ruleset `0.2.0` against catalogue `1`. Configurations naming any other
 * ruleset or catalogue are rejected before any simulation begins. The legacy
 * `runMatch` path is untouched.
 */
export function runGridMatch(config: MatchConfig): GridMatchResult {
  assertGridVersionContract(config);
  return runMatchForZone(config, GRID_MATCH_ADAPTER);
}

function assertGridVersionContract(config: MatchConfig): void {
  if (config.rulesetVersion !== "0.2.0") {
    throw new Error(
      `Grid runtime requires rulesetVersion 0.2.0; received ${String(config.rulesetVersion)}`,
    );
  }
  if (config.catalogueVersion !== "1") {
    throw new Error(
      `Grid runtime requires catalogueVersion 1; received ${String(config.catalogueVersion)}`,
    );
  }
}

export { createZoneFighterState };
