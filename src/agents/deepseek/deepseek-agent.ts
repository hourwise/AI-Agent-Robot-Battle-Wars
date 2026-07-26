import type {
  ArenaAgent,
  AgentResult,
  DesignRequest,
  PolicyRequest,
  ReviewRequest,
} from "../arena-agent.js";
import type { MachineBuildProposal } from "../../validation/validation.types.js";
import type { ActionPolicy } from "../../simulator/types.js";
import type { DeepSeekConfig } from "./deepseek-config.js";
import {
  DeepSeekClient,
  AuthenticationError,
  RateLimitError,
  ProviderTimeout,
  ProviderError,
} from "./deepseek-client.js";
import { machineBuildProposalSchema } from "../../schemas/build.schema.js";
import { actionPolicySchema } from "../../schemas/policy.schema.js";
import { validateBuild } from "../../validation/build-validator.js";
import { CATALOGUE_V1 } from "../../catalogue/catalogue.v1.js";
import {
  DESIGN_PROMPT_VERSION,
  buildDesignSystemPrompt,
  buildDesignUserPrompt,
  buildCorrectionPrompt,
} from "../../prompts/design-prompt.v1.js";
import {
  POLICY_PROMPT_VERSION,
  buildPolicySystemPrompt,
  buildPolicyUserPrompt,
  buildPolicyCorrectionPrompt,
} from "../../prompts/policy-prompt.v1.js";

const MAX_CORRECTION_ATTEMPTS = 2;

export class SchemaError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super(`Schema validation failed: ${issues.join("; ")}`);
    this.name = "SchemaError";
    this.issues = issues;
  }
}

export class SemanticError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super(`Semantic validation failed: ${issues.join("; ")}`);
    this.name = "SemanticError";
    this.issues = issues;
  }
}

export class DesignFailedError extends Error {
  readonly allErrors: readonly string[];
  constructor(allErrors: readonly string[]) {
    super(
      `Design failed after ${MAX_CORRECTION_ATTEMPTS + 1} attempts: ${allErrors.join("; ")}`,
    );
    this.name = "DesignFailedError";
    this.allErrors = allErrors;
  }
}

function parseJsonResponse(raw: string): unknown {
  let trimmed = raw.trim();

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    trimmed = fenceMatch[1]!.trim();
  }

  return JSON.parse(trimmed);
}

function validateSchema(raw: unknown):
  | {
      ok: true;
      proposal: MachineBuildProposal;
    }
  | { ok: false; errors: string[] } {
  const result = machineBuildProposalSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, proposal: result.data };
  }

  const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  return { ok: false, errors };
}

function validateSemantic(proposal: MachineBuildProposal): string[] {
  const errors: string[] = [];
  const result = validateBuild(proposal, CATALOGUE_V1);

  if (!result.ok) {
    for (const e of result.errors) {
      errors.push(`${e.field}: ${e.message}`);
    }
  }

  return errors;
}

function validatePolicySchema(
  raw: unknown,
): { ok: true; policy: ActionPolicy } | { ok: false; errors: string[] } {
  const result = actionPolicySchema.safeParse(raw);
  if (result.success) {
    return { ok: true, policy: result.data };
  }

  const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  return { ok: false, errors };
}

function validatePolicySemantic(policy: ActionPolicy): string[] {
  const errors: string[] = [];

  if (policy.retreatThreshold < 10) {
    errors.push("retreatThreshold: too low (< 10) — will never retreat");
  }
  if (policy.retreatThreshold > 80) {
    errors.push("retreatThreshold: too high (> 80) — will retreat too early");
  }
  if (policy.heatThreshold < 50) {
    errors.push("heatThreshold: too low (< 50) — overly cautious");
  }
  if (policy.heatThreshold > 95) {
    errors.push("heatThreshold: too high (> 95) — will overheat before acting");
  }
  if (policy.aggression < 20) {
    errors.push("aggression: too low (< 20) — will not attack enough");
  }
  if (policy.aggression > 90) {
    errors.push("aggression: too high (> 90) — reckless, will overheat");
  }

  return errors;
}

export class DeepSeekArenaAgent implements ArenaAgent {
  readonly id = "deepseek";
  readonly displayName = "DeepSeek AI";
  readonly provider = "deepseek";
  readonly model: string;

  private readonly client: DeepSeekClient;

