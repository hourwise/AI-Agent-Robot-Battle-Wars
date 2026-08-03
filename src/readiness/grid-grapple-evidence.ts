import { isGridZone, type GridZone } from "../simulator/arena-grid.js";
import { resolveGridGrapple } from "../simulator/grid-runtime.js";
import {
  getMovementEventSubjectId,
  isMovementEventAction,
} from "../events/battle-event.js";
import type { MatchRecordV3 } from "../schemas/match-record.schema.js";
import type { Direction, GridFighterState, GridMatchResult } from "../simulator/types.js";

/**
 * Authoritative supplemental grapple-reposition evidence (Milestone 0.2C
 * Phase 3E2, Phase 7; causal binding hardened Phase 3E2.1).
 *
 * A valid grapple-reposition observation must come from the frozen grid
 * runtime's actual event contract AND be causally bound to a successful
 * Grappler attack:
 *
 *   - a canonical `attack_attempted` by the Grapple Coverage Attacker with
 *     weapon `grappler` in round `1..record.rounds` must have exactly one
 *     outcome (`attack_hit` or `attack_missed`) in the same round with the
 *     same actor, target and weapon;
 *   - a valid `movement_resolved(action="grapple")` must occur after an
 *     unmatched non-same-cell `attack_hit` in the same round, use the
 *     attacker as actor and the defender as target/subject, match the hit's
 *     actor/target/weapon, occur before `round_ended`, consume that hit (so no
 *     second grapple event can be associated with it), have canonical
 *     `from`/`to`/facing with `from !== to`, and require
 *     `data.from === tracked defender zone`, `data.facing === tracked defender
 *     facing` and `data.to === resolveGridGrapple(tracked attacker zone,
 *     tracked defender zone)`.
 *
 * The hidden 50% Grappler reposition roll is never inferred: a non-same-cell
 * hit without a movement event is allowed (the roll may have failed). A
 * same-cell hit increments `sameCellGrapplerHitsWithoutReposition`, must not
 * have a grapple movement and can never count as reposition coverage. A
 * malformed or unmatched grapple event never increments valid coverage counts
 * and always contributes to the hard-failure isolation diagnostics.
 *
 * The extractor is pure and fails closed on malformed facts. It never counts:
 * an attack attempt without a hit, a same-cell grappler hit (no reposition
 * can occur), ordinary movement, knockback, malformed actor/target semantics
 * or a report-only statement.
 */
export class GridGrappleCoverageEvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GridGrappleCoverageEvidenceError";
  }
}

export type GridFighterSlot = "fighter_a" | "fighter_b";

const ORDINARY_MOVEMENT_ACTIONS: ReadonlySet<string> = new Set<string>([
  "advance",
  "retreat",
  "circle_left",
  "circle_right",
  "hold",
]);

const CARDINAL_FACINGS: ReadonlySet<string> = new Set<string>([
  "north",
  "east",
  "south",
  "west",
]);

export interface GridGrappleRunEvidence {
  /** `attack_attempted` events with weapon `grappler` by the attacker. */
  readonly grapplerAttackAttempts: number;
  /** Valid `attack_hit` outcomes for a matched grappler attempt. */
  readonly grapplerHits: number;
  /** Valid `attack_missed` outcomes for a matched grappler attempt. */
  readonly grapplerMisses: number;
  /** Valid causally-bound `movement_resolved` grapple-reposition events. */
  readonly grappleRepositionEvents: number;
  /** Grappler hits where both fighters already occupied the same cell. */
  readonly sameCellGrapplerHitsWithoutReposition: number;
  readonly grappleSourceZones: Readonly<Record<GridZone, number>>;
  readonly grappleDestinationZones: Readonly<Record<GridZone, number>>;
  readonly grappleRounds: readonly number[];
  /** `movement_resolved` knockback events (non-grapple reposition). */
  readonly nonGrappleKnockbackEvents: number;
  /** `robot_overturned` events. */
  readonly overturnEvents: number;
  /** Grapple reposition events whose actor is not the attacker slot. */
  readonly grappleEventsAttributedToWrongFighter: number;
  /**
   * Malformed grapple/attack-ledger events: outcome without attempt, duplicate
   * outcome, hit and miss for the same attempt, attempt without outcome,
   * noncanonical actor/target, outcome after `round_ended`, grapple movement
   * without a preceding hit, a second grapple for one hit, a grapple movement
   * on a same-cell hit, noncanonical zones/facing, `from === to`, a `from`
   * that does not equal the tracked defender snapshot, a facing that does not
   * equal the tracked defender facing, or a destination that disagrees with
   * the canonical resolver.
   */
  readonly malformedOrResolverDisagreeingGrappleEvents: number;
}

