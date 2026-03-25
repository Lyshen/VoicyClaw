import { Buffer } from "node:buffer"
import { EventEmitter } from "node:events"
import { mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  createRuntimeTTSProvider,
  resolveTencentCloudStreamingTTSOptions,
  resolveTencentCloudTTSOptions,
} from "../apps/server/src/tts-provider"
import { TencentCloudTTSProvider } from "../packages/tts/src/providers/tencent-cloud"
import type { TencentCloudSocket } from "../packages/tts/src/providers/tencent-cloud-shared"
import { TencentCloudStreamingTTSProvider } from "../packages/tts/src/providers/tencent-cloud-streaming"

describe("Tencent Cloud TTS runtime wiring", () => {
  it("requires Tencent credentials for the unary provider", () => {
    expect(() =>
      resolveTencentCloudTTSOptions({
        VOICYCLAW_PROVIDER_CONFIG:
          "/tmp/voicyclaw-missing-provider-config.yaml",
      }),
    ).toThrow(
      /VOICYCLAW_TENCENT_APP_ID, VOICYCLAW_TENCENT_SECRET_ID, VOICYCLAW_TENCENT_SECRET_KEY/,
    )
  })

  it("maps Tencent unary env vars into provider config", () => {
    const options = resolveTencentCloudTTSOptions({
      VOICYCLAW_TENCENT_APP_ID: "app-id",
      VOICYCLAW_TENCENT_SECRET_ID: "secret-id",
      VOICYCLAW_TENCENT_SECRET_KEY: "secret-key",
      VOICYCLAW_TENCENT_TTS_VOICE_TYPE: "502001",
      VOICYCLAW_TENCENT_TTS_SAMPLE_RATE: "16000",
      VOICYCLAW_TENCENT_TTS_SPEED: "1.1",
      VOICYCLAW_TENCENT_TTS_VOLUME: "4",
      VOICYCLAW_TENCENT_TTS_ENABLE_SUBTITLE: "true",
    })

    expect(options).toMatchObject({
      appId: "app-id",
      secretId: "secret-id",
      secretKey: "secret-key",
      voiceType: "502001",
      sampleRate: 16_000,
      speed: 1.1,
      volume: 4,
      enableSubtitle: true,
    })
  })

  it("lets Tencent bidirectional config inherit base YAML credentials and override runtime fields", () => {
    const options = resolveTencentCloudStreamingTTSOptions({
      VOICYCLAW_PROVIDER_CONFIG: writeProviderConfigFile([
        "TencentCloudTTS:",
        "  app_id: 1234567890",
        "  secret_id: yaml-secret-id",
        "  secret_key: yaml-secret-key",
        "  voice_type: 502001",
        "  sample_rate: 16000",
        "",
        "TencentCloudStreamingTTS:",
        "  voice_type: 502003",
        "  sample_rate: 24000",
        "  speed: 1.2",
        "  volume: 5",
        "  enable_subtitle: true",
      ]),
      VOICYCLAW_TENCENT_STREAMING_TTS_VOLUME: "3",
    })

    expect(options).toMatchObject({
      appId: "1234567890",
      secretId: "yaml-secret-id",
      secretKey: "yaml-secret-key",
      voiceType: "502003",
      sampleRate: 24_000,
      speed: 1.2,
      volume: 3,
      enableSubtitle: true,
    })
  })

  it("selects Tencent unary TTS at runtime", () => {
    const runtime = createRuntimeTTSProvider(
      {
        conversationBackend: "local-bot",
        asrMode: "client",
        asrProvider: "browser",
        ttsMode: "server",
        ttsProvider: "tencent-tts",
        language: "en-US",
      },
      {
        VOICYCLAW_TENCENT_APP_ID: "app-id",
        VOICYCLAW_TENCENT_SECRET_ID: "secret-id",
        VOICYCLAW_TENCENT_SECRET_KEY: "secret-key",
      },
    )

    expect(runtime.providerId).toBe("tencent-tts")
    expect(runtime.sampleRate).toBe(16_000)
  })

  it("selects Tencent bidirectional TTS at runtime", () => {
    const runtime = createRuntimeTTSProvider(
      {
        conversationBackend: "local-bot",
        asrMode: "client",
        asrProvider: "browser",
        ttsMode: "server",
        ttsProvider: "tencent-streaming-tts",
        language: "en-US",
      },
      {
        VOICYCLAW_TENCENT_APP_ID: "app-id",
        VOICYCLAW_TENCENT_SECRET_ID: "secret-id",
        VOICYCLAW_TENCENT_SECRET_KEY: "secret-key",
        VOICYCLAW_TENCENT_STREAMING_TTS_SAMPLE_RATE: "24000",
      },
    )

    expect(runtime.providerId).toBe("tencent-streaming-tts")
    expect(runtime.sampleRate).toBe(24_000)
  })
})

