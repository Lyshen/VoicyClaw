import { Buffer } from "node:buffer"
import { readFile } from "node:fs/promises"
import type { protos as googleTtsProtos } from "@google-cloud/text-to-speech"
import { v1 as googleTextToSpeechV1 } from "@google-cloud/text-to-speech"

import type { TTSAdapter } from "../interface"
import type { AudioChunk, TTSConfig } from "../types"

const DEFAULT_SAMPLE_RATE = 24_000

type GoogleServiceAccount = {
  client_email: string
  private_key: string
  project_id?: string
}

export interface GoogleCloudTTSProviderOptions {
  serviceAccountJson?: string
  serviceAccountFile?: string
  endpoint?: string
  voice?: string
  sampleRate?: number
  speakingRate?: number
  createStreamingClient?: () => GoogleStreamingSynthesizeClient
}

type GoogleStreamingSynthesizeRequest =
  googleTtsProtos.google.cloud.texttospeech.v1.IStreamingSynthesizeRequest
type GoogleStreamingSynthesizeResponse =
  googleTtsProtos.google.cloud.texttospeech.v1.IStreamingSynthesizeResponse

interface GoogleStreamingSynthesizeStream {
  write: (request: GoogleStreamingSynthesizeRequest) => boolean
  end: () => void
  destroy: (error?: Error) => void
  once: (
    event: "drain",
    listener: () => void,
  ) => GoogleStreamingSynthesizeStream
  off: (event: "drain", listener: () => void) => GoogleStreamingSynthesizeStream
  [Symbol.asyncIterator]: () => AsyncIterator<GoogleStreamingSynthesizeResponse>
}

interface GoogleStreamingSynthesizeClient {
  streamingSynthesize: () => GoogleStreamingSynthesizeStream
  close: () => Promise<void>
}

export class GoogleCloudTTSProvider implements TTSAdapter {
  readonly name = "google-cloud-tts"

  constructor(private readonly options: GoogleCloudTTSProviderOptions) {}

  async *synthesize(
    text: AsyncIterable<string>,
    config?: TTSConfig,
  ): AsyncGenerator<AudioChunk> {
    const voiceName = resolveStreamingVoice(config, this.options)
    const client = await this.createStreamingClient()
    const sampleRate =
      config?.sampleRate ?? this.options.sampleRate ?? DEFAULT_SAMPLE_RATE
    const languageCode = resolveLanguageCode(config?.language, voiceName)
    const stream = client.streamingSynthesize()
    const writePromise = this.writeStreamingRequests(
      stream,
      text,
      languageCode,
      voiceName,
      sampleRate,
    ).catch((error) => {
      stream.destroy(normalizeError(error))
      throw error
    })

    try {
      for await (const response of stream) {
        const audio = normalizeGoogleAudioContent(response.audioContent)
        if (audio.byteLength > 0) {
          yield audio
        }
      }

      await writePromise
    } finally {
      await settlePromise(writePromise)
      await client.close().catch(() => undefined)
    }
  }

  private async createStreamingClient() {
    if (this.options.createStreamingClient) {
      return this.options.createStreamingClient()
    }

    const serviceAccount = await loadServiceAccount(this.options)
    if (!serviceAccount) {
      throw new Error(
        "Google Cloud streaming TTS requires VOICYCLAW_GOOGLE_TTS_SERVICE_ACCOUNT_JSON or VOICYCLAW_GOOGLE_TTS_SERVICE_ACCOUNT_FILE.",
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
      ...(normalizeGoogleStreamingApiHost(this.options.endpoint)
        ? {
            apiEndpoint: normalizeGoogleStreamingApiHost(this.options.endpoint),
          }
        : {}),
    })
  }

  private async writeStreamingRequests(
    stream: GoogleStreamingSynthesizeStream,
    text: AsyncIterable<string>,
    languageCode: string,
    voiceName: string,
    sampleRate: number,
  ) {
    await writeStreamingRequest(stream, {
      streamingConfig: {
        voice: {
          languageCode,
          name: voiceName,
        },
        streamingAudioConfig: {
          audioEncoding: "PCM",
          sampleRateHertz: sampleRate,
          ...(typeof this.options.speakingRate === "number"
            ? {
                speakingRate: this.options.speakingRate,
              }
            : {}),
        },
      },
    })

    for await (const chunk of text) {
      if (!chunk.trim()) {
        continue
      }

      await writeStreamingRequest(stream, {
        input: {
          text: chunk,
        },
      })
    }

    stream.end()
  }
}

async function loadServiceAccount(options: GoogleCloudTTSProviderOptions) {
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

function normalizeGoogleStreamingApiHost(endpoint?: string) {
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

function resolveStreamingVoice(
  config: TTSConfig | undefined,
  options: GoogleCloudTTSProviderOptions,
) {
  const voiceName = config?.voice?.trim() || options.voice?.trim()

  if (!voiceName) {
    throw new Error(
      "Google Cloud TTS streaming requires a Chirp 3 HD voice. Set VOICYCLAW_GOOGLE_TTS_VOICE or GoogleCloudTTS.voice.",
    )
  }

  if (!isChirpStreamingVoice(voiceName)) {
    throw new Error(
      `Google Cloud TTS streaming only supports Chirp 3 HD voices right now. Received ${voiceName}.`,
    )
  }

  return voiceName
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

async function writeStreamingRequest(
  stream: GoogleStreamingSynthesizeStream,
  request: GoogleStreamingSynthesizeRequest,
) {
  if (stream.write(request)) {
    return
  }

  await new Promise<void>((resolve) => {
    const handleDrain = () => {
      stream.off("drain", handleDrain)
      resolve()
    }

    stream.once("drain", handleDrain)
  })
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
}

async function settlePromise(promise: Promise<unknown>) {
  try {
    await promise
  } catch {
    // The streaming loop already surfaces the original failure path.
  }
}
