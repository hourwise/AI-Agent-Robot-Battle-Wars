import { describe, it, expect } from "vitest";
import { loadEnv } from "../../src/config/env.js";

describe("loadEnv", () => {
  it("returns defaults when no DeepSeek vars are set", () => {
    const env = loadEnv();
    expect(env.DEEPSEEK_MODEL).toBe("deepseek-v4-flash");
    expect(env.DEEPSEEK_THINKING_MODE).toBe("non-thinking");
    expect(env.DEEPSEEK_TIMEOUT_MS).toBe(60000);
    expect(env.DEEPSEEK_MAX_RETRIES).toBe(2);
    expect(env.DEEPSEEK_BASE_URL).toBe("https://api.deepseek.com");
    expect(env.DEEPSEEK_API_KEY).toBeUndefined();
  });
});
