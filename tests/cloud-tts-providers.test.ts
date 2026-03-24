import { Buffer } from "node:buffer"
import { mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { Transform } from "node:stream"

import { describe, expect, it, vi } from "vitest"

import {
  createRuntimeTTSProvider,
  resolveAzureSpeechTTSOptions,
  resolveGoogleCloudTTSOptions,
} from "../apps/server/src/tts-provider"
import { AzureSpeechTTSProvider } from "../packages/tts/src/providers/azure-speech"
import { GoogleCloudTTSProvider } from "../packages/tts/src/providers/google-cloud"

describe("AzureSpeechTTSProvider", () => {
  it("posts SSML to Azure and yields raw PCM audio", async () => {
    const audio = Buffer.from(Int16Array.from([1, -2, 3, -4]).buffer)
    const fetchImpl = vi.fn(async () => new Response(audio, { status: 200 }))
    const provider = new AzureSpeechTTSProvider({
      apiKey: "azure-key",
      region: "eastus",
      voice: "en-US-JennyNeural",
      sampleRate: 24_000,
      fetchImpl,
    })

    const chunks = await collect(
      provider.synthesize(textChunks(["Hello", " world"]), {
        language: "en-US",
      }),
    )

    expect(chunks).toEqual([audio])
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>

    expect(url).toBe(
      "https://eastus.tts.speech.microsoft.com/cognitiveservices/v1",
    )
    expect(headers["Ocp-Apim-Subscription-Key"]).toBe("azure-key")
    expect(headers["X-Microsoft-OutputFormat"]).toBe("raw-24khz-16bit-mono-pcm")
    expect(String(init.body)).toContain("Hello world")
    expect(String(init.body)).toContain("en-US-JennyNeural")
  })

  it("normalizes the Azure portal resource endpoint into the speech synthesis endpoint", async () => {
    const audio = Buffer.from(Int16Array.from([1, -2, 3, -4]).buffer)
    const fetchImpl = vi.fn(async () => new Response(audio, { status: 200 }))
    const provider = new AzureSpeechTTSProvider({
      apiKey: "azure-key",
      region: "eastasia",
      endpoint: "https://eastasia.api.cognitive.microsoft.com/",
      voice: "en-US-JennyNeural",
      sampleRate: 24_000,
      fetchImpl,
    })

    await collect(
      provider.synthesize(textChunks(["Hello"]), {
        language: "en-US",
      }),
    )

    const [url] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      "https://eastasia.tts.speech.microsoft.com/cognitiveservices/v1",
    )
  })
})

describe("GoogleCloudTTSProvider", () => {
  it("uses bidirectional streaming for Chirp 3 HD voices with service-account credentials", async () => {
    const firstAudio = Buffer.from(Int16Array.from([1, -1]).buffer)
    const secondAudio = Buffer.from(Int16Array.from([2, -2]).buffer)
    const call = new FakeGoogleStreamingCall([firstAudio, secondAudio])
    const close = vi.fn(async () => undefined)
    const provider = new GoogleCloudTTSProvider({
      serviceAccountJson: "{}",
      voice: "en-US-Chirp3-HD-Leda",
      sampleRate: 24_000,
      speakingRate: 1.05,
      createStreamingClient: () => ({
        streamingSynthesize: () => call as never,
        close,
      }),
    })

    const chunks = await collect(
      provider.synthesize(textChunks(["Hello", " world"]), {
        language: "en-US",
      }),
    )

    expect(chunks).toEqual([firstAudio, secondAudio])
    expect(call.requests).toEqual([
      {
        streamingConfig: {
          voice: {
            languageCode: "en-US",
            name: "en-US-Chirp3-HD-Leda",
          },
          streamingAudioConfig: {
            audioEncoding: "PCM",
            sampleRateHertz: 24_000,
            speakingRate: 1.05,
          },
        },
      },
      {
        input: {
          text: "Hello",
        },
      },
      {
        input: {
          text: " world",
        },
      },
    ])
    expect(close).toHaveBeenCalledTimes(1)
  })

  it("waits for the first non-empty chunk before opening the Google stream", async () => {
    const audio = Buffer.from(Int16Array.from([7, -7]).buffer)
    const call = new FakeGoogleStreamingCall([audio])
    const close = vi.fn(async () => undefined)
    const createStreamingClient = vi.fn(() => ({
      streamingSynthesize: () => call as never,
      close,
    }))
    let releaseFirstChunk: (() => void) | undefined
    const firstChunkGate = new Promise<void>((resolve) => {
      releaseFirstChunk = resolve
    })
    const provider = new GoogleCloudTTSProvider({
      serviceAccountJson: "{}",
      voice: "en-US-Chirp3-HD-Leda",
      createStreamingClient,
    })

    const synthesis = collect(
      provider.synthesize(
        (async function* () {
          yield "   "
          await firstChunkGate
          yield "Hello after delay"
        })(),
        {
          language: "en-US",
        },
      ),
    )

    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(createStreamingClient).not.toHaveBeenCalled()

    releaseFirstChunk?.()

    await expect(synthesis).resolves.toEqual([audio])
    expect(createStreamingClient).toHaveBeenCalledTimes(1)
    expect(call.requests).toEqual([
      {
        streamingConfig: {
          voice: {
            languageCode: "en-US",
            name: "en-US-Chirp3-HD-Leda",
          },
          streamingAudioConfig: {
            audioEncoding: "PCM",
            sampleRateHertz: 24_000,
          },
        },
      },
      {
        input: {
          text: "Hello after delay",
        },
      },
    ])
    expect(close).toHaveBeenCalledTimes(1)
  })

  it("rejects non-Chirp voices because only streaming is supported", async () => {
    const createStreamingClient = vi.fn(() => {
      throw new Error("streaming should not be created")
    })
    const provider = new GoogleCloudTTSProvider({
      serviceAccountJson: "{}",
      voice: "en-US-Journey-F",
      createStreamingClient,
    })

    await expect(
      collect(
        provider.synthesize(textChunks(["Hello", " world"]), {
          language: "en-US",
        }),
      ),
    ).rejects.toThrow(/Chirp 3 HD voices/)
    expect(createStreamingClient).not.toHaveBeenCalled()
  })

  it("requires an explicit streaming voice", async () => {
    const createStreamingClient = vi.fn(() => {
      throw new Error("streaming should not be created")
    })
    const provider = new GoogleCloudTTSProvider({
      serviceAccountJson: "{}",
      createStreamingClient,
    })

    await expect(
      collect(
        provider.synthesize(textChunks(["Hello", " world"]), {
          language: "en-US",
        }),
      ),
    ).rejects.toThrow(/requires a Chirp 3 HD voice/)
    expect(createStreamingClient).not.toHaveBeenCalled()
  })
})

