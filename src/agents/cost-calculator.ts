export interface PricingTier {
  readonly inputPerToken: number;
  readonly cachedInputPerToken: number;
  readonly outputPerToken: number;
}

export interface CostEstimate {
  readonly costUsd: number;
  readonly isEstimated: boolean;
  readonly pricingVersion: string;
}

const DEEPSEEK_V4_FLASH_PRICING: PricingTier = {
  inputPerToken: 0.27 / 1_000_000,
  cachedInputPerToken: 0.07 / 1_000_000,
  outputPerToken: 1.1 / 1_000_000,
};

const PRICING_REGISTRY: Record<string, PricingTier> = {
  "deepseek-v4-flash": DEEPSEEK_V4_FLASH_PRICING,
};

const DEFAULT_PRICING_VERSION = "2025-01";

export function getPricingTier(model: string): PricingTier | null {
  return PRICING_REGISTRY[model] ?? null;
}

export function estimateCost(
  model: string,
  inputTokens: number,
  cachedTokens: number,
  outputTokens: number,
): CostEstimate {
  const tier = getPricingTier(model);

  if (!tier) {
    return {
      costUsd: 0,
      isEstimated: true,
      pricingVersion: DEFAULT_PRICING_VERSION,
    };
  }

  const regularInput = Math.max(0, inputTokens - cachedTokens);
  const cost =
    regularInput * tier.inputPerToken +
    cachedTokens * tier.cachedInputPerToken +
    outputTokens * tier.outputPerToken;

  return {
    costUsd: Math.round(cost * 1_000_000) / 1_000_000,
    isEstimated: true,
    pricingVersion: DEFAULT_PRICING_VERSION,
  };
}
