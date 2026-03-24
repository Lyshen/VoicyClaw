import { Buffer } from "node:buffer"
import { createSign } from "node:crypto"
import { readFile } from "node:fs/promises"
import type { protos as googleTtsProtos } from "@google-cloud/text-to-speech"
import { v1 as googleTextToSpeechV1 } from "@google-cloud/text-to-speech"

import type { TTSAdapter } from "../interface"
import type { AudioChunk, TTSConfig } from "../types"
import { collectFullText, stripWavHeaderIfPresent } from "./shared"

const DEFAULT_ENDPOINT =
  "https://texttospeech.googleapis.com/v1beta1/text:synthesize"
const DEFAULT_SAMPLE_RATE = 24_000
const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token"
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/cloud-platform"

type GoogleServiceAccount = {
  client_email: string
  private_key: string
  project_id?: string
  token_uri?: string
}

export interface GoogleCloudTTSProviderOptions {
  accessToken?: string
  apiKey?: string
  serviceAccountJson?: string
  serviceAccountFile?: string
  endpoint?: string
  voice?: string
  sampleRate?: number
  speakingRate?: number
  pitch?: number
  fetchImpl?: typeof fetch
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
  private cachedAccessToken: { value: string; expiresAt: number } | null = null

  constructor(private readonly options: GoogleCloudTTSProviderOptions) {}

  async *synthesize(
    text: AsyncIterable<string>,
    config?: TTSConfig,
  ): AsyncGenerator<AudioChunk> {
    const voiceName = config?.voice?.trim() || this.options.voice?.trim()
    if (voiceName && shouldUseStreaming(this.options, voiceName)) {
      yield* this.synthesizeStreaming(text, config, voiceName)
      return
    }

    yield* this.synthesizeUnary(text, config, voiceName)
  }

  private async *synthesizeUnary(
    text: AsyncIterable<string>,
    config: TTSConfig | undefined,
    voiceName: string | undefined,
  ): AsyncGenerator<AudioChunk> {
    const input = await collectFullText(text)

    if (!input) {
      return
    }

    const sampleRate =
      config?.sampleRate ?? this.options.sampleRate ?? DEFAULT_SAMPLE_RATE
    const languageCode = resolveLanguageCode(config?.language, voiceName)
    const response = await (this.options.fetchImpl ?? fetch)(
      buildGoogleEndpointUrl(
        this.options.endpoint?.trim() || DEFAULT_ENDPOINT,
        this.options.apiKey?.trim(),
      ),
      {
        method: "POST",
        headers: await this.buildHeaders(),
        body: JSON.stringify({
          input: {
            text: input,
          },
          voice: {
            languageCode,
            ...(voiceName ? { name: voiceName } : {}),
          },
          audioConfig: {
            audioEncoding: "PCM",
            sampleRateHertz: sampleRate,
            ...(typeof this.options.speakingRate === "number"
              ? { speakingRate: this.options.speakingRate }
              : {}),
            ...(typeof this.options.pitch === "number"
              ? { pitch: this.options.pitch }
              : {}),
          },
        }),
      },
    )

    if (!response.ok) {
      throw new Error(
        `Google Cloud TTS request failed: ${await readGoogleError(response)}`,
      )
    }

    const payload = (await response.json()) as {
      audioContent?: string
    }
    const audioContent = payload.audioContent?.trim()

    if (!audioContent) {
      throw new Error("Google Cloud TTS response did not include audioContent.")
    }

    const audio = stripWavHeaderIfPresent(Buffer.from(audioContent, "base64"))
    if (audio.byteLength > 0) {
      yield audio
    }
  }

