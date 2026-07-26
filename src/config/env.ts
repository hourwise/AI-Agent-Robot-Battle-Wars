import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().default("deepseek-v4-flash"),
  DEEPSEEK_THINKING_MODE: z.enum(["thinking", "non-thinking"]).default("non-thinking"),
  DEEPSEEK_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  DEEPSEEK_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}
