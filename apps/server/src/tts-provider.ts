import type { ClientHelloMessage } from "@voicyclaw/protocol"
import {
  AzureSpeechStreamingTTSProvider,
  AzureSpeechTTSProvider,
  createServerTTSAdapter,
  GoogleCloudBatchedTTSProvider,
  GoogleCloudTTSProvider,
  TencentCloudStreamingTTSProvider,
  type TencentCloudStreamingTTSProviderOptions,
  TencentCloudTTSProvider,
  type TencentCloudTTSProviderOptions,
  type TTSAdapter,
  type VolcengineTTSProviderOptions,
} from "@voicyclaw/tts"
import {
  resolveAzureSpeechStreamingTTSConfig,
  resolveAzureSpeechTTSConfig,
  resolveDoubaoStreamTTSConfig,
  resolveGoogleCloudBatchedTTSConfig,
  resolveGoogleCloudTTSConfig,
  resolveTencentCloudStreamingTTSConfig,
  resolveTencentCloudTTSConfig,
} from "./provider-config"

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
    style: pickFirstNonEmpty(env.VOICYCLAW_AZURE_TTS_STYLE, config?.style),
    styleDegree:
      parseFloatValue(env.VOICYCLAW_AZURE_TTS_STYLE_DEGREE) ??
      parseFloatValue(config?.style_degree),
    role: pickFirstNonEmpty(env.VOICYCLAW_AZURE_TTS_ROLE, config?.role),
    rate: pickFirstNonEmpty(env.VOICYCLAW_AZURE_TTS_RATE, config?.rate),
    pitch: pickFirstNonEmpty(env.VOICYCLAW_AZURE_TTS_PITCH, config?.pitch),
    volume: pickFirstNonEmpty(env.VOICYCLAW_AZURE_TTS_VOLUME, config?.volume),
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

export function resolveAzureSpeechStreamingTTSOptions(
  env: RuntimeEnv = process.env,
) {
  const baseConfig = resolveAzureSpeechTTSConfig(env)
  const config = resolveAzureSpeechStreamingTTSConfig(env)
  const apiKey = pickFirstNonEmpty(
    env.VOICYCLAW_AZURE_SPEECH_KEY,
    env.AZURE_SPEECH_KEY,
    config?.api_key,
    baseConfig?.api_key,
  )

  if (!apiKey) {
    throw new Error(
      "Azure Speech streaming TTS is missing credentials. Set VOICYCLAW_AZURE_SPEECH_KEY, AzureSpeechStreamingTTS.api_key, or AzureSpeechTTS.api_key in config/providers.local.yaml.",
    )
  }

  const region = pickFirstNonEmpty(
    env.VOICYCLAW_AZURE_SPEECH_REGION,
    env.AZURE_SPEECH_REGION,
    config?.region,
    baseConfig?.region,
  )
  const endpoint = pickFirstNonEmpty(
    env.VOICYCLAW_AZURE_STREAMING_TTS_ENDPOINT,
    env.VOICYCLAW_AZURE_TTS_ENDPOINT,
    config?.endpoint,
    baseConfig?.endpoint,
  )

  if (!region && !endpoint) {
    throw new Error(
      "Azure Speech streaming TTS is missing region or endpoint. Set VOICYCLAW_AZURE_SPEECH_REGION, VOICYCLAW_AZURE_STREAMING_TTS_ENDPOINT, VOICYCLAW_AZURE_TTS_ENDPOINT, or AzureSpeechStreamingTTS.region/endpoint in config/providers.local.yaml.",
    )
  }

  return {
    apiKey,
    region,
    endpoint,
    voice: pickFirstNonEmpty(
      env.VOICYCLAW_AZURE_STREAMING_TTS_VOICE,
      env.VOICYCLAW_AZURE_TTS_VOICE,
      config?.voice,
      baseConfig?.voice,
    ),
    sampleRate:
      parsePositiveInt(env.VOICYCLAW_AZURE_STREAMING_TTS_SAMPLE_RATE) ??
      parsePositiveInt(env.VOICYCLAW_AZURE_TTS_SAMPLE_RATE) ??
      parsePositiveInt(config?.sample_rate) ??
      parsePositiveInt(baseConfig?.sample_rate),
    style: pickFirstNonEmpty(
      env.VOICYCLAW_AZURE_STREAMING_TTS_STYLE,
      env.VOICYCLAW_AZURE_TTS_STYLE,
      config?.style,
      baseConfig?.style,
    ),
    styleDegree:
      parseFloatValue(env.VOICYCLAW_AZURE_STREAMING_TTS_STYLE_DEGREE) ??
      parseFloatValue(env.VOICYCLAW_AZURE_TTS_STYLE_DEGREE) ??
      parseFloatValue(config?.style_degree) ??
      parseFloatValue(baseConfig?.style_degree),
    role: pickFirstNonEmpty(
      env.VOICYCLAW_AZURE_STREAMING_TTS_ROLE,
      env.VOICYCLAW_AZURE_TTS_ROLE,
      config?.role,
      baseConfig?.role,
    ),
    rate: pickFirstNonEmpty(
      env.VOICYCLAW_AZURE_STREAMING_TTS_RATE,
      env.VOICYCLAW_AZURE_TTS_RATE,
      config?.rate,
      baseConfig?.rate,
    ),
    pitch: pickFirstNonEmpty(
      env.VOICYCLAW_AZURE_STREAMING_TTS_PITCH,
      env.VOICYCLAW_AZURE_TTS_PITCH,
      config?.pitch,
      baseConfig?.pitch,
    ),
    volume: pickFirstNonEmpty(
      env.VOICYCLAW_AZURE_STREAMING_TTS_VOLUME,
      env.VOICYCLAW_AZURE_TTS_VOLUME,
      config?.volume,
      baseConfig?.volume,
    ),
    flushTimeoutMs:
      parsePositiveInt(env.VOICYCLAW_AZURE_STREAMING_TTS_FLUSH_TIMEOUT_MS) ??
      parsePositiveInt(config?.flush_timeout_ms),
    maxChunkCharacters:
      parsePositiveInt(
        env.VOICYCLAW_AZURE_STREAMING_TTS_MAX_CHUNK_CHARACTERS,
      ) ?? parsePositiveInt(config?.max_chunk_characters),
  }
}

