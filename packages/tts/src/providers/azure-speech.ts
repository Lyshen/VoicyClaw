import { Buffer } from "node:buffer"

import type { TTSAdapter } from "../interface"
import type { AudioChunk, TTSConfig } from "../types"
import { collectFullText } from "./shared"

const DEFAULT_SAMPLE_RATE = 24_000
const DEFAULT_VOICE = "en-US-JennyNeural"

const AZURE_OUTPUT_FORMATS = new Map<number, string>([
  [16_000, "raw-16khz-16bit-mono-pcm"],
  [24_000, "raw-24khz-16bit-mono-pcm"],
  [48_000, "raw-48khz-16bit-mono-pcm"],
])

export interface AzureSpeechTTSProviderOptions {
  apiKey: string
  region?: string
  endpoint?: string
  voice?: string
  sampleRate?: number
  fetchImpl?: typeof fetch
}

export class AzureSpeechTTSProvider implements TTSAdapter {
  readonly name = "azure-speech-tts"

  constructor(private readonly options: AzureSpeechTTSProviderOptions) {}

  async *synthesize(
    text: AsyncIterable<string>,
    config?: TTSConfig,
  ): AsyncGenerator<AudioChunk> {
    const input = await collectFullText(text)

    if (!input) {
      return
    }

    const sampleRate = normalizeAzureSampleRate(
      config?.sampleRate ?? this.options.sampleRate ?? DEFAULT_SAMPLE_RATE,
    )
    const outputFormat =
      AZURE_OUTPUT_FORMATS.get(sampleRate) || "raw-24khz-16bit-mono-pcm"
    const voice =
      config?.voice?.trim() ||
      this.options.voice?.trim() ||
      defaultVoiceForLanguage(config?.language)
    const language = config?.language?.trim() || voiceLocale(voice)
    const endpoint = resolveAzureEndpoint(this.options)
    const response = await (this.options.fetchImpl ?? fetch)(endpoint, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": this.options.apiKey,
        "Content-Type": "application/ssml+xml",
        "User-Agent": "VoicyClaw/azure-tts",
        "X-Microsoft-OutputFormat": outputFormat,
      },
      body: buildAzureSsml(input, language, voice),
    })

    if (!response.ok) {
      throw new Error(
        `Azure Speech TTS request failed: ${await readResponseError(response)}`,
      )
    }

    const audio = Buffer.from(await response.arrayBuffer())
    if (audio.byteLength > 0) {
      yield audio
    }
  }
}

function resolveAzureEndpoint(options: AzureSpeechTTSProviderOptions) {
  const explicitEndpoint = options.endpoint?.trim()
  if (explicitEndpoint) {
    return normalizeAzureEndpoint(explicitEndpoint, options.region?.trim())
  }

  const region = options.region?.trim()
  if (!region) {
    throw new Error(
      "Azure Speech TTS requires VOICYCLAW_AZURE_SPEECH_REGION or VOICYCLAW_AZURE_TTS_ENDPOINT.",
    )
  }

  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`
}

function normalizeAzureEndpoint(endpoint: string, region?: string) {
  let url: URL

  try {
    url = new URL(endpoint)
  } catch {
    return endpoint
  }

  const hostname = url.hostname.toLowerCase()
  if (hostname.endsWith(".api.cognitive.microsoft.com")) {
    const inferredRegion = hostname.slice(
      0,
      hostname.length - ".api.cognitive.microsoft.com".length,
    )
    const resolvedRegion = region || inferredRegion

    if (resolvedRegion) {
      return `https://${resolvedRegion}.tts.speech.microsoft.com/cognitiveservices/v1`
    }
  }

  if (
    hostname.endsWith(".tts.speech.microsoft.com") &&
    (url.pathname === "/" || url.pathname === "")
  ) {
    return `${url.origin}/cognitiveservices/v1`
  }

  return endpoint
}

function buildAzureSsml(text: string, language: string, voice: string) {
  return [
    `<speak version="1.0" xml:lang="${escapeXml(language)}">`,
    `<voice name="${escapeXml(voice)}">`,
    escapeXml(text),
    "</voice>",
    "</speak>",
  ].join("")
}

function normalizeAzureSampleRate(sampleRate: number) {
  if (AZURE_OUTPUT_FORMATS.has(sampleRate)) {
    return sampleRate
  }

  if (sampleRate <= 16_000) {
    return 16_000
  }

  if (sampleRate <= 24_000) {
    return 24_000
  }

  return 48_000
}

function defaultVoiceForLanguage(language?: string) {
  const normalized = language?.trim().toLowerCase()

  if (normalized?.startsWith("zh-cn")) {
    return "zh-CN-XiaoxiaoNeural"
  }

  if (normalized?.startsWith("ja-jp")) {
    return "ja-JP-NanamiNeural"
  }

  return DEFAULT_VOICE
}

function voiceLocale(voice: string) {
  const parts = voice.split("-")
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1]}`
  }

  return "en-US"
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

async function readResponseError(response: Response) {
  const body = await response.text()
  return body.trim() || `${response.status} ${response.statusText}`
}
