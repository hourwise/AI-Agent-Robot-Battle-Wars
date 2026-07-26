import type { MachineBuildProposal } from "../validation/validation.types.js";
import type { ActionPolicy } from "../simulator/types.js";

export interface DesignRequest {
  readonly context?: string;
}

export interface PolicyRequest {
  readonly build: MachineBuildProposal;
  readonly context?: string;
}

export interface ReviewRequest {
  readonly matchSummary: string;
  readonly context?: string;
}

export interface AgentResult<T> {
  readonly value: T;
  readonly raw: unknown;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedTokens: number;
  readonly costUsd: number | null;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly promptVersion: string;
}

export interface ArenaAgent {
  readonly id: string;
  readonly displayName: string;
  readonly provider: string;
  readonly model: string;

  designMachine(request: DesignRequest): Promise<AgentResult<MachineBuildProposal>>;
  choosePolicy(request: PolicyRequest): Promise<AgentResult<ActionPolicy>>;
  reviewMatch(request: ReviewRequest): Promise<AgentResult<unknown>>;
}