export function resolveGoogleCloudBatchedTTSOptions(
  env: RuntimeEnv = process.env,
) {
  const config = resolveGoogleCloudBatchedTTSConfig(env)
  const serviceAccountJson = pickFirstNonEmpty(
    env.VOICYCLAW_GOOGLE_BATCHED_TTS_SERVICE_ACCOUNT_JSON,
    config?.service_account_json,
  )
  const serviceAccountFile = pickFirstNonEmpty(
    env.VOICYCLAW_GOOGLE_BATCHED_TTS_SERVICE_ACCOUNT_FILE,
    env.GOOGLE_APPLICATION_CREDENTIALS,
    config?.service_account_file,
  )
  const voice = pickFirstNonEmpty(
    env.VOICYCLAW_GOOGLE_BATCHED_TTS_VOICE,
    config?.voice,
  )

  if (!serviceAccountJson && !serviceAccountFile) {
    throw new Error(
      "Google Cloud batched TTS is missing credentials. Set VOICYCLAW_GOOGLE_BATCHED_TTS_SERVICE_ACCOUNT_JSON, VOICYCLAW_GOOGLE_BATCHED_TTS_SERVICE_ACCOUNT_FILE, or GoogleCloudBatchedTTS.service_account_json/service_account_file in config/providers.local.yaml.",
    )
  }

  if (!voice) {
    throw new Error(
      "Google Cloud batched TTS requires a non-Chirp voice such as WaveNet or Neural2. Set VOICYCLAW_GOOGLE_BATCHED_TTS_VOICE or GoogleCloudBatchedTTS.voice in config/providers.local.yaml.",
    )
  }

  if (/chirp3?-hd/i.test(voice)) {
    throw new Error(
      `Google Cloud batched TTS is intended for unary voices such as WaveNet or Neural2. Received ${voice}; use google-tts for Chirp 3 HD streaming.`,
    )
  }

  return {
    serviceAccountJson,
    serviceAccountFile,
    endpoint: pickFirstNonEmpty(
      env.VOICYCLAW_GOOGLE_BATCHED_TTS_ENDPOINT,
      config?.endpoint,
    ),
    voice,
    sampleRate:
      parsePositiveInt(env.VOICYCLAW_GOOGLE_BATCHED_TTS_SAMPLE_RATE) ??
      parsePositiveInt(config?.sample_rate),
    speakingRate:
      parseFloatValue(env.VOICYCLAW_GOOGLE_BATCHED_TTS_SPEAKING_RATE) ??
      parseFloatValue(config?.speaking_rate),
    pitch:
      parseFloatValue(env.VOICYCLAW_GOOGLE_BATCHED_TTS_PITCH) ??
      parseFloatValue(config?.pitch),
    flushTimeoutMs:
      parsePositiveInt(env.VOICYCLAW_GOOGLE_BATCHED_TTS_FLUSH_TIMEOUT_MS) ??
      parsePositiveInt(config?.flush_timeout_ms),
    maxChunkCharacters:
      parsePositiveInt(env.VOICYCLAW_GOOGLE_BATCHED_TTS_MAX_CHUNK_CHARACTERS) ??
      parsePositiveInt(config?.max_chunk_characters),
  }
}

