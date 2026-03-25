import { Buffer } from "node:buffer"
import { createHmac } from "node:crypto"

import WebSocket from "ws"

import type { AudioChunk, TTSConfig } from "../types"

export const DEFAULT_TENCENT_SAMPLE_RATE = 16_000
export const DEFAULT_TENCENT_TTS_ENDPOINT =
  "wss://tts.cloud.tencent.com/stream_ws"
export const DEFAULT_TENCENT_STREAMING_TTS_ENDPOINT =
  "wss://tts.cloud.tencent.com/stream_wsv2"
export const TENCENT_FAST_VOICE_TYPE = "200000000"

type QueueWaiter<T> = {
  resolve: (value: IteratorResult<T>) => void
  reject: (error: Error) => void
}

type TencentCloudControlMessage = {
  code?: number
  message?: string
  final?: number
  ready?: number
  heartbeat?: number
}

export interface TencentCloudBaseSynthesisOptions {
  appId: string
  secretId: string
  secretKey: string
  endpoint?: string
  voiceType?: string
  fastVoiceType?: string
  sampleRate?: number
  codec?: string
  speed?: number
  volume?: number
  enableSubtitle?: boolean
  createSocket?: TencentCloudSocketFactory
}

export interface TencentCloudRuntimeConfig {
  appId: string
  secretId: string
  secretKey: string
  endpoint?: string
  voiceType?: string
  fastVoiceType?: string
  sampleRate: number
  codec: "pcm"
  speed?: number
  volume?: number
  enableSubtitle?: boolean
}

export interface TencentCloudSocket {
  readyState: number
  send: (data: string, callback?: (error?: Error) => void) => void
  close: (code?: number, data?: string | Buffer) => void
  on: (event: string, listener: (...args: any[]) => void) => TencentCloudSocket
  once: (
    event: string,
    listener: (...args: any[]) => void,
  ) => TencentCloudSocket
  off: (event: string, listener: (...args: any[]) => void) => TencentCloudSocket
}

export type TencentCloudSocketFactory = (url: string) => TencentCloudSocket

export function resolveTencentRuntimeConfig(
  options: TencentCloudBaseSynthesisOptions,
  config?: TTSConfig,
): TencentCloudRuntimeConfig {
  const sampleRate = normalizeTencentSampleRate(
    config?.sampleRate ?? options.sampleRate ?? DEFAULT_TENCENT_SAMPLE_RATE,
  )
  const voiceType =
    config?.voice?.trim() ||
    options.voiceType?.trim() ||
    (options.fastVoiceType?.trim() ? TENCENT_FAST_VOICE_TYPE : undefined)

  return {
    appId: options.appId.trim(),
    secretId: options.secretId.trim(),
    secretKey: options.secretKey,
    endpoint: options.endpoint?.trim(),
    voiceType,
    fastVoiceType: options.fastVoiceType?.trim(),
    sampleRate,
    codec: normalizeTencentCodec(options.codec),
    speed:
      typeof options.speed === "number" && Number.isFinite(options.speed)
        ? options.speed
        : undefined,
    volume:
      typeof options.volume === "number" && Number.isFinite(options.volume)
        ? options.volume
        : undefined,
    enableSubtitle: options.enableSubtitle === true,
  }
}

export function normalizeTencentSampleRate(sampleRate: number) {
  return Number.isFinite(sampleRate) && sampleRate > 0
    ? Math.trunc(sampleRate)
    : DEFAULT_TENCENT_SAMPLE_RATE
}

export function validateTencentUnarySampleRate(sampleRate: number) {
  if (sampleRate !== 8_000 && sampleRate !== 16_000) {
    throw new Error(
      `Tencent Cloud TTS unary streaming only supports sample rates 8000 or 16000. Received ${sampleRate}.`,
    )
  }

  return sampleRate
}