function emptyZoneCounts(): Record<GridZone, number> {
  return {
    north_west: 0,
    north: 0,
    north_east: 0,
    west: 0,
    center: 0,
    east: 0,
    south_west: 0,
    south: 0,
    south_east: 0,
  };
}

interface GrappleTrackingState {
  zoneA: GridZone;
  zoneB: GridZone;
  facingA: Direction;
  facingB: Direction;
}

interface GrappleAttackAttempt {
  round: number;
  actor: GridFighterSlot;
  target: GridFighterSlot;
  weapon: "grappler";
  outcome: null | "hit" | "miss";
}

interface UnconsumedHit {
  round: number;
  actor: GridFighterSlot;
  target: GridFighterSlot;
  sameCell: boolean;
}

/**
 * Pure extraction of the authoritative grapple evidence from a persisted
 * match-record v3. `attackerSlot` is the fighter slot holding the Grapple
 * Coverage Attacker for the run (derived from the canonical run plan).
 *
 * The tracker applies only ordinary `movement_resolved` events to the
 * reconstructed positions. Grapple/knockback reposition events derive their
 * `from`/`to` from the shared post-movement snapshot, so they are validated
 * against the tracked snapshot zones but never applied to the tracker (the
 * authoritative round-end zones resynchronise the tracker at each
 * `round_ended`). This reproduces the frozen grid runtime's shared-snapshot
 * semantics exactly.
 */
