import { EventEmitter } from "node:events"
import { mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  createRuntimeTTSProvider,
  resolveVolcengineTTSOptions,
} from "../apps/server/src/tts-provider"
import { VolcengineTTSProvider } from "../packages/tts/src/providers/volcengine"
import {
  createVolcengineMessage,
  marshalVolcengineMessage,
  unmarshalVolcengineMessage,
  VolcengineEventType,
  VolcengineMessageType,
  type VolcengineSocket,
} from "../packages/tts/src/providers/volcengine/protocol"

describe("Volcengine TTS runtime wiring", () => {
  it("selects the demo provider by default", () => {
    const runtime = createRuntimeTTSProvider({
      conversationBackend: "local-bot",
      asrMode: "client",
      asrProvider: "browser",
      ttsMode: "server",
      ttsProvider: "demo",
      language: "en-US",
    })

    expect(runtime.providerId).toBe("demo")
    expect(runtime.sampleRate).toBe(16_000)
  })

  it("requires Volcengine env vars when the provider is selected", () => {
    expect(() =>
      resolveVolcengineTTSOptions({
        VOICYCLAW_CONFIG: "/tmp/voicyclaw-missing-voicyclaw-config.yaml",
      }),
    ).toThrow(
      /VOICYCLAW_VOLCENGINE_APP_ID, VOICYCLAW_VOLCENGINE_ACCESS_TOKEN, VOICYCLAW_VOLCENGINE_TTS_VOICE_TYPE/,
    )
  })

  it("maps Volcengine env vars into provider config", () => {
    const options = resolveVolcengineTTSOptions({
      VOICYCLAW_VOLCENGINE_APP_ID: "app-id",
      VOICYCLAW_VOLCENGINE_ACCESS_TOKEN: "token",
      VOICYCLAW_VOLCENGINE_TTS_VOICE_TYPE: "zh_female_example",
      VOICYCLAW_VOLCENGINE_TTS_SAMPLE_RATE: "24000",
    })

    expect(options).toMatchObject({
      appId: "app-id",
      accessToken: "token",
      voiceType: "zh_female_example",
      sampleRate: 24_000,
    })
  })

  it("prefers env vars over YAML config values", () => {
    const cwd = mkdtempSync(path.join(os.tmpdir(), "voicyclaw-volcengine-"))
    const filePath = path.join(cwd, "voicyclaw.local.yaml")
    writeFileSync(
      filePath,
      [
        "DoubaoStreamTTS:",
        "  type: doubao_stream",
        "  ws_url: wss://example.com/yaml",
        "  appid: yaml-app-id",
        "  access_token: yaml-token",
        "  model: seed-tts-2.0-standard",
        "  resource_id: yaml-resource",
        "  speaker: yaml-speaker",
        "  sample_rate: 16000",
      ].join("\n"),
    )

    const options = resolveVolcengineTTSOptions({
      VOICYCLAW_CONFIG: filePath,
      VOICYCLAW_VOLCENGINE_APP_ID: "env-app-id",
      VOICYCLAW_VOLCENGINE_ACCESS_TOKEN: "env-token",
      VOICYCLAW_VOLCENGINE_TTS_VOICE_TYPE: "env-speaker",
      VOICYCLAW_VOLCENGINE_TTS_MODEL: "seed-tts-2.0-expressive",
      VOICYCLAW_VOLCENGINE_TTS_ENDPOINT: "wss://example.com/env",
      VOICYCLAW_VOLCENGINE_TTS_RESOURCE_ID: "env-resource",
      VOICYCLAW_VOLCENGINE_TTS_SAMPLE_RATE: "24000",
    })

    expect(options).toMatchObject({
      appId: "env-app-id",
      accessToken: "env-token",
      voiceType: "env-speaker",
      model: "seed-tts-2.0-expressive",
      endpoint: "wss://example.com/env",
      resourceId: "env-resource",
      sampleRate: 24_000,
    })
  })
})

