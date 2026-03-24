import { Buffer } from "node:buffer"
import { readFile } from "node:fs/promises"
import type { protos as googleTtsProtos } from "@google-cloud/text-to-speech"
import { v1 as googleTextToSpeechV1 } from "@google-cloud/text-to-speech"

import type { TTSAdapter } from "../interface"
import type { AudioChunk, TTSConfig } from "../types"
import { stripWavHeaderIfPresent } from "./shared"

const DEFAULT_SAMPLE_RATE = 24_000
const DEFAULT_FLUSH_TIMEOUT_MS = 450
const DEFAULT_MAX_CHUNK_CHARACTERS = 220

type GoogleServiceAccount = {
  client_email: string
  private_key: string
  project_id?: string
}

type GoogleSynthesizeSpeechRequest =
  googleTtsProtos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest
type GoogleSynthesizeSpeechResponse =
  googleTtsProtos.google.cloud.texttospeech.v1.ISynthesizeSpeechResponse

interface GoogleSynthesizeSpeechClient {
  synthesizeSpeech: (
    request: GoogleSynthesizeSpeechRequest,
  ) => Promise<
    [
      GoogleSynthesizeSpeechResponse,
      GoogleSynthesizeSpeechRequest | undefined,
      unknown?,
    ]
  >
  close: () => Promise<void>
}

export interface GoogleCloudBatchedTTSProviderOptions {
  serviceAccountJson?: string
  serviceAccountFile?: string
  endpoint?: string
  voice?: string
  sampleRate?: number
  speakingRate?: number
  pitch?: number
  flushTimeoutMs?: number
  maxChunkCharacters?: number
  createSynthesizeClient?: () => GoogleSynthesizeSpeechClient
}

export class GoogleCloudBatchedTTSProvider implements TTSAdapter {
  readonly name = "google-cloud-batched-tts"

  constructor(private readonly options: GoogleCloudBatchedTTSProviderOptions) {}

  async *synthesize(
    text: AsyncIterable<string>,
    config?: TTSConfig,
  ): AsyncGenerator<AudioChunk> {
    const voiceName = resolveBatchedVoice(config, this.options)
    const sampleRate =
      config?.sampleRate ?? this.options.sampleRate ?? DEFAULT_SAMPLE_RATE
    const segmentIterator = createBatchedSegments(text, {
      flushTimeoutMs: this.options.flushTimeoutMs ?? DEFAULT_FLUSH_TIMEOUT_MS,
      maxChunkCharacters:
        this.options.maxChunkCharacters ?? DEFAULT_MAX_CHUNK_CHARACTERS,
    })[Symbol.asyncIterator]()
    const firstSegment = await segmentIterator.next()

    if (firstSegment.done) {
      return
    }

    const client = await this.createSynthesizeClient()

    try {
      yield* this.synthesizeSegment(
        client,
        firstSegment.value,
        config?.language,
        voiceName,
        sampleRate,
      )

      while (true) {
        const nextSegment = await segmentIterator.next()
        if (nextSegment.done) {
          return
        }

        yield* this.synthesizeSegment(
          client,
          nextSegment.value,
          config?.language,
          voiceName,
          sampleRate,
        )
      }
    } finally {
      await client.close().catch(() => undefined)
    }
  }

  private async createSynthesizeClient(): Promise<GoogleSynthesizeSpeechClient> {
    if (this.options.createSynthesizeClient) {
      return this.options.createSynthesizeClient()
    }

    const serviceAccount = await loadServiceAccount(this.options)
    if (!serviceAccount) {
      throw new Error(
        "Google Cloud batched TTS requires VOICYCLAW_GOOGLE_BATCHED_TTS_SERVICE_ACCOUNT_JSON, VOICYCLAW_GOOGLE_BATCHED_TTS_SERVICE_ACCOUNT_FILE, or GOOGLE_APPLICATION_CREDENTIALS.",
      )
    }

    const filePath = this.options.serviceAccountFile?.trim()

    return new googleTextToSpeechV1.TextToSpeechClient({
      ...(filePath
        ? {
            keyFilename: filePath,
          }
        : {
            credentials: {
              client_email: serviceAccount.client_email,
              private_key: serviceAccount.private_key,
            },
            ...(serviceAccount.project_id
              ? {
                  projectId: serviceAccount.project_id,
                }
              : {}),
          }),
      ...(normalizeGoogleApiHost(this.options.endpoint)
        ? {
            apiEndpoint: normalizeGoogleApiHost(this.options.endpoint),
          }
        : {}),
    }) as GoogleSynthesizeSpeechClient
  }

