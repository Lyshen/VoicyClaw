import { Buffer } from "node:buffer"
import * as speechSdk from "microsoft-cognitiveservices-speech-sdk"

import type { AudioChunk, TTSConfig } from "../types"

const DEFAULT_VOICE = "en-US-JennyNeural"
const AZURE_OUTPUT_FORMATS = new Map<
  number,
  speechSdk.SpeechSynthesisOutputFormat
>([
  [16_000, speechSdk.SpeechSynthesisOutputFormat.Raw16Khz16BitMonoPcm],
  [22_050, speechSdk.SpeechSynthesisOutputFormat.Raw22050Hz16BitMonoPcm],
  [24_000, speechSdk.SpeechSynthesisOutputFormat.Raw24Khz16BitMonoPcm],
  [44_100, speechSdk.SpeechSynthesisOutputFormat.Raw44100Hz16BitMonoPcm],
  [48_000, speechSdk.SpeechSynthesisOutputFormat.Raw48Khz16BitMonoPcm],
])

export const DEFAULT_AZURE_SAMPLE_RATE = 24_000
export const DEFAULT_AZURE_FLUSH_TIMEOUT_MS = 450
export const DEFAULT_AZURE_MAX_CHUNK_CHARACTERS = 220

export interface AzureSpeechSynthesisOptions {
  apiKey: string
  region?: string
  endpoint?: string
  voice?: string
  sampleRate?: number
  createSynthesizer?: AzureSpeechSynthesizerFactory
  createPushAudioStream?: AzurePushAudioStreamFactory
}

export interface AzureSpeechRuntimeConfig {
  apiKey: string
  region?: string
  endpoint?: string
  voice: string
  language: string
  sampleRate: number
}

export interface AzureSpeechSynthesisResultLike {
  reason?: number
  errorDetails?: string
}

export interface AzurePushAudioStreamLike {
  write: (dataBuffer: ArrayBuffer) => void
  close: () => void
}

export type AzurePushAudioStreamFactory = (
  handlers: AzurePushAudioStreamHandlers,
) => AzurePushAudioStreamLike

export interface AzureSpeechSynthesizerLike {
  speakTextAsync: (
    text: string,
    cb?: (result: AzureSpeechSynthesisResultLike) => void,
    err?: (error: string) => void,
    stream?: AzurePushAudioStreamLike,
  ) => void
  close: (cb?: () => void, err?: (error: string) => void) => void
}

export type AzureSpeechSynthesizerFactory = (
  config: AzureSpeechRuntimeConfig,
) => AzureSpeechSynthesizerLike

export type AzurePushAudioStreamHandlers = {
  onChunk: (chunk: AudioChunk) => void
  onClose: () => void
}

type QueueWaiter<T> = {
  resolve: (value: IteratorResult<T>) => void
  reject: (error: Error) => void
}

export function resolveAzureRuntimeConfig(
  options: AzureSpeechSynthesisOptions,
  config?: TTSConfig,
): AzureSpeechRuntimeConfig {
  const sampleRate = normalizeAzureSampleRate(
    config?.sampleRate ?? options.sampleRate ?? DEFAULT_AZURE_SAMPLE_RATE,
  )
  const voice =
    config?.voice?.trim() ||
    options.voice?.trim() ||
    defaultVoiceForLanguage(config?.language)

  return {
    apiKey: options.apiKey,
    region: options.region?.trim(),
    endpoint: options.endpoint?.trim(),
    voice,
    language: config?.language?.trim() || voiceLocale(voice),
    sampleRate,
  }
}

export function createAzureSpeechSynthesizer(
  config: AzureSpeechRuntimeConfig,
): AzureSpeechSynthesizerLike {
  return new speechSdk.SpeechSynthesizer(createAzureSpeechConfig(config))
}

export async function closeAzureSpeechSynthesizer(
  synthesizer: AzureSpeechSynthesizerLike,
) {
  await new Promise<void>((resolve) => {
    synthesizer.close(
      () => resolve(),
      () => resolve(),
    )
  })
}

export function createDefaultAzurePushAudioStream(
  handlers: AzurePushAudioStreamHandlers,
) {
  return new AzurePushAudioStream(handlers)
}

export async function* synthesizeAzureTextSegment(
  synthesizer: AzureSpeechSynthesizerLike,
  text: string,
  createPushAudioStream: AzurePushAudioStreamFactory,
): AsyncGenerator<AudioChunk> {
  if (!text.trim()) {
    return
  }

  const queue = new AsyncChunkQueue<AudioChunk>()
  const stream = createPushAudioStream({
    onChunk(chunk) {
      if (chunk.byteLength > 0) {
        queue.push(chunk)
      }
    },
    onClose() {
      queue.close()
    },
  })

  const completion = new Promise<void>((resolve, reject) => {
    try {
      synthesizer.speakTextAsync(
        text,
        (result) => {
          const error = normalizeAzureSynthesisResultError(result)
          if (error) {
            queue.fail(error)
            reject(error)
            return
          }

          queue.close()
          resolve()
        },
        (error) => {
          const normalized = new Error(
            `Azure Speech TTS request failed: ${error}`,
          )
          queue.fail(normalized)
          reject(normalized)
        },
        stream,
      )
    } catch (error) {
      const normalized = normalizeError(error)
      queue.fail(normalized)
      reject(normalized)
    }
  })

  try {
    yield* queue.drain()
    await completion
  } finally {
    await completion.catch(() => undefined)
  }
}

