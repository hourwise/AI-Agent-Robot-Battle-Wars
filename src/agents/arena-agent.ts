import type { MachineBuildProposal } from "../validation/validation.types.js";
import type { ActionPolicy } from "../simulator/types.js";
import type { AgentUsageRecord } from "../types/agent-usage.js";
import type { MatchReview } from "../schemas/review.schema.js";
import type { AnyFactualMatchReport } from "../schemas/factual-report.schema.js";

export interface RebuildContext {
  readonly matchNumber: number;
  readonly factualReport: AnyFactualMatchReport;
  readonly review: MatchReview;
}

export interface DesignRequest {
  readonly opponent?: OpponentSummary;
  readonly priorBuild?: MachineBuildProposal;
  readonly reviewContext?: RebuildContext;
  readonly context?: string;
}

export interface OpponentSummary {
  readonly machineName: string;
  readonly chassisId: string;
  readonly mobilityId: string;
  readonly weaponId: string;
  readonly utilityId: string;
  readonly armour: {
    readonly front: number;
    readonly left: number;
    readonly right: number;
    readonly rear: number;
    readonly top: number;
  };
  readonly knownWeaknesses: readonly string[];
}

export interface PolicyRequest {
  readonly build: MachineBuildProposal;
  readonly opponent: OpponentSummary;
  readonly priorMatchSummaries?: readonly string[];
  readonly context?: string;
}

export interface ReviewRequest {
  readonly factualReport: AnyFactualMatchReport;
  readonly context?: string;
}

export interface AgentResult<T> {
  readonly value: T;
  readonly raw: unknown;
  readonly model: string;
  readonly providerRequestId: string | null;
  readonly finishReason: string | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedTokens: number;
  readonly costUsd: number | null;
  readonly costIsEstimated: boolean;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly promptVersion: string;
  readonly fallbackUsed: boolean;
}

export interface ArenaAgent {
  readonly id: string;
  readonly displayName: string;
  readonly provider: string;
  readonly model: string;

  designMachine(request: DesignRequest): Promise<AgentResult<MachineBuildProposal>>;
  choosePolicy(request: PolicyRequest): Promise<AgentResult<ActionPolicy>>;
  reviewMatch(request: ReviewRequest): Promise<AgentResult<MatchReview>>;

  usageFromResult<T>(
    result: AgentResult<T>,
    phase: AgentUsageRecord["phase"],
  ): AgentUsageRecord;
}
