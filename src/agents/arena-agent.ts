import type { MachineBuildProposal } from "../validation/validation.types.js";
import type { ActionPolicy } from "../simulator/types.js";

export interface AgentResult<T> {
  value: T;
  raw: unknown;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  attempts: number;
  promptVersion: string;
}

export interface ArenaAgent {
  readonly id: string;
  readonly displayName: string;
  readonly provider: string;
  readonly model: string;
  designMachine(request: unknown): Promise<AgentResult<MachineBuildProposal>>;
  choosePolicy(request: unknown): Promise<AgentResult<ActionPolicy>>;
  reviewMatch(request: unknown): Promise<AgentResult<unknown>>;
}
