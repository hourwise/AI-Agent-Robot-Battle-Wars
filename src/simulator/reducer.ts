import type {
  FighterState,
  ZoneFighterState,
  GridZone,
  RoundAction,
  SimulationEvent,
  ArenaZone,
  Condition,
  ActionPolicy,
  MovementAction,
  PrimaryTarget,
  SecondaryTarget,
  Direction,
} from "./types.js";
import type { SeededRandom } from "./seeded-random.js";
import { resolveMovement } from "./movement.js";
import { calculateAttack, type AttackResult } from "./damage.js";
import {
  STARTING_ENERGY,
  MAX_HEAT,
  ENERGY_REGEN_PER_ROUND,
  HEAT_DISSIPATION_PER_ROUND,
  ATTACK_ENERGY_COST,
  ATTACK_HEAT_GAIN,
  OVERHEAT_RECOVERY_AMOUNT,
  BASE_HIT_CHANCE,
} from "./constants.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";
import {
  getEffectiveCoolingBonus,
  selectQualifiedComponentForTransition,
  transitionComponentState,
  applyTransition,
  deriveBinaryComponents,
  calculateComponentImpact,
  checkComponentQualification,
} from "./component-state.js";
import {
  getDefaultComponentQualificationConfig,
  resolveArmourBand,
  type ComponentQualificationConfig,
} from "./component-qualification-registry.js";

function getComponentQualificationFacts(
  attack: AttackResult,
  config: ComponentQualificationConfig,
) {
  const impact = calculateComponentImpact(
    {
      rawDamage: attack.rawDamage,
      armourAtHitZone: attack.armourAtHitZone,
    },
    config,
  );
  const band =
    config.model === "armour-band-component-impact"
      ? resolveArmourBand(config, attack.armourAtHitZone)
      : undefined;
  return {
    ...impact,
    integrityEffectiveDamage: attack.effectiveDamage,
    qualification: checkComponentQualification(
      attack.isCritical,
      impact.componentImpact,
      config,
      band,
    ),
  };
}

function getWeaponCooldown(weaponId: string): number {
  const weapon = CATALOGUE_V1.weapons.find((w) => w.id === weaponId);
  return weapon?.cooldown ?? 0;
}

export interface RoundState<Z extends ArenaZone | GridZone = ArenaZone> {
  fighterA: ZoneFighterState<Z>;
  fighterB: ZoneFighterState<Z>;
  events: SimulationEvent[];
  damageDealt: { a: number; b: number };
  roundsAttacked: { a: number; b: number };
}

/**
 * The positioning surface the shared round core depends on. The legacy
 * adapter implements the five-zone semantics; the grid adapter implements the
 * frozen 3×3 semantics. Shared combat, component and energy/heat logic is
 * therefore written once and never drifts between runtimes.
 */
export interface PositioningAdapter<Z extends ArenaZone | GridZone> {
  /**
   * Resolve one fighter's movement from the shared start-of-round state.
   * Both fighters are passed so opponent-relative grid movement stays
   * deterministic and free of fighter-A ordering advantage.
   */
  resolveMovement(
    state: ZoneFighterState<Z>,
    opponent: ZoneFighterState<Z>,
    action: MovementAction,
  ): { zone: Z; facing: Direction; translated: boolean };
  computeDistance(zoneA: Z, zoneB: Z): "close" | "medium" | "far";
  computeAttack(
    attacker: ZoneFighterState<Z>,
    defender: ZoneFighterState<Z>,
    hitChance: number,
    momentum: number,
    rng: SeededRandom,
    primaryTarget?: PrimaryTarget,
    secondaryTarget?: SecondaryTarget,
  ): AttackResult;
  resolveKnockback(attackerZone: Z, attackerFacing: Direction, defenderZone: Z): Z | null;
  resolveGrapple(attackerZone: Z, defenderZone: Z): Z | null;
  /** Grid enables target-relative grapple repositioning; legacy does not. */
  enableGrappleRepositioning: boolean;
  /**
   * When true, both fighters' knockback/grapple destinations are planned from
   * the same post-movement snapshot (simultaneous semantics, Phase 3B). When
   * false, the historical sequential-origin behaviour is preserved: fighter
   * B's plan is computed from the state after fighter A's plan was applied.
   * The grid adapter enables this; the legacy adapter must not change its
   * historical positional-effect behaviour.
   */
  planFromSharedSnapshot: boolean;
  momentumFor(action: MovementAction, translated: boolean): number;
}