  private async *synthesizeSegment(
    client: GoogleSynthesizeSpeechClient,
    text: string,
    language: string | undefined,
    voiceName: string,
    sampleRate: number,
  ): AsyncGenerator<AudioChunk> {
    const [response] = await client.synthesizeSpeech({
      input: {
        text,
      },
      voice: {
        languageCode: resolveLanguageCode(language, voiceName),
        name: voiceName,
      },
      audioConfig: {
        // Unary Google TTS is normalized through LINEAR16 so we can strip the
        // WAV wrapper and keep the browser-facing contract as raw PCM.
        audioEncoding: "LINEAR16",
        sampleRateHertz: sampleRate,
        ...(typeof this.options.speakingRate === "number"
          ? {
              speakingRate: this.options.speakingRate,
            }
          : {}),
        ...(typeof this.options.pitch === "number"
          ? {
              pitch: this.options.pitch,
            }
          : {}),
      },
    })

    const audio = normalizeGoogleAudioContent(response.audioContent)
    if (audio.byteLength > 0) {
      yield stripWavHeaderIfPresent(audio)
    }
  }
}

async function loadServiceAccount(
  options: GoogleCloudBatchedTTSProviderOptions,
) {
  const inlineJson = options.serviceAccountJson?.trim()
  if (inlineJson) {
    return JSON.parse(inlineJson) as GoogleServiceAccount
  }

  const filePath = options.serviceAccountFile?.trim()
  if (!filePath) {
    return null
  }

  const contents = await readFile(filePath, "utf8")
  return JSON.parse(contents) as GoogleServiceAccount
}

function normalizeGoogleApiHost(endpoint?: string) {
  const normalized = endpoint?.trim()
  if (!normalized) {
    return undefined
  }

  try {
    return new URL(normalized).host
  } catch {
    return normalized
  }
}

function resolveLanguageCode(
  language: string | undefined,
  voice: string | undefined,
) {
  const normalizedLanguage = language?.trim()
  if (normalizedLanguage) {
    return normalizedLanguage
  }

  if (voice) {
    const parts = voice.split("-")
    if (parts.length >= 2) {
      return `${parts[0]}-${parts[1]}`
    }
  }

  return "en-US"
}

function isChirpStreamingVoice(voiceName: string) {
  return /chirp3?-hd/i.test(voiceName)
}

function resolveBatchedVoice(
  config: TTSConfig | undefined,
  options: GoogleCloudBatchedTTSProviderOptions,
) {
  const voiceName = config?.voice?.trim() || options.voice?.trim()

  if (!voiceName) {
    throw new Error(
      "Google Cloud batched TTS requires a non-Chirp voice such as WaveNet or Neural2. Set VOICYCLAW_GOOGLE_BATCHED_TTS_VOICE or GoogleCloudBatchedTTS.voice.",
    )
  }

  if (isChirpStreamingVoice(voiceName)) {
    throw new Error(
      `Google Cloud batched TTS is intended for unary voices such as WaveNet or Neural2. Received ${voiceName}; use google-tts for Chirp 3 HD streaming.`,
    )
  }

  return voiceName
}

