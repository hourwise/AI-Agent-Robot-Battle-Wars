import type { BenchmarkReport, SeedPartition } from "./benchmark.types.js";
import type { MatchResult } from "../simulator/types.js";
import type {
  MachineBuildProposal,
  ValidatedBuild,
} from "../validation/validation.types.js";
import type { ActionPolicy } from "../simulator/types.js";

export type FixtureClassification = "hard" | "diagnostic";
export type GateStatus = "pass" | "fail" | "diagnostic" | "not-applicable";

export interface LifecycleCompetitorDefinition {
  readonly competitorId: string;
  readonly source:
    "canonical-bulwark" | "benchmark-only" | "benchmark-v2-transition-test";
  readonly build: MachineBuildProposal;
  readonly policy: ActionPolicy;
}

export interface LifecycleFixtureDefinition {
  readonly fixtureId: string;
  readonly benchmarkId: string;
  readonly purpose:
    | "high-armour plus reinforced-drive stress test"
    | "high-armour lifecycle progression without guard interference"
    | "low-armour over-aggression and transition-density test"
    | "armour differentiation and role-swapped behaviour";
  readonly fighterXCompetitorId: string;
  readonly fighterYCompetitorId: string;
  readonly roleSwapped: boolean;
  readonly seedPartition: "development";
  readonly classification: FixtureClassification;
}

export interface LifecycleFixtureSuiteDefinition {
  readonly schemaVersion: "1";
  readonly suiteId: "component-lifecycle-v1";
  readonly componentQualificationId: "component-impact-c2";
  readonly simulatorVersion: "0.2.0";
  readonly rulesetVersion: "0.2.0";
  readonly catalogueVersion: "1";
  readonly seedPartition: "development";
  readonly competitors: readonly LifecycleCompetitorDefinition[];
  readonly fixtures: readonly LifecycleFixtureDefinition[];
}

export interface ResolvedLifecycleCompetitor extends Omit<
  LifecycleCompetitorDefinition,
  "build"
> {
  readonly build: ValidatedBuild;
}

export interface ResolvedLifecycleFixture extends LifecycleFixtureDefinition {
  readonly fighterX: ResolvedLifecycleCompetitor;
  readonly fighterY: ResolvedLifecycleCompetitor;
}

export interface ResolvedLifecycleFixtureSuite extends Omit<
  LifecycleFixtureSuiteDefinition,
  "competitors" | "fixtures"
> {
  readonly competitors: readonly ResolvedLifecycleCompetitor[];
  readonly fixtures: readonly ResolvedLifecycleFixture[];
}

export interface GateResult {
  readonly gateId: string;
  readonly status: GateStatus;
  readonly observed: number | string | boolean;
  readonly expected: string;
  readonly fixtureId: string;
  readonly rationale?: string;
}

export interface TransitionAuditRecord {
  readonly matchKey: string;
  readonly seed: number;
  readonly roleSwapped: boolean;
  readonly fighter: string;
  readonly round: number;
  readonly eventType:
    "component_damaged" | "component_disabled" | "component_damage_resisted";
  readonly component: string;
  readonly previousState: string;
  readonly newState: string;
  readonly qualificationReason: string;
  readonly componentQualificationId: string;
}

export interface LifecycleAudit {
  readonly transitionRecords: readonly TransitionAuditRecord[];
  readonly invalidTransitions: readonly string[];
  readonly factualCompletenessErrors: readonly string[];
  readonly guardErrors: readonly string[];
  readonly nonQualifyingSelectionErrors: readonly string[];
  readonly mobilityDamagedEndingErrors: readonly string[];
  readonly mobilityDisabledEndingErrors: readonly string[];
  readonly firstRoundTerminalDisableCount: number;
}

export interface LifecycleFixtureDiagnostics {
  readonly qualifyingHitsPerMatch: number;
  readonly matchesWithAnyQualifyingHitRate: number;
  readonly resistanceRate: number | null;
  readonly firstRoundTerminalDisableRate: number;
  readonly roundCapIncidence: number;
  readonly drawRate: number;
  readonly matchesEndingWithDamagedComponentsRate: number;
  readonly finishMethods: {
    readonly destruction: number;
    readonly immobilisation: number;
    readonly judges: number;
    readonly draws: number;
  };
}

export interface LifecycleFixtureReport {
  readonly fixtureId: string;
  readonly purpose: string;
  readonly classification: FixtureClassification;
  readonly fighterXCompetitorId: string;
  readonly fighterYCompetitorId: string;
  readonly benchmark: BenchmarkReport;
  readonly diagnostics: LifecycleFixtureDiagnostics;
  readonly audit: LifecycleAudit;
  readonly gates: readonly GateResult[];
}

export interface AggregateLifecycleSummary {
  readonly totalSimulations: number;
  readonly totalHits: number;
  readonly totalQualifyingHits: number;
  readonly totalDamagedTransitions: number;
  readonly totalDisabledTransitions: number;
  readonly totalResistedTransitions: number;
  readonly mobilityDisabledTransitions: number;
  readonly weaponDisabledTransitions: number;
  readonly utilityDisabledTransitions: number;
}

export interface LifecycleSuiteReport {
  readonly schemaVersion: "1";
  readonly suiteId: string;
  readonly componentQualificationId: string;
  readonly seedBankId: string;
  readonly partition: "development";
  readonly fixtureReports: readonly LifecycleFixtureReport[];
  readonly aggregateLifecycleSummary: AggregateLifecycleSummary;
  readonly suiteGates: readonly GateResult[];
  readonly decision:
    | "A. Candidate C2 passes revised 0.2B lifecycle gates."
    | "B. Candidate C2 fails revised lifecycle gates and requires no further automatic tuning."
    | "C. Fixture suite exposes a lifecycle-design defect rather than a tuning issue."
    | "D. Fixture suite implementation is insufficient to make a decision.";
  readonly suiteChecksum: string;
}

export interface BenchmarkExecution {
  readonly perMatch: import("./benchmark.types.js").PerMatchResult;
  readonly match: MatchResult;
}

export interface RunLifecycleSuiteOptions {
  readonly suite: ResolvedLifecycleFixtureSuite;
  readonly seedBank: import("./benchmark.types.js").SeedBank;
  readonly partition: SeedPartition;
  readonly fixtureId?: string;
}
