import type {
  ArenaAgent,
  AgentResult,
  DesignRequest,
  PolicyRequest,
  ReviewRequest,
} from "../arena-agent.js";
import type { MachineBuildProposal } from "../../validation/validation.types.js";
import type { ActionPolicy } from "../../simulator/types.js";
import type { AgentUsageRecord } from "../../types/agent-usage.js";
import type { MatchReview } from "../../schemas/review.schema.js";
import type { AnyFactualMatchReport } from "../../schemas/factual-report.schema.js";
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
import { MatchReviewSchema } from "../../schemas/review.schema.js";
import { validateBuild } from "../../validation/build-validator.js";
import { CATALOGUE_V1 } from "../../catalogue/catalogue.v1.js";
import { estimateCost } from "../cost-calculator.js";
import { FALLBACK_POLICY, FALLBACK_POLICY_VERSION } from "../fallback-policy.js";
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
import {
  REVIEW_PROMPT_VERSION,
  buildReviewSystemPrompt,
  buildReviewUserPrompt,
  buildReviewCorrectionPrompt,
} from "../../prompts/review-prompt.v1.js";
import { buildFallbackReview } from "../../prompts/review-prompt.v1.js";

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

function buildParseErrorDiagnostic(response: {
  content: string;
  finishReason: string | null;
}): string {
  const preview = response.content.slice(0, 300).replace(/[\r\n]+/g, " ");

  return (
    `Response is not valid JSON; finishReason=${response.finishReason ?? "null"}; ` +
    `contentLength=${response.content.length}; preview=${preview}`
  );
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

function validateReviewSchema(
  raw: unknown,
): { ok: true; review: MatchReview } | { ok: false; errors: string[] } {
  const result = MatchReviewSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, review: result.data };
  }

  const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  return { ok: false, errors };
}

function validateReviewSemantic(review: MatchReview): string[] {
  const errors: string[] = [];

  if (review.summary.length < 10) {
    errors.push("summary: too short (< 10 characters)");
  }
  if (review.summary.length > 500) {
    errors.push("summary: too long (> 500 characters)");
  }
  if (review.keyMoments.length === 0) {
    errors.push("keyMoments: must have at least one entry");
  }
  if (review.suggestedChanges.length > 5) {
    errors.push("suggestedChanges: too many (> 5)");
  }

  // Validate catalogue IDs in suggested changes
  const validWeapons = CATALOGUE_V1.weapons.map((w) => w.id);
  const validUtilities = CATALOGUE_V1.utilities.map((u) => u.id);
  const validChassis = CATALOGUE_V1.chassis.map((c) => c.id);
  const validMobility = CATALOGUE_V1.mobility.map((m) => m.id);

  for (const change of review.suggestedChanges) {
    if (
      change.replacementWeaponId &&
      !validWeapons.includes(change.replacementWeaponId)
    ) {
      errors.push(
        `"${change.replacementWeaponId}" is not a valid weaponId. Valid: ${validWeapons.join(", ")}`,
      );
    }
    if (
      change.replacementUtilityId &&
      !validUtilities.includes(change.replacementUtilityId)
    ) {
      errors.push(
        `"${change.replacementUtilityId}" is not a valid utilityId. Valid: ${validUtilities.join(", ")}`,
      );
    }
    if (
      change.replacementChassisId &&
      !validChassis.includes(change.replacementChassisId)
    ) {
      errors.push(
        `"${change.replacementChassisId}" is not a valid chassisId. Valid: ${validChassis.join(", ")}`,
      );
    }
    if (
      change.replacementMobilityId &&
      !validMobility.includes(change.replacementMobilityId)
    ) {
      errors.push(
        `"${change.replacementMobilityId}" is not a valid mobilityId. Valid: ${validMobility.join(", ")}`,
      );
    }
  }

  return errors;
}

