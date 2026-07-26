import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DeepSeekArenaAgent,
  DesignFailedError,
} from "../../src/agents/deepseek/deepseek-agent.js";
import type { DeepSeekConfig } from "../../src/agents/deepseek/deepseek-config.js";
import fixture from "../fixtures/deepseek-design-response.json";
import {
  AuthenticationError,
  ProviderTimeout,
} from "../../src/agents/deepseek/deepseek-client.js";

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

function mockFetchSuccess(content: unknown) {
  globalThis.fetch = vi.fn().mockImplementation(async () => ({
    ok: true,
    status: 200,
    body: {
      getReader: () => {
        const encoder = new TextEncoder();
        const data = encoder.encode(
          JSON.stringify({
            id: "chatcmpl-mock",
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content:
                    typeof content === "string" ? content : JSON.stringify(content),
                },
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 50,
              total_tokens: 150,
            },
          }),
        );
        let offset = 0;
        return {
          read: async () => {
            if (offset >= data.length) {
              return { done: true, value: undefined };
            }
            const chunk = data.slice(offset, offset + 4096);
            offset += chunk.length;
            return { done: false, value: chunk };
          },
          releaseLock: () => {},
        };
      },
    },
  }));
}

function mockFetchSequence(responses: Array<{ status?: number; body?: unknown }>) {
  let callIndex = 0;

  globalThis.fetch = vi.fn().mockImplementation(async () => {
    const resp = responses[callIndex] ?? responses[responses.length - 1]!;
    callIndex++;

    const status = resp.status ?? 200;
    const bodyStr = JSON.stringify(resp.body ?? fixture);

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
              const chunk = data.slice(offset, offset + 4096);
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

describe("DeepSeekArenaAgent", () => {
  let agent: DeepSeekArenaAgent;

  beforeEach(() => {
    agent = new DeepSeekArenaAgent(makeConfig());
  });

  it("returns a valid MachineBuildProposal from a valid response", async () => {
    mockFetchSuccess(fixture.choices[0]!.message.content);

    const result = await agent.designMachine({});

    expect(result.value.machineName).toBe("Cirque du Fragile");
    expect(result.value.chassisId).toBe("medium");
    expect(result.value.mobilityId).toBe("legs");
    expect(result.value.weaponId).toBe("flipper");
    expect(result.value.utilityId).toBe("cooling");
    expect(result.value.armour.front).toBe(20);
    expect(result.value.machineName).toBeTruthy();
    expect(result.model).toBe("deepseek-v4-flash");
    expect(result.promptVersion).toBe("design-v1");
    expect(result.attempts).toBe(1);
  });

  it("includes token usage in result", async () => {
    mockFetchSuccess(fixture.choices[0]!.message.content);

    const result = await agent.designMachine({});

    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("retries on schema validation failure then succeeds", async () => {
    mockFetchSequence([
      { body: { choices: [{ message: { content: "not json" } }], usage: {} } },
      { body: fixture },
    ]);

    const result = await agent.designMachine({});

    expect(result.value.machineName).toBe("Cirque du Fragile");
    expect(result.attempts).toBe(2);
  });

  it("throws DesignFailedError after exhausting correction attempts", async () => {
    mockFetchSuccess("not valid json at all");

    await expect(agent.designMachine({})).rejects.toThrow(DesignFailedError);
  });

  it("throws DesignFailedError when build is consistently over budget", async () => {
    const overBudgetBuild = {
      machineName: "OverBudget",
      chassisId: "heavy",
      mobilityId: "legs",
      weaponId: "horizontal_spinner",
      utilityId: "reinforced_drive",
      armour: { front: 60, left: 60, right: 60, rear: 60, top: 0 },
      designSummary: "Too expensive",
      designRationale: "Will be rejected",
    };

    mockFetchSuccess(overBudgetBuild);

    await expect(agent.designMachine({})).rejects.toThrow(DesignFailedError);
  });

  it("throws AuthenticationError on 401", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 401,
        body: {
          getReader: () => ({
            read: async () => ({ done: true, value: undefined }),
            releaseLock: () => {},
          }),
        },
      };
    });

    await expect(agent.designMachine({})).rejects.toThrow(AuthenticationError);
  });

  it("throws ProviderTimeout on timeout", async () => {
    const timeoutAgent = new DeepSeekArenaAgent(
      makeConfig({ timeoutMs: 50, maxRetries: 0 }),
    );

    globalThis.fetch = vi
      .fn()
      .mockImplementation(async (_url: string, opts: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const abortHandler = () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          };
          opts.signal?.addEventListener("abort", abortHandler);

          const timer = setTimeout(() => {
            _resolve({
              ok: true,
              status: 200,
              body: {
                getReader: () => ({
                  read: async () => ({ done: true, value: undefined }),
                  releaseLock: () => {},
                }),
              },
            });
          }, 10000);
          void timer;
        });
      });

    await expect(timeoutAgent.designMachine({})).rejects.toThrow(ProviderTimeout);
  });

  it("rejects review method", async () => {
    await expect(agent.reviewMatch({ matchSummary: "test" })).rejects.toThrow(
      "Not implemented",
    );
  });

  it("has correct metadata", () => {
    expect(agent.id).toBe("deepseek");
    expect(agent.displayName).toBe("DeepSeek AI");
    expect(agent.provider).toBe("deepseek");
    expect(agent.model).toBe("deepseek-v4-flash");
  });

  describe("choosePolicy", () => {
    const validPolicyResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              opening: "flank",
              preferredRange: "close",
              aggression: 70,
              primaryTarget: "rear",
              secondaryTarget: "left",
              retreatThreshold: 30,
              heatThreshold: 80,
              fallback: "retreat",
            }),
          },
        },
      ],
      usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
    };

    const validBuild = {
      machineName: "TestBot",
      chassisId: "medium",
      mobilityId: "legs",
      weaponId: "flipper",
      utilityId: "cooling",
      armour: { front: 20, left: 15, right: 15, rear: 10, top: 5 },
      designSummary: "Test bot",
      designRationale: "For testing",
    };

    const mockOpponent = {
      machineName: "OpponentBot",
      chassisId: "heavy",
      mobilityId: "tracks",
      weaponId: "ram",
      utilityId: "none",
      armour: { front: 50, left: 10, right: 10, rear: 0, top: 0 },
      knownWeaknesses: ["zero rear armour"],
    };

    it("returns a valid ActionPolicy from a valid response", async () => {
      mockFetchSuccess(validPolicyResponse.choices[0]!.message.content);

      const result = await agent.choosePolicy({
        build: validBuild,
        opponent: mockOpponent,
      });

      expect(result.value.opening).toBe("flank");
      expect(result.value.preferredRange).toBe("close");
      expect(result.value.aggression).toBe(70);
      expect(result.value.primaryTarget).toBe("rear");
      expect(result.value.fallback).toBe("retreat");
      expect(result.promptVersion).toBe("policy-v2");
      expect(result.attempts).toBe(1);
      expect(result.fallbackUsed).toBe(false);
    });

    it("includes token usage in result", async () => {
      mockFetchSequence([{ body: validPolicyResponse }]);

      const result = await agent.choosePolicy({
        build: validBuild,
        opponent: mockOpponent,
      });

      expect(result.inputTokens).toBe(80);
      expect(result.outputTokens).toBe(40);
    });

    it("retries on invalid JSON then succeeds", async () => {
      mockFetchSequence([
        { body: { choices: [{ message: { content: "not json" } }], usage: {} } },
        { body: validPolicyResponse },
      ]);

      const result = await agent.choosePolicy({
        build: validBuild,
        opponent: mockOpponent,
      });

      expect(result.value.opening).toBe("flank");
      expect(result.attempts).toBe(2);
    });

    it("returns fallback policy when correction attempts exhausted", async () => {
      mockFetchSuccess("not valid json at all");

      const result = await agent.choosePolicy({
        build: validBuild,
        opponent: mockOpponent,
      });

      expect(result.fallbackUsed).toBe(true);
      expect(result.value.opening).toBe("cautious");
      expect(result.value.aggression).toBe(50);
      expect(result.value.fallback).toBe("defend");
    });

    it("returns fallback policy with aggression too high", async () => {
      const badPolicy = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                opening: "rush",
                preferredRange: "close",
                aggression: 95,
                primaryTarget: "front",
                secondaryTarget: "front",
                retreatThreshold: 10,
                heatThreshold: 90,
                fallback: "desperate_attack",
              }),
            },
          },
        ],
        usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
      };

      mockFetchSuccess(badPolicy.choices[0]!.message.content);

      const result = await agent.choosePolicy({
        build: validBuild,
        opponent: mockOpponent,
      });

      expect(result.fallbackUsed).toBe(true);
      expect(result.value).toEqual({
        opening: "cautious",
        preferredRange: "medium",
        aggression: 50,
        primaryTarget: "front",
        secondaryTarget: "front",
        retreatThreshold: 30,
        heatThreshold: 75,
        fallback: "defend",
      });
    });

    it("retains provider metadata when present", async () => {
      mockFetchSequence([
        {
          body: {
            id: "chatcmpl-test-123",
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    opening: "flank",
                    preferredRange: "close",
                    aggression: 70,
                    primaryTarget: "rear",
                    secondaryTarget: "left",
                    retreatThreshold: 30,
                    heatThreshold: 80,
                    fallback: "retreat",
                  }),
                },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
          },
        },
      ]);

      const result = await agent.choosePolicy({
        build: validBuild,
        opponent: mockOpponent,
      });

      expect(result.providerRequestId).toBe("chatcmpl-test-123");
      expect(result.finishReason).toBe("stop");
    });
  });
});