export function validateTencentBidirectionalSampleRate(sampleRate: number) {
  if (sampleRate !== 8_000 && sampleRate !== 16_000 && sampleRate !== 24_000) {
    throw new Error(
      `Tencent Cloud TTS bidirectional streaming only supports sample rates 8000, 16000, or 24000. Received ${sampleRate}.`,
    )
  }

  return sampleRate
}

export function buildTencentSignedUrl(
  endpoint: string,
  params: Record<string, string | number | boolean | undefined>,
  secretKey: string,
) {
  const url = new URL(endpoint)
  const pathname = url.pathname || "/"
  const canonicalEntries = Object.entries(params)
    .filter(
      (entry): entry is [string, string | number | boolean] =>
        entry[1] !== undefined && entry[1] !== "",
    )
    .map(([key, value]) => [key, stringifyTencentQueryValue(value)] as const)
    .sort(([left], [right]) => left.localeCompare(right))
  const canonicalQuery = canonicalEntries
    .map(([key, value]) => `${key}=${value}`)
    .join("&")
  const signature = createHmac("sha1", secretKey)
    .update(`GET${url.host}${pathname}?${canonicalQuery}`, "utf8")
    .digest("base64")
  const finalEntries = [...canonicalEntries, ["Signature", signature] as const]
  const encodedQuery = finalEntries
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&")

  return `${url.protocol}//${url.host}${pathname}?${encodedQuery}`
}

export function createTencentSocket(
  url: string,
  createSocket?: TencentCloudSocketFactory,
) {
  return createSocket
    ? createSocket(url)
    : (new WebSocket(url, {
        perMessageDeflate: false,
      }) as TencentCloudSocket)
}

export async function waitForTencentSocketOpen(socket: TencentCloudSocket) {
  if (socket.readyState === 1) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const handleOpen = () => {
      cleanup()
      resolve()
    }
    const handleError = (error: unknown) => {
      cleanup()
      reject(normalizeError(error))
    }
    const cleanup = () => {
      socket.off("open", handleOpen)
      socket.off("error", handleError)
    }

    socket.once("open", handleOpen)
    socket.once("error", handleError)
  })
}

export function createTencentSocketSession(
  socket: TencentCloudSocket,
  options?: {
    expectReady?: boolean
  },
) {
  const queue = new AsyncChunkQueue<AudioChunk>()
  let completed = false
  let readyResolved = !options?.expectReady
  let resolveReady = () => {}
  let rejectReady = (_error: Error) => {}
  const ready = readyResolved
    ? Promise.resolve()
    : new Promise<void>((resolve, reject) => {
        resolveReady = () => {
          readyResolved = true
          resolve()
        }
        rejectReady = reject
      })
  let resolveCompletion = () => {}
  let rejectCompletion = (_error: Error) => {}
  const completion = new Promise<void>((resolve, reject) => {
    resolveCompletion = resolve
    rejectCompletion = reject
  })

  const finish = () => {
    if (completed) {
      return
    }

    completed = true
    resolveReady()
    queue.close()
    resolveCompletion()
  }

  const fail = (error: Error) => {
    if (completed) {
      return
    }

    completed = true
    queue.fail(error)
    rejectReady(error)
    rejectCompletion(error)
  }

  const handleMessage = (data: unknown, isBinary = false) => {
    if (isBinary) {
      const audio = normalizeTencentBinaryFrame(data)
      if (audio.byteLength > 0) {
        queue.push(audio)
      }
      return
    }

    let payload: TencentCloudControlMessage

    try {
      payload = JSON.parse(normalizeTencentTextFrame(data))
    } catch (error) {
      fail(
        new Error(
          `Tencent Cloud TTS returned an invalid control frame: ${normalizeError(error).message}`,
        ),
      )
      return
    }

    if (typeof payload.code === "number" && payload.code !== 0) {
      fail(
        new Error(
          `Tencent Cloud TTS request failed: ${payload.message || `code ${payload.code}`}`,
        ),
      )
      return
    }

    if (payload.ready === 1) {
      resolveReady()
      return
    }

    if (payload.final === 1) {
      finish()
    }
  }

  const handleError = (error: unknown) => {
    fail(
      new Error(
        `Tencent Cloud TTS websocket error: ${normalizeError(error).message}`,
      ),
    )
  }

  const handleClose = () => {
    if (!completed) {
      fail(
        new Error(
          "Tencent Cloud TTS connection closed before the final response arrived.",
        ),
      )
    }
  }

  socket.on("message", handleMessage)
  socket.on("error", handleError)
  socket.on("close", handleClose)

  return {
    audio: queue,
    ready,
    completion,
    dispose() {
      socket.off("message", handleMessage)
      socket.off("error", handleError)
      socket.off("close", handleClose)
    },
  }
}

