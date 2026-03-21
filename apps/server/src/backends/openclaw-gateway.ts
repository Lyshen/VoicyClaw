import { randomUUID } from "node:crypto"

import WebSocket from "ws"

import { AsyncIterableQueue } from "../lib/async-queue"
import type {
  ConversationBackend,
  ConversationChunk,
  ConversationSettings,
  ConversationTurnInput,
} from "./conversation-backend"

const OPENCLAW_PROTOCOL_MIN = 1
const OPENCLAW_PROTOCOL_MAX = 3
const OPENCLAW_CLIENT_ID = "gateway-client"
const OPENCLAW_CLIENT_MODE = "backend"
const OPENCLAW_ROLE = "operator"
const OPENCLAW_SCOPES = ["operator.read", "operator.write"]
const OPENCLAW_CONNECT_TIMEOUT_MS = 10_000
const OPENCLAW_TURN_TIMEOUT_MS = 60_000
const OPENCLAW_SESSION_PREFIX = "voicyclaw"

type GatewayFrame =
  | {
      type: "req"
      id: string
      method: string
      params?: unknown
    }
  | {
      type: "res"
      id: string
      ok: boolean
      payload?: unknown
      error?: {
        code?: string
        message?: string
        details?: Record<string, unknown>
      }
    }
  | {
      type: "event"
      event: string
      payload?: unknown
    }

type GatewayChatEvent = {
  runId: string
  sessionKey: string
  seq: number
  state: "delta" | "final" | "aborted" | "error"
  message?: unknown
  errorMessage?: string
  usage?: unknown
  stopReason?: string
}

type GatewayChallengeEvent = {
  nonce?: string
}

type PendingResponse = {
  resolve: (payload: unknown) => void
  reject: (error: Error) => void
}

type GatewayErrorInfo = Extract<GatewayFrame, { type: "res" }>["error"]

type OpenClawConnectStrategy = {
  kind: "shared-token"
  token: string
}

export class OpenClawGatewayConversationBackend implements ConversationBackend {
  readonly kind = "openclaw-gateway" as const
  readonly botId = "openclaw-gateway"

  constructor(private readonly settings: ConversationSettings) {}

  async *sendTurn(
    input: ConversationTurnInput,
  ): AsyncGenerator<ConversationChunk> {
    const config = resolveOpenClawGatewayConfig(this.settings)
    const sessionKey = buildOpenClawSessionKey(input.channelId)
    const gateway = new OpenClawGatewaySocket(
      config,
      resolveOpenClawConnectStrategy(config),
    )

    let runId: string | undefined
    let emittedText = false
    let streamedText = ""

    try {
      logOpenClawBridge("CONNECT_START", {
        sessionKey,
        utteranceId: input.utteranceId,
        url: config.url,
      })
      await gateway.connect()
      logOpenClawBridge("CONNECT_OK", {
        sessionKey,
        utteranceId: input.utteranceId,
      })

      const result = (await gateway.request("chat.send", {
        sessionKey,
        message: input.text,
        deliver: false,
        idempotencyKey: input.utteranceId,
      })) as Record<string, unknown> | undefined

      runId = extractRunId(result)
      logOpenClawBridge("CHAT_SEND_OK", {
        sessionKey,
        utteranceId: input.utteranceId,
        runId,
      })

      for await (const event of gateway.chatEvents()) {
        logOpenClawBridge("CHAT_EVENT_RAW", {
          sessionKey,
          utteranceId: input.utteranceId,
          runId: event.runId,
          eventSessionKey: event.sessionKey,
          state: event.state,
        })

        if (runId && event.runId !== runId) {
          continue
        }
        if (!runId && !sessionKeysMatch(sessionKey, event.sessionKey)) {
          continue
        }

        if (event.state === "error") {
          logOpenClawBridge("CHAT_EVENT_ERROR", {
            sessionKey,
            utteranceId: input.utteranceId,
            runId: event.runId,
            errorMessage: event.errorMessage,
          })
          throw new Error(
            event.errorMessage ||
              "OpenClaw returned a chat error for this turn.",
          )
        }

        if (event.state === "aborted") {
          break
        }

        const text = extractTextFromUnknown(event.message)
        const chunkText = toIncrementalText(streamedText, text)

        if (event.state === "delta") {
          if (!chunkText) {
            continue
          }

          streamedText = text
          emittedText = true
          logOpenClawBridge("CHAT_EVENT_DELTA", {
            sessionKey,
            utteranceId: input.utteranceId,
            runId: event.runId,
            text: clipOpenClawLog(chunkText),
          })

          yield {
            utteranceId: input.utteranceId,
            text: chunkText,
            isFinal: false,
          }
          continue
        }

        if (chunkText) {
          streamedText = text
          emittedText = true
        }
        logOpenClawBridge("CHAT_EVENT_FINAL", {
          sessionKey,
          utteranceId: input.utteranceId,
          runId: event.runId,
          text: clipOpenClawLog(chunkText),
        })

        yield {
          utteranceId: input.utteranceId,
          text: chunkText,
          isFinal: true,
        }
        return
      }

      if (!emittedText) {
        logOpenClawBridge("CHAT_EVENT_EMPTY_FINAL", {
          sessionKey,
          utteranceId: input.utteranceId,
          runId,
        })
        throw new Error(
          "OpenClaw completed the turn without a readable assistant message.",
        )
      }

      yield {
        utteranceId: input.utteranceId,
        text: "",
        isFinal: true,
      }
    } finally {
      await gateway.close()
    }
  }
}