/**
 * A planned positional effect (knockback or grapple) derived from a weapon's
 * existing attack-result facts — no extra RNG is consumed. Grid combat freezes
 * that both fighters' destinations are calculated from the common
 * post-movement positioning snapshot (Phase 3B); `from` is that snapshot
 * origin, and no event is emitted when the planned destination equals the
 * origin.
 */
export interface PlannedReposition<Z extends ArenaZone | GridZone> {
  targetId: string;
  from: Z;
  to: Z;
  facing: Direction;
  action: "knockback" | "grapple";
}

function planReposition<Z extends ArenaZone | GridZone>(
  attack: AttackResult | null,
  attacker: ZoneFighterState<Z>,
  defender: ZoneFighterState<Z>,
  positioning: PositioningAdapter<Z>,
  targetId: string,
): PlannedReposition<Z> | null {
  if (attack === null || !attack.hit) return null;
  let to: Z | null = null;
  let action: "knockback" | "grapple" = "knockback";
  if (attack.knockback) {
    to = positioning.resolveKnockback(attacker.zone, attacker.facing, defender.zone);
  } else if (positioning.enableGrappleRepositioning && attack.grappleReposition) {
    to = positioning.resolveGrapple(attacker.zone, defender.zone);
    action = "grapple";
  }
  if (to === null || to === defender.zone) return null;
  return {
    targetId,
    from: defender.zone,
    to,
    facing: defender.facing,
    action,
  };
}

const LEGACY_POSITIONING_ADAPTER: PositioningAdapter<ArenaZone> = {
  resolveMovement(state, _opponent, action) {
    const resolved = resolveMovement(state as FighterState, action);
    return {
      ...resolved,
      translated: resolved.zone !== state.zone,
    };
  },
  computeDistance: (zoneA, zoneB) => getDistance(zoneA, zoneB),
  computeAttack: (attacker, defender, hitChance, momentum, rng, primary, secondary) =>
    calculateAttack(
      attacker as FighterState,
      defender as FighterState,
      hitChance,
      momentum,
      rng,
      primary,
      secondary,
    ),
  resolveKnockback: (attackerZone, _attackerFacing, defenderZone) =>
    getKnockbackZone(attackerZone, defenderZone),
  resolveGrapple: () => null,
  enableGrappleRepositioning: false,
  planFromSharedSnapshot: false,
  momentumFor: (action) => (action === "advance" ? 1 : 0),
};

export function applyRound(
  state: RoundState,
  actions: { fighterA: RoundAction; fighterB: RoundAction },
  rng: SeededRandom,
  round: number,
  timestampMs: number,
  policyA?: ActionPolicy,
  policyB?: ActionPolicy,
  qualificationConfig: ComponentQualificationConfig = getDefaultComponentQualificationConfig(),
): RoundState {
  return applyRoundForZone(
    state,
    actions,
    rng,
    round,
    timestampMs,
    policyA,
    policyB,
    qualificationConfig,
    LEGACY_POSITIONING_ADAPTER,
  );
}

/**
 * Shared deterministic round core parameterised by the positioning adapter.
 * The legacy adapter reproduces the historical five-zone semantics exactly;
 * the grid adapter freezes the 3×3 semantics. All non-positioning logic
 * (recovery, cooldowns, energy/heat, attacks, component lifecycle, events) is
 * shared.
 */
