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
 * Phase 3E2, Phase 7).
 *
 * A valid grapple-reposition observation must come from the frozen grid
 * runtime's actual event contract:
 *
 *   - an authoritative successful `attack_hit` by the Grapple Coverage
 *     Attacker with weapon identity `grappler`;
 *   - a corresponding `movement_resolved` event whose action is `grapple`;
 *   - canonical fighter IDs (the attacker is the actor, the repositioned
 *     defender is the target/subject);
 *   - canonical `from` and `to` grid zones with `from !== to`;
 *   - canonical facing;
 *   - event round within the completed match and valid chronology;
 *   - the destination exactly agrees with the canonical grapple destination
 *     resolver `resolveGridGrapple(attackerZone, defenderZone)`;
 *   - the persisted v3 record, v2 report and replays remain mutually
 *     consistent (enforced by the execution core and bundle validator).
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
  /** `attack_hit` events with weapon `grappler` by the attacker. */
  readonly grapplerHits: number;
  /** `attack_missed` events with weapon `grappler` by the attacker. */
  readonly grapplerMisses: number;
  /** Valid `movement_resolved` grapple-reposition events (from != to, resolver agrees). */
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
  /** Grapple events with malformed zones/facing/from==to or resolver disagreement. */
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

/**
 * Pure extraction of the authoritative grapple evidence from a persisted
 * match-record v3. `attackerSlot` is the fighter slot holding the Grapple
 * Coverage Attacker for the run (derived from the run plan assignment).
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
  const state: GrappleTrackingState = {
    zoneA: record.initialState.fighterA.zone,
    zoneB: record.initialState.fighterB.zone,
    facingA: record.initialState.fighterA.facing,
    facingB: record.initialState.fighterB.facing,
  };

  const sourceZones = emptyZoneCounts();
  const destinationZones = emptyZoneCounts();
  const grappleRounds: number[] = [];

  let grapplerAttackAttempts = 0;
  let grapplerHits = 0;
  let grapplerMisses = 0;
  let grappleRepositionEvents = 0;
  let sameCellGrapplerHitsWithoutReposition = 0;
  let nonGrappleKnockbackEvents = 0;
  let overturnEvents = 0;
  let grappleEventsAttributedToWrongFighter = 0;
  let malformedOrResolverDisagreeingGrappleEvents = 0;

  const slotOf = (fighterId: string | undefined): GridFighterSlot | null => {
    if (fighterId === "fighter_a") return "fighter_a";
    if (fighterId === "fighter_b") return "fighter_b";
    return null;
  };

  const zoneOf = (slot: GridFighterSlot): GridZone =>
    slot === "fighter_a" ? state.zoneA : state.zoneB;

  const facingOf = (slot: GridFighterSlot): Direction =>
    slot === "fighter_a" ? state.facingA : state.facingB;

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
        const canonicalZones = isGridZone(data.from) && isGridZone(data.to);
        const canonicalFacing =
          typeof data.facing === "string" && CARDINAL_FACINGS.has(data.facing);
        const movedFighter = subject;
        const attackerFighter = actor;

        if (actor !== attackerSlot) {
          grappleEventsAttributedToWrongFighter += 1;
          continue;
        }
        if (
          attackerFighter === null ||
          movedFighter === attackerFighter ||
          !canonicalZones ||
          !canonicalFacing ||
          data.from === data.to
        ) {
          malformedOrResolverDisagreeingGrappleEvents += 1;
          continue;
        }
        const attackerZone = zoneOf(attackerFighter);
        const defenderZone = data.from as GridZone;
        if (data.facing !== facingOf(movedFighter)) {
          malformedOrResolverDisagreeingGrappleEvents += 1;
          continue;
        }
        const expected = resolveGridGrapple(attackerZone, defenderZone);
        if (expected === null || expected !== (data.to as GridZone)) {
          malformedOrResolverDisagreeingGrappleEvents += 1;
          continue;
        }
        grappleRepositionEvents += 1;
        sourceZones[defenderZone] += 1;
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
    } else if (event.type === "attack_attempted") {
      const data = event.data as { weapon?: unknown };
      if (data.weapon === "grappler" && slotOf(event.actorId) === attackerSlot) {
        grapplerAttackAttempts += 1;
      }
    } else if (event.type === "attack_hit") {
      const data = event.data as { weapon?: unknown };
      if (data.weapon === "grappler" && slotOf(event.actorId) === attackerSlot) {
        grapplerHits += 1;
        if (zoneOf(attackerSlot) === zoneOf(oppositeSlot(attackerSlot))) {
          sameCellGrapplerHitsWithoutReposition += 1;
        }
      }
    } else if (event.type === "attack_missed") {
      const data = event.data as { weapon?: unknown };
      if (data.weapon === "grappler" && slotOf(event.actorId) === attackerSlot) {
        grapplerMisses += 1;
      }
    } else if (event.type === "robot_overturned") {
      overturnEvents += 1;
    }
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

function oppositeSlot(slot: GridFighterSlot): GridFighterSlot {
  return slot === "fighter_a" ? "fighter_b" : "fighter_a";
}

export type { GridFighterState, GridMatchResult };
