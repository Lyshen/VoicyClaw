import type { ClientHelloMessage } from "@voicyclaw/protocol"
import {
  AzureSpeechTTSProvider,
  DemoTTSProvider,
  GoogleCloudTTSProvider,
} from "@voicyclaw/tts"
import {
  resolveAzureSpeechTTSConfig,
  resolveGoogleCloudTTSConfig,
} from "./provider-config"

const DEFAULT_DEMO_SAMPLE_RATE = 16_000
const DEFAULT_AZURE_SAMPLE_RATE = 24_000
const DEFAULT_GOOGLE_SAMPLE_RATE = 24_000

type RuntimeTTSSettings = ClientHelloMessage["settings"] | undefined

type RuntimeTTSProvider = {
  providerId: string
  sampleRate: number
  adapter: DemoTTSProvider | AzureSpeechTTSProvider | GoogleCloudTTSProvider
}

type RuntimeEnv = NodeJS.ProcessEnv

export function createRuntimeTTSProvider(
  settings: RuntimeTTSSettings,
  env: RuntimeEnv = process.env,
): RuntimeTTSProvider {
  switch (settings?.ttsProvider) {
    case "azure-tts": {
      const options = resolveAzureSpeechTTSOptions(env)

      return {
        providerId: "azure-tts",
        sampleRate: options.sampleRate ?? DEFAULT_AZURE_SAMPLE_RATE,
        adapter: new AzureSpeechTTSProvider(options),
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
    default:
      return {
        providerId: "demo",
        sampleRate: DEFAULT_DEMO_SAMPLE_RATE,
        adapter: new DemoTTSProvider(),
      }
  }
}

export function resolveAzureSpeechTTSOptions(env: RuntimeEnv = process.env) {
  const config = resolveAzureSpeechTTSConfig(env)
  const apiKey = pickFirstNonEmpty(
    env.VOICYCLAW_AZURE_SPEECH_KEY,
    env.AZURE_SPEECH_KEY,
    config?.api_key,
  )

  if (!apiKey) {
    throw new Error(
      "Azure Speech TTS is missing credentials. Set VOICYCLAW_AZURE_SPEECH_KEY or AzureSpeechTTS.api_key in config/providers.local.yaml.",
    )
  }

  const region = pickFirstNonEmpty(
    env.VOICYCLAW_AZURE_SPEECH_REGION,
    env.AZURE_SPEECH_REGION,
    config?.region,
  )
  const endpoint = pickFirstNonEmpty(
    env.VOICYCLAW_AZURE_TTS_ENDPOINT,
    config?.endpoint,
  )

  if (!region && !endpoint) {
    throw new Error(
      "Azure Speech TTS is missing region or endpoint. Set VOICYCLAW_AZURE_SPEECH_REGION, VOICYCLAW_AZURE_TTS_ENDPOINT, or AzureSpeechTTS.region/endpoint in config/providers.local.yaml.",
    )
  }

  return {
    apiKey,
    region,
    endpoint,
    voice: pickFirstNonEmpty(env.VOICYCLAW_AZURE_TTS_VOICE, config?.voice),
    sampleRate:
      parsePositiveInt(env.VOICYCLAW_AZURE_TTS_SAMPLE_RATE) ??
      parsePositiveInt(config?.sample_rate),
  }
}

export function resolveGoogleCloudTTSOptions(env: RuntimeEnv = process.env) {
  const config = resolveGoogleCloudTTSConfig(env)
  const accessToken = pickFirstNonEmpty(
    env.VOICYCLAW_GOOGLE_TTS_ACCESS_TOKEN,
    config?.access_token,
  )
  const apiKey = pickFirstNonEmpty(
    env.VOICYCLAW_GOOGLE_TTS_API_KEY,
    env.GOOGLE_API_KEY,
    config?.api_key,
  )
  const serviceAccountJson = pickFirstNonEmpty(
    env.VOICYCLAW_GOOGLE_TTS_SERVICE_ACCOUNT_JSON,
    config?.service_account_json,
  )
  const serviceAccountFile = pickFirstNonEmpty(
    env.VOICYCLAW_GOOGLE_TTS_SERVICE_ACCOUNT_FILE,
    env.GOOGLE_APPLICATION_CREDENTIALS,
    config?.service_account_file,
  )

  if (!accessToken && !apiKey && !serviceAccountJson && !serviceAccountFile) {
    throw new Error(
      "Google Cloud TTS is missing credentials. Set VOICYCLAW_GOOGLE_TTS_SERVICE_ACCOUNT_JSON, VOICYCLAW_GOOGLE_TTS_SERVICE_ACCOUNT_FILE, VOICYCLAW_GOOGLE_TTS_ACCESS_TOKEN, VOICYCLAW_GOOGLE_TTS_API_KEY, or GoogleCloudTTS credentials in config/providers.local.yaml.",
    )
  }

  return {
    accessToken,
    apiKey,
    serviceAccountJson,
    serviceAccountFile,
    endpoint: pickFirstNonEmpty(
      env.VOICYCLAW_GOOGLE_TTS_ENDPOINT,
      config?.endpoint,
    ),
    voice: pickFirstNonEmpty(env.VOICYCLAW_GOOGLE_TTS_VOICE, config?.voice),
    sampleRate:
      parsePositiveInt(env.VOICYCLAW_GOOGLE_TTS_SAMPLE_RATE) ??
      parsePositiveInt(config?.sample_rate),
    speakingRate:
      parseFloatValue(env.VOICYCLAW_GOOGLE_TTS_SPEAKING_RATE) ??
      parseFloatValue(config?.speaking_rate),
    pitch:
      parseFloatValue(env.VOICYCLAW_GOOGLE_TTS_PITCH) ??
      parseFloatValue(config?.pitch),
  }
}

function pickFirstNonEmpty(...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = value?.trim()
    if (normalized) {
      return normalized
    }
  }

  return undefined
}

function parsePositiveInt(value: string | number | undefined) {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function parseFloatValue(value: string | number | undefined) {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(value ?? "")
  return Number.isFinite(parsed) ? parsed : undefined
}