export function resolveTencentCloudTTSOptions(
  env: RuntimeEnv = process.env,
): TencentCloudTTSProviderOptions {
  const config = resolveTencentCloudTTSConfig(env)
  const appId = pickFirstNonEmpty(
    env.VOICYCLAW_TENCENT_APP_ID,
    stringify(config?.app_id),
  )
  const secretId = pickFirstNonEmpty(
    env.VOICYCLAW_TENCENT_SECRET_ID,
    config?.secret_id,
  )
  const secretKey = pickFirstNonEmpty(
    env.VOICYCLAW_TENCENT_SECRET_KEY,
    config?.secret_key,
  )
  const missing = [
    !appId && "VOICYCLAW_TENCENT_APP_ID",
    !secretId && "VOICYCLAW_TENCENT_SECRET_ID",
    !secretKey && "VOICYCLAW_TENCENT_SECRET_KEY",
  ].filter(Boolean) as string[]

  if (missing.length > 0) {
    throw new Error(
      `Tencent Cloud TTS requires ${missing.join(", ")} when ttsProvider=tencent-tts`,
    )
  }

  return {
    appId: appId as string,
    secretId: secretId as string,
    secretKey: secretKey as string,
    endpoint: pickFirstNonEmpty(
      env.VOICYCLAW_TENCENT_TTS_ENDPOINT,
      config?.endpoint,
    ),
    voiceType: pickFirstNonEmpty(
      env.VOICYCLAW_TENCENT_TTS_VOICE_TYPE,
      stringify(config?.voice_type),
    ),
    fastVoiceType: pickFirstNonEmpty(
      env.VOICYCLAW_TENCENT_TTS_FAST_VOICE_TYPE,
      config?.fast_voice_type,
    ),
    sampleRate:
      parsePositiveInt(env.VOICYCLAW_TENCENT_TTS_SAMPLE_RATE) ??
      parsePositiveInt(config?.sample_rate),
    codec: pickFirstNonEmpty(env.VOICYCLAW_TENCENT_TTS_CODEC, config?.codec),
    speed:
      parseFloatValue(env.VOICYCLAW_TENCENT_TTS_SPEED) ??
      parseFloatValue(config?.speed),
    volume:
      parseFloatValue(env.VOICYCLAW_TENCENT_TTS_VOLUME) ??
      parseFloatValue(config?.volume),
    enableSubtitle:
      parseBoolean(env.VOICYCLAW_TENCENT_TTS_ENABLE_SUBTITLE) ??
      parseBoolean(config?.enable_subtitle),
    emotionCategory: pickFirstNonEmpty(
      env.VOICYCLAW_TENCENT_TTS_EMOTION_CATEGORY,
      config?.emotion_category,
    ),
    emotionIntensity:
      parseFloatValue(env.VOICYCLAW_TENCENT_TTS_EMOTION_INTENSITY) ??
      parseFloatValue(config?.emotion_intensity),
    segmentRate:
      parsePositiveInt(env.VOICYCLAW_TENCENT_TTS_SEGMENT_RATE) ??
      parsePositiveInt(config?.segment_rate),
  }
}

