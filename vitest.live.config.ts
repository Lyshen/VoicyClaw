import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.live.test.ts"],
    restoreMocks: true,
    hookTimeout: 120_000,
    testTimeout: 120_000,
  },
})