export function resolveOpenClawGatewayConfig(settings: ConversationSettings) {
  const url = normalizeOpenClawGatewayUrl(settings.openClawGateway?.url)
  const token = settings.openClawGateway?.token?.trim()

  if (!token) {
    throw new Error(
      "OpenClaw Gateway mode requires a Gateway token in settings.",
    )
  }

  return {
    url,
    token,
  }
}

function resolveOpenClawConnectStrategy(config: { token: string }) {
  return {
    kind: "shared-token",
    token: config.token,
  } satisfies OpenClawConnectStrategy
}

export function normalizeOpenClawGatewayUrl(input: string | undefined) {
  const fallback = "ws://127.0.0.1:18789"
  const trimmed = input?.trim() || fallback
  const candidate =
    /^wss?:\/\//i.test(trimmed) || /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `ws://${trimmed}`

  try {
    const url = new URL(candidate)
    if (url.protocol === "http:") {
      url.protocol = "ws:"
    } else if (url.protocol === "https:") {
      url.protocol = "wss:"
    }

    return `${url.protocol}//${url.host}${url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "")}`
  } catch {
    return fallback
  }
}

export function buildOpenClawSessionKey(channelId: string) {
  return `${OPENCLAW_SESSION_PREFIX}:channel:${channelId}`
}

export function extractTextFromUnknown(value: unknown, depth = 0): string {
  if (depth > 6 || value == null) {
    return ""
  }

  if (typeof value === "string") {
    return normalizeExtractedText(value)
  }

  if (Array.isArray(value)) {
    return normalizeExtractedText(
      value
        .map((item) => extractTextFromUnknown(item, depth + 1))
        .filter(Boolean)
        .join(" "),
    )
  }

  if (typeof value !== "object") {
    return ""
  }

  const record = value as Record<string, unknown>
  const preferredKeys = [
    "text",
    "delta",
    "content",
    "message",
    "parts",
    "output",
    "result",
    "summary",
    "final",
  ]

  const prioritized = preferredKeys
    .map((key) => extractTextFromUnknown(record[key], depth + 1))
    .filter(Boolean)
    .join(" ")

  if (prioritized) {
    return normalizeExtractedText(prioritized)
  }

  return normalizeExtractedText(
    Object.values(record)
      .map((item) => extractTextFromUnknown(item, depth + 1))
      .filter(Boolean)
      .join(" "),
  )
}

function normalizeExtractedText(text: string) {
  return text.replace(/\s+/g, " ").trim()
}

