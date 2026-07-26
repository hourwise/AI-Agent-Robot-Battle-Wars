import type { DeepSeekConfig } from "./deepseek-config.js";

export interface ChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface DeepSeekResponse {
  readonly id: string;
  readonly content: string;
  readonly model: string;
  readonly finishReason: string | null;
  readonly usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
    readonly cachedTokens: number;
  };
  readonly latencyMs: number;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class ProviderTimeout extends Error {
  constructor(timeoutMs: number) {
    super(`DeepSeek request timed out after ${timeoutMs}ms`);
    this.name = "ProviderTimeout";
  }
}

export class ProviderError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ProviderError";
    this.statusCode = statusCode;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DeepSeekClient {
  private readonly config: DeepSeekConfig;

  constructor(config: DeepSeekConfig) {
    this.config = config;
  }

  async chatCompletion(params: {
    messages: readonly ChatMessage[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<DeepSeekResponse> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      if (attempt > 0) {
        const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 10000);
        await sleep(backoffMs);
      }

      try {
        return await this.doRequest(params, attempt);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));

        if (e instanceof AuthenticationError || e instanceof ProviderTimeout) {
          throw e;
        }

        if (e instanceof RateLimitError && attempt < this.config.maxRetries) {
          continue;
        }

        if (e instanceof ProviderError) {
          if (e.statusCode === 429 && attempt < this.config.maxRetries) {
            continue;
          }
          if (e.statusCode >= 500 && attempt < this.config.maxRetries) {
            continue;
          }
          throw e;
        }
      }
    }

    throw lastError ?? new Error("Unknown error in DeepSeek client");
  }

  private async doRequest(
    params: {
      messages: readonly ChatMessage[];
      temperature?: number;
      maxTokens?: number;
    },
    _attempt: number,
  ): Promise<DeepSeekResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    const body = {
      model: this.config.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 1024,
      response_format: { type: "json_object" },
    };

    const start = performance.now();

    try {
      const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const latencyMs = Math.round(performance.now() - start);

      if (!response.ok) {
        const errorText = await readBodySafe(response, this.config.maxResponseBytes);

        if (response.status === 401) {
          throw new AuthenticationError("Invalid API key");
        }
        if (response.status === 429) {
          throw new RateLimitError("Rate limited by DeepSeek");
        }

        throw new ProviderError(
          response.status,
          `DeepSeek API error ${response.status}: ${redact(errorText)}`,
        );
      }

      const rawJson = await readBodySafe(response, this.config.maxResponseBytes);
      const parsed = JSON.parse(rawJson) as Record<string, unknown>;

      const choice = (parsed.choices as Array<Record<string, unknown>>)?.[0];
      if (!choice) {
        throw new ProviderError(200, "No choices in DeepSeek response");
      }

      const message = choice.message as Record<string, unknown> | undefined;
      const content = typeof message?.content === "string" ? message.content : "";

      const finishReason =
        typeof choice.finish_reason === "string" ? choice.finish_reason : null;

      const usage = (parsed.usage as Record<string, unknown>) ?? {};
      const promptTokens = (usage.prompt_tokens as number) ?? 0;
      const completionTokens = (usage.completion_tokens as number) ?? 0;
      const details = usage.prompt_tokens_details as Record<string, unknown> | undefined;
      const cachedTokens = (details?.cached_tokens as number) ?? 0;

      return {
        id: (parsed.id as string) ?? `ds-${Date.now()}`,
        content,
        model: (parsed.model as string) ?? this.config.model,
        finishReason,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          cachedTokens,
        },
        latencyMs,
      };
    } catch (e) {
      if (e instanceof AuthenticationError || e instanceof ProviderError) {
        throw e;
      }

      if (e instanceof Error && e.name === "AbortError") {
        throw new ProviderTimeout(this.config.timeoutMs);
      }

      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

async function readBodySafe(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let result = "";
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.length;
      if (totalBytes > maxBytes) {
        throw new ProviderError(200, `Response exceeded ${maxBytes} byte limit`);
      }

      result += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }

  return result;
}

function redact(text: string): string {
  if (text.length > 100) {
    return text.slice(0, 100) + "...[redacted]";
  }
  return text;
}
