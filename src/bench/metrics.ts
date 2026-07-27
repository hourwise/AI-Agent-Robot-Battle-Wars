import type { PerMatchResult, AggregateMetrics } from "./benchmark.types.js";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function wilsonCI(
  wins: number,
  total: number,
  z = 1.96,
): { lower: number; upper: number; confidence: number } {
  if (total === 0) return { lower: 0, upper: 1, confidence: 0.95 };
  const p = wins / total;
  const n = total;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return {
    lower: Math.max(0, centre - margin),
    upper: Math.min(1, centre + margin),
    confidence: 0.95,
  };
}

export function computeMetrics(results: readonly PerMatchResult[]): AggregateMetrics {
  const n = results.length;
  const nonSwapped = results.filter((r) => !r.roleSwapped);

  const fighterAWins = nonSwapped.filter((r) => r.winner === "fighter_a").length;
  const fighterBWins = nonSwapped.filter((r) => r.winner === "fighter_b").length;
  const draws = nonSwapped.filter((r) => r.winner === null).length;

  const rounds = results.map((r) => r.rounds);
  const avgRounds = rounds.reduce((a, b) => a + b, 0) / n;
  const minRounds = Math.min(...rounds);
  const maxRounds = Math.max(...rounds);

  const integrityA = results.map((r) => r.fighterA.integrity);
  const integrityB = results.map((r) => r.fighterB.integrity);
  const avgIntegrityA = integrityA.reduce((a, b) => a + b, 0) / n;
  const avgIntegrityB = integrityB.reduce((a, b) => a + b, 0) / n;
  const avgIntegrityDiff = avgIntegrityA - avgIntegrityB;

  const destructionCount = results.filter((r) => r.method === "destruction").length;
  const immobCount = results.filter((r) => r.method === "immobilisation").length;
  const judgesCount = results.filter((r) => r.method === "judges").length;

  const firstRoundFinish = results.filter((r) => r.rounds === 1).length;
  const firstRoundImmob = results.filter(
    (r) => r.rounds === 1 && r.method === "immobilisation",
  ).length;

  const anyDisable = results.filter(
    (r) =>
      r.fighterA.disabledComponents.length > 0 ||
      r.fighterB.disabledComponents.length > 0,
  ).length;

  const mobilityDisables = results.reduce((sum, r) => {
    let c = 0;
    if (r.fighterA.mobilityDisabled) c++;
    if (r.fighterB.mobilityDisabled) c++;
    return sum + c;
  }, 0);
  const weaponDisables = results.reduce((sum, r) => {
    let c = 0;
    if (r.fighterA.weaponDisabled) c++;
    if (r.fighterB.weaponDisabled) c++;
    return sum + c;
  }, 0);
  const utilityDisables = results.reduce((sum, r) => {
    let c = 0;
    if (r.fighterA.utilityDisabled) c++;
    if (r.fighterB.utilityDisabled) c++;
    return sum + c;
  }, 0);

  const totalCriticalHits = results.reduce((s, r) => s + r.criticalHits, 0);
  const totalAttacks = results.reduce((s, r) => s + r.attacksAttempted, 0);
  const totalHits = results.reduce((s, r) => s + r.attacksHit, 0);

  const nonSwappedN = nonSwapped.length || 1;

  return {
    totalMatches: nonSwappedN,
    fighterAWins,
    fighterBWins,
    draws,
    winRateA: fighterAWins / nonSwappedN,
    winRateB: fighterBWins / nonSwappedN,
    wilsonCI: wilsonCI(fighterAWins, nonSwappedN),
    avgRounds,
    medianRounds: median(rounds),
    minRounds,
    maxRounds,
    avgIntegrityA,
    avgIntegrityB,
    avgIntegrityDiff,
    destructionRate: destructionCount / nonSwappedN,
    immobilisationRate: immobCount / nonSwappedN,
    judgesRate: judgesCount / nonSwappedN,
    firstRoundFinishRate: firstRoundFinish / nonSwappedN,
    firstRoundImmobilisationRate: firstRoundImmob / nonSwappedN,
    matchesWithAnyDisable: anyDisable / nonSwappedN,
    mobilityDisables,
    weaponDisables,
    utilityDisables,
    totalCriticalHits,
    totalAttacks,
    totalHits,
    hitRate: totalAttacks > 0 ? totalHits / totalAttacks : 0,
  };
}
