import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "json-summary", "lcov"],
      include: ["apps/web/lib/**/*.ts", "packages/**/*.ts"],
      exclude: [
        ".next/**",
        "**/.next/**",
        "**/dist/**",
        "coverage/**",
        "docs/**",
        "e2e/**",
        "apps/web/lib/audio.ts",
        "apps/web/lib/use-prototype-settings.ts",
        "playwright-report/**",
        "packages/*/src/client.ts",
        "packages/*/src/index.ts",
        "packages/*/src/interface.ts",
        "packages/*/src/types.ts",
        "playwright.config.ts",
        "test-results/**",
        "tests/**",
        "**/*.d.ts"
      ]
    }
  }
})
