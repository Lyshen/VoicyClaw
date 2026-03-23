import { Buffer } from "node:buffer"
import { randomUUID } from "node:crypto"

import WebSocket from "ws"

import type { TTSAdapter } from "../interface"
import type { AudioChunk, TTSConfig } from "../types"
import {
  throwIfVolcengineError,
  VolcengineEventType,
  VolcengineMessageChannel,
  VolcengineMessageType,
  type VolcengineSocket,
} from "./volcengine/protocol"

const DEFAULT_ENDPOINT = "wss://openspeech.bytedance.com/api/v3/tts/bidirection"
const DEFAULT_SAMPLE_RATE = 16_000
const DEFAULT_RESOURCE_ID = "volc.service_type.10029"
const MEGATTS_RESOURCE_ID = "volc.megatts.default"

type VolcengineSocketInit = {
  headers: Record<string, string>
  skipUTF8Validation: boolean
}

type ConnectedClient = {
  socket: VolcengineSocket
  channel: VolcengineMessageChannel
}

export interface VolcengineTTSProviderOptions {
  appId: string
  accessToken: string
  voiceType: string
  endpoint?: string
  resourceId?: string
  sampleRate?: number
  createSocket?: (url: string, init: VolcengineSocketInit) => VolcengineSocket
}

export class VolcengineTTSProvider implements TTSAdapter {
  readonly name = "volcengine-tts"

  constructor(private readonly options: VolcengineTTSProviderOptions) {}

  async *synthesize(
    text: AsyncIterable<string>,
    config?: TTSConfig,
  ): AsyncGenerator<AudioChunk> {
    const sampleRate =
      config?.sampleRate ?? this.options.sampleRate ?? DEFAULT_SAMPLE_RATE
    const voiceType = config?.voice?.trim() || this.options.voiceType.trim()
    let client: ConnectedClient | null = null

    try {
      for await (const chunk of text) {
        const cleaned = chunk.trim()

        if (!cleaned) {
          continue
        }

        if (!client) {
          client = await this.connect(voiceType)
        }

        yield* this.synthesizeChunk(client, cleaned, voiceType, sampleRate)
      }

      if (!client) {
        return
      }

      await client.channel.sendEvent(
        VolcengineEventType.FinishConnection,
        encodeJson({}),
      )
      await client.channel.waitFor(
        VolcengineMessageType.FullServerResponse,
        VolcengineEventType.ConnectionFinished,
      )
    } finally {
      client?.socket.close()
    }
  }

  private async connect(voiceType: string): Promise<ConnectedClient> {
    const socket = await this.openSocket(voiceType)
    const channel = new VolcengineMessageChannel(socket)

    await channel.sendEvent(VolcengineEventType.StartConnection, encodeJson({}))
    await channel.waitFor(
      VolcengineMessageType.FullServerResponse,
      VolcengineEventType.ConnectionStarted,
    )

    return {
      socket,
      channel,
    }
  }

  private async openSocket(voiceType: string): Promise<VolcengineSocket> {
    const endpoint = this.options.endpoint?.trim() || DEFAULT_ENDPOINT
    const resourceId =
      this.options.resourceId?.trim() || voiceToResourceId(voiceType)
    const init: VolcengineSocketInit = {
      headers: {
        "X-Api-App-Key": this.options.appId,
        "X-Api-Access-Key": this.options.accessToken,
        "X-Api-Resource-Id": resourceId,
        "X-Api-Connect-Id": randomUUID(),
      },
      skipUTF8Validation: true,
    }
    const socket = this.options.createSocket
      ? this.options.createSocket(endpoint, init)
      : (new WebSocket(endpoint, init) as VolcengineSocket)

    await waitForSocketOpen(socket)
    return socket
  }

  private async *synthesizeChunk(
    client: ConnectedClient,
    chunk: string,
    voiceType: string,
    sampleRate: number,
  ): AsyncGenerator<AudioChunk> {
    const sessionId = randomUUID()
    const requestTemplate = {
      user: {
        uid: randomUUID(),
      },
      req_params: {
        speaker: voiceType,
        audio_params: {
          format: "pcm",
          sample_rate: sampleRate,
          enable_timestamp: true,
        },
        additions: JSON.stringify({
          disable_markdown_filter: false,
        }),
      },
    }

    await client.channel.sendEvent(
      VolcengineEventType.StartSession,
      encodeJson({
        ...requestTemplate,
        event: VolcengineEventType.StartSession,
      }),
      sessionId,
    )
    await client.channel.waitFor(
      VolcengineMessageType.FullServerResponse,
      VolcengineEventType.SessionStarted,
    )

    for (const character of chunk) {
      await client.channel.sendEvent(
        VolcengineEventType.TaskRequest,
        encodeJson({
          ...requestTemplate,
          event: VolcengineEventType.TaskRequest,
          req_params: {
            ...requestTemplate.req_params,
            text: character,
          },
        }),
        sessionId,
      )
    }

    await client.channel.sendEvent(
      VolcengineEventType.FinishSession,
      encodeJson({}),
      sessionId,
    )

    while (true) {
      const message = await client.channel.receive()
      throwIfVolcengineError(message)

      if (message.type === VolcengineMessageType.AudioOnlyServer) {
        if (message.payload.byteLength > 0) {
          yield Buffer.from(message.payload)
        }
        continue
      }

      if (
        message.type === VolcengineMessageType.FullServerResponse &&
        message.event === VolcengineEventType.SessionFinished
      ) {
        return
      }
    }
  }
}

function voiceToResourceId(voiceType: string) {
  return voiceType.startsWith("S_") ? MEGATTS_RESOURCE_ID : DEFAULT_RESOURCE_ID
}

function encodeJson(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value))
}

async function waitForSocketOpen(socket: VolcengineSocket) {
  await new Promise<void>((resolve, reject) => {
    const handleError = (error: Error) => {
      reject(error)
    }

    const maybeResolveImmediately =
      "readyState" in socket && Number(socket.readyState) === WebSocket.OPEN

    if (maybeResolveImmediately) {
      resolve()
      return
    }

    socket.once("open", () => {
      socket.removeListener("error", handleError)
      resolve()
    })
    socket.once("error", handleError)
  })
}
