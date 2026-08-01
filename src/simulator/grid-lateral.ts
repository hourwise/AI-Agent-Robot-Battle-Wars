/**
 * Pure deterministic grid lateral-movement foundation (Milestone 0.2C Phase 3C).
 *
 * This module is deliberately isolated: it imports no match runner, reducer,
 * damage calculation, component lifecycle, persistence, replay or seeded
 * randomness. It depends only on grid geometry (`arena-grid`), grid fighter
 * and policy types, and cardinal rotation helpers (`movement`).
 *
 * It is the single canonical home for:
 *
 * - translated `circle_left` / `circle_right` resolution (tangent vectors,
 *   candidate filtering and deterministic ranking, facing toward the
 *   opponent, in-place rotation fallbacks);
 * - the deterministic flank-policy movement selector driven by the existing
 *   `opening: "flank"` policy field.
 *
 * Movement resolution and action derivation both consume these functions so
 * the circling/flank semantics cannot drift between callers.
 */
import type {
  ActionPolicy,
  Direction,
  GridFighterState,
  MovementAction,
} from "./types.js";
import type { GridZone } from "./arena-grid.js";
import {
  getCombatProximity,
  getGridCoordinate,
  getOrthogonalNeighbours,
  getPlanarExposedArmourZones,
  getRelativeBearing,
  findShortestGridPath,
} from "./arena-grid.js";
import { rotateLeft, rotateRight } from "./movement.js";

export interface GridCircleResult {
  zone: GridZone;
  facing: Direction;
  translated: boolean;
}

function chebyshevDistance(a: GridZone, b: GridZone): number {
  const ca = getGridCoordinate(a);
  const cb = getGridCoordinate(b);
  return Math.max(Math.abs(ca.x - cb.x), Math.abs(ca.y - cb.y));
}

/**
 * The first step of the deterministic north→east→south→west shortest path from
 * `from` toward `to`, expressed as a cardinal facing. Returns `null` when no
 * direction can be determined (same cell).
 */
export function getFacingTowardGridZone(from: GridZone, to: GridZone): Direction | null {
  if (from === to) return null;
  const path = findShortestGridPath(from, to);
  const next = path[1] ?? null;
  if (next === null) return null;
  const a = getGridCoordinate(from);
  const b = getGridCoordinate(next);
  if (b.x === a.x + 1) return "east";
  if (b.x === a.x - 1) return "west";
  if (b.y === a.y + 1) return "north";
  if (b.y === a.y - 1) return "south";
  return null;
}

/**
 * Choose the single best lateral destination cell for a circle action, or
 * `null` when no valid lateral candidate exists.
 *
 * Actor-to-opponent vector: `dx = ox - ax`, `dy = oy - ay`. Tangent vectors
 * are frozen as:
 *
 *   circle_left  tangent = (-dy, dx)
 *   circle_right tangent = ( dy,-dx)
 *
 * Candidates are the actor's valid orthogonal neighbours in frozen
 * north→east→south→west order, excluding the opponent's cell, keeping only
 * those whose one-step vector has a strictly positive dot product with the
 * requested tangent. Ranking freezes: smallest absolute change in Chebyshev
 * distance to the opponent, then greatest positive tangent dot product, then
 * the frozen north→east→south→west order. No diagonal movement and no
 * wrapping are permitted.
 */
export function chooseGridCircleCandidate(
  actorZone: GridZone,
  opponentZone: GridZone,
  action: "circle_left" | "circle_right",
): GridZone | null {
  const actor = getGridCoordinate(actorZone);
  const opponent = getGridCoordinate(opponentZone);
  const dx = opponent.x - actor.x;
  const dy = opponent.y - actor.y;
  const tangentX = action === "circle_left" ? -dy : dy;
  const tangentY = action === "circle_left" ? dx : -dx;

  const candidates: GridZone[] = [];
  for (const neighbour of getOrthogonalNeighbours(actorZone)) {
    if (neighbour === opponentZone) continue;
    const n = getGridCoordinate(neighbour);
    const dot = (n.x - actor.x) * tangentX + (n.y - actor.y) * tangentY;
    if (dot > 0) candidates.push(neighbour);
  }
  if (candidates.length === 0) return null;

  const currentChebyshev = chebyshevDistance(actorZone, opponentZone);
  const tangentDotOf = (zone: GridZone): number => {
    const c = getGridCoordinate(zone);
    return (c.x - actor.x) * tangentX + (c.y - actor.y) * tangentY;
  };
  const neighbourOrder = getOrthogonalNeighbours(actorZone);

  const ranked = [...candidates].sort((a, b) => {
    const distanceA = Math.abs(chebyshevDistance(a, opponentZone) - currentChebyshev);
    const distanceB = Math.abs(chebyshevDistance(b, opponentZone) - currentChebyshev);
    if (distanceA !== distanceB) return distanceA - distanceB;
    const dotA = tangentDotOf(a);
    const dotB = tangentDotOf(b);
    if (dotA !== dotB) return dotB - dotA;
    return neighbourOrder.indexOf(a) - neighbourOrder.indexOf(b);
  });
  return ranked[0] ?? null;
}

/**
 * Deterministic translated circling (Milestone 0.2C Phase 3C).
 *
 * - When the fighters share a cell, no lateral direction exists: the actor
 *   rotates in place (left for `circle_left`, right for `circle_right`).
 * - When a lateral candidate exists, the actor translates one orthogonal cell
 *   and faces toward the opponent from the destination (first step of the
 *   deterministic shortest path), preserving the previous facing only if no
 *   directional result can be determined.
 * - When no valid lateral candidate exists (blocked), the actor does not
 *   translate and rotates in place as before (Phase 3A fallback).
 */
