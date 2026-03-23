import { describe, expect, it } from "vitest"

import {
  resolveSelectedTTSFixtureProviders,
  resolveTTSFixtureMode,
  runTTSFixtureProvider,
} from "./support/tts-live-fixtures"

describe.sequential("TTS provider live fixtures", () => {
  const providers = resolveSelectedTTSFixtureProviders()

  for (const provider of providers) {
    const resolution = provider.resolve(process.env)
    const testCase = resolution.configured ? it : it.skip

    testCase(
      `${provider.id} renders hello/你好 fixture audio (${resolveTTSFixtureMode()})`,
      async () => {
        const result = await runTTSFixtureProvider(provider)

        expect(result.manifests).toHaveLength(2)
        expect(
          result.manifests.every((manifest) => manifest.byteLength > 0),
        ).toBe(true)
        expect(
          result.manifests.every((manifest) => manifest.pcm16Aligned),
        ).toBe(true)
        expect(
          result.manifests.every((manifest) => manifest.nonZeroSampleCount > 0),
        ).toBe(true)
      },
      120_000,
    )
  }
})