export function toIncrementalText(previousText: string, nextText: string) {
  if (!nextText) {
    return ""
  }

  if (!previousText) {
    return nextText
  }

  if (nextText.startsWith(previousText)) {
    return nextText.slice(previousText.length)
  }

  return nextText
}

function extractRunId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return undefined
  }

  const direct = (payload as { runId?: unknown }).runId
  if (typeof direct === "string" && direct.trim()) {
    return direct
  }

  const nested = (payload as { payload?: { runId?: unknown } }).payload?.runId
  if (typeof nested === "string" && nested.trim()) {
    return nested
  }

  return undefined
}

function sessionKeysMatch(
  requestedSessionKey: string,
  eventSessionKey: string,
) {
  if (!requestedSessionKey || !eventSessionKey) {
    return false
  }

  if (requestedSessionKey === eventSessionKey) {
    return true
  }

  return eventSessionKey.endsWith(`:${requestedSessionKey}`)
}

class OpenClawGatewaySocket {
  private readonly pendingResponses = new Map<string, PendingResponse>()
  private readonly eventQueue = new AsyncIterableQueue<GatewayFrame>()
  private closing = false
  private socket: WebSocket | null = null

  constructor(
    private readonly config: { url: string; token: string },
    private readonly connectStrategy: OpenClawConnectStrategy,
  ) {}

  async connect() {
    const socket = new WebSocket(this.config.url)
    this.socket = socket

    socket.on("message", (raw, isBinary) => {
      if (isBinary) {
        return
      }

      let frame: GatewayFrame
      try {
        frame = JSON.parse(raw.toString()) as GatewayFrame
      } catch {
        return
      }

      if (frame.type === "res") {
        const pending = this.pendingResponses.get(frame.id)
        if (!pending) {
          return
        }

        this.pendingResponses.delete(frame.id)
        if (!frame.ok) {
          pending.reject(new Error(formatGatewayError(frame.error)))
          return
        }

        pending.resolve(frame.payload)
        return
      }

      if (frame.type === "event") {
        this.eventQueue.push(frame)
      }
    })

    socket.once("close", (code, reason) => {
      if (this.closing) {
        this.eventQueue.close()
        return
      }

      const error = new Error(formatUnexpectedGatewayCloseMessage(code, reason))
      this.rejectPending(error)
      this.eventQueue.error(error)
    })

    socket.once("error", (error) => {
      const failure = error instanceof Error ? error : new Error(String(error))
      this.rejectPending(failure)
      this.eventQueue.error(failure)
    })

    await new Promise<WebSocket>((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => {
        reject(
          new Error(
            `Timed out after ${OPENCLAW_CONNECT_TIMEOUT_MS}ms connecting to OpenClaw Gateway.`,
          ),
        )
      }, OPENCLAW_CONNECT_TIMEOUT_MS)

      socket.once("open", () => {
        globalThis.clearTimeout(timeout)
        resolve(socket)
      })
      socket.once("error", (error) => {
        globalThis.clearTimeout(timeout)
        reject(error instanceof Error ? error : new Error(String(error)))
      })
    })

