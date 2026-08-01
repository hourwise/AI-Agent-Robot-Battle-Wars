import type { FighterCoreState, CompetitionResult, JudgeScore } from "./types.js";
import {
  JUDGE_DAMAGE_WEIGHT,
  JUDGE_MOBILITY_WEIGHT,
  JUDGE_WEAPON_WEIGHT,
  JUDGE_AGGRESSION_WEIGHT,
  JUDGE_INTEGRITY_WEIGHT,
  MAX_EXPECTED_DAMAGE,
} from "./constants.js";

export function checkVictory(
  fighterA: FighterCoreState,
  fighterB: FighterCoreState,
  round: number,
  maxRounds: number,
  damageDealt: { a: number; b: number },
  roundsAttacked: { a: number; b: number },
): CompetitionResult | null {
  const aDead = fighterA.integrity <= 0;
  const bDead = fighterB.integrity <= 0;

  if (aDead && bDead) {
    return judgeDecision(fighterA, fighterB, damageDealt, roundsAttacked, round);
  }
  if (aDead) {
    return {
      winner: fighterB.fighterId,
      loser: fighterA.fighterId,
      method: "destruction",
    };
  }
  if (bDead) {
    return {
      winner: fighterA.fighterId,
      loser: fighterB.fighterId,
      method: "destruction",
    };
  }

  const aImmob = fighterA.components.mobilityDisabled;
  const bImmob = fighterB.components.mobilityDisabled;

  if (aImmob && bImmob) {
    return judgeDecision(fighterA, fighterB, damageDealt, roundsAttacked, round);
  }
  if (aImmob) {
    return {
      winner: fighterB.fighterId,
      loser: fighterA.fighterId,
      method: "immobilisation",
    };
  }
  if (bImmob) {
    return {
      winner: fighterA.fighterId,
      loser: fighterB.fighterId,
      method: "immobilisation",
    };
  }

  if (round >= maxRounds) {
    return judgeDecision(fighterA, fighterB, damageDealt, roundsAttacked, round);
  }

  return null;
}

export function judgeDecision(
  fighterA: FighterCoreState,
  fighterB: FighterCoreState,
  damageDealt: { a: number; b: number },
  roundsAttacked: { a: number; b: number },
  totalRounds: number,
): CompetitionResult {
  const scoreA = computeJudgeScore(
    fighterA,
    damageDealt.a,
    roundsAttacked.a,
    totalRounds,
  );
  const scoreB = computeJudgeScore(
    fighterB,
    damageDealt.b,
    roundsAttacked.b,
    totalRounds,
  );

  if (scoreA.normalised.total > scoreB.normalised.total) {
    return {
      winner: fighterA.fighterId,
      loser: fighterB.fighterId,
      method: "judges",
      judgeScores: { fighterA: scoreA, fighterB: scoreB },
    };
  }

  if (scoreB.normalised.total > scoreA.normalised.total) {
    return {
      winner: fighterB.fighterId,
      loser: fighterA.fighterId,
      method: "judges",
      judgeScores: { fighterA: scoreA, fighterB: scoreB },
    };
  }

  const tiebreak = tieBreak(fighterA, fighterB, damageDealt);
  return {
    winner: tiebreak.winner,
    loser: tiebreak.loser,
    method: "judges",
    judgeScores: { fighterA: scoreA, fighterB: scoreB },
  };
}

function computeJudgeScore(
  fighter: FighterCoreState,
  damageInflicted: number,
  roundsAttacked: number,
  totalRounds: number,
): JudgeScore {
  const damageNormalised = Math.min(100, (damageInflicted / MAX_EXPECTED_DAMAGE) * 100);
  const mobilityNormalised = getMobilityScore(fighter);
  const weaponNormalised = fighter.components.weaponDisabled ? 0 : 100;
  const aggressionNormalised = totalRounds > 0 ? (roundsAttacked / totalRounds) * 100 : 0;
  const integrityNormalised = (fighter.integrity / fighter.maxIntegrity) * 100;

  const total =
    damageNormalised * JUDGE_DAMAGE_WEIGHT +
    mobilityNormalised * JUDGE_MOBILITY_WEIGHT +
    weaponNormalised * JUDGE_WEAPON_WEIGHT +
    aggressionNormalised * JUDGE_AGGRESSION_WEIGHT +
    integrityNormalised * JUDGE_INTEGRITY_WEIGHT;

  return {
    damageInflicted,
    mobilityRemaining: mobilityNormalised,
    weaponFunctional: !fighter.components.weaponDisabled,
    aggression: aggressionNormalised,
    integrityRemaining: integrityNormalised,
    normalised: {
      damage: damageNormalised,
      mobility: mobilityNormalised,
      weapon: weaponNormalised,
      aggression: aggressionNormalised,
      integrity: integrityNormalised,
      total,
    },
  };
}

function getMobilityScore(fighter: FighterCoreState): number {
  if (fighter.components.mobilityDisabled) return 0;

  const speed = getSpeed(fighter);
  return Math.min(100, speed * 10);
}

function getSpeed(fighter: FighterCoreState): number {
  const id = fighter.build.proposal.mobilityId;
  switch (id) {
    case "wheels":
      return 9;
    case "tracks":
      return 5;
    case "legs":
      return 6;
    default:
      return 5;
  }
}

function tieBreak(
  fighterA: FighterCoreState,
  fighterB: FighterCoreState,
  damageDealt: { a: number; b: number },
): { winner: string | null; loser: string | null } {
  const mobA = getMobilityScore(fighterA);
  const mobB = getMobilityScore(fighterB);
  if (mobA !== mobB) {
    return mobA > mobB
      ? { winner: fighterA.fighterId, loser: fighterB.fighterId }
      : { winner: fighterB.fighterId, loser: fighterA.fighterId };
  }

  const weapA = fighterA.components.weaponDisabled ? 0 : 1;
  const weapB = fighterB.components.weaponDisabled ? 0 : 1;
  if (weapA !== weapB) {
    return weapA > weapB
      ? { winner: fighterA.fighterId, loser: fighterB.fighterId }
      : { winner: fighterB.fighterId, loser: fighterA.fighterId };
  }

  if (fighterA.integrity !== fighterB.integrity) {
    return fighterA.integrity > fighterB.integrity
      ? { winner: fighterA.fighterId, loser: fighterB.fighterId }
      : { winner: fighterB.fighterId, loser: fighterA.fighterId };
  }

  if (damageDealt.a !== damageDealt.b) {
    return damageDealt.a > damageDealt.b
      ? { winner: fighterA.fighterId, loser: fighterB.fighterId }
      : { winner: fighterB.fighterId, loser: fighterA.fighterId };
  }

  return { winner: null, loser: null };
}
