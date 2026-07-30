import type { MatchResult } from "../simulator/types.js";
import type {
  ComponentQualificationId,
  ComponentQualificationMetadata,
} from "../simulator/component-qualification-registry.js";

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
  readonly componentQualificationId?: ComponentQualificationId;
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
    /** v2: component damaged (not disabled) at match end. */
    readonly mobilityDamaged: boolean;
    readonly weaponDamaged: boolean;
    readonly utilityDamaged: boolean;
  };
  readonly fighterB: {
    readonly machineName: string;
    readonly integrity: number;
    readonly maxIntegrity: number;
    readonly mobilityDisabled: boolean;
    readonly weaponDisabled: boolean;
    readonly utilityDisabled: boolean;
    readonly disabledComponents: readonly string[];
    /** v2: component damaged (not disabled) at match end. */
    readonly mobilityDamaged: boolean;
    readonly weaponDamaged: boolean;
    readonly utilityDamaged: boolean;
  };
  readonly criticalHits: number;
  readonly attacksAttempted: number;
  readonly attacksHit: number;
  readonly qualifyingHits: number;
  readonly criticalQualifiedHits: number;
  readonly highImpactQualifiedHits: number;
  readonly hitsSatisfyingBothConditions: number;
  readonly nonQualifyingSuccessfulHits: number;
  /** v2: component transition counts */
  readonly componentDamagedTransitions: number;
  readonly componentDisabledTransitions: number;
  readonly componentResistedTransitions: number;
  readonly guardsSpent: number;
  readonly guardsLost: number;
  /** v2: per-component breakdown */
  readonly mobilityDamagedCount: number;
  readonly weaponDamagedCount: number;
  readonly utilityDamagedCount: number;
  readonly mobilityDisabledCount: number;
  readonly weaponDisabledCount: number;
  readonly utilityDisabledCount: number;
  readonly terminalDisable: boolean;
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
  readonly totalQualifyingHits: number;
  readonly totalCriticalQualifiedHits: number;
  readonly totalHighImpactQualifiedHits: number;
  readonly totalHitsSatisfyingBothConditions: number;
  readonly totalNonQualifyingSuccessfulHits: number;
  readonly qualificationRate: number;
  readonly matchesWithAtLeastOneQualifyingHit: number;
  readonly matchesWithAtLeastTwoQualifyingHits: number;
  readonly matchesWithAtLeastThreeQualifyingHits: number;
  /** v2: component transition metrics */
  readonly totalDamagedTransitions: number;
  readonly totalDisabledTransitions: number;
  readonly totalResistedTransitions: number;
  readonly totalGuardsSpent: number;
  readonly totalGuardsLost: number;
  readonly matchesWithAnyComponentTransition: number;
  /** v2: per-component transition counts */
  readonly mobilityDamagedTransitions: number;
  readonly weaponDamagedTransitions: number;
  readonly utilityDamagedTransitions: number;
  readonly mobilityDisabledTransitions: number;
  readonly weaponDisabledTransitions: number;
  readonly utilityDisabledTransitions: number;
  /** v2: matches with damaged (not disabled) components at end */
  readonly matchesWithAnyDamagedComponent: number;
}

export interface BenchmarkReport {
  readonly schemaVersion: string;
  readonly benchmarkId: string;
  readonly seedBankId: string;
  readonly partition: SeedPartition;
  readonly simulatorVersion: string;
  readonly rulesetVersion: string;
  readonly catalogueVersion: string;
  readonly componentQualificationId: ComponentQualificationId;
  readonly componentQualification: ComponentQualificationMetadata;
  readonly qualificationConstants: {
    readonly armourFactor: number;
    readonly minimumImpact: number;
    readonly criticalThreshold: number;
    readonly highImpactThreshold: number;
  };
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
