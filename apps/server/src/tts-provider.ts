import type { ClientHelloMessage } from "@voicyclaw/protocol"
import {
  AzureSpeechStreamingTTSProvider,
  AzureSpeechTTSProvider,
  createServerTTSAdapter,
  GoogleCloudBatchedTTSProvider,
  GoogleCloudTTSProvider,
  TencentCloudStreamingTTSProvider,
  TencentCloudTTSProvider,
  type TTSAdapter,
} from "@voicyclaw/tts"
import {
  resolveAzureSpeechStreamingTTSOptions,
  resolveAzureSpeechTTSOptions,
  resolveGoogleCloudBatchedTTSOptions,
  resolveGoogleCloudTTSOptions,
  resolveTencentCloudStreamingTTSOptions,
  resolveTencentCloudTTSOptions,
  resolveVolcengineTTSOptions,
} from "./tts-provider-options"

const DEFAULT_DEMO_SAMPLE_RATE = 16_000
const DEFAULT_VOLCENGINE_SAMPLE_RATE = 16_000
const DEFAULT_AZURE_SAMPLE_RATE = 24_000
const DEFAULT_AZURE_STREAMING_SAMPLE_RATE = 24_000
const DEFAULT_GOOGLE_SAMPLE_RATE = 24_000
const DEFAULT_GOOGLE_BATCHED_SAMPLE_RATE = 24_000
const DEFAULT_TENCENT_SAMPLE_RATE = 16_000
const DEFAULT_TENCENT_STREAMING_SAMPLE_RATE = 16_000

type RuntimeTTSSettings = ClientHelloMessage["settings"] | undefined
type RuntimeEnv = NodeJS.ProcessEnv

export interface RuntimeTTSProvider {
  providerId:
    | "demo"
    | "volcengine-tts"
    | "azure-tts"
    | "azure-streaming-tts"
    | "google-tts"
    | "google-batched-tts"
    | "tencent-tts"
    | "tencent-streaming-tts"
  sampleRate: number
  adapter: TTSAdapter
}

export function createRuntimeTTSProvider(
  settings: RuntimeTTSSettings,
  env: RuntimeEnv = process.env,
): RuntimeTTSProvider {
  switch (settings?.ttsProvider) {
    case "volcengine-tts": {
      const options = resolveVolcengineTTSOptions(env)

      return {
        providerId: "volcengine-tts",
        sampleRate: options.sampleRate ?? DEFAULT_VOLCENGINE_SAMPLE_RATE,
        adapter: createServerTTSAdapter({
          id: "volcengine-tts",
          options,
        }),
      }
    }
    case "azure-tts": {
      const options = resolveAzureSpeechTTSOptions(env)

      return {
        providerId: "azure-tts",
        sampleRate: options.sampleRate ?? DEFAULT_AZURE_SAMPLE_RATE,
        adapter: new AzureSpeechTTSProvider(options),
      }
    }
    case "azure-streaming-tts": {
      const options = resolveAzureSpeechStreamingTTSOptions(env)

      return {
        providerId: "azure-streaming-tts",
        sampleRate: options.sampleRate ?? DEFAULT_AZURE_STREAMING_SAMPLE_RATE,
        adapter: new AzureSpeechStreamingTTSProvider(options),
      }
    }
    case "google-tts": {
      const options = resolveGoogleCloudTTSOptions(env)

      return {
        providerId: "google-tts",
        sampleRate: options.sampleRate ?? DEFAULT_GOOGLE_SAMPLE_RATE,
        adapter: new GoogleCloudTTSProvider(options),
      }
    }
    case "google-batched-tts": {
      const options = resolveGoogleCloudBatchedTTSOptions(env)

      return {
        providerId: "google-batched-tts",
        sampleRate: options.sampleRate ?? DEFAULT_GOOGLE_BATCHED_SAMPLE_RATE,
        adapter: new GoogleCloudBatchedTTSProvider(options),
      }
    }
    case "tencent-tts": {
      const options = resolveTencentCloudTTSOptions(env)

      return {
        providerId: "tencent-tts",
        sampleRate: options.sampleRate ?? DEFAULT_TENCENT_SAMPLE_RATE,
        adapter: new TencentCloudTTSProvider(options),
      }
    }
    case "tencent-streaming-tts": {
      const options = resolveTencentCloudStreamingTTSOptions(env)

      return {
        providerId: "tencent-streaming-tts",
        sampleRate: options.sampleRate ?? DEFAULT_TENCENT_STREAMING_SAMPLE_RATE,
        adapter: new TencentCloudStreamingTTSProvider(options),
      }
    }
    default:
      return {
        providerId: "demo",
        sampleRate: DEFAULT_DEMO_SAMPLE_RATE,
        adapter: createServerTTSAdapter({
          id: "demo",
        }),
      }
  }
}

export {
  resolveAzureSpeechStreamingTTSOptions,
  resolveAzureSpeechTTSOptions,
  resolveGoogleCloudBatchedTTSOptions,
  resolveGoogleCloudTTSOptions,
  resolveTencentCloudStreamingTTSOptions,
  resolveTencentCloudTTSOptions,
  resolveVolcengineTTSOptions,
} from "./tts-provider-options"