export async function sendTencentJsonMessage(
  socket: TencentCloudSocket,
  payload: Record<string, unknown>,
) {
  await new Promise<void>((resolve, reject) => {
    socket.send(JSON.stringify(payload), (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

export function createTencentSessionQuery(
  action: "TextToStreamAudioWS" | "TextToStreamAudioWSv2",
  runtime: TencentCloudRuntimeConfig,
  sessionId: string,
) {
  const timestamp = Math.floor(Date.now() / 1000)

  return {
    Action: action,
    AppId: runtime.appId,
    SecretId: runtime.secretId,
    Timestamp: timestamp,
    Expired: timestamp + 86_400,
    SessionId: sessionId,
    VoiceType: runtime.voiceType,
    FastVoiceType: runtime.fastVoiceType,
    Codec: runtime.codec,
    SampleRate: runtime.sampleRate,
    Speed: runtime.speed,
    Volume: runtime.volume,
    EnableSubtitle: runtime.enableSubtitle,
  }
}

function normalizeTencentCodec(codec: string | undefined): "pcm" {
  const normalized = codec?.trim().toLowerCase() || "pcm"

  if (normalized !== "pcm") {
    throw new Error(
      `Tencent Cloud TTS currently only supports pcm output in VoicyClaw. Received ${normalized}.`,
    )
  }

  return "pcm"
}

function stringifyTencentQueryValue(value: string | number | boolean) {
  if (typeof value === "boolean") {
    return value ? "True" : "False"
  }

  return String(value)
}

function normalizeTencentBinaryFrame(data: unknown) {
  if (Buffer.isBuffer(data)) {
    return data
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data)
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  }

  return Buffer.alloc(0)
}

function normalizeTencentTextFrame(data: unknown) {
  if (typeof data === "string") {
    return data
  }

  return normalizeTencentBinaryFrame(data).toString("utf8")
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
}

class AsyncChunkQueue<T> implements AsyncIterable<T> {
  private readonly items: T[] = []
  private readonly waiters: QueueWaiter<T>[] = []
  private error: Error | null = null
  private closed = false

  push(item: T) {
    if (this.closed || this.error) {
      return
    }

    const waiter = this.waiters.shift()
    if (waiter) {
      waiter.resolve({
        done: false,
        value: item,
      })
      return
    }

    this.items.push(item)
  }

  close() {
    if (this.closed || this.error) {
      return
    }

    this.closed = true
    while (this.waiters.length > 0) {
      this.waiters.shift()?.resolve({
        done: true,
        value: undefined,
      })
    }
  }

  fail(error: Error) {
    if (this.error || this.closed) {
      return
    }

    this.error = error
    while (this.waiters.length > 0) {
      this.waiters.shift()?.reject(error)
    }
  }

  async *drain() {
    while (true) {
      const next = await this.next()
      if (next.done) {
        return
      }

      yield next.value
    }
  }

  async next(): Promise<IteratorResult<T>> {
    if (this.items.length > 0) {
      return {
        done: false,
        value: this.items.shift() as T,
      }
    }

    if (this.error) {
      throw this.error
    }

    if (this.closed) {
      return {
        done: true,
        value: undefined,
      }
    }

    return await new Promise<IteratorResult<T>>((resolve, reject) => {
      this.waiters.push({
        resolve,
        reject,
      })
    })
  }

  [Symbol.asyncIterator]() {
    return this.drain()
  }
}
