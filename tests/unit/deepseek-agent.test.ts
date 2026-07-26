import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DeepSeekArenaAgent,
  DesignFailedError,
  validateReviewAgainstFacts,
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
    expect(result.promptVersion).toBe("design-v2");
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

  it("returns a valid MatchReview from a valid response", async () => {
    const mockReview = {
      schemaVersion: "1",
      summary: "Fighter A won by destruction in 12 rounds after a strong flank attack.",
      keyMoments: [
        {
          round: 5,
          eventType: "attack",
          description: "Fighter A hits Fighter B for 18 damage",
        },
      ],
      strategyAssessment: {
        effectiveChoices: ["flanking movement", "rear targeting"],
        ineffectiveChoices: ["excessive aggression early"],
        policyAssessment: "Opening flank was effective against slow opponent.",
        designAssessment: "Weapon choice was strong for close range.",
      },
      suggestedChanges: [
        {
          target: "armour",
          action: "Increase rear armour from 0 to 15",
          rationale: "Opponent may target rear if it flanks",
          priority: "medium",
        },
      ],
      confidence: "high",
      observedOutcome: {
        winnerId: "fighter_a",
        method: "destruction",
        rounds: 12,
        ownFinalIntegrity: 80,
        opponentFinalIntegrity: 0,
        ownDisabledComponents: [],
        opponentDisabledComponents: [],
      },
    };

    mockFetchSuccess(mockReview);

    const result = await agent.reviewMatch({
      factualReport: {
        schemaVersion: "1",
        matchId: "test-match",
        seed: 42,
        rounds: 12,
        winner: "fighter_a",
        resultMethod: "destruction",
        fighterA: {
          fighterId: "fighter_a",
          machineName: "Test Bot",
          chassisId: "medium",
          mobilityId: "wheels",
          weaponId: "ram",
          utilityId: "none",
          armour: { front: 20, left: 10, right: 10, rear: 0, top: 0 },
          totalCost: 50,
          opening: "flank",
          preferredRange: "close",
          aggression: 70,
          primaryTarget: "rear",
          secondaryTarget: "left",
        },
        fighterB: {
          fighterId: "fighter_b",
          machineName: "The Bulwark",
          chassisId: "heavy",
          mobilityId: "tracks",
          weaponId: "ram",
          utilityId: "reinforced_drive",
          armour: { front: 60, left: 15, right: 15, rear: 0, top: 0 },
          totalCost: 52,
          opening: "rush",
          preferredRange: "close",
          aggression: 85,
          primaryTarget: "front",
          secondaryTarget: "front",
        },
        criticalHits: [],
        componentFailures: [],
        overturns: [],
        finalStates: {
          fighterA: {
            fighterId: "fighter_a",
            machineName: "Test Bot",
            integrity: 80,
            maxIntegrity: 100,
            energy: 60,
            heat: 20,
            zone: "center",
            facing: "north",
            weaponCooldown: 0,
            utilityCooldown: 0,
            mobilityDisabled: false,
            weaponDisabled: false,
            utilityDisabled: false,
            conditions: [],
          },
          fighterB: {
            fighterId: "fighter_b",
            machineName: "The Bulwark",
            integrity: 0,
            maxIntegrity: 100,
            energy: 0,
            heat: 30,
            zone: "center",
            facing: "south",
            weaponCooldown: 0,
            utilityCooldown: 0,
            mobilityDisabled: false,
            weaponDisabled: false,
            utilityDisabled: false,
            conditions: [],
          },
        },
      },
    });

    expect(result.value.summary).toContain("destruction");
    expect(result.value.keyMoments).toHaveLength(1);
    expect(result.value.suggestedChanges).toHaveLength(1);
    expect(result.value.confidence).toBe("high");
    expect(result.promptVersion).toBe("review-v1");
  });

  it("returns fallback review when correction attempts exhausted", async () => {
    mockFetchSequence([
      { body: { choices: [{ message: { content: "not valid json" } }] } },
      { body: { choices: [{ message: { content: "still invalid" } }] } },
      { body: { choices: [{ message: { content: "also bad" } }] } },
    ]);

    const result = await agent.reviewMatch({
      factualReport: {
        schemaVersion: "1",
        matchId: "test",
        seed: 42,
        rounds: 10,
        winner: "fighter_a",
        resultMethod: "judges",
        fighterA: {
          fighterId: "fighter_a",
          machineName: "A",
          chassisId: "medium",
          mobilityId: "wheels",
          weaponId: "ram",
          utilityId: "none",
          armour: { front: 20, left: 10, right: 10, rear: 0, top: 0 },
          totalCost: 50,
          opening: "flank",
          preferredRange: "close",
          aggression: 70,
          primaryTarget: "rear",
          secondaryTarget: "left",
        },
        fighterB: {
          fighterId: "fighter_b",
          machineName: "B",
          chassisId: "heavy",
          mobilityId: "tracks",
          weaponId: "ram",
          utilityId: "reinforced_drive",
          armour: { front: 60, left: 15, right: 15, rear: 0, top: 0 },
          totalCost: 52,
          opening: "rush",
          preferredRange: "close",
          aggression: 85,
          primaryTarget: "front",
          secondaryTarget: "front",
        },
        criticalHits: [],
        componentFailures: [],
        overturns: [],
        finalStates: {
          fighterA: {
            fighterId: "fighter_a",
            machineName: "A",
            integrity: 50,
            maxIntegrity: 100,
            energy: 50,
            heat: 10,
            zone: "center",
            facing: "north",
            weaponCooldown: 0,
            utilityCooldown: 0,
            mobilityDisabled: false,
            weaponDisabled: false,
            utilityDisabled: false,
            conditions: [],
          },
          fighterB: {
            fighterId: "fighter_b",
            machineName: "B",
            integrity: 45,
            maxIntegrity: 100,
            energy: 40,
            heat: 15,
            zone: "center",
            facing: "south",
            weaponCooldown: 0,
            utilityCooldown: 0,
            mobilityDisabled: false,
            weaponDisabled: false,
            utilityDisabled: false,
            conditions: [],
          },
        },
      },
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.value.confidence).toBe("low");
    expect(result.value.suggestedChanges).toHaveLength(0);
    expect(result.value.summary).toContain("fighter_a");
    expect(result.value.summary).toContain("judges");
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

// --- Review validation regression tests (Rear-Hunter vs Bulwark, seed 12345) ---

import type { MatchReview, ObservedOutcome } from "../../src/schemas/review.schema.js";
import type { FactualMatchReport } from "../../src/schemas/factual-report.schema.js";

function makeRearHunterFactualReport(
  overrides: Partial<FactualMatchReport> = {},
): FactualMatchReport {
  return {
    schemaVersion: "1",
    matchId: "f0f00065",
    seed: 12345,
    rounds: 6,
    winner: "fighter_b",
    resultMethod: "immobilisation",
    fighterA: {
      fighterId: "fighter_a",
      machineName: "Rear-Hunter",
      chassisId: "medium",
      mobilityId: "wheels",
      weaponId: "horizontal_spinner",
      utilityId: "cooling",
      armour: { front: 30, left: 20, right: 20, rear: 10, top: 10 },
      totalCost: 86,
      opening: "flank",
      preferredRange: "close",
      aggression: 80,
      primaryTarget: "rear",
      secondaryTarget: "left",
    },
    fighterB: {
      fighterId: "fighter_b",
      machineName: "The Bulwark",
      chassisId: "heavy",
      mobilityId: "tracks",
      weaponId: "ram",
      utilityId: "reinforced_drive",
      armour: { front: 60, left: 15, right: 15, rear: 0, top: 0 },
      totalCost: 94,
      opening: "rush",
      preferredRange: "close",
      aggression: 85,
      primaryTarget: "front",
      secondaryTarget: "front",
    },
    firstHit: undefined,
    criticalHits: [],
    componentFailures: [],
    overturns: [],
    finalStates: {
      fighterA: {
        fighterId: "fighter_a",
        machineName: "Rear-Hunter",
        integrity: 80,
        maxIntegrity: 100,
        energy: 30,
        heat: 40,
        zone: "center",
        facing: "east",
        weaponCooldown: 0,
        utilityCooldown: 0,
        mobilityDisabled: true,
        weaponDisabled: false,
        utilityDisabled: false,
        conditions: [],
      },
      fighterB: {
        fighterId: "fighter_b",
        machineName: "The Bulwark",
        integrity: 150,
        maxIntegrity: 150,
        energy: 50,
        heat: 30,
        zone: "center",
        facing: "west",
        weaponCooldown: 0,
        utilityCooldown: 0,
        mobilityDisabled: false,
        weaponDisabled: false,
        utilityDisabled: false,
        conditions: [],
      },
    },
    ...overrides,
  };
}

function makeValidOutcome(overrides: Partial<ObservedOutcome> = {}): ObservedOutcome {
  return {
    winnerId: "fighter_b",
    method: "immobilisation",
    rounds: 6,
    ownFinalIntegrity: 80,
    opponentFinalIntegrity: 150,
    ownDisabledComponents: ["mobility"],
    opponentDisabledComponents: [],
    ...overrides,
  };
}

function makeReview(outcome: ObservedOutcome): MatchReview {
  return {
    schemaVersion: "1",
    summary: "Test review",
    keyMoments: [
      {
        round: 5,
        eventType: "component_disabled",
        description: "Rear-Hunter mobility disabled",
      },
    ],
    strategyAssessment: {
      effectiveChoices: [],
      ineffectiveChoices: [],
      policyAssessment: "test",
      designAssessment: "test",
    },
    suggestedChanges: [],
    confidence: "medium",
    observedOutcome: outcome,
  };
}

describe("validateReviewAgainstFacts", () => {
  it("accepts exact authoritative outcome", () => {
    const report = makeRearHunterFactualReport();
    const review = makeReview(makeValidOutcome());
    const errors = validateReviewAgainstFacts(review, report);
    expect(errors).toHaveLength(0);
  });

  it("rejects incorrect own final integrity", () => {
    const report = makeRearHunterFactualReport();
    const review = makeReview(makeValidOutcome({ ownFinalIntegrity: 100 }));
    const errors = validateReviewAgainstFacts(review, report);
    expect(errors).toContainEqual(
      expect.stringContaining("ownFinalIntegrity is 100 but fighter_a ended at 80"),
    );
  });

  it("rejects incorrect opponent final integrity", () => {
    const report = makeRearHunterFactualReport();
    const review = makeReview(makeValidOutcome({ opponentFinalIntegrity: 100 }));
    const errors = validateReviewAgainstFacts(review, report);
    expect(errors).toContainEqual(
      expect.stringContaining("opponentFinalIntegrity is 100 but fighter_b ended at 150"),
    );
  });

  it("rejects missing mobility disable", () => {
    const report = makeRearHunterFactualReport();
    const review = makeReview(makeValidOutcome({ ownDisabledComponents: [] }));
    const errors = validateReviewAgainstFacts(review, report);
    expect(errors).toContainEqual(
      expect.stringContaining("ownDisabledComponents is [] but fighter_a had [mobility]"),
    );
  });

  it("rejects extra disabled component", () => {
    const report = makeRearHunterFactualReport();
    const review = makeReview(
      makeValidOutcome({ ownDisabledComponents: ["mobility", "weapon"] }),
    );
    const errors = validateReviewAgainstFacts(review, report);
    expect(errors).toContainEqual(
      expect.stringContaining(
        "ownDisabledComponents is [mobility, weapon] but fighter_a had [mobility]",
      ),
    );
  });

  it("rejects reversed own/opponent state (own shows opponent's integrity)", () => {
    const report = makeRearHunterFactualReport();
    // Swapped: own shows Bulwark integrity, opponent shows Rear-Hunter integrity
    const review = makeReview(
      makeValidOutcome({
        ownFinalIntegrity: 150,
        opponentFinalIntegrity: 80,
        ownDisabledComponents: [],
        opponentDisabledComponents: ["mobility"],
      }),
    );
    const errors = validateReviewAgainstFacts(review, report);
    expect(errors.length).toBeGreaterThanOrEqual(4);
    expect(errors).toContainEqual(
      expect.stringContaining("ownFinalIntegrity is 150 but fighter_a ended at 80"),
    );
    expect(errors).toContainEqual(
      expect.stringContaining("opponentFinalIntegrity is 80 but fighter_b ended at 150"),
    );
  });

  it("rejects incorrect winner", () => {
    const report = makeRearHunterFactualReport();
    const review = makeReview(makeValidOutcome({ winnerId: "fighter_a" }));
    const errors = validateReviewAgainstFacts(review, report);
    expect(errors).toContainEqual(
      expect.stringContaining(`winnerId is "fighter_a" but match winner is "fighter_b"`),
    );
  });

  it("rejects incorrect method", () => {
    const report = makeRearHunterFactualReport();
    const review = makeReview(makeValidOutcome({ method: "destruction" }));
    const errors = validateReviewAgainstFacts(review, report);
    expect(errors).toContainEqual(
      expect.stringContaining(
        `method is "destruction" but match result is "immobilisation"`,
      ),
    );
  });

  it("rejects incorrect rounds", () => {
    const report = makeRearHunterFactualReport();
    const review = makeReview(makeValidOutcome({ rounds: 10 }));
    const errors = validateReviewAgainstFacts(review, report);
    expect(errors).toContainEqual(
      expect.stringContaining("rounds is 10 but match lasted 6 rounds"),
    );
  });

  it("accepts disabled components in any order (normalised set comparison)", () => {
    const report = makeRearHunterFactualReport({
      finalStates: {
        ...makeRearHunterFactualReport().finalStates,
        fighterA: {
          ...makeRearHunterFactualReport().finalStates.fighterA,
          mobilityDisabled: true,
          weaponDisabled: true,
        },
      },
    });
    // Model returns them in reverse canonical order — should still match
    const review = makeReview(
      makeValidOutcome({
        ownFinalIntegrity: 80,
        ownDisabledComponents: ["weapon", "mobility"],
      }),
    );
    const errors = validateReviewAgainstFacts(review, report);
    expect(errors).toHaveLength(0);
  });
});
