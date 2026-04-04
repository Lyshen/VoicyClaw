import { Buffer } from "node:buffer"
import { mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { Transform } from "node:stream"

import { describe, expect, it, vi } from "vitest"

import {
  createRuntimeTTSProvider,
  resolveAzureSpeechStreamingTTSOptions,
  resolveAzureSpeechTTSOptions,
  resolveGoogleCloudBatchedTTSOptions,
  resolveGoogleCloudTTSOptions,
} from "../apps/server/src/tts-provider"
import { AzureSpeechTTSProvider } from "../packages/tts/src/providers/azure-speech"
import {
  type AzurePushAudioStreamLike,
  type AzureSpeechSynthesizerLike,
  normalizeAzureEndpointForSdk,
} from "../packages/tts/src/providers/azure-speech-shared"
import { AzureSpeechStreamingTTSProvider } from "../packages/tts/src/providers/azure-speech-streaming"
import { GoogleCloudTTSProvider } from "../packages/tts/src/providers/google-cloud"
import { GoogleCloudBatchedTTSProvider } from "../packages/tts/src/providers/google-cloud-batched"

describe("AzureSpeechTTSProvider", () => {
  it("streams Azure SDK audio chunks and emits conversational SSML", async () => {
    const firstAudio = Buffer.from(Int16Array.from([1, -2]).buffer)
    const secondAudio = Buffer.from(Int16Array.from([3, -4]).buffer)
    const synthesizer = new FakeAzureSpeechSynthesizer([
      {
        chunks: [firstAudio, secondAudio],
      },
    ])
    const createSynthesizer = vi.fn(() => synthesizer)
    const provider = new AzureSpeechTTSProvider({
      apiKey: "azure-key",
      region: "eastus",
      voice: "en-US-JennyNeural",
      sampleRate: 24_000,
      createSynthesizer,
    })

    const chunks = await collect(
      provider.synthesize(textChunks(["Hello", " world"]), {
        language: "en-US",
      }),
    )

    expect(chunks).toEqual([firstAudio, secondAudio])
    expect(createSynthesizer).toHaveBeenCalledWith({
      apiKey: "azure-key",
      region: "eastus",
      endpoint: undefined,
      voice: "en-US-JennyNeural",
      language: "en-US",
      sampleRate: 24_000,
      style: "assistant",
      styleDegree: undefined,
      role: undefined,
      rate: "+4.0%",
      pitch: undefined,
      volume: undefined,
    })
    expect(synthesizer.requests).toHaveLength(1)
    expect(synthesizer.requests[0]).toContain('voice name="en-US-JennyNeural"')
    expect(synthesizer.requests[0]).toContain(
      'mstts:express-as style="assistant"',
    )
    expect(synthesizer.requests[0]).toContain('prosody rate="+4.0%"')
    expect(synthesizer.requests[0]).toContain("Hello world")
    expect(synthesizer.closeCalls).toBe(1)
  })

  it("normalizes Azure REST and portal endpoints into websocket synthesis endpoints", () => {
    expect(
      normalizeAzureEndpointForSdk(
        "https://eastasia.api.cognitive.microsoft.com/",
        "eastasia",
      ),
    ).toBe(
      "wss://eastasia.tts.speech.microsoft.com/tts/cognitiveservices/websocket/v1",
    )
    expect(
      normalizeAzureEndpointForSdk(
        "https://eastasia.tts.speech.microsoft.com/cognitiveservices/v1",
      ),
    ).toBe(
      "wss://eastasia.tts.speech.microsoft.com/tts/cognitiveservices/websocket/v1",
    )
  })
})

describe("AzureSpeechStreamingTTSProvider", () => {
  it("batches sentence chunks into segmented Azure SSML synth calls", async () => {
    const firstAudio = Buffer.from(Int16Array.from([11, -11]).buffer)
    const secondAudio = Buffer.from(Int16Array.from([12, -12]).buffer)
    const synthesizer = new FakeAzureSpeechSynthesizer([
      {
        chunks: [firstAudio],
      },
      {
        chunks: [secondAudio],
      },
    ])
    const provider = new AzureSpeechStreamingTTSProvider({
      apiKey: "azure-key",
      region: "eastus",
      voice: "en-US-AriaNeural",
      sampleRate: 24_000,
      createSynthesizer: () => synthesizer,
    })

    const chunks = await collect(
      provider.synthesize(textChunks(["Hello", " world.", " Next sentence!"]), {
        language: "en-US",
      }),
    )

    expect(chunks).toEqual([firstAudio, secondAudio])
    expect(synthesizer.requests).toHaveLength(2)
    expect(synthesizer.requests[0]).toContain('mstts:express-as style="chat"')
    expect(synthesizer.requests[0]).toContain("Hello world.")
    expect(synthesizer.requests[1]).toContain("Next sentence!")
    expect(synthesizer.closeCalls).toBe(1)
  })

  it("flushes a partial Azure segment after the batching timeout", async () => {
    const firstAudio = Buffer.from(Int16Array.from([21, -21]).buffer)
    const secondAudio = Buffer.from(Int16Array.from([22, -22]).buffer)
    const synthesizer = new FakeAzureSpeechSynthesizer([
      {
        chunks: [firstAudio],
      },
      {
        chunks: [secondAudio],
      },
    ])
    const provider = new AzureSpeechStreamingTTSProvider({
      apiKey: "azure-key",
      region: "eastus",
      voice: "en-US-AriaNeural",
      flushTimeoutMs: 10,
      createSynthesizer: () => synthesizer,
    })

    const chunks = await collect(
      provider.synthesize(
        (async function* () {
          yield "Hello"
          await sleep(30)
          yield " later."
        })(),
        {
          language: "en-US",
        },
      ),
    )

    expect(chunks).toEqual([firstAudio, secondAudio])
    expect(synthesizer.requests).toHaveLength(2)
    expect(synthesizer.requests[0]).toContain("Hello")
    expect(synthesizer.requests[1]).toContain("later.")
    expect(synthesizer.closeCalls).toBe(1)
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

describe("GoogleCloudBatchedTTSProvider", () => {
  it("batches sentence chunks into unary Google synthesizeSpeech calls", async () => {
    const firstAudio = Buffer.from(Int16Array.from([11, -11]).buffer)
    const secondAudio = Buffer.from(Int16Array.from([12, -12]).buffer)
    const synthesizeSpeech = vi.fn(
      async (request: { input?: { text?: string } }) => {
        const text = String(request.input?.text ?? "")

        if (text === "Hello world.") {
          return [{ audioContent: firstAudio }]
        }

        if (text === "Next sentence!") {
          return [{ audioContent: secondAudio }]
        }

        throw new Error(`Unexpected text: ${text}`)
      },
    )
    const close = vi.fn(async () => undefined)
    const provider = new GoogleCloudBatchedTTSProvider({
      serviceAccountJson: "{}",
      voice: "en-US-Neural2-F",
      sampleRate: 24_000,
      speakingRate: 0.95,
      pitch: -1,
      createSynthesizeClient: () => ({
        synthesizeSpeech,
        close,
      }),
    })

    const chunks = await collect(
      provider.synthesize(textChunks(["Hello", " world.", " Next sentence!"]), {
        language: "en-US",
      }),
    )

    expect(chunks).toEqual([firstAudio, secondAudio])
    expect(synthesizeSpeech).toHaveBeenCalledTimes(2)
    expect(synthesizeSpeech.mock.calls).toEqual([
      [
        {
          input: {
            text: "Hello world.",
          },
          voice: {
            languageCode: "en-US",
            name: "en-US-Neural2-F",
          },
          audioConfig: {
            audioEncoding: "LINEAR16",
            sampleRateHertz: 24_000,
            speakingRate: 0.95,
            pitch: -1,
          },
        },
      ],
      [
        {
          input: {
            text: "Next sentence!",
          },
          voice: {
            languageCode: "en-US",
            name: "en-US-Neural2-F",
          },
          audioConfig: {
            audioEncoding: "LINEAR16",
            sampleRateHertz: 24_000,
            speakingRate: 0.95,
            pitch: -1,
          },
        },
      ],
    ])
    expect(close).toHaveBeenCalledTimes(1)
  })

  it("flushes a partial segment after the batching timeout", async () => {
    const firstAudio = Buffer.from(Int16Array.from([21, -21]).buffer)
    const secondAudio = Buffer.from(Int16Array.from([22, -22]).buffer)
    const synthesizeSpeech = vi.fn(
      async (request: { input?: { text?: string } }) => {
        const text = String(request.input?.text ?? "")

        if (text === "Hello") {
          return [{ audioContent: firstAudio }]
        }

        if (text === "later.") {
          return [{ audioContent: secondAudio }]
        }

        throw new Error(`Unexpected text: ${text}`)
      },
    )
    const close = vi.fn(async () => undefined)
    const provider = new GoogleCloudBatchedTTSProvider({
      serviceAccountJson: "{}",
      voice: "en-US-Neural2-F",
      flushTimeoutMs: 10,
      createSynthesizeClient: () => ({
        synthesizeSpeech,
        close,
      }),
    })

    const chunks = await collect(
      provider.synthesize(
        (async function* () {
          yield "Hello"
          await sleep(30)
          yield " later."
        })(),
        {
          language: "en-US",
        },
      ),
    )

    expect(chunks).toEqual([firstAudio, secondAudio])
    expect(
      synthesizeSpeech.mock.calls.map(([request]) => request.input?.text ?? ""),
    ).toEqual(["Hello", "later."])
    expect(close).toHaveBeenCalledTimes(1)
  })

  it("rejects Chirp voices because batched mode is for unary models", async () => {
    const createSynthesizeClient = vi.fn(() => {
      throw new Error("unary client should not be created")
    })
    const provider = new GoogleCloudBatchedTTSProvider({
      serviceAccountJson: "{}",
      voice: "en-US-Chirp3-HD-Leda",
      createSynthesizeClient,
    })

    await expect(
      collect(
        provider.synthesize(textChunks(["Hello", " world"]), {
          language: "en-US",
        }),
      ),
    ).rejects.toThrow(/use google-tts for Chirp 3 HD streaming/i)
    expect(createSynthesizeClient).not.toHaveBeenCalled()
  })
})

describe("runtime TTS provider selection", () => {
  it("requires Azure credentials when Azure TTS is selected", () => {
    expect(() =>
      resolveAzureSpeechTTSOptions({
        VOICYCLAW_CONFIG: missingUnifiedConfigPath(),
      }),
    ).toThrow(/VOICYCLAW_AZURE_SPEECH_KEY/)
  })

  it("requires Azure credentials when Azure segmented TTS is selected", () => {
    expect(() =>
      resolveAzureSpeechStreamingTTSOptions({
        VOICYCLAW_CONFIG: missingUnifiedConfigPath(),
      }),
    ).toThrow(/VOICYCLAW_AZURE_SPEECH_KEY/)
  })

  it("requires Google service-account credentials when Google TTS is selected", () => {
    expect(() =>
      resolveGoogleCloudTTSOptions({
        VOICYCLAW_CONFIG: missingUnifiedConfigPath(),
      }),
    ).toThrow(/VOICYCLAW_GOOGLE_TTS_SERVICE_ACCOUNT_JSON/)
  })

  it("requires a Google Chirp 3 HD voice when Google TTS is selected", () => {
    expect(() =>
      resolveGoogleCloudTTSOptions({
        VOICYCLAW_CONFIG: missingUnifiedConfigPath(),
        VOICYCLAW_GOOGLE_TTS_SERVICE_ACCOUNT_FILE: "/tmp/google-tts.json",
      }),
    ).toThrow(/requires a Chirp 3 HD voice/)
  })

  it("requires Google service-account credentials when Google batched TTS is selected", () => {
    expect(() =>
      resolveGoogleCloudBatchedTTSOptions({
        VOICYCLAW_CONFIG: missingUnifiedConfigPath(),
      }),
    ).toThrow(/VOICYCLAW_GOOGLE_BATCHED_TTS_SERVICE_ACCOUNT_JSON/)
  })

  it("requires a non-Chirp voice when Google batched TTS is selected", () => {
    expect(() =>
      resolveGoogleCloudBatchedTTSOptions({
        VOICYCLAW_CONFIG: missingUnifiedConfigPath(),
        VOICYCLAW_GOOGLE_BATCHED_TTS_SERVICE_ACCOUNT_FILE:
          "/tmp/google-batched-tts.json",
      }),
    ).toThrow(/requires a non-Chirp voice/)
  })

  it("rejects Chirp voices when Google batched TTS is selected", () => {
    expect(() =>
      resolveGoogleCloudBatchedTTSOptions({
        VOICYCLAW_CONFIG: missingUnifiedConfigPath(),
        VOICYCLAW_GOOGLE_BATCHED_TTS_SERVICE_ACCOUNT_FILE:
          "/tmp/google-batched-tts.json",
        VOICYCLAW_GOOGLE_BATCHED_TTS_VOICE: "en-US-Chirp3-HD-Leda",
      }),
    ).toThrow(/use google-tts for Chirp 3 HD streaming/i)
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

  it("selects Azure segmented TTS at runtime", () => {
    const runtime = createRuntimeTTSProvider(
      {
        conversationBackend: "local-bot",
        asrMode: "client",
        asrProvider: "browser",
        ttsMode: "server",
        ttsProvider: "azure-streaming-tts",
        language: "en-US",
      },
      {
        VOICYCLAW_AZURE_SPEECH_KEY: "azure-key",
        VOICYCLAW_AZURE_SPEECH_REGION: "eastus",
      },
    )

    expect(runtime.providerId).toBe("azure-streaming-tts")
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

  it("selects Google Cloud batched TTS at runtime", () => {
    const runtime = createRuntimeTTSProvider(
      {
        conversationBackend: "local-bot",
        asrMode: "client",
        asrProvider: "browser",
        ttsMode: "server",
        ttsProvider: "google-batched-tts",
        language: "en-US",
      },
      {
        VOICYCLAW_GOOGLE_BATCHED_TTS_SERVICE_ACCOUNT_FILE:
          "/tmp/google-batched-tts.json",
        VOICYCLAW_GOOGLE_BATCHED_TTS_VOICE: "en-US-Neural2-F",
      },
    )

    expect(runtime.providerId).toBe("google-batched-tts")
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
        VOICYCLAW_CONFIG: writeUnifiedConfigFile([
          "AzureSpeechTTS:",
          "  api_key: azure-key-from-yaml",
          "  region: eastasia",
          "  voice: en-US-AriaNeural",
          "  sample_rate: 48000",
          "  style: chat",
          "  rate: +6%",
        ]),
      },
    )

    expect(runtime.providerId).toBe("azure-tts")
    expect(runtime.sampleRate).toBe(48_000)
  })

  it("lets env vars override Azure provider YAML values", () => {
    const options = resolveAzureSpeechTTSOptions({
      VOICYCLAW_CONFIG: writeUnifiedConfigFile([
        "AzureSpeechTTS:",
        "  api_key: azure-key-from-yaml",
        "  region: eastasia",
        "  voice: en-US-AriaNeural",
        "  sample_rate: 24000",
        "  style: chat",
        "  rate: +6%",
      ]),
      VOICYCLAW_AZURE_SPEECH_KEY: "azure-key-from-env",
      VOICYCLAW_AZURE_SPEECH_REGION: "westus",
      VOICYCLAW_AZURE_TTS_VOICE: "en-US-JennyNeural",
      VOICYCLAW_AZURE_TTS_SAMPLE_RATE: "16000",
      VOICYCLAW_AZURE_TTS_STYLE: "assistant",
      VOICYCLAW_AZURE_TTS_RATE: "+3%",
    })

    expect(options).toMatchObject({
      apiKey: "azure-key-from-env",
      region: "westus",
      voice: "en-US-JennyNeural",
      sampleRate: 16_000,
      style: "assistant",
      rate: "+3%",
    })
  })

  it("loads Azure segmented runtime options from provider YAML and base Azure credentials", () => {
    const runtime = createRuntimeTTSProvider(
      {
        conversationBackend: "local-bot",
        asrMode: "client",
        asrProvider: "browser",
        ttsMode: "server",
        ttsProvider: "azure-streaming-tts",
        language: "en-US",
      },
      {
        VOICYCLAW_CONFIG: writeUnifiedConfigFile([
          "AzureSpeechTTS:",
          "  api_key: azure-key-from-yaml",
          "  region: eastasia",
          "  style: assistant",
          "  rate: +3%",
          "",
          "AzureSpeechStreamingTTS:",
          "  voice: en-US-AriaNeural",
          "  sample_rate: 48000",
          "  style: chat",
          "  rate: +5%",
          "  flush_timeout_ms: 320",
          "  max_chunk_characters: 180",
        ]),
      },
    )

    expect(runtime.providerId).toBe("azure-streaming-tts")
    expect(runtime.sampleRate).toBe(48_000)
  })

  it("lets env vars override Azure segmented provider YAML values", () => {
    const options = resolveAzureSpeechStreamingTTSOptions({
      VOICYCLAW_CONFIG: writeUnifiedConfigFile([
        "AzureSpeechTTS:",
        "  api_key: azure-key-from-yaml",
        "  region: eastasia",
        "  voice: en-US-AriaNeural",
        "  sample_rate: 24000",
        "  style: assistant",
        "  rate: +3%",
        "",
        "AzureSpeechStreamingTTS:",
        "  voice: en-US-AndrewNeural",
        "  sample_rate: 22050",
        "  style: empathetic",
        "  rate: +2%",
        "  flush_timeout_ms: 320",
        "  max_chunk_characters: 180",
      ]),
      VOICYCLAW_AZURE_SPEECH_KEY: "azure-key-from-env",
      VOICYCLAW_AZURE_SPEECH_REGION: "westus",
      VOICYCLAW_AZURE_STREAMING_TTS_VOICE: "en-US-JennyNeural",
      VOICYCLAW_AZURE_STREAMING_TTS_SAMPLE_RATE: "16000",
      VOICYCLAW_AZURE_STREAMING_TTS_STYLE: "assistant",
      VOICYCLAW_AZURE_STREAMING_TTS_RATE: "+3%",
      VOICYCLAW_AZURE_STREAMING_TTS_FLUSH_TIMEOUT_MS: "450",
      VOICYCLAW_AZURE_STREAMING_TTS_MAX_CHUNK_CHARACTERS: "240",
    })

    expect(options).toMatchObject({
      apiKey: "azure-key-from-env",
      region: "westus",
      voice: "en-US-JennyNeural",
      sampleRate: 16_000,
      style: "assistant",
      rate: "+3%",
      flushTimeoutMs: 450,
      maxChunkCharacters: 240,
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
        VOICYCLAW_CONFIG: writeUnifiedConfigFile([
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
      VOICYCLAW_CONFIG: writeUnifiedConfigFile([
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

  it("loads Google batched runtime options from provider YAML", () => {
    const runtime = createRuntimeTTSProvider(
      {
        conversationBackend: "local-bot",
        asrMode: "client",
        asrProvider: "browser",
        ttsMode: "server",
        ttsProvider: "google-batched-tts",
        language: "en-US",
      },
      {
        VOICYCLAW_CONFIG: writeUnifiedConfigFile([
          "GoogleCloudBatchedTTS:",
          "  service_account_file: /tmp/google-batched-from-yaml.json",
          "  voice: en-US-Neural2-F",
          "  sample_rate: 22050",
          "  speaking_rate: 0.9",
          "  pitch: -1",
          "  flush_timeout_ms: 320",
          "  max_chunk_characters: 180",
        ]),
      },
    )

    expect(runtime.providerId).toBe("google-batched-tts")
    expect(runtime.sampleRate).toBe(22_050)
  })

  it("lets env vars override Google batched provider YAML values", () => {
    const options = resolveGoogleCloudBatchedTTSOptions({
      VOICYCLAW_CONFIG: writeUnifiedConfigFile([
        "GoogleCloudBatchedTTS:",
        "  service_account_file: /tmp/google-batched-from-yaml.json",
        "  voice: en-US-Neural2-F",
        "  sample_rate: 22050",
        "  speaking_rate: 0.9",
        "  pitch: -1",
        "  flush_timeout_ms: 320",
        "  max_chunk_characters: 180",
      ]),
      VOICYCLAW_GOOGLE_BATCHED_TTS_SERVICE_ACCOUNT_FILE:
        "/tmp/google-batched-from-env.json",
      VOICYCLAW_GOOGLE_BATCHED_TTS_VOICE: "en-US-Wavenet-D",
      VOICYCLAW_GOOGLE_BATCHED_TTS_SAMPLE_RATE: "24000",
      VOICYCLAW_GOOGLE_BATCHED_TTS_SPEAKING_RATE: "1.05",
      VOICYCLAW_GOOGLE_BATCHED_TTS_PITCH: "2",
      VOICYCLAW_GOOGLE_BATCHED_TTS_FLUSH_TIMEOUT_MS: "450",
      VOICYCLAW_GOOGLE_BATCHED_TTS_MAX_CHUNK_CHARACTERS: "240",
    })

    expect(options).toMatchObject({
      serviceAccountFile: "/tmp/google-batched-from-env.json",
      voice: "en-US-Wavenet-D",
      sampleRate: 24_000,
      speakingRate: 1.05,
      pitch: 2,
      flushTimeoutMs: 450,
      maxChunkCharacters: 240,
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

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function writeUnifiedConfigFile(lines: string[]) {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "voicyclaw-provider-yaml-"))
  const filePath = path.join(cwd, "voicyclaw.local.yaml")
  writeFileSync(filePath, lines.join("\n"))
  return filePath
}

function missingUnifiedConfigPath() {
  return path.join(
    mkdtempSync(path.join(os.tmpdir(), "voicyclaw-provider-missing-")),
    "missing.yaml",
  )
}

class FakeAzureSpeechSynthesizer implements AzureSpeechSynthesizerLike {
  readonly requests: string[] = []
  closeCalls = 0
  private responseIndex = 0

  constructor(
    private readonly responses: Array<{
      chunks: Buffer[]
      error?: string
      reason?: number
    }>,
  ) {}

  speakSsmlAsync(
    ssml: string,
    cb?: (result: { reason?: number; errorDetails?: string }) => void,
    err?: (error: string) => void,
    stream?: AzurePushAudioStreamLike,
  ) {
    this.requests.push(ssml)

    const response = this.responses[this.responseIndex]
    this.responseIndex += 1

    if (!response) {
      err?.("Missing fake Azure response")
      return
    }

    if (response.error) {
      err?.(response.error)
      return
    }

    for (const chunk of response.chunks) {
      stream?.write(toArrayBuffer(chunk))
    }

    stream?.close()
    cb?.({
      reason: response.reason ?? 8,
    })
  }

  close(cb?: () => void) {
    this.closeCalls += 1
    cb?.()
  }
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

function toArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  )
}
