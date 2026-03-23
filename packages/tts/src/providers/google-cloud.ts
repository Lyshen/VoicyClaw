import { Buffer } from "node:buffer"
import { createSign } from "node:crypto"
import { readFile } from "node:fs/promises"

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
}

export class GoogleCloudTTSProvider implements TTSAdapter {
  readonly name = "google-cloud-tts"
  private cachedAccessToken: { value: string; expiresAt: number } | null = null

  constructor(private readonly options: GoogleCloudTTSProviderOptions) {}

  async *synthesize(
    text: AsyncIterable<string>,
    config?: TTSConfig,
  ): AsyncGenerator<AudioChunk> {
    const input = await collectFullText(text)

    if (!input) {
      return
    }

    const sampleRate =
      config?.sampleRate ?? this.options.sampleRate ?? DEFAULT_SAMPLE_RATE
    const voiceName = config?.voice?.trim() || this.options.voice?.trim()
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
