import type { ClientHelloMessage } from "@voicyclaw/protocol"
import {
  createServerTTSAdapter,
  type ServerTTSProviderConfig,
  type TTSAdapter,
  type VolcengineTTSProviderOptions,
} from "@voicyclaw/tts"
import { resolveDoubaoStreamTTSConfig } from "./provider-config"

const DEFAULT_SAMPLE_RATE = 16_000

export interface RuntimeTTSProvider {
  adapter: TTSAdapter
  providerId: "demo" | "volcengine-tts"
  sampleRate: number
}

export function createRuntimeTTSProvider(
  settings?: ClientHelloMessage["settings"],
  env: NodeJS.ProcessEnv = process.env,
): RuntimeTTSProvider {
  if (settings?.ttsProvider === "volcengine-tts") {
    const options = resolveVolcengineTTSOptions(env)
    const config = {
      id: "volcengine-tts",
      options,
    } satisfies ServerTTSProviderConfig

    return {
      adapter: createServerTTSAdapter(config),
      providerId: "volcengine-tts",
      sampleRate: options.sampleRate ?? DEFAULT_SAMPLE_RATE,
    }
  }

  return {
    adapter: createServerTTSAdapter({
      id: "demo",
    }),
    providerId: "demo",
    sampleRate: DEFAULT_SAMPLE_RATE,
  }
}

export function resolveVolcengineTTSOptions(
  env: NodeJS.ProcessEnv,
): VolcengineTTSProviderOptions {
  const yamlConfig = resolveDoubaoStreamTTSConfig(env)
  const appId =
    env.VOICYCLAW_VOLCENGINE_APP_ID?.trim() || stringify(yamlConfig?.appid)
  const accessToken =
    env.VOICYCLAW_VOLCENGINE_ACCESS_TOKEN?.trim() ||
    yamlConfig?.access_token?.trim()
  const voiceType =
    env.VOICYCLAW_VOLCENGINE_TTS_VOICE_TYPE?.trim() ||
    yamlConfig?.speaker?.trim()
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
  const sampleRate = parsePositiveInt(
    env.VOICYCLAW_VOLCENGINE_TTS_SAMPLE_RATE ??
      stringify(yamlConfig?.sample_rate),
    DEFAULT_SAMPLE_RATE,
  )

  return {
    appId: ensuredAppId,
    accessToken: ensuredAccessToken,
    voiceType: ensuredVoiceType,
    endpoint:
      env.VOICYCLAW_VOLCENGINE_TTS_ENDPOINT?.trim() ||
      yamlConfig?.ws_url?.trim() ||
      undefined,
    resourceId:
      env.VOICYCLAW_VOLCENGINE_TTS_RESOURCE_ID?.trim() ||
      yamlConfig?.resource_id?.trim() ||
      undefined,
    sampleRate,
  }
}

function parsePositiveInt(input: string | undefined, fallback: number) {
  const parsed = Number(input?.trim() || "")
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function stringify(value: string | number | undefined) {
  if (value === undefined) return undefined
  return String(value).trim()
}
