import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    // Generous default timeout: several governance/source-snapshot tests read
    // the exact reviewed Git commit objects (26 files) through
    // `buildInMemoryReviewedSourceReader`. The first such read per worker can
    // take ~20-40s under full-suite fork-pool load, so the 30s default was
    // exceeded intermittently. 90s preserves hang detection while removing
    // that load-induced flakiness.
    testTimeout: 90000,
    pool: "forks",
    typecheck: {
      enabled: true,
    },
  },
});
