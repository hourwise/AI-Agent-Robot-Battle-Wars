import type { MatchResult } from "../simulator/types.js";
import { sanitizeTerminalText } from "../shared/text-sanitise.js";

export interface FighterStatistics {
  fighterId: string;
  name: string;
  attacksAttempted: number;
  attacksHit: number;
  attacksMissed: number;
  damageInflicted: number;
  damageReceived: number;
  criticalHits: number;
  componentDisablesInflicted: number;
  componentDisablesSuffered: number;
  movements: number;
  knockbacksInflicted: number;
  knockbacksSuffered: number;
  overturnsInflicted: number;
  overturnsSuffered: number;
  finalIntegrity: number;
  maxIntegrity: number;
}

export interface MatchStatistics {
  totalRounds: number;
  totalEvents: number;
  fighterA: FighterStatistics;
  fighterB: FighterStatistics;
  firstBlood: { round: number; attacker: string } | null;
  lastHit: { round: number; attacker: string } | null;
}

function createFighterStats(
  fighterId: string,
  name: string,
  maxIntegrity: number,
): FighterStatistics {
  return {
    fighterId,
    name,
    attacksAttempted: 0,
    attacksHit: 0,
    attacksMissed: 0,
    damageInflicted: 0,
    damageReceived: 0,
    criticalHits: 0,
    componentDisablesInflicted: 0,
    componentDisablesSuffered: 0,
    movements: 0,
    knockbacksInflicted: 0,
    knockbacksSuffered: 0,
    overturnsInflicted: 0,
    overturnsSuffered: 0,
    finalIntegrity: 0,
    maxIntegrity,
  };
}

function lookupStats(
  fighterId: string | undefined,
  statsA: FighterStatistics,
  statsB: FighterStatistics,
): FighterStatistics | null {
  if (fighterId === "fighter_a") return statsA;
  if (fighterId === "fighter_b") return statsB;
  return null;
}

export function computeMatchStatistics(result: MatchResult): MatchStatistics {
  const nameA = sanitizeTerminalText(result.config.fighterA.build.proposal.machineName);
  const nameB = sanitizeTerminalText(result.config.fighterB.build.proposal.machineName);

  const statsA = createFighterStats(
    "fighter_a",
    nameA,
    result.initialState.fighterA.maxIntegrity,
  );
  const statsB = createFighterStats(
    "fighter_b",
    nameB,
    result.initialState.fighterB.maxIntegrity,
  );

  let firstBlood: MatchStatistics["firstBlood"] = null;
  let lastHit: MatchStatistics["lastHit"] = null;

  for (const event of result.events) {
    const actor = lookupStats(event.actorId, statsA, statsB);
    const target = lookupStats(event.targetId, statsA, statsB);

    switch (event.type) {
      case "attack_attempted":
        if (actor) {
          actor.attacksAttempted++;
        }
        break;

      case "attack_hit":
        if (actor) {
          actor.attacksHit++;
          if (event.data.isCritical) {
            actor.criticalHits++;
          }
          if (target) {
            const damage = event.data.effectiveDamage as number;
            actor.damageInflicted += damage;
            target.damageReceived += damage;
          }
          if (!firstBlood) {
            firstBlood = { round: event.round, attacker: actor.name };
          }
          lastHit = { round: event.round, attacker: actor.name };
        }
        break;

      case "attack_missed":
        if (actor) {
          actor.attacksMissed++;
        }
        break;

      case "component_disabled":
        if (actor) {
          actor.componentDisablesInflicted++;
        }
        if (target) {
          target.componentDisablesSuffered++;
        }
        break;

      case "movement_resolved":
        if (actor) {
          actor.movements++;
          if (event.data.action === "knockback") {
            actor.knockbacksInflicted++;
          }
        }
        if (target && event.data.action === "knockback") {
          target.knockbacksSuffered++;
        }
        break;

      case "robot_overturned":
        if (actor) {
          actor.overturnsInflicted++;
        }
        if (target) {
          target.overturnsSuffered++;
        }
        break;
    }
  }

  statsA.finalIntegrity = result.initialState.fighterA.integrity;
  statsB.finalIntegrity = result.initialState.fighterB.integrity;

  for (const event of result.events) {
    if (event.type === "integrity_damaged") {
      const remaining = event.data.remaining as number;
      if (event.targetId === "fighter_a") {
        statsA.finalIntegrity = remaining;
      } else if (event.targetId === "fighter_b") {
        statsB.finalIntegrity = remaining;
      }
    }
  }

  return {
    totalRounds: result.rounds,
    totalEvents: result.events.length,
    fighterA: statsA,
    fighterB: statsB,
    firstBlood,
    lastHit,
  };
}

export function formatMatchStatistics(stats: MatchStatistics): string {
  const lines: string[] = [];

  lines.push("=".repeat(50));
  lines.push("MATCH STATISTICS");
  lines.push("=".repeat(50));
  lines.push("");
  lines.push(`Total Rounds: ${stats.totalRounds}`);
  lines.push(`Total Events: ${stats.totalEvents}`);
  lines.push("");

  for (const fighter of [stats.fighterA, stats.fighterB]) {
    lines.push(`${fighter.name}:`);
    lines.push(`  Attacks: ${fighter.attacksHit}/${fighter.attacksAttempted} hit`);
    lines.push(`  Damage Inflicted: ${fighter.damageInflicted}`);
    lines.push(`  Damage Received: ${fighter.damageReceived}`);
    lines.push(`  Critical Hits: ${fighter.criticalHits}`);
    lines.push(
      `  Component Disables: ${fighter.componentDisablesInflicted} inflicted, ${fighter.componentDisablesSuffered} suffered`,
    );
    lines.push(`  Movements: ${fighter.movements}`);
    lines.push(
      `  Knockbacks: ${fighter.knockbacksInflicted} inflicted, ${fighter.knockbacksSuffered} suffered`,
    );
    lines.push(
      `  Overturns: ${fighter.overturnsInflicted} inflicted, ${fighter.overturnsSuffered} suffered`,
    );
    lines.push(`  Final Integrity: ${fighter.finalIntegrity}/${fighter.maxIntegrity}`);
    lines.push("");
  }

  if (stats.firstBlood) {
    lines.push(
      `First Blood: Round ${stats.firstBlood.round} by ${stats.firstBlood.attacker}`,
    );
  }
  if (stats.lastHit) {
    lines.push(`Last Hit: Round ${stats.lastHit.round} by ${stats.lastHit.attacker}`);
  }

  lines.push("");
  return lines.join("\n");
}