export function applyRoundForZone<Z extends ArenaZone | GridZone>(
  state: RoundState<Z>,
  actions: { fighterA: RoundAction; fighterB: RoundAction },
  rng: SeededRandom,
  round: number,
  timestampMs: number,
  policyA: ActionPolicy | undefined,
  policyB: ActionPolicy | undefined,
  qualificationConfig: ComponentQualificationConfig,
  positioning: PositioningAdapter<Z>,
): RoundState<Z> {
  let a = { ...state.fighterA };
  let b = { ...state.fighterB };
  const events: SimulationEvent[] = [];
  let seq = state.events.length;

  const emit = (
    type: string,
    actorId?: string,
    targetId?: string,
    data: Record<string, unknown> = {},
    schemaVersion = "2",
  ): SimulationEvent => {
    const event: SimulationEvent = {
      schemaVersion,
      sequence: seq++,
      round,
      timestampMs: timestampMs + seq,
      type,
      actorId,
      targetId,
      data,
    };
    events.push(event);
    return event;
  };

  if (a.conditions.includes("overheated")) {
    a = { ...a, conditions: a.conditions.filter((c) => c !== "overheated") };
    a = { ...a, heat: Math.max(0, a.heat - OVERHEAT_RECOVERY_AMOUNT) };
    emit("robot_recovered", a.fighterId, undefined, {
      heatAfterRecovery: a.heat,
    });
  }
  if (b.conditions.includes("overheated")) {
    b = { ...b, conditions: b.conditions.filter((c) => c !== "overheated") };
    b = { ...b, heat: Math.max(0, b.heat - OVERHEAT_RECOVERY_AMOUNT) };
    emit("robot_recovered", b.fighterId, undefined, {
      heatAfterRecovery: b.heat,
    });
  }

  const resolvedA = positioning.resolveMovement(a, b, actions.fighterA.movement);
  const resolvedB = positioning.resolveMovement(b, a, actions.fighterB.movement);

  if (resolvedA.zone !== a.zone || resolvedA.facing !== a.facing) {
    emit("movement_resolved", a.fighterId, undefined, {
      from: a.zone,
      to: resolvedA.zone,
      facing: resolvedA.facing,
      action: actions.fighterA.movement,
    });
    a = { ...a, zone: resolvedA.zone, facing: resolvedA.facing };
  }

  if (resolvedB.zone !== b.zone || resolvedB.facing !== b.facing) {
    emit("movement_resolved", b.fighterId, undefined, {
      from: b.zone,
      to: resolvedB.zone,
      facing: resolvedB.facing,
      action: actions.fighterB.movement,
    });
    b = { ...b, zone: resolvedB.zone, facing: resolvedB.facing };
  }

  const momentumA = positioning.momentumFor(
    actions.fighterA.movement,
    resolvedA.translated,
  );
  const momentumB = positioning.momentumFor(
    actions.fighterB.movement,
    resolvedB.translated,
  );

  const attackA =
    actions.fighterA.combat === "attack" &&
    a.comps.weapon.state !== "disabled" &&
    a.weaponCooldown <= 0;
  const attackB =
    actions.fighterB.combat === "attack" &&
    b.comps.weapon.state !== "disabled" &&
    b.weaponCooldown <= 0;

  const attackResultA = attackA
    ? positioning.computeAttack(
        a,
        b,
        computeHitChance(a, b, positioning),
        momentumA,
        rng,
        policyA?.primaryTarget,
        policyA?.secondaryTarget,
      )
    : null;
  const attackResultB = attackB
    ? positioning.computeAttack(
        b,
        a,
        computeHitChance(b, a, positioning),
        momentumB,
        rng,
        policyB?.primaryTarget,
        policyB?.secondaryTarget,
      )
    : null;

  // Simultaneous positional-effect planning (Phase 3B). Both attacks and
  // their hit/exposure facts were calculated from the same post-movement
  // state above; the same shared snapshot is now the origin for both fighters'
  // planned knockback/grapple destinations. Fighter A's applied movement (and
  // later, its applied repositioning) never becomes fighter B's calculation
  // origin. Destinations are then applied with the stable A-then-B event
  // ordering; both may be applied and same-cell occupancy remains legal. The
  // legacy adapter keeps its historical sequential-origin behaviour.
  const snapshotA = a;
  const snapshotB = b;

  const planA = planReposition(
    attackResultA,
    snapshotA,
    snapshotB,
    positioning,
    b.fighterId,
  );

  const bAfterPlanA = planA ? { ...b, zone: planA.to } : b;
  const planB = positioning.planFromSharedSnapshot
    ? planReposition(attackResultB, snapshotB, snapshotA, positioning, a.fighterId)
    : planReposition(attackResultB, bAfterPlanA, a, positioning, a.fighterId);

  let damageAtoB = 0;
  let damageBtoA = 0;

  if (attackResultA) {
    a = {
      ...a,
      energy: a.energy - ATTACK_ENERGY_COST,
      heat: a.heat + ATTACK_HEAT_GAIN,
      weaponCooldown: getWeaponCooldown(a.build.proposal.weaponId),
    };
    emit("attack_attempted", a.fighterId, b.fighterId, {
      weapon: a.build.proposal.weaponId,
      momentum: momentumA,
    });

    if (!attackResultA.hit) {
      emit("attack_missed", a.fighterId, b.fighterId, {
        weapon: a.build.proposal.weaponId,
      });
    } else {
      const facts = getComponentQualificationFacts(attackResultA, qualificationConfig);
      emit("attack_hit", a.fighterId, b.fighterId, {
        weapon: a.build.proposal.weaponId,
        hitZone: attackResultA.hitZone,
        rawDamage: attackResultA.rawDamage,
        effectiveDamage: attackResultA.effectiveDamage,
        integrityEffectiveDamage: attackResultA.effectiveDamage,
        armourAtHitZone: attackResultA.armourAtHitZone,
        componentImpact: facts.componentImpact,
        componentQualificationId: facts.qualification.qualificationId,
        componentQualificationConfigChecksum:
          facts.qualification.qualificationConfigChecksum,
        componentQualificationChecksum:
          facts.qualification.qualificationModel === "armour-band-component-impact"
            ? facts.qualification.qualificationConfigChecksum
            : undefined,
        componentQualificationModel: facts.qualification.qualificationModel,
        criticalComponentImpactThreshold: facts.qualification.criticalThreshold,
        highComponentImpactThreshold: facts.qualification.highImpactThreshold,
        componentArmourFactor: facts.armourFactor,
        componentMinimumImpact: facts.minimumImpact,
        qualificationReason: facts.qualification.reason,
        componentArmourBandId: facts.qualification.bandId,
        componentArmourBandMinInclusive: facts.qualification.bandMinArmourInclusive,
        componentArmourBandMaxInclusive: facts.qualification.bandMaxArmourInclusive,
        isCritical: attackResultA.isCritical,
      });

      damageAtoB = attackResultA.effectiveDamage;

      b = { ...b, integrity: Math.max(0, b.integrity - attackResultA.effectiveDamage) };
      emit("integrity_damaged", a.fighterId, b.fighterId, {
        damage: attackResultA.effectiveDamage,
        remaining: b.integrity,
      });

      if (attackResultA.overturnSuccess && !b.conditions.includes("overturned")) {
        b = { ...b, conditions: [...b.conditions, "overturned" as Condition] };
        emit("robot_overturned", a.fighterId, b.fighterId, {});
      }

      if (planA) {
        b = { ...b, zone: planA.to };
        emit("movement_resolved", a.fighterId, b.fighterId, {
          from: planA.from,
          to: planA.to,
          facing: planA.facing,
          action: planA.action,
        });
      }

      // 0.2B: qualification-based component lifecycle
      const component = selectQualifiedComponentForTransition(
        facts.qualification,
        b.comps,
        attackResultA.hitZone,
        rng,
      );
      if (component) {
        const transition = transitionComponentState(
          b.comps,
          component,
          facts.qualification,
        );
        if (transition.transitionOccurred) {
          b = {
            ...b,
            comps: applyTransition(b.comps, transition),
          };
          b = { ...b, components: deriveBinaryComponents(b.comps) };

          if (transition.reason === "reinforced_drive" && transition.guardStateBefore) {
            const resistData: Record<string, unknown> = {
              component: "mobility",
              previousState: "healthy",
              newState: "healthy",
              sourceAttack: {
                weapon: a.build.proposal.weaponId,
                isCritical: attackResultA.isCritical,
              },
              effectiveDamage: attackResultA.effectiveDamage,
              integrityEffectiveDamage: facts.integrityEffectiveDamage,
              rawDamage: facts.rawDamage,
              armourAtHitZone: facts.armourAtHitZone,
              componentImpact: facts.componentImpact,
              componentQualificationId: facts.qualification.qualificationId,
              componentQualificationConfigChecksum:
                facts.qualification.qualificationConfigChecksum,
              componentQualificationChecksum:
                facts.qualification.qualificationModel === "armour-band-component-impact"
                  ? facts.qualification.qualificationConfigChecksum
                  : undefined,
              componentQualificationModel: facts.qualification.qualificationModel,
              componentArmourFactor: facts.armourFactor,
              componentMinimumImpact: facts.minimumImpact,
              criticalComponentImpactThreshold: facts.qualification.criticalThreshold,
              highComponentImpactThreshold: facts.qualification.highImpactThreshold,
              qualificationReason: facts.qualification.reason,
              componentArmourBandId: facts.qualification.bandId,
              componentArmourBandMinInclusive: facts.qualification.bandMinArmourInclusive,
              componentArmourBandMaxInclusive: facts.qualification.bandMaxArmourInclusive,
              hitZone: attackResultA.hitZone,
              reason: "reinforced_drive",
              guardStateBefore: transition.guardStateBefore,
              guardStateAfter: transition.guardStateAfter,
            };
            if (transition.utilityRuntimeChange) {
              resistData.utilityRuntimeChange = transition.utilityRuntimeChange;
            }
            emit("component_damage_resisted", a.fighterId, b.fighterId, resistData);
          } else if (transition.newState === "damaged") {
            const eventData: Record<string, unknown> = {
              component,
              previousState: transition.previousState,
              newState: transition.newState,
              sourceAttack: {
                weapon: a.build.proposal.weaponId,
                isCritical: attackResultA.isCritical,
              },
              effectiveDamage: attackResultA.effectiveDamage,
              integrityEffectiveDamage: facts.integrityEffectiveDamage,
              rawDamage: facts.rawDamage,
              armourAtHitZone: facts.armourAtHitZone,
              componentImpact: facts.componentImpact,
              componentQualificationId: facts.qualification.qualificationId,
              componentQualificationConfigChecksum:
                facts.qualification.qualificationConfigChecksum,
              componentQualificationChecksum:
                facts.qualification.qualificationModel === "armour-band-component-impact"
                  ? facts.qualification.qualificationConfigChecksum
                  : undefined,
              componentQualificationModel: facts.qualification.qualificationModel,
              componentArmourFactor: facts.armourFactor,
              componentMinimumImpact: facts.minimumImpact,
              criticalComponentImpactThreshold: facts.qualification.criticalThreshold,
              highComponentImpactThreshold: facts.qualification.highImpactThreshold,
              qualificationReason: facts.qualification.reason,
              componentArmourBandId: facts.qualification.bandId,
              componentArmourBandMinInclusive: facts.qualification.bandMinArmourInclusive,
              componentArmourBandMaxInclusive: facts.qualification.bandMaxArmourInclusive,
              hitZone: attackResultA.hitZone,
              reason: transition.reason,
            };
            if (transition.utilityRuntimeChange) {
              eventData.utilityRuntimeChange = transition.utilityRuntimeChange;
            }
            emit("component_damaged", a.fighterId, b.fighterId, eventData);
          } else if (transition.newState === "disabled") {
            const eventData: Record<string, unknown> = {
              component,
              previousState: transition.previousState,
              newState: transition.newState,
              sourceAttack: {
                weapon: a.build.proposal.weaponId,
                isCritical: attackResultA.isCritical,
              },
              effectiveDamage: attackResultA.effectiveDamage,
              integrityEffectiveDamage: facts.integrityEffectiveDamage,
              rawDamage: facts.rawDamage,
              armourAtHitZone: facts.armourAtHitZone,
              componentImpact: facts.componentImpact,
              componentQualificationId: facts.qualification.qualificationId,
              componentQualificationConfigChecksum:
                facts.qualification.qualificationConfigChecksum,
              componentQualificationChecksum:
                facts.qualification.qualificationModel === "armour-band-component-impact"
                  ? facts.qualification.qualificationConfigChecksum
                  : undefined,
              componentQualificationModel: facts.qualification.qualificationModel,
              componentArmourFactor: facts.armourFactor,
              componentMinimumImpact: facts.minimumImpact,
              criticalComponentImpactThreshold: facts.qualification.criticalThreshold,
              highComponentImpactThreshold: facts.qualification.highImpactThreshold,
              qualificationReason: facts.qualification.reason,
              componentArmourBandId: facts.qualification.bandId,
              componentArmourBandMinInclusive: facts.qualification.bandMinArmourInclusive,
              componentArmourBandMaxInclusive: facts.qualification.bandMaxArmourInclusive,
              hitZone: attackResultA.hitZone,
              reason: transition.reason,
            };
            if (transition.utilityRuntimeChange) {
              eventData.utilityRuntimeChange = transition.utilityRuntimeChange;
            }
            emit("component_disabled", a.fighterId, b.fighterId, eventData);
          }

          if (component === "mobility" && b.comps.mobility.state === "disabled") {
            if (!b.conditions.includes("immobilised")) {
              b = {
                ...b,
                conditions: [...b.conditions, "immobilised" as Condition],
              };
            }
          }
        }
      }
    }
  }

  if (attackResultB) {
    b = {
      ...b,
      energy: b.energy - ATTACK_ENERGY_COST,
      heat: b.heat + ATTACK_HEAT_GAIN,
      weaponCooldown: getWeaponCooldown(b.build.proposal.weaponId),
    };
    emit("attack_attempted", b.fighterId, a.fighterId, {
      weapon: b.build.proposal.weaponId,
      momentum: momentumB,
    });

    if (!attackResultB.hit) {
      emit("attack_missed", b.fighterId, a.fighterId, {
        weapon: b.build.proposal.weaponId,
      });
    } else {
      const facts = getComponentQualificationFacts(attackResultB, qualificationConfig);
      emit("attack_hit", b.fighterId, a.fighterId, {
        weapon: b.build.proposal.weaponId,
        hitZone: attackResultB.hitZone,
        rawDamage: attackResultB.rawDamage,
        effectiveDamage: attackResultB.effectiveDamage,
        integrityEffectiveDamage: attackResultB.effectiveDamage,
        armourAtHitZone: attackResultB.armourAtHitZone,
        componentImpact: facts.componentImpact,
        componentQualificationId: facts.qualification.qualificationId,
        componentQualificationConfigChecksum:
          facts.qualification.qualificationConfigChecksum,
        componentQualificationChecksum:
          facts.qualification.qualificationModel === "armour-band-component-impact"
            ? facts.qualification.qualificationConfigChecksum
            : undefined,
        componentQualificationModel: facts.qualification.qualificationModel,
        criticalComponentImpactThreshold: facts.qualification.criticalThreshold,
        highComponentImpactThreshold: facts.qualification.highImpactThreshold,
        componentArmourFactor: facts.armourFactor,
        componentMinimumImpact: facts.minimumImpact,
        qualificationReason: facts.qualification.reason,
        componentArmourBandId: facts.qualification.bandId,
        componentArmourBandMinInclusive: facts.qualification.bandMinArmourInclusive,
        componentArmourBandMaxInclusive: facts.qualification.bandMaxArmourInclusive,
        isCritical: attackResultB.isCritical,
      });

      damageBtoA = attackResultB.effectiveDamage;

      a = { ...a, integrity: Math.max(0, a.integrity - attackResultB.effectiveDamage) };
      emit("integrity_damaged", b.fighterId, a.fighterId, {
        damage: attackResultB.effectiveDamage,
        remaining: a.integrity,
      });

      if (attackResultB.overturnSuccess && !a.conditions.includes("overturned")) {
        a = { ...a, conditions: [...a.conditions, "overturned" as Condition] };
        emit("robot_overturned", b.fighterId, a.fighterId, {});
      }

      if (planB) {
        a = { ...a, zone: planB.to };
        emit("movement_resolved", b.fighterId, a.fighterId, {
          from: planB.from,
          to: planB.to,
          facing: planB.facing,
          action: planB.action,
        });
      }

      // 0.2B: qualification-based component lifecycle
      const component = selectQualifiedComponentForTransition(
        facts.qualification,
        a.comps,
        attackResultB.hitZone,
        rng,
      );
      if (component) {
        const transition = transitionComponentState(
          a.comps,
          component,
          facts.qualification,
        );
        if (transition.transitionOccurred) {
          a = {
            ...a,
            comps: applyTransition(a.comps, transition),
          };
          a = { ...a, components: deriveBinaryComponents(a.comps) };

          if (transition.reason === "reinforced_drive" && transition.guardStateBefore) {
            const resistData: Record<string, unknown> = {
              component: "mobility",
              previousState: "healthy",
              newState: "healthy",
              sourceAttack: {
                weapon: b.build.proposal.weaponId,
                isCritical: attackResultB.isCritical,
              },
              effectiveDamage: attackResultB.effectiveDamage,
              integrityEffectiveDamage: facts.integrityEffectiveDamage,
              rawDamage: facts.rawDamage,
              armourAtHitZone: facts.armourAtHitZone,
              componentImpact: facts.componentImpact,
              componentQualificationId: facts.qualification.qualificationId,
              componentQualificationConfigChecksum:
                facts.qualification.qualificationConfigChecksum,
              componentQualificationChecksum:
                facts.qualification.qualificationModel === "armour-band-component-impact"
                  ? facts.qualification.qualificationConfigChecksum
                  : undefined,
              componentQualificationModel: facts.qualification.qualificationModel,
              componentArmourFactor: facts.armourFactor,
              componentMinimumImpact: facts.minimumImpact,
              criticalComponentImpactThreshold: facts.qualification.criticalThreshold,
              highComponentImpactThreshold: facts.qualification.highImpactThreshold,
              qualificationReason: facts.qualification.reason,
              componentArmourBandId: facts.qualification.bandId,
              componentArmourBandMinInclusive: facts.qualification.bandMinArmourInclusive,
              componentArmourBandMaxInclusive: facts.qualification.bandMaxArmourInclusive,
              hitZone: attackResultB.hitZone,
              reason: "reinforced_drive",
              guardStateBefore: transition.guardStateBefore,
              guardStateAfter: transition.guardStateAfter,
            };
            if (transition.utilityRuntimeChange) {
              resistData.utilityRuntimeChange = transition.utilityRuntimeChange;
            }
            emit("component_damage_resisted", b.fighterId, a.fighterId, resistData);
          } else if (transition.newState === "damaged") {
            const eventData: Record<string, unknown> = {
              component,
              previousState: transition.previousState,
              newState: transition.newState,
              sourceAttack: {
                weapon: b.build.proposal.weaponId,
                isCritical: attackResultB.isCritical,
              },
              effectiveDamage: attackResultB.effectiveDamage,
              integrityEffectiveDamage: facts.integrityEffectiveDamage,
              rawDamage: facts.rawDamage,
              armourAtHitZone: facts.armourAtHitZone,
              componentImpact: facts.componentImpact,
              componentQualificationId: facts.qualification.qualificationId,
              componentQualificationConfigChecksum:
                facts.qualification.qualificationConfigChecksum,
              componentQualificationChecksum:
                facts.qualification.qualificationModel === "armour-band-component-impact"
                  ? facts.qualification.qualificationConfigChecksum
                  : undefined,
              componentQualificationModel: facts.qualification.qualificationModel,
              componentArmourFactor: facts.armourFactor,
              componentMinimumImpact: facts.minimumImpact,
              criticalComponentImpactThreshold: facts.qualification.criticalThreshold,
              highComponentImpactThreshold: facts.qualification.highImpactThreshold,
              qualificationReason: facts.qualification.reason,
              componentArmourBandId: facts.qualification.bandId,
              componentArmourBandMinInclusive: facts.qualification.bandMinArmourInclusive,
              componentArmourBandMaxInclusive: facts.qualification.bandMaxArmourInclusive,
              hitZone: attackResultB.hitZone,
              reason: transition.reason,
            };
            if (transition.utilityRuntimeChange) {
              eventData.utilityRuntimeChange = transition.utilityRuntimeChange;
            }
            emit("component_damaged", b.fighterId, a.fighterId, eventData);
          } else if (transition.newState === "disabled") {
            const eventData: Record<string, unknown> = {
              component,
              previousState: transition.previousState,
              newState: transition.newState,
              sourceAttack: {
                weapon: b.build.proposal.weaponId,
                isCritical: attackResultB.isCritical,
              },
              effectiveDamage: attackResultB.effectiveDamage,
              integrityEffectiveDamage: facts.integrityEffectiveDamage,
              rawDamage: facts.rawDamage,
              armourAtHitZone: facts.armourAtHitZone,
              componentImpact: facts.componentImpact,
              componentQualificationId: facts.qualification.qualificationId,
              componentQualificationConfigChecksum:
                facts.qualification.qualificationConfigChecksum,
              componentQualificationChecksum:
                facts.qualification.qualificationModel === "armour-band-component-impact"
                  ? facts.qualification.qualificationConfigChecksum
                  : undefined,
              componentQualificationModel: facts.qualification.qualificationModel,
              componentArmourFactor: facts.armourFactor,
              componentMinimumImpact: facts.minimumImpact,
              criticalComponentImpactThreshold: facts.qualification.criticalThreshold,
              highComponentImpactThreshold: facts.qualification.highImpactThreshold,
              qualificationReason: facts.qualification.reason,
              componentArmourBandId: facts.qualification.bandId,
              componentArmourBandMinInclusive: facts.qualification.bandMinArmourInclusive,
              componentArmourBandMaxInclusive: facts.qualification.bandMaxArmourInclusive,
              hitZone: attackResultB.hitZone,
              reason: transition.reason,
            };
            if (transition.utilityRuntimeChange) {
              eventData.utilityRuntimeChange = transition.utilityRuntimeChange;
            }
            emit("component_disabled", b.fighterId, a.fighterId, eventData);
          }

          if (component === "mobility" && a.comps.mobility.state === "disabled") {
            if (!a.conditions.includes("immobilised")) {
              a = {
                ...a,
                conditions: [...a.conditions, "immobilised" as Condition],
              };
            }
          }
        }
      }
    }
  }

  a = applyHeatAndEnergy(a);
  b = applyHeatAndEnergy(b);

  if (
    a.conditions.includes("overheated") &&
    !state.fighterA.conditions.includes("overheated")
  ) {
    emit("robot_overheated", a.fighterId, undefined, { heat: a.heat });
  }
  if (
    b.conditions.includes("overheated") &&
    !state.fighterB.conditions.includes("overheated")
  ) {
    emit("robot_overheated", b.fighterId, undefined, { heat: b.heat });
  }

  a = { ...a, weaponCooldown: Math.max(0, a.weaponCooldown - 1) };
  b = { ...b, weaponCooldown: Math.max(0, b.weaponCooldown - 1) };

  const newDamageDealt = {
    a: state.damageDealt.a + damageAtoB,
    b: state.damageDealt.b + damageBtoA,
  };

  const newRoundsAttacked = {
    a: state.roundsAttacked.a + (attackA ? 1 : 0),
    b: state.roundsAttacked.b + (attackB ? 1 : 0),
  };

  return {
    fighterA: a,
    fighterB: b,
    events: [...state.events, ...events],
    damageDealt: newDamageDealt,
    roundsAttacked: newRoundsAttacked,
  };
}

