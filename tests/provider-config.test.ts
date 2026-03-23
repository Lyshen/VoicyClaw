import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  loadProviderConfig,
  resolveAzureSpeechTTSConfig,
  resolveGoogleCloudTTSConfig,
} from "../apps/server/src/provider-config"

describe("provider config", () => {
  it("loads Azure and Google TTS YAML provider config", () => {
    const cwd = mkdtempSync(
      path.join(os.tmpdir(), "voicyclaw-provider-config-"),
    )
    const filePath = path.join(cwd, "providers.local.yaml")
    writeFileSync(
      filePath,
      [
        "AzureSpeechTTS:",
        "  type: azure_speech_tts",
        "  endpoint: https://eastasia.api.cognitive.microsoft.com/",
        "  region: eastasia",
        "  api_key: azure-key",
        "  voice: en-US-JennyNeural",
        "  sample_rate: 24000",
        "",
        "GoogleCloudTTS:",
        "  type: google_cloud_tts",
        "  api_key: google-key",
        "  voice: en-US-Chirp3-HD-Achernar",
        "  sample_rate: 24000",
        "  speaking_rate: 1.0",
        "  pitch: 0",
      ].join("\n"),
    )

    const env = {
      VOICYCLAW_PROVIDER_CONFIG: filePath,
    }

    expect(loadProviderConfig(env).AzureSpeechTTS).toBeTruthy()
    expect(resolveAzureSpeechTTSConfig(env)).toMatchObject({
      type: "azure_speech_tts",
      region: "eastasia",
      api_key: "azure-key",
      voice: "en-US-JennyNeural",
    })
    expect(resolveGoogleCloudTTSConfig(env)).toMatchObject({
      type: "google_cloud_tts",
      api_key: "google-key",
      voice: "en-US-Chirp3-HD-Achernar",
      sample_rate: 24000,
    })
  })

  it("finds config/providers.local.yaml from a nested server working directory", () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), "voicyclaw-provider-config-root-"),
    )
    const configDir = path.join(root, "config")
    const nestedCwd = path.join(root, "apps", "server")
    mkdirSync(configDir, { recursive: true })
    mkdirSync(nestedCwd, { recursive: true })
    writeFileSync(
      path.join(configDir, "providers.local.yaml"),
      [
        "AzureSpeechTTS:",
        "  region: eastasia",
        "  api_key: nested-azure-key",
      ].join("\n"),
    )

    const originalCwd = process.cwd()
    process.chdir(nestedCwd)

    try {
      expect(resolveAzureSpeechTTSConfig({})).toMatchObject({
        region: "eastasia",
        api_key: "nested-azure-key",
      })
    } finally {
      process.chdir(originalCwd)
    }
  })
})