export function extractGridGrappleRunEvidence(
  record: MatchRecordV3,
  attackerSlot: GridFighterSlot,
): GridGrappleRunEvidence {
  const defenderSlot: GridFighterSlot =
    attackerSlot === "fighter_a" ? "fighter_b" : "fighter_a";
  const state: GrappleTrackingState = {
    zoneA: record.initialState.fighterA.zone,
    zoneB: record.initialState.fighterB.zone,
    facingA: record.initialState.fighterA.facing,
    facingB: record.initialState.fighterB.facing,
  };

  const sourceZones = emptyZoneCounts();
  const destinationZones = emptyZoneCounts();
  const grappleRounds: number[] = [];

  const attempts = new Map<string, GrappleAttackAttempt>();
  const unconsumedHits: UnconsumedHit[] = [];
  const closedRounds = new Set<number>();

  let grapplerAttackAttempts = 0;
  let grapplerHits = 0;
  let grapplerMisses = 0;
  let grappleRepositionEvents = 0;
  let sameCellGrapplerHitsWithoutReposition = 0;
  let nonGrappleKnockbackEvents = 0;
  let overturnEvents = 0;
  let grappleEventsAttributedToWrongFighter = 0;
  let malformedOrResolverDisagreeingGrappleEvents = 0;

  const markMalformed = (): void => {
    malformedOrResolverDisagreeingGrappleEvents += 1;
  };

  const slotOf = (fighterId: string | undefined): GridFighterSlot | null => {
    if (fighterId === "fighter_a") return "fighter_a";
    if (fighterId === "fighter_b") return "fighter_b";
    return null;
  };

  const zoneOf = (slot: GridFighterSlot): GridZone =>
    slot === "fighter_a" ? state.zoneA : state.zoneB;

  const facingOf = (slot: GridFighterSlot): Direction =>
    slot === "fighter_a" ? state.facingA : state.facingB;

  const attemptKey = (
    round: number,
    actor: GridFighterSlot,
    target: GridFighterSlot,
  ): string => `${round}|${actor}|${target}`;

  const resolveAttemptOutcome = (
    round: number,
    actor: GridFighterSlot | null,
    target: GridFighterSlot | null,
    weapon: unknown,
    outcome: "hit" | "miss",
  ): { attempt: GrappleAttackAttempt | null; malformed: boolean } => {
    if (weapon !== "grappler") return { attempt: null, malformed: false };
    if (actor === null || target === null) {
      markMalformed();
      return { attempt: null, malformed: true };
    }
    if (actor !== attackerSlot) {
      markMalformed();
      return { attempt: null, malformed: true };
    }
    if (target !== defenderSlot) {
      markMalformed();
      return { attempt: null, malformed: true };
    }
    if (closedRounds.has(round)) {
      markMalformed();
      return { attempt: null, malformed: true };
    }
    const key = attemptKey(round, actor, target);
    const attempt = attempts.get(key);
    if (!attempt) {
      markMalformed();
      return { attempt: null, malformed: true };
    }
    if (attempt.outcome !== null) {
      markMalformed();
      return { attempt, malformed: true };
    }
    attempt.outcome = outcome;
    return { attempt, malformed: false };
  };

  const closeRound = (round: number): void => {
    closedRounds.add(round);
    for (const attempt of attempts.values()) {
      if (attempt.round === round && attempt.outcome === null) {
        markMalformed();
        attempt.outcome = "miss";
      }
    }
    // Unconsumed hits in the round are either same-cell hits (already counted)
    // or non-same-cell hits whose hidden 50% reposition roll failed; neither
    // can be consumed by a later round's grapple event.
    for (let i = unconsumedHits.length - 1; i >= 0; i--) {
      if (unconsumedHits[i]!.round === round) unconsumedHits.splice(i, 1);
    }
  };

  for (const event of record.events) {
    if (event.type === "movement_resolved") {
      const data = event.data as {
        from?: unknown;
        to?: unknown;
        facing?: unknown;
        action?: unknown;
      };
      if (!isMovementEventAction(data.action)) {
        // Malformed action facts fail closed in the shared record-evidence
        // inspector before the supplement core reaches this point.
        continue;
      }
      const action = data.action;
      const subject = getMovementEventSubjectId(event);
      if (subject !== "fighter_a" && subject !== "fighter_b") {
        // Malformed actor/target semantics (also rejected by the shared
        // inspector) are never counted as a reposition.
        continue;
      }

      if (action === "grapple") {
        const actor = slotOf(event.actorId);
        const target = slotOf(event.targetId);
        if (actor !== attackerSlot) {
          grappleEventsAttributedToWrongFighter += 1;
          continue;
        }
        // A grapple movement must be causally bound to an unmatched
        // non-same-cell grappler hit in the same round.
        const hitIndex = unconsumedHits.findIndex(
          (h) =>
            h.round === event.round &&
            h.actor === attackerSlot &&
            h.target === defenderSlot,
        );
        if (hitIndex === -1) {
          markMalformed();
          continue;
        }
        const hit = unconsumedHits[hitIndex]!;
        unconsumedHits.splice(hitIndex, 1);
        if (hit.sameCell) {
          // A same-cell hit must never have a grapple movement.
          markMalformed();
          continue;
        }
        const canonicalZones = isGridZone(data.from) && isGridZone(data.to);
        const canonicalFacing =
          typeof data.facing === "string" && CARDINAL_FACINGS.has(data.facing);
        if (
          target !== defenderSlot ||
          subject !== defenderSlot ||
          !canonicalZones ||
          !canonicalFacing ||
          data.from === data.to
        ) {
          markMalformed();
          continue;
        }
        if (data.from !== zoneOf(defenderSlot)) {
          markMalformed();
          continue;
        }
        if (data.facing !== facingOf(defenderSlot)) {
          markMalformed();
          continue;
        }
        const expected = resolveGridGrapple(zoneOf(attackerSlot), zoneOf(defenderSlot));
        if (expected === null || expected !== (data.to as GridZone)) {
          markMalformed();
          continue;
        }
        grappleRepositionEvents += 1;
        sourceZones[data.from as GridZone] += 1;
        destinationZones[data.to as GridZone] += 1;
        grappleRounds.push(event.round);
        continue;
      }

      if (action === "knockback") {
        nonGrappleKnockbackEvents += 1;
        continue;
      }

      // Ordinary movement: update the reconstructed position.
      if (ORDINARY_MOVEMENT_ACTIONS.has(action) && isGridZone(data.to)) {
        if (subject === "fighter_a") {
          state.zoneA = data.to as GridZone;
          if (typeof data.facing === "string" && CARDINAL_FACINGS.has(data.facing)) {
            state.facingA = data.facing as Direction;
          }
        } else {
          state.zoneB = data.to as GridZone;
          if (typeof data.facing === "string" && CARDINAL_FACINGS.has(data.facing)) {
            state.facingB = data.facing as Direction;
          }
        }
      }
    } else if (event.type === "round_ended") {
      const data = event.data as {
        fighterA: { zone: string };
        fighterB: { zone: string };
      };
      if (isGridZone(data.fighterA.zone) && isGridZone(data.fighterB.zone)) {
        state.zoneA = data.fighterA.zone;
        state.zoneB = data.fighterB.zone;
      }
      closeRound(event.round);
    } else if (event.type === "attack_attempted") {
      const data = event.data as { weapon?: unknown };
      const actor = slotOf(event.actorId);
      const target = slotOf(event.targetId);
      if (data.weapon !== "grappler") continue;
      if (actor === null || target === null) {
        markMalformed();
        continue;
      }
      if (actor !== attackerSlot) {
        markMalformed();
        continue;
      }
      grapplerAttackAttempts += 1;
      if (target !== defenderSlot) {
        markMalformed();
        continue;
      }
      if (event.round < 1 || event.round > record.rounds) {
        markMalformed();
        continue;
      }
      const key = attemptKey(event.round, attackerSlot, defenderSlot);
      if (attempts.has(key)) {
        markMalformed();
        continue;
      }
      attempts.set(key, {
        round: event.round,
        actor: attackerSlot,
        target: defenderSlot,
        weapon: "grappler",
        outcome: null,
      });
    } else if (event.type === "attack_hit") {
      const data = event.data as { weapon?: unknown };
      const resolved = resolveAttemptOutcome(
        event.round,
        slotOf(event.actorId),
        slotOf(event.targetId),
        data.weapon,
        "hit",
      );
      if (resolved.malformed) continue;
      if (resolved.attempt === null) continue;
      grapplerHits += 1;
      const sameCell = zoneOf(attackerSlot) === zoneOf(defenderSlot);
      if (sameCell) sameCellGrapplerHitsWithoutReposition += 1;
      unconsumedHits.push({
        round: event.round,
        actor: attackerSlot,
        target: defenderSlot,
        sameCell,
      });
    } else if (event.type === "attack_missed") {
      const data = event.data as { weapon?: unknown };
      const resolved = resolveAttemptOutcome(
        event.round,
        slotOf(event.actorId),
        slotOf(event.targetId),
        data.weapon,
        "miss",
      );
      if (resolved.malformed) continue;
      if (resolved.attempt === null) continue;
      grapplerMisses += 1;
    } else if (event.type === "robot_overturned") {
      overturnEvents += 1;
    }
  }

  // Any pending attempt without an outcome at record end is malformed.
  for (const attempt of attempts.values()) {
    if (attempt.outcome === null) {
      markMalformed();
      attempt.outcome = "miss";
    }
  }
  // The causal ledger invariant: every attempt has exactly one outcome.
  if (grapplerAttackAttempts !== grapplerHits + grapplerMisses) {
    markMalformed();
  }

  return {
    grapplerAttackAttempts,
    grapplerHits,
    grapplerMisses,
    grappleRepositionEvents,
    sameCellGrapplerHitsWithoutReposition,
    grappleSourceZones: sourceZones,
    grappleDestinationZones: destinationZones,
    grappleRounds: Object.freeze(grappleRounds),
    nonGrappleKnockbackEvents,
    overturnEvents,
    grappleEventsAttributedToWrongFighter,
    malformedOrResolverDisagreeingGrappleEvents,
  };
}

export type { GridFighterState, GridMatchResult };
