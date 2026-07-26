import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeepSeekClient } from "../../src/agents/deepseek/deepseek-client.js";
import type { DeepSeekConfig } from "../../src/agents/deepseek/deepseek-config.js";
import type { ChatMessage } from "../../src/agents/deepseek/deepseek-client.js";
import fixture from "../fixtures/deepseek-design-response.json";

function makeConfig(overrides: Partial<DeepSeekConfig> = {}): DeepSeekConfig {
  return {
    apiKey: "test-key",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    thinkingMode: "non-thinking",
    timeoutMs: 5000,
    maxRetries: 0,
    maxResponseBytes: 4096,
    ...overrides,
  };
}

function mockFetch(response: { status?: number; body?: unknown; delay?: number }) {
  const { status = 200, body, delay = 0 } = response;

  return vi.fn().mockImplementation(async () => {
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }

    const bodyStr = JSON.stringify(body ?? fixture);

    return {
      ok: status >= 200 && status < 300,
      status,
      body: {
        getReader: () => {
          const encoder = new TextEncoder();
          const data = encoder.encode(bodyStr);
          let offset = 0;
          return {
            read: async () => {
              if (offset >= data.length) {
                return { done: true, value: undefined };
              }
              const chunk = data.slice(offset, offset + 1024);
              offset += chunk.length;
              return { done: false, value: chunk };
            },
            releaseLock: () => {},
          };
        },
      },
    };
  });
}

describe("DeepSeekClient", () => {
  let client: DeepSeekClient;

  beforeEach(() => {
    client = new DeepSeekClient(makeConfig());
  });

  it("parses a valid response", async () => {
    globalThis.fetch = mockFetch({ status: 200 });

    const messages: ChatMessage[] = [{ role: "user", content: "test" }];
    const result = await client.chatCompletion({ messages });

    expect(result.content).toBeTruthy();
    expect(result.model).toBe("deepseek-v4-flash");
    expect(result.usage.promptTokens).toBe(450);
    expect(result.usage.completionTokens).toBe(180);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("throws AuthenticationError on 401", async () => {
    globalThis.fetch = mockFetch({
      status: 401,
      body: { error: { message: "Unauthorized" } },
    });

    await expect(
      client.chatCompletion({ messages: [{ role: "user", content: "test" }] }),
    ).rejects.toThrow("Invalid API key");
  });

  it("throws RateLimitError on 429", async () => {
    globalThis.fetch = mockFetch({
      status: 429,
      body: { error: { message: "Rate limited" } },
    });

    await expect(
      client.chatCompletion({ messages: [{ role: "user", content: "test" }] }),
    ).rejects.toThrow("Rate limited");
  });

  it("throws ProviderError on 500", async () => {
    globalThis.fetch = mockFetch({
      status: 500,
      body: { error: { message: "Internal error" } },
    });

    await expect(
      client.chatCompletion({ messages: [{ role: "user", content: "test" }] }),
    ).rejects.toThrow("DeepSeek API error 500");
  });

  it("retries on 500 when maxRetries > 0", async () => {
    const clientWithRetries = new DeepSeekClient(makeConfig({ maxRetries: 1 }));
    let callCount = 0;

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 500,
          body: {
            getReader: () => ({
              read: async () => ({ done: true, value: undefined }),
              releaseLock: () => {},
            }),
          },
        };
      }
      return {
        ok: true,
        status: 200,
        body: {
          getReader: () => {
            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify(fixture));
            let offset = 0;
            return {
              read: async () => {
                if (offset >= data.length) {
                  return { done: true, value: undefined };
                }
                const chunk = data.slice(offset, offset + 1024);
                offset += chunk.length;
                return { done: false, value: chunk };
              },
              releaseLock: () => {},
            };
          },
        },
      };
    });

    const result = await clientWithRetries.chatCompletion({
      messages: [{ role: "user", content: "test" }],
    });

    expect(callCount).toBe(2);
    expect(result.content).toBeTruthy();
  });

  it("sends json_object response format", async () => {
    let capturedBody: string = "";
    globalThis.fetch = vi
      .fn()
      .mockImplementation(async (_url: string, opts: RequestInit) => {
        capturedBody = opts.body as string;
        return {
          ok: true,
          status: 200,
          body: {
            getReader: () => {
              const encoder = new TextEncoder();
              const data = encoder.encode(JSON.stringify(fixture));
              let offset = 0;
              return {
                read: async () => {
                  if (offset >= data.length) {
                    return { done: true, value: undefined };
                  }
                  const chunk = data.slice(offset, offset + 1024);
                  offset += chunk.length;
                  return { done: false, value: chunk };
                },
                releaseLock: () => {},
              };
            },
          },
        };
      });

    await client.chatCompletion({
      messages: [{ role: "user", content: "test" }],
    });

    const body = JSON.parse(capturedBody);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.model).toBe("deepseek-v4-flash");
  });
});
