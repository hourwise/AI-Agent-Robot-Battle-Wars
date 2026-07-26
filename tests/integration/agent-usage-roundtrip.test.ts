import { describe, it, expect } from "vitest";
import { runMatch } from "../../src/simulator/simulator.js";
import { CATALOGUE_V1 } from "../../src/catalogue/catalogue.v1.js";
import {
  createBulwarkBuild,
  BULWARK_POLICY,
} from "../../src/agents/scripted/bulwark-agent.js";
import { matchResultToRecord } from "../../src/persistence/match-converter.js";
import {
  serializeMatchRecord,
  deserializeMatchRecord,
} from "../../src/schemas/match-record.schema.js";
import type { AgentUsageRecord } from "../../src/types/agent-usage.js";

const MOCK_USAGE: AgentUsageRecord[] = [
  {
    phase: "design",
    agentId: "deepseek",
    provider: "deepseek",
    model: "deepseek-v4-flash",
    providerRequestId: "chatcmpl-test-123",
    promptVersion: "design-v1",
    inputTokens: 500,
    outputTokens: 200,
    cachedTokens: 50,
    costUsd: 0.0003,
    costIsEstimated: true,
    pricingVersion: "2025-01",
    latencyMs: 1500,
    attempts: 1,
    fallbackUsed: false,
    errorCategory: "none",
  },
  {
    phase: "policy",
    agentId: "deepseek",
    provider: "deepseek",
    model: "deepseek-v4-flash",
    providerRequestId: "chatcmpl-test-456",
    promptVersion: "policy-v2",
    inputTokens: 400,
    outputTokens: 150,
    cachedTokens: 0,
    costUsd: 0.0002,
    costIsEstimated: true,
    pricingVersion: "2025-01",
    latencyMs: 1200,
    attempts: 1,
    fallbackUsed: false,
    errorCategory: "none",
  },
];

describe("agent usage round-trip", () => {
  const build = createBulwarkBuild();

  it("design and policy usage survive JSON round-trip", () => {
    const result = runMatch({
      seed: 42,
      fighterA: { build, policy: BULWARK_POLICY },
      fighterB: { build, policy: BULWARK_POLICY },
      rulesetVersion: "0.1.0",
      catalogueVersion: CATALOGUE_V1.version,
    });

    const record = matchResultToRecord(result, MOCK_USAGE);
    expect(record.agentUsage).toHaveLength(2);

    const json = serializeMatchRecord(record);
    const loaded = deserializeMatchRecord(json);
    expect(loaded.ok).toBe(true);

    if (loaded.ok) {
      expect(loaded.record.agentUsage).toHaveLength(2);
      expect(loaded.record.agentUsage[0]!.phase).toBe("design");
      expect(loaded.record.agentUsage[0]!.providerRequestId).toBe("chatcmpl-test-123");
      expect(loaded.record.agentUsage[0]!.costUsd).toBe(0.0003);
      expect(loaded.record.agentUsage[0]!.costIsEstimated).toBe(true);
      expect(loaded.record.agentUsage[1]!.phase).toBe("policy");
      expect(loaded.record.agentUsage[1]!.cachedTokens).toBe(0);
    }
  });

  it("no secret is persisted in agent usage", () => {
    const result = runMatch({
      seed: 42,
      fighterA: { build, policy: BULWARK_POLICY },
      fighterB: { build, policy: BULWARK_POLICY },
      rulesetVersion: "0.1.0",
      catalogueVersion: CATALOGUE_V1.version,
    });

    const record = matchResultToRecord(result, MOCK_USAGE);
    const json = serializeMatchRecord(record);

    expect(json).not.toContain("api_key");
    expect(json).not.toContain("apiKey");
    expect(json).not.toContain("Bearer");
    expect(json).not.toContain("test-key");
  });

  it("defaults to empty agentUsage when none provided", () => {
    const result = runMatch({
      seed: 42,
      fighterA: { build, policy: BULWARK_POLICY },
      fighterB: { build, policy: BULWARK_POLICY },
      rulesetVersion: "0.1.0",
      catalogueVersion: CATALOGUE_V1.version,
    });

    const record = matchResultToRecord(result);
    expect(record.agentUsage).toEqual([]);

    const json = serializeMatchRecord(record);
    const loaded = deserializeMatchRecord(json);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.record.agentUsage).toEqual([]);
    }
  });

  it("request ID and finish reason are retained when present", () => {
    const result = runMatch({
      seed: 42,
      fighterA: { build, policy: BULWARK_POLICY },
      fighterB: { build, policy: BULWARK_POLICY },
      rulesetVersion: "0.1.0",
      catalogueVersion: CATALOGUE_V1.version,
    });

    const record = matchResultToRecord(result, MOCK_USAGE);
    const json = serializeMatchRecord(record);
    const loaded = deserializeMatchRecord(json);

    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      const designUsage = loaded.record.agentUsage.find((u) => u.phase === "design");
      expect(designUsage).toBeDefined();
      expect(designUsage!.providerRequestId).toBe("chatcmpl-test-123");
    }
  });

  it("cached-token usage is handled when present or absent", () => {
    const withCache = MOCK_USAGE.map((u) => ({
      ...u,
      cachedTokens: u.phase === "design" ? 50 : 0,
    }));

    const result = runMatch({
      seed: 42,
      fighterA: { build, policy: BULWARK_POLICY },
      fighterB: { build, policy: BULWARK_POLICY },
      rulesetVersion: "0.1.0",
      catalogueVersion: CATALOGUE_V1.version,
    });

    const record = matchResultToRecord(result, withCache);
    const json = serializeMatchRecord(record);
    const loaded = deserializeMatchRecord(json);

    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.record.agentUsage[0]!.cachedTokens).toBe(50);
      expect(loaded.record.agentUsage[1]!.cachedTokens).toBe(0);
    }
  });
});
