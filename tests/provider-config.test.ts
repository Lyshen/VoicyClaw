import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  loadProviderConfig,
  resolveAzureSpeechStreamingTTSConfig,
  resolveAzureSpeechTTSConfig,
  resolveDoubaoStreamTTSConfig,
  resolveGoogleCloudBatchedTTSConfig,
  resolveGoogleCloudTTSConfig,
  resolveTencentCloudStreamingTTSConfig,
  resolveTencentCloudTTSConfig,
} from "../apps/server/src/provider-config"

describe("unified provider sections", () => {
  it("loads Azure, Google, Tencent, and Doubao TTS sections from the unified YAML file", () => {
    const cwd = mkdtempSync(
      path.join(os.tmpdir(), "voicyclaw-provider-config-"),
    )
    const filePath = path.join(cwd, "voicyclaw.local.yaml")
    writeFileSync(
      filePath,
      [
        "App:",
        "  server_port: 3001",
        "",
        "AzureSpeechTTS:",
        "  type: azure_speech_tts",
        "  endpoint: https://eastasia.tts.speech.microsoft.com/cognitiveservices/v1",
        "  region: eastasia",
        "  api_key: azure-key",
        "  voice: en-US-AriaNeural",
        "  sample_rate: 24000",
        "  style: chat",
        "  rate: +4%",
        "",
        "AzureSpeechStreamingTTS:",
        "  type: azure_speech_streaming_tts",
        "  voice: en-US-AriaNeural",
        "  sample_rate: 24000",
        "  style: chat",
        "  rate: +5%",
        "  flush_timeout_ms: 450",
        "  max_chunk_characters: 220",
        "",
        "GoogleCloudTTS:",
        "  type: google_cloud_tts",
        "  api_key: google-key",
        "  voice: en-US-Chirp3-HD-Achernar",
        "  sample_rate: 24000",
        "  speaking_rate: 1.0",
        "  pitch: 0",
        "",
        "GoogleCloudBatchedTTS:",
        "  type: google_cloud_tts_batched",
        "  service_account_file: /tmp/google-batched-tts.json",
        "  voice: en-US-Neural2-F",
        "  sample_rate: 24000",
        "  speaking_rate: 0.95",
        "  pitch: -1",
        "  flush_timeout_ms: 450",
        "  max_chunk_characters: 220",
        "",
        "TencentCloudTTS:",
        "  type: tencent_cloud_tts",
        "  app_id: 1234567890",
        "  secret_id: secret-id",
        "  secret_key: secret-key",
        "  voice_type: 502001",
        "  sample_rate: 16000",
        "  speed: 1",
        "  volume: 5",
        "",
        "TencentCloudStreamingTTS:",
        "  type: tencent_cloud_streaming_tts",
        "  voice_type: 502001",
        "  sample_rate: 24000",
        "  speed: 1.1",
        "  volume: 4",
        "  enable_subtitle: true",
        "",
        "DoubaoStreamTTS:",
        "  type: doubao_stream",
        "  ws_url: wss://openspeech.bytedance.com/api/v3/tts/bidirection",
        "  appid: 123456",
        "  access_token: token",
        "  model: seed-tts-2.0-standard",
        "  resource_id: volc.service_type.10029",
        "  speaker: zh_female_demo",
      ].join("\n"),
    )

    const env = {
      VOICYCLAW_CONFIG: filePath,
    }

    expect(loadProviderConfig(env).App).toBeUndefined()
    expect(loadProviderConfig(env).AzureSpeechTTS).toBeTruthy()
    expect(resolveAzureSpeechTTSConfig(env)).toMatchObject({
      type: "azure_speech_tts",
      region: "eastasia",
      api_key: "azure-key",
      voice: "en-US-AriaNeural",
      style: "chat",
      rate: "+4%",
    })
    expect(resolveAzureSpeechStreamingTTSConfig(env)).toMatchObject({
      type: "azure_speech_streaming_tts",
      voice: "en-US-AriaNeural",
      sample_rate: 24000,
      style: "chat",
      rate: "+5%",
      flush_timeout_ms: 450,
      max_chunk_characters: 220,
    })
    expect(resolveGoogleCloudTTSConfig(env)).toMatchObject({
      type: "google_cloud_tts",
      api_key: "google-key",
      voice: "en-US-Chirp3-HD-Achernar",
      sample_rate: 24000,
    })
    expect(resolveGoogleCloudBatchedTTSConfig(env)).toMatchObject({
      type: "google_cloud_tts_batched",
      service_account_file: "/tmp/google-batched-tts.json",
      voice: "en-US-Neural2-F",
      sample_rate: 24000,
      flush_timeout_ms: 450,
    })
    expect(resolveTencentCloudTTSConfig(env)).toMatchObject({
      type: "tencent_cloud_tts",
      app_id: 1234567890,
      secret_id: "secret-id",
      secret_key: "secret-key",
      voice_type: 502001,
      sample_rate: 16000,
      speed: 1,
      volume: 5,
    })
    expect(resolveTencentCloudStreamingTTSConfig(env)).toMatchObject({
      type: "tencent_cloud_streaming_tts",
      voice_type: 502001,
      sample_rate: 24000,
      speed: 1.1,
      volume: 4,
      enable_subtitle: true,
    })
    expect(resolveDoubaoStreamTTSConfig(env)).toMatchObject({
      type: "doubao_stream",
      appid: 123456,
      access_token: "token",
      model: "seed-tts-2.0-standard",
      speaker: "zh_female_demo",
    })
  })

  it("finds config/voicyclaw.local.yaml from a nested server working directory", () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), "voicyclaw-provider-config-root-"),
    )
    const configDir = path.join(root, "config")
    const nestedCwd = path.join(root, "apps", "server")
    mkdirSync(configDir, { recursive: true })
    mkdirSync(nestedCwd, { recursive: true })
    writeFileSync(
      path.join(configDir, "voicyclaw.local.yaml"),
      [
        "AzureSpeechTTS:",
        "  region: eastasia",
        "  api_key: nested-azure-key",
        "",
        "DoubaoStreamTTS:",
        "  appid: nested-app-id",
      ].join("\n"),
    )

    const originalCwd = process.cwd()
    process.chdir(nestedCwd)

    try {
      expect(
        resolveAzureSpeechTTSConfig({
          VOICYCLAW_CONFIG: "config/voicyclaw.local.yaml",
        }),
      ).toMatchObject({
        region: "eastasia",
        api_key: "nested-azure-key",
      })
      expect(
        resolveDoubaoStreamTTSConfig({
          VOICYCLAW_CONFIG: "config/voicyclaw.local.yaml",
        }),
      ).toMatchObject({
        appid: "nested-app-id",
      })
    } finally {
      process.chdir(originalCwd)
    }
  })
})
