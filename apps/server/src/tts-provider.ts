import type { ClientHelloMessage } from "@voicyclaw/protocol"
import {
  AzureSpeechTTSProvider,
  createServerTTSAdapter,
  GoogleCloudTTSProvider,
  type TTSAdapter,
  type VolcengineTTSProviderOptions,
} from "@voicyclaw/tts"
import {
  resolveAzureSpeechTTSConfig,
  resolveDoubaoStreamTTSConfig,
  resolveGoogleCloudTTSConfig,
} from "./provider-config"

const DEFAULT_DEMO_SAMPLE_RATE = 16_000
const DEFAULT_VOLCENGINE_SAMPLE_RATE = 16_000
const DEFAULT_AZURE_SAMPLE_RATE = 24_000
const DEFAULT_GOOGLE_SAMPLE_RATE = 24_000

type RuntimeTTSSettings = ClientHelloMessage["settings"] | undefined
type RuntimeEnv = NodeJS.ProcessEnv

export interface RuntimeTTSProvider {
  providerId: "demo" | "volcengine-tts" | "azure-tts" | "google-tts"
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
        adapter: createServerTTSAdapter({
          id: "demo",
        }),
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
  const serviceAccountJson = pickFirstNonEmpty(
    env.VOICYCLAW_GOOGLE_TTS_SERVICE_ACCOUNT_JSON,
    config?.service_account_json,
  )
  const serviceAccountFile = pickFirstNonEmpty(
    env.VOICYCLAW_GOOGLE_TTS_SERVICE_ACCOUNT_FILE,
    env.GOOGLE_APPLICATION_CREDENTIALS,
    config?.service_account_file,
  )
  const voice = pickFirstNonEmpty(env.VOICYCLAW_GOOGLE_TTS_VOICE, config?.voice)

  if (!serviceAccountJson && !serviceAccountFile) {
    throw new Error(
      "Google Cloud TTS streaming is missing credentials. Set VOICYCLAW_GOOGLE_TTS_SERVICE_ACCOUNT_JSON, VOICYCLAW_GOOGLE_TTS_SERVICE_ACCOUNT_FILE, or GoogleCloudTTS.service_account_json/service_account_file in config/providers.local.yaml.",
    )
  }

  if (!voice) {
    throw new Error(
      "Google Cloud TTS streaming requires a Chirp 3 HD voice. Set VOICYCLAW_GOOGLE_TTS_VOICE or GoogleCloudTTS.voice in config/providers.local.yaml.",
    )
  }

  if (!/chirp3?-hd/i.test(voice)) {
    throw new Error(
      `Google Cloud TTS streaming only supports Chirp 3 HD voices right now. Received ${voice}.`,
    )
  }

  return {
    serviceAccountJson,
    serviceAccountFile,
    endpoint: pickFirstNonEmpty(
      env.VOICYCLAW_GOOGLE_TTS_ENDPOINT,
      config?.endpoint,
    ),
    voice,
    sampleRate:
      parsePositiveInt(env.VOICYCLAW_GOOGLE_TTS_SAMPLE_RATE) ??
      parsePositiveInt(config?.sample_rate),
    speakingRate:
      parseFloatValue(env.VOICYCLAW_GOOGLE_TTS_SPEAKING_RATE) ??
      parseFloatValue(config?.speaking_rate),
  }
}

export function resolveVolcengineTTSOptions(
  env: RuntimeEnv = process.env,
): VolcengineTTSProviderOptions {
  const yamlConfig = resolveDoubaoStreamTTSConfig(env)
  const appId = pickFirstNonEmpty(
    env.VOICYCLAW_VOLCENGINE_APP_ID,
    stringify(yamlConfig?.appid),
  )
  const accessToken = pickFirstNonEmpty(
    env.VOICYCLAW_VOLCENGINE_ACCESS_TOKEN,
    yamlConfig?.access_token,
  )
  const voiceType = pickFirstNonEmpty(
    env.VOICYCLAW_VOLCENGINE_TTS_VOICE_TYPE,
    yamlConfig?.speaker,
  )
  const missing = [
    !appId && "VOICYCLAW_VOLCENGINE_APP_ID",
    !accessToken && "VOICYCLAW_VOLCENGINE_ACCESS_TOKEN",
    !voiceType && "VOICYCLAW_VOLCENGINE_TTS_VOICE_TYPE",
  ].filter(Boolean) as string[]

  if (missing.length > 0) {
    throw new Error(
      `Volcengine TTS requires ${missing.join(", ")} when ttsProvider=volcengine-tts`,
    )
  }

  const ensuredAppId = appId as string
  const ensuredAccessToken = accessToken as string
  const ensuredVoiceType = voiceType as string
  const sampleRate =
    parsePositiveInt(env.VOICYCLAW_VOLCENGINE_TTS_SAMPLE_RATE) ??
    parsePositiveInt(yamlConfig?.sample_rate) ??
    DEFAULT_VOLCENGINE_SAMPLE_RATE

  return {
    appId: ensuredAppId,
    accessToken: ensuredAccessToken,
    voiceType: ensuredVoiceType,
    model: pickFirstNonEmpty(
      env.VOICYCLAW_VOLCENGINE_TTS_MODEL,
      yamlConfig?.model,
    ),
    endpoint: pickFirstNonEmpty(
      env.VOICYCLAW_VOLCENGINE_TTS_ENDPOINT,
      yamlConfig?.ws_url,
    ),
    resourceId: pickFirstNonEmpty(
      env.VOICYCLAW_VOLCENGINE_TTS_RESOURCE_ID,
      yamlConfig?.resource_id,
    ),
    sampleRate,
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

function stringify(value: string | number | undefined) {
  if (value === undefined) return undefined
  return String(value).trim()
}