describe("TencentCloudTTSProvider", () => {
  it("opens the signed Tencent unary websocket and yields streamed PCM frames", async () => {
    const firstAudio = Buffer.from([1, 2, 3, 4])
    const secondAudio = Buffer.from([5, 6, 7, 8])
    let openedUrl = ""
    let socket: MockTencentUnarySocket | undefined
    const provider = new TencentCloudTTSProvider({
      appId: "app-id",
      secretId: "secret-id",
      secretKey: "secret-key",
      voiceType: "502001",
      sampleRate: 16_000,
      createSocket: (url) => {
        openedUrl = url
        socket = new MockTencentUnarySocket([
          {
            data: JSON.stringify({
              code: 0,
              message: "synthesis started",
            }),
            isBinary: false,
          },
          {
            data: firstAudio,
            isBinary: true,
          },
          {
            data: secondAudio,
            isBinary: true,
          },
          {
            data: JSON.stringify({
              code: 0,
              final: 1,
            }),
            isBinary: false,
          },
        ])
        return socket
      },
    })

    const audio = await collect(
      provider.synthesize(textChunks(["Hello", " Tencent"]), {
        sampleRate: 16_000,
      }),
    )

    expect(audio.map((chunk) => chunk.toString("hex"))).toEqual([
      "01020304",
      "05060708",
    ])
    expect(socket?.sentMessages).toEqual([])

    const url = new URL(openedUrl)
    expect(url.pathname).toBe("/stream_ws")
    expect(url.searchParams.get("Action")).toBe("TextToStreamAudioWS")
    expect(url.searchParams.get("Text")).toBe("Hello Tencent")
    expect(url.searchParams.get("VoiceType")).toBe("502001")
    expect(url.searchParams.get("Codec")).toBe("pcm")
    expect(url.searchParams.get("Signature")).toBeTruthy()
  })
})

