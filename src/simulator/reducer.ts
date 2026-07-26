import type {
  FighterState,
  RoundAction,
  SimulationEvent,
  ArenaZone,
  Condition,
  ActionPolicy,
} from "./types.js";
import type { SeededRandom } from "./seeded-random.js";
import { resolveMovement } from "./movement.js";
import { calculateAttack, selectDamagedComponent } from "./damage.js";
import {
  STARTING_ENERGY,
  MAX_HEAT,
  ENERGY_REGEN_PER_ROUND,
  HEAT_DISSIPATION_PER_ROUND,
  ATTACK_ENERGY_COST,
  ATTACK_HEAT_GAIN,
  COOLING_BONUS,
  OVERHEAT_RECOVERY_AMOUNT,
  BASE_HIT_CHANCE,
} from "./constants.js";
import { CATALOGUE_V1 } from "../catalogue/catalogue.v1.js";

function getWeaponCooldown(weaponId: string): number {
  const weapon = CATALOGUE_V1.weapons.find((w) => w.id === weaponId);
  return weapon?.cooldown ?? 0;
}

export interface RoundState {
  fighterA: FighterState;
  fighterB: FighterState;
  events: SimulationEvent[];
  damageDealt: { a: number; b: number };
  roundsAttacked: { a: number; b: number };
}

export function applyRound(
  state: RoundState,
  actions: { fighterA: RoundAction; fighterB: RoundAction },
  rng: SeededRandom,
  round: number,
  timestampMs: number,
  policyA?: ActionPolicy,
  policyB?: ActionPolicy,
): RoundState {
  let a = { ...state.fighterA };
  let b = { ...state.fighterB };
  const events: SimulationEvent[] = [];
  let seq = state.events.length;

  const emit = (
    type: string,
    actorId?: string,
    targetId?: string,
    data: Record<string, unknown> = {},
  ): SimulationEvent => {
    const event: SimulationEvent = {
      schemaVersion: "1",
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

  const resolvedA = resolveMovement(a, actions.fighterA.movement);
  const resolvedB = resolveMovement(b, actions.fighterB.movement);

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

  const momentumA = actions.fighterA.movement === "advance" ? 1 : 0;
  const momentumB = actions.fighterB.movement === "advance" ? 1 : 0;

  const attackA =
    actions.fighterA.combat === "attack" &&
    !a.components.weaponDisabled &&
    a.weaponCooldown <= 0;
  const attackB =
    actions.fighterB.combat === "attack" &&
    !b.components.weaponDisabled &&
    b.weaponCooldown <= 0;

  const attackResultA = attackA
    ? calculateAttack(
        a,
        b,
        computeHitChance(a, b, rng),
        momentumA,
        rng,
        policyA?.primaryTarget,
        policyA?.secondaryTarget,
      )
    : null;
  const attackResultB = attackB
    ? calculateAttack(
        b,
        a,
        computeHitChance(b, a, rng),
        momentumB,
        rng,
        policyB?.primaryTarget,
        policyB?.secondaryTarget,
      )
    : null;

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
      emit("attack_hit", a.fighterId, b.fighterId, {
        weapon: a.build.proposal.weaponId,
        hitZone: attackResultA.hitZone,
        rawDamage: attackResultA.rawDamage,
        effectiveDamage: attackResultA.effectiveDamage,
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

      if (attackResultA.knockback) {
        const newZone = getKnockbackZone(a.zone, b.zone);
        if (newZone && newZone !== b.zone) {
          const originalZone = b.zone;
          b = { ...b, zone: newZone };
          emit("movement_resolved", a.fighterId, b.fighterId, {
            from: originalZone,
            to: newZone,
            facing: b.facing,
            action: "knockback",
          });
        }
      }

      if (attackResultA.isCritical) {
        const component = selectDamagedComponent(
          attackResultA.hitZone,
          b.components,
          rng,
        );
        if (component) {
          b = applyComponentDamage(b, component);
          emit("component_disabled", a.fighterId, b.fighterId, { component });
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
      emit("attack_hit", b.fighterId, a.fighterId, {
        weapon: b.build.proposal.weaponId,
        hitZone: attackResultB.hitZone,
        rawDamage: attackResultB.rawDamage,
        effectiveDamage: attackResultB.effectiveDamage,
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

      if (attackResultB.knockback) {
        const newZone = getKnockbackZone(b.zone, a.zone);
        if (newZone && newZone !== a.zone) {
          const originalZone = a.zone;
          a = { ...a, zone: newZone };
          emit("movement_resolved", b.fighterId, a.fighterId, {
            from: originalZone,
            to: newZone,
            facing: a.facing,
            action: "knockback",
          });
        }
      }

      if (attackResultB.isCritical) {
        const component = selectDamagedComponent(
          attackResultB.hitZone,
          a.components,
          rng,
        );
        if (component) {
          a = applyComponentDamage(a, component);
          emit("component_disabled", b.fighterId, a.fighterId, { component });
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

function computeHitChance(
  attacker: FighterState,
  defender: FighterState,
  _rng: SeededRandom,
): number {
  const weaponSpec = attacker.build.proposal.weaponId;
  const baseAccuracy = getWeaponAccuracy(weaponSpec);
  const range = getDistance(attacker.zone, defender.zone);
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

function applyHeatAndEnergy(state: FighterState): FighterState {
  const hasCooling =
    state.build.proposal.utilityId === "cooling" && !state.components.utilityDisabled;
  const dissipation = HEAT_DISSIPATION_PER_ROUND + (hasCooling ? COOLING_BONUS : 0);

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

function applyComponentDamage(
  state: FighterState,
  component: "mobility" | "weapon" | "utility",
): FighterState {
  const newComponents = { ...state.components };
  const newConditions = [...state.conditions];

  switch (component) {
    case "mobility":
      newComponents.mobilityDisabled = true;
      if (!newConditions.includes("immobilised")) {
        newConditions.push("immobilised");
      }
      break;
    case "weapon":
      newComponents.weaponDisabled = true;
      break;
    case "utility":
      newComponents.utilityDisabled = true;
      break;
  }

  return { ...state, components: newComponents, conditions: newConditions };
}
