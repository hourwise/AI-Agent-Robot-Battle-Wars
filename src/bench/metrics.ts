import type {
  PerMatchResult,
  AggregateMetrics,
  SlotOutcomes,
  CompetitorOutcomes,
} from "./benchmark.types.js";

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

function computeSlotOutcomes(results: readonly PerMatchResult[]): SlotOutcomes {
  const n = results.length || 1;
  const aWins = results.filter((r) => r.winner === "fighter_a").length;
  const bWins = results.filter((r) => r.winner === "fighter_b").length;
  const draws = results.filter((r) => r.winner === null).length;

  return {
    fighterAWins: aWins,
    fighterBWins: bWins,
    draws,
    winRateA: aWins / n,
    winRateB: bWins / n,
    firstSlotAdvantage: (aWins - bWins) / n,
    wilsonCI: wilsonCI(aWins, n),
  };
}

function computeCompetitorOutcomes(
  results: readonly PerMatchResult[],
): CompetitorOutcomes | null {
  // Determine if results have competitor identity fields
  const first = results[0];
  if (!first || !first.fighterACompetitor) return null;

  const n = results.length || 1;

  const xWins = results.filter((r) => {
    if (r.winner === "fighter_a") return r.fighterACompetitor === "x";
    if (r.winner === "fighter_b") return r.fighterBCompetitor === "x";
    return false;
  }).length;

  const yWins = results.filter((r) => {
    if (r.winner === "fighter_a") return r.fighterACompetitor === "y";
    if (r.winner === "fighter_b") return r.fighterBCompetitor === "y";
    return false;
  }).length;

  const draws = results.filter((r) => r.winner === null).length;

  // For identical designs, competitor outcomes are N/A
  if (xWins + yWins + draws === 0 && n > 0) return null;

  return {
    xWins,
    yWins,
    draws,
    winRateX: xWins / n,
    winRateY: yWins / n,
  };
}

export function computeMetrics(
  results: readonly PerMatchResult[],
  seedCount: number,
  roleAssignmentsPerSeed: number,
): AggregateMetrics {
  const n = results.length;

  const slotOutcomes = computeSlotOutcomes(results);
  const competitorOutcomes = computeCompetitorOutcomes(results);

  // Combat metrics — use ALL simulations as the population
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

  return {
    seedCount,
    roleAssignmentsPerSeed,
    totalSimulations: n,
    slotOutcomes,
    competitorOutcomes,
    avgRounds,
    medianRounds: median(rounds),
    minRounds,
    maxRounds,
    avgIntegrityA,
    avgIntegrityB,
    avgIntegrityDiff,
    destructionRate: destructionCount / n,
    immobilisationRate: immobCount / n,
    judgesRate: judgesCount / n,
    firstRoundFinishRate: firstRoundFinish / n,
    firstRoundImmobilisationRate: firstRoundImmob / n,
    matchesWithAnyDisable: anyDisable / n,
    mobilityDisables,
    weaponDisables,
    utilityDisables,
    totalCriticalHits,
    totalAttacks,
    totalHits,
    hitRate: totalAttacks > 0 ? totalHits / totalAttacks : 0,
  };
}