describe("VolcengineTTSProvider", () => {
  it("keeps a single session open while streaming text and audio", async () => {
    const socket = new MockVolcengineSocket([
      {
        taskResponses: [
          [Buffer.from([1, 2, 3, 4]), Buffer.from([5, 6, 7, 8])],
          [Buffer.from([9, 10, 11, 12])],
        ],
      },
    ])
    const provider = new VolcengineTTSProvider({
      appId: "app-id",
      accessToken: "token",
      voiceType: "zh_female_example",
      createSocket: () => socket,
    })

    const audio = await collect(
      provider.synthesize(textChunks(["你好", "", "世界"]), {
        sampleRate: 16_000,
      }),
    )

    expect(audio.map((chunk) => chunk.toString("hex"))).toEqual([
      "01020304",
      "05060708",
      "090a0b0c",
    ])

    const sessionIds = socket.sentMessages
      .filter((message) => message.event === VolcengineEventType.StartSession)
      .map((message) => message.sessionId)
    expect(sessionIds).toHaveLength(1)

    const taskPayloads = socket.sentMessages
      .filter((message) => message.event === VolcengineEventType.TaskRequest)
      .map((message) => decodePayload(message.payload).req_params.text)

    expect(taskPayloads).toEqual(["你好", "世界"])
    expect(
      decodePayload(
        socket.sentMessages.find(
          (message) => message.event === VolcengineEventType.TaskRequest,
        )?.payload as Uint8Array,
      ).req_params.model,
    ).toBeUndefined()
  })

  it("can yield audio before the final text chunk arrives", async () => {
    const socket = new MockVolcengineSocket([
      {
        taskResponses: [
          [Buffer.from([1, 2, 3, 4])],
          [Buffer.from([5, 6, 7, 8])],
        ],
      },
    ])
    const provider = new VolcengineTTSProvider({
      appId: "app-id",
      accessToken: "token",
      voiceType: "zh_female_example",
      createSocket: () => socket,
    })
    let releaseSecondChunk: (() => void) | undefined
    const secondChunkGate = new Promise<void>((resolve) => {
      releaseSecondChunk = resolve
    })
    const synthesis = provider.synthesize(
      (async function* () {
        yield "第一句。"
        await secondChunkGate
        yield "第二句。"
      })(),
      {
        sampleRate: 16_000,
      },
    )

    const firstAudio = await synthesis.next()

    expect(firstAudio.done).toBe(false)
    expect(firstAudio.value?.toString("hex")).toBe("01020304")
    expect(
      socket.sentMessages.filter(
        (message) => message.event === VolcengineEventType.FinishSession,
      ),
    ).toHaveLength(0)

    releaseSecondChunk?.()

    const remaining: Buffer[] = []
    for await (const chunk of synthesis) {
      remaining.push(chunk)
    }

    expect(remaining.map((chunk) => chunk.toString("hex"))).toEqual([
      "05060708",
    ])
  })

  it("passes the configured V3 model when present", async () => {
    const socket = new MockVolcengineSocket([
      {
        taskResponses: [[Buffer.from([1, 2, 3, 4])]],
      },
    ])
    const provider = new VolcengineTTSProvider({
      appId: "app-id",
      accessToken: "token",
      voiceType: "zh_female_example",
      model: "seed-tts-2.0-standard",
      createSocket: () => socket,
    })

    await collect(
      provider.synthesize(textChunks(["你好。"]), {
        sampleRate: 16_000,
      }),
    )

    const request = socket.sentMessages.find(
      (message) => message.event === VolcengineEventType.TaskRequest,
    )
    expect(
      decodePayload((request?.payload ?? new Uint8Array()) as Uint8Array)
        .req_params.model,
    ).toBe("seed-tts-2.0-standard")
  })
})

type MockSessionPlan = {
  taskResponses?: Uint8Array[][]
  finishResponses?: Uint8Array[]
}

class MockVolcengineSocket extends EventEmitter implements VolcengineSocket {
  readonly sentMessages = [] as ReturnType<typeof unmarshalVolcengineMessage>[]
  readonly readyState = 1
  private responseIndex = 0
  private activeTaskIndex = 0

  constructor(private readonly sessionPlans: MockSessionPlan[]) {
    super()
    queueMicrotask(() => {
      this.emit("open")
    })
  }

  send(data: Uint8Array, callback?: (error?: Error) => void): void {
    const message = unmarshalVolcengineMessage(data)
    this.sentMessages.push(message)

    queueMicrotask(() => {
      this.flushResponse(message)
      callback?.()
    })
  }

  close(): void {
    this.emit("close")
  }

  private flushResponse(
    message: ReturnType<typeof unmarshalVolcengineMessage>,
  ) {
    if (message.event === VolcengineEventType.StartConnection) {
      this.emitMessage(
        createServerResponse(VolcengineEventType.ConnectionStarted),
      )
      return
    }

    if (message.event === VolcengineEventType.StartSession) {
      this.activeTaskIndex = 0
      this.emitMessage(
        createServerResponse(
          VolcengineEventType.SessionStarted,
          message.sessionId,
        ),
      )
      return
    }

    if (message.event === VolcengineEventType.TaskRequest) {
      const plan = this.sessionPlans[this.responseIndex]
      const chunks = plan?.taskResponses?.[this.activeTaskIndex] ?? []
      this.activeTaskIndex += 1

      for (const chunk of chunks) {
        this.emitMessage(createAudioResponse(chunk))
      }
      return
    }

    if (message.event === VolcengineEventType.FinishSession) {
      const plan = this.sessionPlans[this.responseIndex]
      this.responseIndex += 1

      for (const chunk of plan?.finishResponses ?? []) {
        this.emitMessage(createAudioResponse(chunk))
      }

      this.emitMessage(
        createServerResponse(
          VolcengineEventType.SessionFinished,
          message.sessionId,
        ),
      )
      return
    }

    if (message.event === VolcengineEventType.FinishConnection) {
      this.emitMessage(
        createServerResponse(VolcengineEventType.ConnectionFinished),
      )
    }
  }

  private emitMessage(message: ReturnType<typeof createVolcengineMessage>) {
    this.emit("message", Buffer.from(marshalVolcengineMessage(message)))
  }
}

function createServerResponse(event: VolcengineEventType, sessionId?: string) {
  const message = createVolcengineMessage(
    VolcengineMessageType.FullServerResponse,
    0b100,
  )
  message.event = event
  message.sessionId = sessionId
  message.connectId = "connect-id"
  message.payload = new TextEncoder().encode("{}")
  return message
}

function createAudioResponse(payload: Uint8Array) {
  const message = createVolcengineMessage(VolcengineMessageType.AudioOnlyServer)
  message.payload = payload
  return message
}

async function collect<T>(source: AsyncIterable<T>) {
  const values: T[] = []

  for await (const item of source) {
    values.push(item)
  }

  return values
}

async function* textChunks(values: string[]) {
  for (const value of values) {
    yield value
  }
}

function decodePayload(payload: Uint8Array) {
  return JSON.parse(Buffer.from(payload).toString("utf8")) as {
    req_params: {
      text: string
      model?: string
    }
  }
}