  constructor(config: DeepSeekConfig) {
    this.model = config.model;
    this.client = new DeepSeekClient(config);
  }

  async designMachine(
    _request: DesignRequest,
  ): Promise<AgentResult<MachineBuildProposal>> {
    const allErrors: string[] = [];
    let totalLatencyMs = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: buildDesignSystemPrompt() },
      { role: "user", content: buildDesignUserPrompt() },
    ];

    for (let attempt = 0; attempt <= MAX_CORRECTION_ATTEMPTS; attempt++) {
      const response = await this.client.chatCompletion({ messages });

      totalLatencyMs += response.latencyMs;
      totalInputTokens += response.usage.promptTokens;
      totalOutputTokens += response.usage.completionTokens;

      let parsed: unknown;
      try {
        parsed = parseJsonResponse(response.content);
      } catch {
        const err = "Response is not valid JSON";
        allErrors.push(err);
        messages.push({
          role: "assistant",
          content: response.content,
        });
        messages.push({
          role: "user",
          content: buildCorrectionPrompt([err]),
        });
        continue;
      }

      const schemaResult = validateSchema(parsed);
      if (!schemaResult.ok) {
        allErrors.push(...schemaResult.errors);
        messages.push({
          role: "assistant",
          content: response.content,
        });
        messages.push({
          role: "user",
          content: buildCorrectionPrompt(schemaResult.errors),
        });
        continue;
      }

      const semanticErrors = validateSemantic(schemaResult.proposal);
      if (semanticErrors.length > 0) {
        allErrors.push(...semanticErrors);
        messages.push({
          role: "assistant",
          content: response.content,
        });
        messages.push({
          role: "user",
          content: buildCorrectionPrompt(semanticErrors),
        });
        continue;
      }

      return {
        value: schemaResult.proposal,
        raw: response.content,
        model: response.model,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cachedTokens: 0,
        costUsd: null,
        latencyMs: totalLatencyMs,
        attempts: attempt + 1,
        promptVersion: DESIGN_PROMPT_VERSION,
      };
    }

    throw new DesignFailedError(allErrors);
  }

  async choosePolicy(request: PolicyRequest): Promise<AgentResult<ActionPolicy>> {
    const allErrors: string[] = [];
    let totalLatencyMs = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: buildPolicySystemPrompt() },
      { role: "user", content: buildPolicyUserPrompt(request.build) },
    ];

    for (let attempt = 0; attempt <= MAX_CORRECTION_ATTEMPTS; attempt++) {
      const response = await this.client.chatCompletion({ messages });

      totalLatencyMs += response.latencyMs;
      totalInputTokens += response.usage.promptTokens;
      totalOutputTokens += response.usage.completionTokens;

      let parsed: unknown;
      try {
        parsed = parseJsonResponse(response.content);
      } catch {
        const err = "Response is not valid JSON";
        allErrors.push(err);
        messages.push({
          role: "assistant",
          content: response.content,
        });
        messages.push({
          role: "user",
          content: buildPolicyCorrectionPrompt([err]),
        });
        continue;
      }

      const schemaResult = validatePolicySchema(parsed);
      if (!schemaResult.ok) {
        allErrors.push(...schemaResult.errors);
        messages.push({
          role: "assistant",
          content: response.content,
        });
        messages.push({
          role: "user",
          content: buildPolicyCorrectionPrompt(schemaResult.errors),
        });
        continue;
      }

      const semanticErrors = validatePolicySemantic(schemaResult.policy);
      if (semanticErrors.length > 0) {
        allErrors.push(...semanticErrors);
        messages.push({
          role: "assistant",
          content: response.content,
        });
        messages.push({
          role: "user",
          content: buildPolicyCorrectionPrompt(semanticErrors),
        });
        continue;
      }

      return {
        value: schemaResult.policy,
        raw: response.content,
        model: response.model,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cachedTokens: 0,
        costUsd: null,
        latencyMs: totalLatencyMs,
        attempts: attempt + 1,
        promptVersion: POLICY_PROMPT_VERSION,
      };
    }

    throw new DesignFailedError(allErrors);
  }

  async reviewMatch(_request: ReviewRequest): Promise<AgentResult<unknown>> {
    throw new Error("Not implemented in Milestone 4");
  }
}

export { AuthenticationError, RateLimitError, ProviderTimeout, ProviderError };
