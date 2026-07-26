import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadEnv, resetEnvCacheForTests } from "../../src/config/env.js";

const originalEnv = { ...process.env };

describe("loadEnv", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };

    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.DEEPSEEK_MODEL;
    delete process.env.DEEPSEEK_THINKING_MODE;
    delete process.env.DEEPSEEK_TIMEOUT_MS;
    delete process.env.DEEPSEEK_MAX_RETRIES;
    delete process.env.DEEPSEEK_MAX_RESPONSE_BYTES;

    resetEnvCacheForTests();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetEnvCacheForTests();
  });

  it("returns defaults when no DeepSeek vars are set", () => {
    const env = loadEnv();

    expect(env.DEEPSEEK_API_KEY).toBeUndefined();
    expect(env.DEEPSEEK_BASE_URL).toBe("https://api.deepseek.com");
    expect(env.DEEPSEEK_MODEL).toBe("deepseek-v4-flash");
    expect(env.DEEPSEEK_THINKING_MODE).toBe("non-thinking");
    expect(env.DEEPSEEK_TIMEOUT_MS).toBe(60000);
    expect(env.DEEPSEEK_MAX_RETRIES).toBe(2);
    expect(env.DEEPSEEK_MAX_RESPONSE_BYTES).toBe(32768);
  });
});