function computeHitChance<Z extends ArenaZone | GridZone>(
  attacker: ZoneFighterState<Z>,
  defender: ZoneFighterState<Z>,
  positioning: PositioningAdapter<Z>,
): number {
  const weaponSpec = attacker.build.proposal.weaponId;
  const baseAccuracy = getWeaponAccuracy(weaponSpec);
  const range = positioning.computeDistance(attacker.zone, defender.zone);
  const rangeMod = range === "close" ? 1.0 : range === "medium" ? 0.8 : 0.5;

  return (baseAccuracy / 100) * BASE_HIT_CHANCE * rangeMod;
}

function getWeaponAccuracy(weaponId: string): number {
  switch (weaponId) {
    case "ram":
      return 80;
    case "hammer":
      return 65;
    case "horizontal_spinner":
      return 55;
    case "grappler":
      return 80;
    case "flipper":
      return 65;
    default:
      return 50;
  }
}

function getDistance(zoneA: ArenaZone, zoneB: ArenaZone): "close" | "medium" | "far" {
  if (zoneA === zoneB) return "close";
  if (zoneA === "center" || zoneB === "center") return "medium";

  const opposing: Array<[ArenaZone, ArenaZone]> = [
    ["north_edge", "south_edge"],
    ["east_edge", "west_edge"],
  ];

  for (const [a, b] of opposing) {
    if ((zoneA === a && zoneB === b) || (zoneA === b && zoneB === a)) return "far";
  }

  return "medium";
}

function getKnockbackZone(
  attackerZone: ArenaZone,
  defenderZone: ArenaZone,
): ArenaZone | null {
  if (defenderZone === "center") {
    if (attackerZone === "north_edge") return "south_edge";
    if (attackerZone === "south_edge") return "north_edge";
    if (attackerZone === "east_edge") return "west_edge";
    if (attackerZone === "west_edge") return "east_edge";
  }
  return null;
}

function applyHeatAndEnergy<Z extends ArenaZone | GridZone>(
  state: ZoneFighterState<Z>,
): ZoneFighterState<Z> {
  const coolingBonus = getEffectiveCoolingBonus(state);
  const dissipation = HEAT_DISSIPATION_PER_ROUND + coolingBonus;

  const newHeat = Math.max(0, state.heat - dissipation);
  const newEnergy = Math.min(STARTING_ENERGY, state.energy + ENERGY_REGEN_PER_ROUND);
  const newConditions = [...state.conditions];

  if (newHeat >= MAX_HEAT && !newConditions.includes("overheated")) {
    newConditions.push("overheated");
  }

  return {
    ...state,
    energy: newEnergy,
    heat: newHeat,
    conditions: newConditions,
  };
}
