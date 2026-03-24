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
  model?: string
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
    const iterator = text[Symbol.asyncIterator]()
    const firstChunk = await readNextNonEmptyChunk(iterator)

    if (!firstChunk) {
      return
    }

    const client = await this.connect(voiceType)
    const sessionId = randomUUID()
    const requestTemplate = createRequestTemplate(
      voiceType,
      sampleRate,
      this.options.model,
    )
    const audioQueue = new AsyncChunkQueue<AudioChunk>()
    let writePromise: Promise<void> | null = null
    let receivePromise: Promise<void> | null = null

    try {
      await this.startSession(client, sessionId, requestTemplate)

      receivePromise = this.receiveSessionAudio(client, sessionId, audioQueue)
      writePromise = this.writeSessionText(
        client,
        iterator,
        firstChunk,
        sessionId,
        requestTemplate,
      )

      for await (const audioChunk of audioQueue) {
        yield audioChunk
      }

      await writePromise
      await receivePromise
    } finally {
      await settlePromise(writePromise)
      await settlePromise(receivePromise)
      await this.finishConnection(client).catch(() => undefined)
      client.socket.close()
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

  private async startSession(
    client: ConnectedClient,
    sessionId: string,
    requestTemplate: ReturnType<typeof createRequestTemplate>,
  ) {
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
  }

  private async writeSessionText(
    client: ConnectedClient,
    text: AsyncIterator<string>,
    firstChunk: string,
    sessionId: string,
    requestTemplate: ReturnType<typeof createRequestTemplate>,
  ) {
    try {
      await this.sendTaskRequest(client, sessionId, requestTemplate, firstChunk)

      for await (const chunk of iterateNonEmptyChunks(text)) {
        await this.sendTaskRequest(client, sessionId, requestTemplate, chunk)
      }
    } finally {
      await client.channel.sendEvent(
        VolcengineEventType.FinishSession,
        encodeJson({}),
        sessionId,
      )
    }
  }

  private async sendTaskRequest(
    client: ConnectedClient,
    sessionId: string,
    requestTemplate: ReturnType<typeof createRequestTemplate>,
    chunk: string,
  ) {
    await client.channel.sendEvent(
      VolcengineEventType.TaskRequest,
      encodeJson({
        ...requestTemplate,
        event: VolcengineEventType.TaskRequest,
        req_params: {
          ...requestTemplate.req_params,
          text: chunk,
        },
      }),
      sessionId,
    )
  }

  private async receiveSessionAudio(
    client: ConnectedClient,
    sessionId: string,
    audioQueue: AsyncChunkQueue<AudioChunk>,
  ) {
    try {
      while (true) {
        const message = await client.channel.receive()
        throwIfVolcengineError(message)

        if (message.type === VolcengineMessageType.AudioOnlyServer) {
          if (message.payload.byteLength > 0) {
            audioQueue.push(Buffer.from(message.payload))
          }
          continue
        }

        if (
          message.type === VolcengineMessageType.FullServerResponse &&
          message.event === VolcengineEventType.SessionFinished &&
          message.sessionId === sessionId
        ) {
          audioQueue.close()
          return
        }
      }
    } catch (error) {
      audioQueue.error(normalizeError(error))
      throw error
    }
  }

  private async finishConnection(client: ConnectedClient) {
    await client.channel.sendEvent(
      VolcengineEventType.FinishConnection,
      encodeJson({}),
    )
    await client.channel.waitFor(
      VolcengineMessageType.FullServerResponse,
      VolcengineEventType.ConnectionFinished,
    )
  }
}

function createRequestTemplate(
  voiceType: string,
  sampleRate: number,
  model: string | undefined,
) {
  const normalizedModel = normalizeModel(model)

  return {
    user: {
      uid: randomUUID(),
    },
    req_params: {
      ...(normalizedModel
        ? {
            model: normalizedModel,
          }
        : {}),
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
}

function normalizeModel(model: string | undefined) {
  const normalized = model?.trim()
  return normalized || undefined
}

function voiceToResourceId(voiceType: string) {
  return voiceType.startsWith("S_") ? MEGATTS_RESOURCE_ID : DEFAULT_RESOURCE_ID
}

function encodeJson(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value))
}

async function readNextNonEmptyChunk(iterator: AsyncIterator<string>) {
  while (true) {
    const { done, value } = await iterator.next()
    if (done) {
      return null
    }

    if (value.trim()) {
      return value
    }
  }
}

async function* iterateNonEmptyChunks(iterator: AsyncIterator<string>) {
  while (true) {
    const { done, value } = await iterator.next()
    if (done) {
      return
    }

    if (!value.trim()) {
      continue
    }

    yield value
  }
}

class AsyncChunkQueue<T> implements AsyncIterableIterator<T> {
  private readonly values: T[] = []
  private readonly waiters: Array<{
    resolve: (result: IteratorResult<T>) => void
    reject: (error: Error) => void
  }> = []
  private ended = false
  private failure: Error | null = null

  push(value: T) {
    if (this.ended || this.failure) {
      return
    }

    const waiter = this.waiters.shift()
    if (waiter) {
      waiter.resolve({
        value,
        done: false,
      })
      return
    }

    this.values.push(value)
  }

  close() {
    if (this.ended) {
      return
    }

    this.ended = true

    while (this.waiters.length > 0) {
      this.waiters.shift()?.resolve({
        value: undefined as T,
        done: true,
      })
    }
  }

  error(error: Error) {
    if (this.failure || this.ended) {
      return
    }

    this.failure = error

    while (this.waiters.length > 0) {
      this.waiters.shift()?.reject(error)
    }
  }

  async next(): Promise<IteratorResult<T>> {
    if (this.values.length > 0) {
      return {
        value: this.values.shift() as T,
        done: false,
      }
    }

    if (this.failure) {
      throw this.failure
    }

    if (this.ended) {
      return {
        value: undefined as T,
        done: true,
      }
    }

    return new Promise<IteratorResult<T>>((resolve, reject) => {
      this.waiters.push({
        resolve,
        reject,
      })
    })
  }

  [Symbol.asyncIterator]() {
    return this
  }
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
}

async function settlePromise(promise: Promise<unknown> | null) {
  if (!promise) {
    return
  }

  try {
    await promise
  } catch {
    // The async queue already surfaced the original failure path.
  }
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
