export type AgentPhase = "design" | "policy" | "review" | "rebuild";

export type ErrorCategory =
  | "none"
  | "timeout"
  | "rate_limit"
  | "provider_error"
  | "invalid_json"
  | "schema_violation"
  | "semantic_violation"
  | "authentication";

export interface AgentUsageRecord {
  readonly phase: AgentPhase;
  readonly agentId: string;
  readonly provider: string;
  readonly model: string;
  readonly providerRequestId: string | null;
  readonly promptVersion: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedTokens: number;
  readonly costUsd: number | null;
  readonly costIsEstimated: boolean;
  readonly pricingVersion: string | null;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly fallbackUsed: boolean;
  readonly errorCategory: ErrorCategory;
}