export function resolveTencentCloudStreamingTTSOptions(
  env: RuntimeEnv = process.env,
): TencentCloudStreamingTTSProviderOptions {
  const baseConfig = resolveTencentCloudTTSConfig(env)
  const config = resolveTencentCloudStreamingTTSConfig(env)
  const appId = pickFirstNonEmpty(
    env.VOICYCLAW_TENCENT_APP_ID,
    stringify(config?.app_id),
    stringify(baseConfig?.app_id),
  )
  const secretId = pickFirstNonEmpty(
    env.VOICYCLAW_TENCENT_SECRET_ID,
    config?.secret_id,
    baseConfig?.secret_id,
  )
  const secretKey = pickFirstNonEmpty(
    env.VOICYCLAW_TENCENT_SECRET_KEY,
    config?.secret_key,
    baseConfig?.secret_key,
  )
  const missing = [
    !appId && "VOICYCLAW_TENCENT_APP_ID",
    !secretId && "VOICYCLAW_TENCENT_SECRET_ID",
    !secretKey && "VOICYCLAW_TENCENT_SECRET_KEY",
  ].filter(Boolean) as string[]

  if (missing.length > 0) {
    throw new Error(
      `Tencent Cloud TTS requires ${missing.join(", ")} when ttsProvider=tencent-streaming-tts`,
    )
  }

  return {
    appId: appId as string,
    secretId: secretId as string,
    secretKey: secretKey as string,
    endpoint: pickFirstNonEmpty(
      env.VOICYCLAW_TENCENT_STREAMING_TTS_ENDPOINT,
      env.VOICYCLAW_TENCENT_TTS_ENDPOINT,
      config?.endpoint,
      baseConfig?.endpoint,
    ),
    voiceType: pickFirstNonEmpty(
      env.VOICYCLAW_TENCENT_STREAMING_TTS_VOICE_TYPE,
      env.VOICYCLAW_TENCENT_TTS_VOICE_TYPE,
      stringify(config?.voice_type),
      stringify(baseConfig?.voice_type),
    ),
    fastVoiceType: pickFirstNonEmpty(
      env.VOICYCLAW_TENCENT_STREAMING_TTS_FAST_VOICE_TYPE,
      env.VOICYCLAW_TENCENT_TTS_FAST_VOICE_TYPE,
      config?.fast_voice_type,
      baseConfig?.fast_voice_type,
    ),
    sampleRate:
      parsePositiveInt(env.VOICYCLAW_TENCENT_STREAMING_TTS_SAMPLE_RATE) ??
      parsePositiveInt(env.VOICYCLAW_TENCENT_TTS_SAMPLE_RATE) ??
      parsePositiveInt(config?.sample_rate) ??
      parsePositiveInt(baseConfig?.sample_rate),
    codec: pickFirstNonEmpty(
      env.VOICYCLAW_TENCENT_STREAMING_TTS_CODEC,
      env.VOICYCLAW_TENCENT_TTS_CODEC,
      config?.codec,
      baseConfig?.codec,
    ),
    speed:
      parseFloatValue(env.VOICYCLAW_TENCENT_STREAMING_TTS_SPEED) ??
      parseFloatValue(env.VOICYCLAW_TENCENT_TTS_SPEED) ??
      parseFloatValue(config?.speed) ??
      parseFloatValue(baseConfig?.speed),
    volume:
      parseFloatValue(env.VOICYCLAW_TENCENT_STREAMING_TTS_VOLUME) ??
      parseFloatValue(env.VOICYCLAW_TENCENT_TTS_VOLUME) ??
      parseFloatValue(config?.volume) ??
      parseFloatValue(baseConfig?.volume),
    enableSubtitle:
      parseBoolean(env.VOICYCLAW_TENCENT_STREAMING_TTS_ENABLE_SUBTITLE) ??
      parseBoolean(env.VOICYCLAW_TENCENT_TTS_ENABLE_SUBTITLE) ??
      parseBoolean(config?.enable_subtitle) ??
      parseBoolean(baseConfig?.enable_subtitle),
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

function parseBoolean(value: string | boolean | undefined) {
  if (typeof value === "boolean") {
    return value
  }

  const normalized = value?.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }

  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true
  }

  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false
  }

  return undefined
}

function stringify(value: string | number | undefined) {
  if (value === undefined) return undefined
  return String(value).trim()
}