async function* createBatchedSegments(
  text: AsyncIterable<string>,
  options: {
    flushTimeoutMs: number
    maxChunkCharacters: number
  },
) {
  const iterator = text[Symbol.asyncIterator]()
  let buffer = ""
  let pendingRead: Promise<IteratorResult<string>> | null = null

  while (true) {
    const readySegment = extractReadySegment(buffer, options.maxChunkCharacters)

    if (readySegment) {
      buffer = readySegment.rest
      yield readySegment.segment
      continue
    }

    if (!pendingRead) {
      pendingRead = iterator.next()
    }

    if (!buffer.trim()) {
      const nextResult = await pendingRead
      pendingRead = null

      if (nextResult.done) {
        return
      }

      buffer += nextResult.value
      continue
    }

    const pendingResult = await waitForReadOrTimeout(
      pendingRead,
      options.flushTimeoutMs,
    )

    if (pendingResult.kind === "timeout") {
      const flushed = normalizeSegment(buffer)
      buffer = ""

      if (flushed) {
        yield flushed
      }
      continue
    }

    pendingRead = null

    if (pendingResult.result.done) {
      const finalSegment = normalizeSegment(buffer)
      if (finalSegment) {
        yield finalSegment
      }
      return
    }

    buffer += pendingResult.result.value
  }
}

function extractReadySegment(buffer: string, maxChunkCharacters: number) {
  if (!buffer.trim()) {
    return null
  }

  const sentenceBoundary = findSentenceBoundary(buffer)
  if (sentenceBoundary !== null) {
    return {
      segment: normalizeSegment(buffer.slice(0, sentenceBoundary)) as string,
      rest: buffer.slice(sentenceBoundary),
    }
  }

  if (buffer.length < maxChunkCharacters) {
    return null
  }

  const splitIndex = findPreferredSplitIndex(buffer, maxChunkCharacters)
  return {
    segment: normalizeSegment(buffer.slice(0, splitIndex)) as string,
    rest: buffer.slice(splitIndex),
  }
}

function findSentenceBoundary(buffer: string) {
  for (let index = 0; index < buffer.length; index += 1) {
    if (!isStrongBoundary(buffer[index])) {
      continue
    }

    let end = index + 1
    while (end < buffer.length && isBoundarySuffix(buffer[end])) {
      end += 1
    }

    return end
  }

  return null
}

function findPreferredSplitIndex(buffer: string, maxChunkCharacters: number) {
  const limit = Math.min(buffer.length, maxChunkCharacters)
  const sample = buffer.slice(0, limit)

  for (let index = sample.length - 1; index >= 0; index -= 1) {
    const character = sample[index]
    if (isSoftBoundary(character) || /\s/.test(character)) {
      return index + 1
    }
  }

  return limit
}

function isStrongBoundary(character: string | undefined) {
  return (
    character === "." ||
    character === "!" ||
    character === "?" ||
    character === "。" ||
    character === "！" ||
    character === "？"
  )
}

function isSoftBoundary(character: string | undefined) {
  return (
    character === "," ||
    character === ";" ||
    character === ":" ||
    character === "，" ||
    character === "、" ||
    character === "；" ||
    character === "：" ||
    character === "\n"
  )
}

function isBoundarySuffix(character: string | undefined) {
  return (
    character === '"' ||
    character === "'" ||
    character === ")" ||
    character === "]" ||
    character === "}" ||
    character === "”" ||
    character === "’" ||
    Boolean(character?.match(/\s/))
  )
}

function normalizeSegment(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim()
  return normalized || null
}

async function waitForReadOrTimeout<T>(
  pendingRead: Promise<IteratorResult<T>>,
  timeoutMs: number,
): Promise<
  | {
      kind: "timeout"
    }
  | {
      kind: "result"
      result: IteratorResult<T>
    }
> {
  if (timeoutMs <= 0) {
    return {
      kind: "result",
      result: await pendingRead,
    }
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve({
        kind: "timeout",
      })
    }, timeoutMs)

    pendingRead.then(
      (result) => {
        clearTimeout(timer)
        resolve({
          kind: "result",
          result,
        })
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function normalizeGoogleAudioContent(
  audioContent: Uint8Array | Buffer | string | null | undefined,
) {
  if (!audioContent) {
    return Buffer.alloc(0)
  }

  if (typeof audioContent === "string") {
    return Buffer.from(audioContent, "base64")
  }

  return Buffer.from(audioContent)
}