    const challenge = (await this.waitForEvent("connect.challenge")) as
      | GatewayChallengeEvent
      | undefined
    await this.request(
      "connect",
      buildConnectParams(challenge, this.connectStrategy),
    )
  }

  async request(method: string, params?: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("OpenClaw Gateway socket is not connected.")
    }

    const id = randomUUID()
    const frame = {
      type: "req",
      id,
      method,
      params,
    } satisfies GatewayFrame

    const response = new Promise<unknown>((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => {
        this.pendingResponses.delete(id)
        reject(
          new Error(
            `Timed out after ${OPENCLAW_TURN_TIMEOUT_MS}ms waiting for OpenClaw response to ${method}.`,
          ),
        )
      }, OPENCLAW_TURN_TIMEOUT_MS)

      this.pendingResponses.set(id, {
        resolve: (payload) => {
          globalThis.clearTimeout(timeout)
          resolve(payload)
        },
        reject: (error) => {
          globalThis.clearTimeout(timeout)
          reject(error)
        },
      })
    })

    this.socket.send(JSON.stringify(frame))
    return await response
  }

  async *chatEvents() {
    for await (const frame of this.eventQueue) {
      if (frame.type !== "event" || frame.event !== "chat") {
        continue
      }

      yield frame.payload as GatewayChatEvent
    }
  }

  async close() {
    if (!this.socket) {
      return
    }

    if (
      this.socket.readyState === WebSocket.CLOSING ||
      this.socket.readyState === WebSocket.CLOSED
    ) {
      this.socket = null
      return
    }

    this.closing = true
    await new Promise<void>((resolve) => {
      this.socket?.once("close", () => resolve())
      this.socket?.close()
    })
    this.socket = null
  }

  private async waitForEvent(eventName: string) {
    const iterator = this.eventQueue[Symbol.asyncIterator]()

    while (true) {
      const result = await waitForQueueItem(
        iterator,
        OPENCLAW_CONNECT_TIMEOUT_MS,
        `Timed out after ${OPENCLAW_CONNECT_TIMEOUT_MS}ms waiting for OpenClaw ${eventName}.`,
      )

      if (result.done) {
        break
      }

      if (result.value.type === "event" && result.value.event === eventName) {
        logOpenClawBridge("EVENT_RECEIVED", {
          event: eventName,
        })
        return result.value.payload
      }
    }

    throw new Error(`OpenClaw Gateway never emitted ${eventName}.`)
  }

  private rejectPending(error: Error) {
    for (const [id, pending] of this.pendingResponses.entries()) {
      this.pendingResponses.delete(id)
      pending.reject(error)
    }
  }
}

function logOpenClawBridge(event: string, details: Record<string, unknown>) {
  console.info("[voicyclaw][openclaw-gateway]", { event, ...details })
}

function clipOpenClawLog(text: string, maxLength = 120) {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`
}

function buildConnectParams(
  challenge: GatewayChallengeEvent | undefined,
  connectStrategy: OpenClawConnectStrategy,
) {
  void challenge?.nonce

  return {
    minProtocol: OPENCLAW_PROTOCOL_MIN,
    maxProtocol: OPENCLAW_PROTOCOL_MAX,
    client: {
      id: OPENCLAW_CLIENT_ID,
      displayName: "VoicyClaw Gateway Bridge",
      version: "0.1.0",
      platform: `node-${process.version}`,
      mode: OPENCLAW_CLIENT_MODE,
    },
    role: OPENCLAW_ROLE,
    scopes: OPENCLAW_SCOPES,
    caps: [],
    commands: [],
    auth: buildConnectAuth(connectStrategy),
  }
}

function buildConnectAuth(connectStrategy: OpenClawConnectStrategy) {
  switch (connectStrategy.kind) {
    case "shared-token":
      return {
        token: connectStrategy.token,
      }
  }
}

function formatGatewayError(error: GatewayErrorInfo) {
  const message = error?.message?.trim() || "OpenClaw request failed."
  const detailCode = error?.details?.code

  if (typeof detailCode === "string" && detailCode.trim()) {
    return `${message} [${detailCode}]`
  }

  return message
}

function formatUnexpectedGatewayCloseMessage(code: number, reason: Buffer) {
  const detail = reason.toString("utf8").trim()
  if (detail) {
    return `OpenClaw Gateway connection closed unexpectedly (code ${code}: ${detail}).`
  }

  return `OpenClaw Gateway connection closed unexpectedly (code ${code}).`
}

async function waitForQueueItem<T>(
  iterator: AsyncIterator<T>,
  timeoutMs: number,
  timeoutMessage: string,
) {
  return await new Promise<IteratorResult<T>>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, timeoutMs)

    iterator
      .next()
      .then((result) => {
        globalThis.clearTimeout(timeout)
        resolve(result)
      })
      .catch((error) => {
        globalThis.clearTimeout(timeout)
        reject(error)
      })
  })
}