describe("runtime TTS provider selection", () => {
  it("requires Azure credentials when Azure TTS is selected", () => {
    expect(() =>
      resolveAzureSpeechTTSOptions({
        VOICYCLAW_PROVIDER_CONFIG: missingProviderConfigPath(),
      }),
    ).toThrow(/VOICYCLAW_AZURE_SPEECH_KEY/)
  })

  it("requires Google service-account credentials when Google TTS is selected", () => {
    expect(() =>
      resolveGoogleCloudTTSOptions({
        VOICYCLAW_PROVIDER_CONFIG: missingProviderConfigPath(),
      }),
    ).toThrow(/VOICYCLAW_GOOGLE_TTS_SERVICE_ACCOUNT_JSON/)
  })

  it("requires a Google Chirp 3 HD voice when Google TTS is selected", () => {
    expect(() =>
      resolveGoogleCloudTTSOptions({
        VOICYCLAW_PROVIDER_CONFIG: missingProviderConfigPath(),
        VOICYCLAW_GOOGLE_TTS_SERVICE_ACCOUNT_FILE: "/tmp/google-tts.json",
      }),
    ).toThrow(/requires a Chirp 3 HD voice/)
  })

  it("selects Azure Speech TTS at runtime", () => {
    const runtime = createRuntimeTTSProvider(
      {
        conversationBackend: "local-bot",
        asrMode: "client",
        asrProvider: "browser",
        ttsMode: "server",
        ttsProvider: "azure-tts",
        language: "en-US",
      },
      {
        VOICYCLAW_AZURE_SPEECH_KEY: "azure-key",
        VOICYCLAW_AZURE_SPEECH_REGION: "eastus",
      },
    )

    expect(runtime.providerId).toBe("azure-tts")
    expect(runtime.sampleRate).toBe(24_000)
  })

  it("selects Google Cloud TTS at runtime", () => {
    const runtime = createRuntimeTTSProvider(
      {
        conversationBackend: "local-bot",
        asrMode: "client",
        asrProvider: "browser",
        ttsMode: "server",
        ttsProvider: "google-tts",
        language: "en-US",
      },
      {
        VOICYCLAW_GOOGLE_TTS_SERVICE_ACCOUNT_FILE: "/tmp/google-tts.json",
        VOICYCLAW_GOOGLE_TTS_VOICE: "en-US-Chirp3-HD-Leda",
      },
    )

    expect(runtime.providerId).toBe("google-tts")
    expect(runtime.sampleRate).toBe(24_000)
  })

  it("loads Azure runtime options from provider YAML", () => {
    const runtime = createRuntimeTTSProvider(
      {
        conversationBackend: "local-bot",
        asrMode: "client",
        asrProvider: "browser",
        ttsMode: "server",
        ttsProvider: "azure-tts",
        language: "en-US",
      },
      {
        VOICYCLAW_PROVIDER_CONFIG: writeProviderConfigFile([
          "AzureSpeechTTS:",
          "  api_key: azure-key-from-yaml",
          "  region: eastasia",
          "  voice: en-US-AvaNeural",
          "  sample_rate: 48000",
        ]),
      },
    )

    expect(runtime.providerId).toBe("azure-tts")
    expect(runtime.sampleRate).toBe(48_000)
  })

  it("lets env vars override Azure provider YAML values", () => {
    const options = resolveAzureSpeechTTSOptions({
      VOICYCLAW_PROVIDER_CONFIG: writeProviderConfigFile([
        "AzureSpeechTTS:",
        "  api_key: azure-key-from-yaml",
        "  region: eastasia",
        "  voice: en-US-AvaNeural",
        "  sample_rate: 24000",
      ]),
      VOICYCLAW_AZURE_SPEECH_KEY: "azure-key-from-env",
      VOICYCLAW_AZURE_SPEECH_REGION: "westus",
      VOICYCLAW_AZURE_TTS_VOICE: "en-US-JennyNeural",
      VOICYCLAW_AZURE_TTS_SAMPLE_RATE: "16000",
    })

    expect(options).toMatchObject({
      apiKey: "azure-key-from-env",
      region: "westus",
      voice: "en-US-JennyNeural",
      sampleRate: 16_000,
    })
  })

  it("loads Google runtime options from provider YAML", () => {
    const runtime = createRuntimeTTSProvider(
      {
        conversationBackend: "local-bot",
        asrMode: "client",
        asrProvider: "browser",
        ttsMode: "server",
        ttsProvider: "google-tts",
        language: "en-US",
      },
      {
        VOICYCLAW_PROVIDER_CONFIG: writeProviderConfigFile([
          "GoogleCloudTTS:",
          "  service_account_file: /tmp/google-tts-from-yaml.json",
          "  voice: en-US-Chirp3-HD-Achernar",
          "  sample_rate: 48000",
          "  speaking_rate: 1.1",
        ]),
      },
    )

    expect(runtime.providerId).toBe("google-tts")
    expect(runtime.sampleRate).toBe(48_000)
  })

  it("lets env vars override Google provider YAML values", () => {
    const options = resolveGoogleCloudTTSOptions({
      VOICYCLAW_PROVIDER_CONFIG: writeProviderConfigFile([
        "GoogleCloudTTS:",
        "  service_account_file: /tmp/google-tts-from-yaml.json",
        "  voice: en-US-Chirp3-HD-Achernar",
        "  sample_rate: 24000",
        "  speaking_rate: 1.1",
      ]),
      VOICYCLAW_GOOGLE_TTS_SERVICE_ACCOUNT_FILE:
        "/tmp/google-tts-from-env.json",
      VOICYCLAW_GOOGLE_TTS_VOICE: "en-US-Chirp3-HD-Leda",
      VOICYCLAW_GOOGLE_TTS_SAMPLE_RATE: "16000",
      VOICYCLAW_GOOGLE_TTS_SPEAKING_RATE: "0.95",
    })

    expect(options).toMatchObject({
      serviceAccountFile: "/tmp/google-tts-from-env.json",
      voice: "en-US-Chirp3-HD-Leda",
      sampleRate: 16_000,
      speakingRate: 0.95,
    })
  })
})