  private async *synthesizeStreaming(
    text: AsyncIterable<string>,
    config: TTSConfig | undefined,
    voiceName: string,
  ): AsyncGenerator<AudioChunk> {
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

  private async buildHeaders() {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    const accessToken = await this.resolveAccessToken()
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    return headers
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

  private async resolveAccessToken() {
    if (this.options.accessToken?.trim()) {
      return this.options.accessToken.trim()
    }

    if (
      this.cachedAccessToken &&
      this.cachedAccessToken.expiresAt > Date.now()
    ) {
      return this.cachedAccessToken.value
    }

    if (this.options.apiKey?.trim()) {
      return null
    }

    const serviceAccount = await loadServiceAccount(this.options)
    if (!serviceAccount) {
      throw new Error(
        "Google Cloud TTS requires VOICYCLAW_GOOGLE_TTS_SERVICE_ACCOUNT_JSON, VOICYCLAW_GOOGLE_TTS_SERVICE_ACCOUNT_FILE, VOICYCLAW_GOOGLE_TTS_ACCESS_TOKEN, or VOICYCLAW_GOOGLE_TTS_API_KEY.",
      )
    }

    const token = await exchangeServiceAccountToken(
      serviceAccount,
      this.options.fetchImpl ?? fetch,
    )
    this.cachedAccessToken = {
      value: token.accessToken,
      expiresAt: Date.now() + Math.max(0, token.expiresIn - 60) * 1000,
    }

    return token.accessToken
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

async function exchangeServiceAccountToken(
  serviceAccount: GoogleServiceAccount,
  fetchImpl: typeof fetch,
) {
  const now = Math.floor(Date.now() / 1000)
  const tokenUri = serviceAccount.token_uri?.trim() || GOOGLE_TOKEN_URI
  const assertion = signGoogleJwt(serviceAccount, tokenUri, now)
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  })

  const response = await fetchImpl(tokenUri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })

  if (!response.ok) {
    throw new Error(
      `Google OAuth token exchange failed: ${await readGoogleError(response)}`,
    )
  }

  const payload = (await response.json()) as {
    access_token?: string
    expires_in?: number
  }

  if (!payload.access_token || typeof payload.expires_in !== "number") {
    throw new Error("Google OAuth token exchange returned an invalid payload.")
  }

  return {
    accessToken: payload.access_token,
    expiresIn: payload.expires_in,
  }
}

function signGoogleJwt(
  serviceAccount: GoogleServiceAccount,
  audience: string,
  now: number,
) {
  const header = toBase64Url(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT",
    }),
  )
  const claims = toBase64Url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      sub: serviceAccount.client_email,
      scope: GOOGLE_SCOPE,
      aud: audience,
      iat: now,
      exp: now + 3600,
    }),
  )
  const unsigned = `${header}.${claims}`
  const signer = createSign("RSA-SHA256")

  signer.update(unsigned)
  signer.end()

  const signature = signer.sign(serviceAccount.private_key)
  return `${unsigned}.${toBase64Url(signature)}`
}

function buildGoogleEndpointUrl(endpoint: string, apiKey?: string) {
  if (!apiKey) {
    return endpoint
  }

  const url = new URL(endpoint)
  url.searchParams.set("key", apiKey)
  return url.toString()
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

function shouldUseStreaming(
  options: GoogleCloudTTSProviderOptions,
  voiceName: string | undefined,
) {
  if (!voiceName || !isChirpStreamingVoice(voiceName)) {
    return false
  }

  if (typeof options.pitch === "number") {
    return false
  }

  return Boolean(
    options.serviceAccountJson?.trim() || options.serviceAccountFile?.trim(),
  )
}

function isChirpStreamingVoice(voiceName: string) {
  return /chirp3?-hd/i.test(voiceName)
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

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
}

async function readGoogleError(response: Response) {
  const text = await response.text()

  try {
    const parsed = JSON.parse(text) as {
      error?: {
        message?: string
      }
    }
    const message = parsed.error?.message?.trim()
    if (message) {
      return message
    }
  } catch {
    // Fall back to the raw body below.
  }

  return text.trim() || `${response.status} ${response.statusText}`
}
