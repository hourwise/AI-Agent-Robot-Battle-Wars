import { z } from "zod";
import { loadEnv } from "../../config/env.js";

const deepSeekConfigSchema = z.object({
  apiKey: z.string().min(1, "DEEPSEEK_API_KEY is required"),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  thinkingMode: z.enum(["thinking", "non-thinking"]),
  timeoutMs: z.number().int().positive(),
  maxRetries: z.number().int().min(0).max(5),
  maxResponseBytes: z.number().int().positive().default(4096),
});

export type DeepSeekConfig = z.infer<typeof deepSeekConfigSchema>;

export function loadDeepSeekConfig(): DeepSeekConfig {
  const env = loadEnv();

  if (!env.DEEPSEEK_API_KEY) {
    throw new Error(
      "DEEPSEEK_API_KEY is required. Set it in your .env file or environment.",
    );
  }

  const result = deepSeekConfigSchema.safeParse({
    apiKey: env.DEEPSEEK_API_KEY,
    baseUrl: env.DEEPSEEK_BASE_URL,
    model: env.DEEPSEEK_MODEL,
    thinkingMode: env.DEEPSEEK_THINKING_MODE,
    timeoutMs: env.DEEPSEEK_TIMEOUT_MS,
    maxRetries: env.DEEPSEEK_MAX_RETRIES,
  });

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid DeepSeek configuration:\n${issues}`);
  }

  return result.data;
}