export function validateReviewAgainstFacts(
  review: MatchReview,
  report: AnyFactualMatchReport,
): string[] {
  const errors: string[] = [];

  const outcome = review.observedOutcome;

  // Winner, method, rounds
  if (outcome.winnerId !== report.winner) {
    errors.push(
      `observedOutcome.winnerId is "${outcome.winnerId}" but match winner is "${report.winner}"`,
    );
  }
  if (outcome.method !== report.resultMethod) {
    errors.push(
      `observedOutcome.method is "${outcome.method}" but match result is "${report.resultMethod}"`,
    );
  }
  if (outcome.rounds !== report.rounds) {
    errors.push(
      `observedOutcome.rounds is ${outcome.rounds} but match lasted ${report.rounds} rounds`,
    );
  }

  // AI competitor is fighter_a, opponent is fighter_b (AI vs Bulwark mode)
  const ownState = report.finalStates.fighterA;
  const oppState = report.finalStates.fighterB;

  // Own (fighter_a) final integrity
  if (outcome.ownFinalIntegrity !== ownState.integrity) {
    errors.push(
      `observedOutcome.ownFinalIntegrity is ${outcome.ownFinalIntegrity} but fighter_a ended at ${ownState.integrity}`,
    );
  }

  // Opponent (fighter_b) final integrity
  if (outcome.opponentFinalIntegrity !== oppState.integrity) {
    errors.push(
      `observedOutcome.opponentFinalIntegrity is ${outcome.opponentFinalIntegrity} but fighter_b ended at ${oppState.integrity}`,
    );
  }

  // Disabled components — compare as normalised sets
  const ownDisabled = normaliseDisabledComponents(ownState);
  const oppDisabled = normaliseDisabledComponents(oppState);
  const outcomeOwnSorted = [...outcome.ownDisabledComponents].sort();
  const outcomeOppSorted = [...outcome.opponentDisabledComponents].sort();

  if (arraysDiffer(outcomeOwnSorted, ownDisabled)) {
    errors.push(
      `observedOutcome.ownDisabledComponents is [${outcomeOwnSorted.join(", ")}] but fighter_a had [${ownDisabled.join(", ")}]`,
    );
  }
  if (arraysDiffer(outcomeOppSorted, oppDisabled)) {
    errors.push(
      `observedOutcome.opponentDisabledComponents is [${outcomeOppSorted.join(", ")}] but fighter_b had [${oppDisabled.join(", ")}]`,
    );
  }

  return errors;
}

/** Extract disabled component names from a fighter state summary in canonical order. */
function normaliseDisabledComponents(state: {
  mobilityDisabled: boolean;
  weaponDisabled: boolean;
  utilityDisabled: boolean;
}): Array<"mobility" | "weapon" | "utility"> {
  const result: Array<"mobility" | "weapon" | "utility"> = [];
  if (state.mobilityDisabled) result.push("mobility");
  if (state.weaponDisabled) result.push("weapon");
  if (state.utilityDisabled) result.push("utility");
  return result;
}