export function resolveGridCircleMovement(
  actor: GridFighterState,
  opponent: GridFighterState,
  action: "circle_left" | "circle_right",
): GridCircleResult {
  const rotate =
    action === "circle_left" ? rotateLeft(actor.facing) : rotateRight(actor.facing);

  if (actor.zone === opponent.zone) {
    return { zone: actor.zone, facing: rotate, translated: false };
  }

  const candidate = chooseGridCircleCandidate(actor.zone, opponent.zone, action);
  if (candidate === null) {
    return { zone: actor.zone, facing: rotate, translated: false };
  }

  const facing = getFacingTowardGridZone(candidate, opponent.zone) ?? actor.facing;
  return { zone: candidate, facing, translated: true };
}

/** A planar armour zone that can constitute a flank objective. */
export type FlankTarget = "left" | "right" | "rear";

export function isFlankTarget(value: string): value is FlankTarget {
  return value === "left" || value === "right" || value === "rear";
}

/**
 * Desired flank target (Milestone 0.2C Phase 3C):
 *
 * 1. `primaryTarget` when it is `left`, `right` or `rear`;
 * 2. otherwise `secondaryTarget` when it is `left`, `right` or `rear`;
 * 3. otherwise `rear`.
 *
 * `front` and `top` never constitute a flank objective.
 */
export function resolveDesiredFlankTarget(policy: ActionPolicy): FlankTarget {
  if (isFlankTarget(policy.primaryTarget)) return policy.primaryTarget;
  if (isFlankTarget(policy.secondaryTarget)) return policy.secondaryTarget;
  return "rear";
}

/**
 * Deterministic tactical score for a grid flank position (Phase 3C). Based
 * only on the preview destination, opponent position/facing and the current
 * policy:
 *
 *   desired target exposed       +100
 *   secondary planar target      +20   (only when secondaryTarget is left/right/rear)
 *   rear armour exposed          +30
 *   either side armour exposed   +10
 *   translated lateral movement  +1
 *   resulting proximity equals preferredRange  +8
 *
 * Rear-diagonal bearings count as exposing rear; side-diagonal bearings count
 * as exposing the corresponding side. Top exposure is never invented by the
 * scorer. The scorer inspects no weapon damage, armour values, integrity,
 * component thresholds, random values or match results.
 */
export function scoreGridFlankPosition(
  actorZone: GridZone,
  opponentZone: GridZone,
  opponentFacing: Direction,
  policy: ActionPolicy,
  translated: boolean,
): number {
  const bearing = getRelativeBearing(actorZone, opponentZone, opponentFacing);
  const exposed = new Set(getPlanarExposedArmourZones(bearing));
  const desired = resolveDesiredFlankTarget(policy);

  let score = 0;
  if (exposed.has(desired)) score += 100;
  if (isFlankTarget(policy.secondaryTarget) && exposed.has(policy.secondaryTarget)) {
    score += 20;
  }
  if (exposed.has("rear")) score += 30;
  if (exposed.has("left") || exposed.has("right")) score += 10;
  if (translated) score += 1;
  if (getCombatProximity(actorZone, opponentZone) === policy.preferredRange) {
    score += 8;
  }
  return score;
}

function isDesiredTargetExposed(
  actorZone: GridZone,
  opponentZone: GridZone,
  opponentFacing: Direction,
  desired: FlankTarget,
): boolean {
  const bearing = getRelativeBearing(actorZone, opponentZone, opponentFacing);
  return getPlanarExposedArmourZones(bearing).includes(desired);
}

/**
 * Deterministic flank movement selection (Phase 3C). Consumes no randomness.
 *
 * For `opening: "flank"` after early-state rules:
 *
 * 1. combat proximity `far` → `advance`;
 * 2. same cell → `hold`;
 * 3. desired planar target already exposed → `hold`;
 * 4. otherwise preview both `circle_left` and `circle_right`;
 * 5. select the direction with the higher tactical score;
 * 6. exact tie → `circle_left`;
 * 7. neither direction translates or improves the tactical score → `hold`.
 */
export function chooseGridFlankMovement(
  state: GridFighterState,
  opponent: GridFighterState,
  policy: ActionPolicy,
): MovementAction {
  const proximity = getCombatProximity(state.zone, opponent.zone);
  if (proximity === "far") return "advance";
  if (state.zone === opponent.zone) return "hold";

  const desired = resolveDesiredFlankTarget(policy);
  if (isDesiredTargetExposed(state.zone, opponent.zone, opponent.facing, desired)) {
    return "hold";
  }

  const currentScore = scoreGridFlankPosition(
    state.zone,
    opponent.zone,
    opponent.facing,
    policy,
    false,
  );

  const leftPreview = resolveGridCircleMovement(state, opponent, "circle_left");
  const rightPreview = resolveGridCircleMovement(state, opponent, "circle_right");

  const leftScore = leftPreview.translated
    ? scoreGridFlankPosition(
        leftPreview.zone,
        opponent.zone,
        opponent.facing,
        policy,
        true,
      )
    : -Infinity;
  const rightScore = rightPreview.translated
    ? scoreGridFlankPosition(
        rightPreview.zone,
        opponent.zone,
        opponent.facing,
        policy,
        true,
      )
    : -Infinity;

  let best: "circle_left" | "circle_right" | null = null;
  if (leftScore > currentScore) best = "circle_left";
  if (rightScore > currentScore && rightScore > leftScore) best = "circle_right";
  return best ?? "hold";
}
