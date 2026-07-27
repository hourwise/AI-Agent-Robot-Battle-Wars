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

export interface AggregateMetrics {
  readonly totalMatches: number;
  readonly fighterAWins: number;
  readonly fighterBWins: number;
  readonly draws: number;
  readonly winRateA: number;
  readonly winRateB: number;
  readonly wilsonCI: {
    readonly lower: number;
    readonly upper: number;
    readonly confidence: number;
  };
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
  readonly fighterA: {
    readonly machineName: string;
    readonly buildFingerprint: string;
    readonly policyFingerprint: string;
  };
  readonly fighterB: {
    readonly machineName: string;
    readonly buildFingerprint: string;
    readonly policyFingerprint: string;
  };
  readonly roleSwapped: boolean;
  readonly totalSimulations: number;
  readonly perMatch: readonly PerMatchResult[];
  readonly metrics: AggregateMetrics;
  readonly checksum: string;
}