function arraysDiffer(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return true;
  }
  return false;
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

  usageFromResult<T>(
    result: AgentResult<T>,
    phase: AgentUsageRecord["phase"],
  ): AgentUsageRecord {
    return {
      phase,
      agentId: this.id,
      provider: this.provider,
      model: result.model,
      providerRequestId: result.providerRequestId,
      promptVersion: result.promptVersion,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cachedTokens: result.cachedTokens,
      costUsd: result.costUsd,
      costIsEstimated: result.costIsEstimated,
      pricingVersion: result.costUsd !== null ? "2025-01" : null,
      latencyMs: result.latencyMs,
      attempts: result.attempts,
      fallbackUsed: result.fallbackUsed,
      errorCategory: "none",
    };
  }

  async designMachine(
    request: DesignRequest,
  ): Promise<AgentResult<MachineBuildProposal>> {
    const allErrors: string[] = [];
    let totalLatencyMs = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCachedTokens = 0;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: buildDesignSystemPrompt() },
      { role: "user", content: buildDesignUserPrompt(request) },
    ];

    for (let attempt = 0; attempt <= MAX_CORRECTION_ATTEMPTS; attempt++) {
      const response = await this.client.chatCompletion({
        messages,
        temperature: 0.2,
        maxTokens: 2048,
      });

      totalLatencyMs += response.latencyMs;
      totalInputTokens += response.usage.promptTokens;
      totalOutputTokens += response.usage.completionTokens;
      totalCachedTokens += response.usage.cachedTokens;

      let parsed: unknown;
      try {
        parsed = parseJsonResponse(response.content);
      } catch {
        const err = buildParseErrorDiagnostic(response);
        allErrors.push(err);

        messages.push({
          role: "assistant",
          content: response.content,
        });

        // If truncated by token limit, retry with a larger limit instead of
        // asking the model to "correct" its JSON.
        if (response.finishReason === "length") {
          messages.push({
            role: "user",
            content:
              "Your response was truncated because it exceeded the token limit. " +
              "Return ONLY a shorter JSON object matching the build proposal schema. " +
              "You may shorten designSummary and designRationale to fit.",
          });
        } else {
          messages.push({
            role: "user",
            content: buildCorrectionPrompt([err]),
          });
        }
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

      const cost = estimateCost(
        this.model,
        totalInputTokens,
        totalCachedTokens,
        totalOutputTokens,
      );

      return {
        value: schemaResult.proposal,
        raw: response.content,
        model: response.model,
        providerRequestId: response.id,
        finishReason: response.finishReason,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cachedTokens: totalCachedTokens,
        costUsd: cost.costUsd,
        costIsEstimated: cost.isEstimated,
        latencyMs: totalLatencyMs,
        attempts: attempt + 1,
        promptVersion: DESIGN_PROMPT_VERSION,
        fallbackUsed: false,
      };
    }

    throw new DesignFailedError(allErrors);
  }

  async choosePolicy(request: PolicyRequest): Promise<AgentResult<ActionPolicy>> {
    const allErrors: string[] = [];
    let totalLatencyMs = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCachedTokens = 0;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: buildPolicySystemPrompt() },
      {
        role: "user",
        content: buildPolicyUserPrompt(
          request.build,
          request.opponent,
          request.priorMatchSummaries ?? [],
        ),
      },
    ];

    for (let attempt = 0; attempt <= MAX_CORRECTION_ATTEMPTS; attempt++) {
      const response = await this.client.chatCompletion({ messages });

      totalLatencyMs += response.latencyMs;
      totalInputTokens += response.usage.promptTokens;
      totalOutputTokens += response.usage.completionTokens;
      totalCachedTokens += response.usage.cachedTokens;

      let parsed: unknown;
      try {
        parsed = parseJsonResponse(response.content);
      } catch {
        const err = buildParseErrorDiagnostic(response);
        allErrors.push(err);
        messages.push({
          role: "assistant",
          content: response.content,
        });
        if (response.finishReason === "length") {
          messages.push({
            role: "user",
            content: "Your response was truncated. Return ONLY a shorter JSON object.",
          });
        } else {
          messages.push({
            role: "user",
            content: buildPolicyCorrectionPrompt([err]),
          });
        }
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

      const cost = estimateCost(
        this.model,
        totalInputTokens,
        totalCachedTokens,
        totalOutputTokens,
      );

      return {
        value: schemaResult.policy,
        raw: response.content,
        model: response.model,
        providerRequestId: response.id,
        finishReason: response.finishReason,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cachedTokens: totalCachedTokens,
        costUsd: cost.costUsd,
        costIsEstimated: cost.isEstimated,
        latencyMs: totalLatencyMs,
        attempts: attempt + 1,
        promptVersion: POLICY_PROMPT_VERSION,
        fallbackUsed: false,
      };
    }

    return this.fallbackPolicyResult(
      totalLatencyMs,
      totalInputTokens,
      totalOutputTokens,
      totalCachedTokens,
    );
  }

  private fallbackPolicyResult(
    latencyMs: number,
    inputTokens: number,
    outputTokens: number,
    cachedTokens: number,
  ): AgentResult<ActionPolicy> {
    return {
      value: FALLBACK_POLICY,
      raw: {
        fallback: true,
        reason: "Policy generation failed after bounded correction",
      },
      model: this.model,
      providerRequestId: null,
      finishReason: "fallback",
      inputTokens,
      outputTokens,
      cachedTokens,
      costUsd: null,
      costIsEstimated: false,
      latencyMs,
      attempts: MAX_CORRECTION_ATTEMPTS + 1,
      promptVersion: FALLBACK_POLICY_VERSION,
      fallbackUsed: true,
    };
  }

  async reviewMatch(request: ReviewRequest): Promise<AgentResult<MatchReview>> {
    const allErrors: string[] = [];
    let totalLatencyMs = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCachedTokens = 0;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: buildReviewSystemPrompt() },
      { role: "user", content: buildReviewUserPrompt(request.factualReport) },
    ];

    for (let attempt = 0; attempt <= MAX_CORRECTION_ATTEMPTS; attempt++) {
      const response = await this.client.chatCompletion({ messages });

      totalLatencyMs += response.latencyMs;
      totalInputTokens += response.usage.promptTokens;
      totalOutputTokens += response.usage.completionTokens;
      totalCachedTokens += response.usage.cachedTokens;

      let parsed: unknown;
      try {
        parsed = parseJsonResponse(response.content);
      } catch {
        const err = buildParseErrorDiagnostic(response);
        allErrors.push(err);
        messages.push({
          role: "assistant",
          content: response.content,
        });
        if (response.finishReason === "length") {
          messages.push({
            role: "user",
            content: "Your response was truncated. Return ONLY a shorter JSON object.",
          });
        } else {
          messages.push({
            role: "user",
            content: buildReviewCorrectionPrompt([err]),
          });
        }
        continue;
      }

      const schemaResult = validateReviewSchema(parsed);
      if (!schemaResult.ok) {
        allErrors.push(...schemaResult.errors);
        messages.push({
          role: "assistant",
          content: response.content,
        });
        messages.push({
          role: "user",
          content: buildReviewCorrectionPrompt(schemaResult.errors),
        });
        continue;
      }

      const semanticErrors = validateReviewSemantic(schemaResult.review);
      if (semanticErrors.length > 0) {
        allErrors.push(...semanticErrors);
        messages.push({
          role: "assistant",
          content: response.content,
        });
        messages.push({
          role: "user",
          content: buildReviewCorrectionPrompt(semanticErrors),
        });
        continue;
      }

      const factualErrors = validateReviewAgainstFacts(
        schemaResult.review,
        request.factualReport,
      );
      if (factualErrors.length > 0) {
        allErrors.push(...factualErrors);
        messages.push({
          role: "assistant",
          content: response.content,
        });
        messages.push({
          role: "user",
          content: buildReviewCorrectionPrompt(factualErrors),
        });
        continue;
      }

      const cost = estimateCost(
        this.model,
        totalInputTokens,
        totalCachedTokens,
        totalOutputTokens,
      );

      return {
        value: schemaResult.review,
        raw: response.content,
        model: response.model,
        providerRequestId: response.id,
        finishReason: response.finishReason,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cachedTokens: totalCachedTokens,
        costUsd: cost.costUsd,
        costIsEstimated: cost.isEstimated,
        latencyMs: totalLatencyMs,
        attempts: attempt + 1,
        promptVersion: REVIEW_PROMPT_VERSION,
        fallbackUsed: false,
      };
    }

    return this.fallbackReviewResult(
      request.factualReport,
      totalLatencyMs,
      totalInputTokens,
      totalOutputTokens,
      totalCachedTokens,
    );
  }

  private fallbackReviewResult(
    factualReport: AnyFactualMatchReport,
    latencyMs: number,
    inputTokens: number,
    outputTokens: number,
    cachedTokens: number,
  ): AgentResult<MatchReview> {
    const fallbackSummary = buildFallbackReview(factualReport);

    const fallbackReview: MatchReview = {
      schemaVersion: "1",
      summary: fallbackSummary,
      keyMoments: [],
      strategyAssessment: {
        effectiveChoices: [],
        ineffectiveChoices: [],
        policyAssessment: "AI review unavailable.",
        designAssessment: "AI review unavailable.",
      },
      suggestedChanges: [],
      confidence: "low",
      observedOutcome: {
        winnerId: factualReport.winner,
        method: factualReport.resultMethod,
        rounds: factualReport.rounds,
        ownFinalIntegrity: factualReport.finalStates.fighterA.integrity,
        opponentFinalIntegrity: factualReport.finalStates.fighterB.integrity,
        ownDisabledComponents: normaliseDisabledComponents(
          factualReport.finalStates.fighterA,
        ),
        opponentDisabledComponents: normaliseDisabledComponents(
          factualReport.finalStates.fighterB,
        ),
      },
    };

    return {
      value: fallbackReview,
      raw: {
        fallback: true,
        reason: "Review generation failed after bounded correction",
      },
      model: this.model,
      providerRequestId: null,
      finishReason: "fallback",
      inputTokens,
      outputTokens,
      cachedTokens,
      costUsd: null,
      costIsEstimated: false,
      latencyMs,
      attempts: MAX_CORRECTION_ATTEMPTS + 1,
      promptVersion: REVIEW_PROMPT_VERSION,
      fallbackUsed: true,
    };
  }
}

export { AuthenticationError, RateLimitError, ProviderTimeout, ProviderError };