async function collect<T>(source: AsyncIterable<T>) {
  const values: T[] = []

  for await (const value of source) {
    values.push(value)
  }

  return values
}

async function* textChunks(values: string[]) {
  for (const value of values) {
    yield value
  }
}

function writeProviderConfigFile(lines: string[]) {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "voicyclaw-provider-yaml-"))
  const filePath = path.join(cwd, "providers.local.yaml")
  writeFileSync(filePath, lines.join("\n"))
  return filePath
}

function missingProviderConfigPath() {
  return path.join(
    mkdtempSync(path.join(os.tmpdir(), "voicyclaw-provider-missing-")),
    "missing.yaml",
  )
}

class FakeGoogleStreamingCall extends Transform {
  readonly requests: unknown[] = []
  private responseIndex = 0

  constructor(private readonly responses: Buffer[]) {
    super({
      objectMode: true,
    })
  }

  override _transform(
    chunk: {
      input?: {
        text?: string
      }
    },
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    this.requests.push(chunk)

    if (chunk.input?.text) {
      const response = this.responses[this.responseIndex]
      this.responseIndex += 1

      if (response) {
        this.push({
          audioContent: response,
        })
      }
    }

    callback()
  }

  override _final(callback: (error?: Error | null) => void) {
    this.push(null)
    callback()
  }
}
