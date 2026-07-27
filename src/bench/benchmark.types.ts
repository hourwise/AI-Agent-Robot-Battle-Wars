import type { MatchResult } from "../simulator/types.js";

export interface SeedBank {
  readonly schemaVersion: string;
  readonly bankId: string;
  readonly generatorVersion: string;
  readonly simulatorVersion: string;
  readonly rulesetVersion: string;
  readonly catalogueVersion: string;
  readonly developmentSeeds: readonly number[];
  readonly heldOutSeeds: readonly number[];
}

export type SeedPartition = "development" | "held-out" | "all";

export interface BenchmarkConfig {
  readonly label: string;
  readonly seedBank: SeedBank;
  readonly partition: SeedPartition;
  readonly fighterA: {
    readonly build: MatchResult["config"]["fighterA"]["build"];
    readonly policy: MatchResult["config"]["fighterA"]["policy"];
    readonly machineName: string;
  };
  readonly fighterB: {
    readonly build: MatchResult["config"]["fighterB"]["build"];
    readonly policy: MatchResult["config"]["fighterB"]["policy"];
    readonly machineName: string;
  };
  readonly roleSwapped: boolean;
}

export interface PerMatchResult {
  readonly seed: number;
  readonly roleSwapped: boolean;
  /** Which competitor ("x" or "y") is in the fighter_a slot. */
  readonly fighterACompetitor: "x" | "y";
  /** Which competitor ("x" or "y") is in the fighter_b slot. */
  readonly fighterBCompetitor: "x" | "y";
  readonly winner: string | null;
  readonly method: string;
  readonly rounds: number;
  readonly fighterA: {
    readonly machineName: string;
    readonly integrity: number;
    readonly maxIntegrity: number;
    readonly mobilityDisabled: boolean;
    readonly weaponDisabled: boolean;
    readonly utilityDisabled: boolean;
    readonly disabledComponents: readonly string[];
  };
  readonly fighterB: {
    readonly machineName: string;
    readonly integrity: number;
    readonly maxIntegrity: number;
    readonly mobilityDisabled: boolean;
    readonly weaponDisabled: boolean;
    readonly utilityDisabled: boolean;
    readonly disabledComponents: readonly string[];
  };
  readonly criticalHits: number;
  readonly attacksAttempted: number;
  readonly attacksHit: number;
}

export interface SlotOutcomes {
  readonly fighterAWins: number;
  readonly fighterBWins: number;
  readonly draws: number;
  readonly winRateA: number;
  readonly winRateB: number;
  /** fighter_a win rate − fighter_b win rate */
  readonly firstSlotAdvantage: number;
  readonly wilsonCI: {
    readonly lower: number;
    readonly upper: number;
    readonly confidence: number;
  };
}

export interface CompetitorOutcomes {
  /** Design X wins (regardless of slot). */
  readonly xWins: number;
  /** Design Y wins (regardless of slot). */
  readonly yWins: number;
  readonly draws: number;
  readonly winRateX: number;
  readonly winRateY: number;
}

export interface AggregateMetrics {
  readonly seedCount: number;
  readonly roleAssignmentsPerSeed: number;
  readonly totalSimulations: number;
  readonly slotOutcomes: SlotOutcomes;
  readonly competitorOutcomes: CompetitorOutcomes | null;
  readonly avgRounds: number;
  readonly medianRounds: number;
  readonly minRounds: number;
  readonly maxRounds: number;
  readonly avgIntegrityA: number;
  readonly avgIntegrityB: number;
  readonly avgIntegrityDiff: number;
  readonly destructionRate: number;
  readonly immobilisationRate: number;
  readonly judgesRate: number;
  readonly firstRoundFinishRate: number;
  readonly firstRoundImmobilisationRate: number;
  readonly matchesWithAnyDisable: number;
  readonly mobilityDisables: number;
  readonly weaponDisables: number;
  readonly utilityDisables: number;
  readonly totalCriticalHits: number;
  readonly totalAttacks: number;
  readonly totalHits: number;
  readonly hitRate: number;
}

export interface BenchmarkReport {
  readonly schemaVersion: string;
  readonly benchmarkId: string;
  readonly seedBankId: string;
  readonly partition: SeedPartition;
  readonly simulatorVersion: string;
  readonly rulesetVersion: string;
  readonly catalogueVersion: string;
  readonly fighterX: {
    readonly machineName: string;
    readonly buildFingerprint: string;
    readonly policyFingerprint: string;
  };
  readonly fighterY: {
    readonly machineName: string;
    readonly buildFingerprint: string;
    readonly policyFingerprint: string;
  };
  readonly roleSwapped: boolean;
  readonly seedCount: number;
  readonly roleAssignmentsPerSeed: number;
  readonly totalSimulations: number;
  readonly perMatch: readonly PerMatchResult[];
  readonly metrics: AggregateMetrics;
  /** Checksum of per-match outcomes only (not aggregate report). */
  readonly outcomesChecksum: string;
  /** Checksum of the full report (including aggregate metrics). */
  readonly reportChecksum: string;
}
