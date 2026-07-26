import type { MatchResult } from "../simulator/types.js";

export interface FighterStatistics {
  fighterId: string;
  name: string;
  attacksAttempted: number;
  attacksHit: number;
  attacksMissed: number;
  damageInflicted: number;
  damageReceived: number;
  criticalHits: number;
  componentDisables: number;
  movements: number;
  knockbacks: number;
  overturns: number;
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
    componentDisables: 0,
    movements: 0,
    knockbacks: 0,
    overturns: 0,
    finalIntegrity: 0,
    maxIntegrity,
  };
}

export function computeMatchStatistics(result: MatchResult): MatchStatistics {
  const nameA = result.config.fighterA.build.proposal.machineName;
  const nameB = result.config.fighterB.build.proposal.machineName;

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
    const stats = event.actorId === "fighter_a" ? statsA : statsB;
    const target =
      event.targetId === "fighter_a"
        ? statsA
        : event.targetId === "fighter_b"
          ? statsB
          : null;

    switch (event.type) {
      case "attack_attempted":
        stats.attacksAttempted++;
        break;

      case "attack_hit":
        stats.attacksHit++;
        if (target) {
          const damage = event.data.effectiveDamage as number;
          target.damageReceived += damage;
          stats.damageInflicted += damage;
        }
        if (event.data.isCritical) {
          stats.criticalHits++;
        }
        if (!firstBlood) {
          firstBlood = { round: event.round, attacker: stats.name };
        }
        lastHit = { round: event.round, attacker: stats.name };
        break;

      case "attack_missed":
        stats.attacksMissed++;
        break;

      case "component_disabled":
        if (target) {
          target.componentDisables++;
        }
        break;

      case "movement_resolved":
        stats.movements++;
        if (event.data.action === "knockback") {
          stats.knockbacks++;
          if (target) {
            target.knockbacks++;
          }
        }
        break;

      case "robot_overturned":
        if (target) {
          target.overturns++;
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

  lines.push(`${stats.fighterA.name}:`);
  lines.push(
    `  Attacks: ${stats.fighterA.attacksHit}/${stats.fighterA.attacksAttempted} hit`,
  );
  lines.push(`  Damage Inflicted: ${stats.fighterA.damageInflicted}`);
  lines.push(`  Damage Received: ${stats.fighterA.damageReceived}`);
  lines.push(`  Critical Hits: ${stats.fighterA.criticalHits}`);
  lines.push(`  Component Disables: ${stats.fighterA.componentDisables}`);
  lines.push(`  Movements: ${stats.fighterA.movements}`);
  lines.push(`  Knockbacks: ${stats.fighterA.knockbacks}`);
  lines.push(`  Overturns: ${stats.fighterA.overturns}`);
  lines.push(
    `  Final Integrity: ${stats.fighterA.finalIntegrity}/${stats.fighterA.maxIntegrity}`,
  );
  lines.push("");

  lines.push(`${stats.fighterB.name}:`);
  lines.push(
    `  Attacks: ${stats.fighterB.attacksHit}/${stats.fighterB.attacksAttempted} hit`,
  );
  lines.push(`  Damage Inflicted: ${stats.fighterB.damageInflicted}`);
  lines.push(`  Damage Received: ${stats.fighterB.damageReceived}`);
  lines.push(`  Critical Hits: ${stats.fighterB.criticalHits}`);
  lines.push(`  Component Disables: ${stats.fighterB.componentDisables}`);
  lines.push(`  Movements: ${stats.fighterB.movements}`);
  lines.push(`  Knockbacks: ${stats.fighterB.knockbacks}`);
  lines.push(`  Overturns: ${stats.fighterB.overturns}`);
  lines.push(
    `  Final Integrity: ${stats.fighterB.finalIntegrity}/${stats.fighterB.maxIntegrity}`,
  );
  lines.push("");

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