describe("TencentCloudStreamingTTSProvider", () => {
  it("streams text bidirectionally and can yield audio before later text arrives", async () => {
    const firstAudio = Buffer.from([9, 10, 11, 12])
    const secondAudio = Buffer.from([13, 14, 15, 16])
    let openedUrl = ""
    let socket: MockTencentStreamingSocket | undefined
    const provider = new TencentCloudStreamingTTSProvider({
      appId: "app-id",
      secretId: "secret-id",
      secretKey: "secret-key",
      voiceType: "502001",
      sampleRate: 24_000,
      createSocket: (url) => {
        openedUrl = url
        socket = new MockTencentStreamingSocket({
          onSynthesis(data) {
            if (data === "Hello") {
              return [firstAudio]
            }

            if (data === " world") {
              return [secondAudio]
            }

            return []
          },
        })
        return socket
      },
    })
    let releaseSecondChunk: (() => void) | undefined
    const secondChunkGate = new Promise<void>((resolve) => {
      releaseSecondChunk = resolve
    })
    const synthesis = provider.synthesize(
      (async function* () {
        yield "Hello"
        await secondChunkGate
        yield " world"
      })(),
      {
        sampleRate: 24_000,
      },
    )

    const firstChunk = await synthesis.next()

    expect(firstChunk.done).toBe(false)
    expect(firstChunk.value?.toString("hex")).toBe("090a0b0c")
    expect(socket?.sentMessages).toHaveLength(1)
    expect(JSON.parse(socket?.sentMessages[0] ?? "{}")).toMatchObject({
      action: "ACTION_SYNTHESIS",
      data: "Hello",
    })

    releaseSecondChunk?.()

    const remaining: Buffer[] = []
    for await (const chunk of synthesis) {
      remaining.push(chunk)
    }

    expect(remaining.map((chunk) => chunk.toString("hex"))).toEqual([
      "0d0e0f10",
    ])
    expect(
      socket?.sentMessages.map((message) => JSON.parse(message).action),
    ).toEqual(["ACTION_SYNTHESIS", "ACTION_SYNTHESIS", "ACTION_COMPLETE"])
    expect(
      socket?.sentMessages.map((message) => JSON.parse(message).data),
    ).toEqual(["Hello", " world", undefined])

    const url = new URL(openedUrl)
    expect(url.pathname).toBe("/stream_wsv2")
    expect(url.searchParams.get("Action")).toBe("TextToStreamAudioWSv2")
    expect(url.searchParams.get("Text")).toBeNull()
    expect(url.searchParams.get("VoiceType")).toBe("502001")
    expect(url.searchParams.get("SampleRate")).toBe("24000")
    expect(url.searchParams.get("Signature")).toBeTruthy()
  })
})

type MockTencentFrame = {
  data: string | Buffer
  isBinary: boolean
}

class MockTencentUnarySocket
  extends EventEmitter
  implements TencentCloudSocket
{
  readonly readyState = 1
  readonly sentMessages: string[] = []

  constructor(private readonly frames: MockTencentFrame[]) {
    super()
    queueMicrotask(() => {
      this.emit("open")

      for (const frame of this.frames) {
        queueMicrotask(() => {
          this.emit("message", frame.data, frame.isBinary)
        })
      }
    })
  }

  send(data: string, callback?: (error?: Error) => void): void {
    this.sentMessages.push(data)
    queueMicrotask(() => callback?.())
  }

  close(): void {
    this.emit("close")
  }
}

class MockTencentStreamingSocket
  extends EventEmitter
  implements TencentCloudSocket
{
  readonly readyState = 1
  readonly sentMessages: string[] = []

  constructor(
    private readonly plan: {
      onSynthesis: (data: string) => Buffer[]
    },
  ) {
    super()
    queueMicrotask(() => {
      this.emit("open")
      this.emit(
        "message",
        JSON.stringify({
          code: 0,
          ready: 1,
        }),
        false,
      )
    })
  }

  send(data: string, callback?: (error?: Error) => void): void {
    this.sentMessages.push(data)
    const payload = JSON.parse(data) as {
      action?: string
      data?: string
    }

    queueMicrotask(() => {
      if (payload.action === "ACTION_SYNTHESIS" && payload.data) {
        for (const audioChunk of this.plan.onSynthesis(payload.data)) {
          this.emit("message", audioChunk, true)
        }
      }

      if (payload.action === "ACTION_COMPLETE") {
        this.emit(
          "message",
          JSON.stringify({
            code: 0,
            final: 1,
          }),
          false,
        )
      }

      callback?.()
    })
  }

  close(): void {
    this.emit("close")
  }
}

async function collect<T>(source: AsyncIterable<T>) {
  const values: T[] = []

  for await (const value of source) {
    values.push(value)
  }

  return values
}

async function* textChunks(chunks: string[]) {
  for (const chunk of chunks) {
    yield chunk
  }
}

function writeProviderConfigFile(lines: string[]) {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "voicyclaw-tencent-"))
  const filePath = path.join(cwd, "providers.local.yaml")
  writeFileSync(filePath, lines.join("\n"))
  return filePath
}