function createAzureSpeechConfig(config: AzureSpeechRuntimeConfig) {
  const speechConfig = config.endpoint?.trim()
    ? speechSdk.SpeechConfig.fromEndpoint(
        new URL(normalizeAzureEndpointForSdk(config.endpoint, config.region)),
        config.apiKey,
      )
    : createAzureSpeechConfigFromRegion(config)

  speechConfig.speechSynthesisVoiceName = config.voice
  speechConfig.speechSynthesisLanguage = config.language
  speechConfig.speechSynthesisOutputFormat =
    AZURE_OUTPUT_FORMATS.get(config.sampleRate) ??
    speechSdk.SpeechSynthesisOutputFormat.Raw24Khz16BitMonoPcm

  return speechConfig
}

function createAzureSpeechConfigFromRegion(config: AzureSpeechRuntimeConfig) {
  if (!config.region) {
    throw new Error(
      "Azure Speech TTS requires VOICYCLAW_AZURE_SPEECH_REGION or VOICYCLAW_AZURE_TTS_ENDPOINT.",
    )
  }

  return speechSdk.SpeechConfig.fromSubscription(config.apiKey, config.region)
}

export function normalizeAzureEndpointForSdk(
  endpoint: string,
  region?: string,
) {
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
      return `wss://${resolvedRegion}.tts.speech.microsoft.com/tts/cognitiveservices/websocket/v1`
    }
  }

  if (hostname.endsWith(".tts.speech.microsoft.com")) {
    url.protocol = "wss:"

    if (
      url.pathname === "" ||
      url.pathname === "/" ||
      url.pathname === "/cognitiveservices/v1" ||
      url.pathname === "/tts/cognitiveservices/websocket/v1"
    ) {
      url.pathname = "/tts/cognitiveservices/websocket/v1"
    }

    return url.toString()
  }

  if (url.protocol === "https:") {
    url.protocol = "wss:"
    return url.toString()
  }

  if (url.protocol === "http:") {
    url.protocol = "ws:"
    return url.toString()
  }

  return endpoint
}

function normalizeAzureSampleRate(sampleRate: number) {
  const supported = [...AZURE_OUTPUT_FORMATS.keys()]

  return supported.reduce((best, candidate) =>
    Math.abs(candidate - sampleRate) < Math.abs(best - sampleRate)
      ? candidate
      : best,
  )
}

function normalizeAzureSynthesisResultError(
  result: AzureSpeechSynthesisResultLike | undefined,
) {
  if (result?.reason === speechSdk.ResultReason.Canceled) {
    return new Error(
      `Azure Speech TTS request failed: ${result.errorDetails || "Synthesis canceled"}`,
    )
  }

  return null
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

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
}

class AzurePushAudioStream extends speechSdk.PushAudioOutputStreamCallback {
  constructor(private readonly handlers: AzurePushAudioStreamHandlers) {
    super()
  }

  write(dataBuffer: ArrayBuffer) {
    const audio = Buffer.from(dataBuffer)
    if (audio.byteLength > 0) {
      this.handlers.onChunk(audio)
    }
  }

  close() {
    this.handlers.onClose()
  }
}

class AsyncChunkQueue<T> {
  private readonly values: T[] = []
  private readonly waiters: QueueWaiter<T>[] = []
  private error: Error | null = null
  private closed = false

  push(value: T) {
    if (this.closed || this.error) {
      return
    }

    const waiter = this.waiters.shift()
    if (waiter) {
      waiter.resolve({
        done: false,
        value,
      })
      return
    }

    this.values.push(value)
  }

  close() {
    if (this.closed || this.error) {
      return
    }

    this.closed = true

    while (this.waiters.length > 0) {
      this.waiters.shift()?.resolve({
        done: true,
        value: undefined as T,
      })
    }
  }

  fail(error: Error) {
    if (this.closed || this.error) {
      return
    }

    this.error = error

    while (this.waiters.length > 0) {
      this.waiters.shift()?.reject(error)
    }
  }

  async *drain() {
    while (true) {
      const next = await this.next()
      if (next.done) {
        return
      }

      yield next.value
    }
  }

  private async next(): Promise<IteratorResult<T>> {
    if (this.values.length > 0) {
      return {
        done: false,
        value: this.values.shift() as T,
      }
    }

    if (this.error) {
      throw this.error
    }

    if (this.closed) {
      return {
        done: true,
        value: undefined as T,
      }
    }

    return await new Promise<IteratorResult<T>>((resolve, reject) => {
      this.waiters.push({
        resolve,
        reject,
      })
    })
  }
}
