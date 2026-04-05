import { Buffer } from "node:buffer"
import { setTimeout as delay } from "node:timers/promises"

import { resolveDemoBotConfig } from "@voicyclaw/config"
import { decodeAudioFrame, PROTOCOL_VERSION } from "@voicyclaw/protocol"
import WebSocket from "ws"

const demoBotConfig = resolveDemoBotConfig()
const serverUrl = demoBotConfig.serverUrl
const channelId = demoBotConfig.channelId
const botName = demoBotConfig.botName

function clipTextForLog(text: string, maxLength = 120) {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`
}

async function main() {
  while (true) {
    try {
      const connectionConfig = await getBotConnectionConfig()
      await connectBot(connectionConfig.apiKey, connectionConfig.wsUrl)
    } catch (error) {
      if (isConnectionRefused(error)) {
        console.log("[mock-bot] waiting for the server to come online...")
      } else if (isAlreadyConnected(error)) {
        console.log(
          "[mock-bot] bot session is already active, waiting before retrying...",
        )
      } else {
        console.error("[mock-bot]", error)
      }
      await delay(2_000)
    }
  }
}

async function getBotConnectionConfig() {
  if (demoBotConfig.botApiKey) {
    return {
      apiKey: demoBotConfig.botApiKey,
      wsUrl: new URL(
        "/bot/connect",
        serverUrl.replace(/^http/i, "ws"),
      ).toString(),
    }
  }

  const response = await fetch(new URL("/api/keys", serverUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      channelId,
      label: botName,
    }),
  })

  if (!response.ok) {
    throw new Error(`Unable to issue platform key: ${response.status}`)
  }

  return (await response.json()) as {
    apiKey: string
    wsUrl: string
  }
}

async function connectBot(apiKey: string, wsUrl: string) {
  const socket = new WebSocket(wsUrl)
  let sessionId = ""
  let activeBotName = botName
  let activeChannelId = channelId

  return new Promise<void>((resolve, reject) => {
    socket.on("open", () => {
      socket.send(
        JSON.stringify({
          type: "HELLO",
          api_key: apiKey,
          protocol_version: PROTOCOL_VERSION,
        }),
      )
    })

    socket.on("message", async (raw, isBinary) => {
      if (isBinary) {
        try {
          decodeAudioFrame(Buffer.from(raw as ArrayBuffer))
        } catch {
          // Ignore malformed binary frames in the mock bot.
        }
        return
      }

      const message = JSON.parse(raw.toString()) as {
        type: string
        session_id?: string
        utterance_id?: string
        text?: string
        is_final?: boolean
        channel_id?: string
        bot_name?: string
        code?: string
        message?: string
      }

      switch (message.type) {
        case "WELCOME": {
          sessionId = message.session_id ?? ""
          activeBotName = message.bot_name?.trim() || activeBotName
          activeChannelId = message.channel_id?.trim() || activeChannelId
          console.log(
            `[mock-bot] connected as ${activeBotName} in ${activeChannelId}`,
          )
          break
        }
        case "ERROR": {
          reject(new Error(`[mock-bot] ${message.code}: ${message.message}`))
          socket.close()
          break
        }
        case "STT_RESULT": {
          if (!message.is_final || !sessionId || !message.utterance_id) return
          console.log(
            `[mock-bot] STT_RESULT final ${message.utterance_id}: ${clipTextForLog(message.text ?? "")}`,
          )
          await streamReply(socket, {
            botName: activeBotName,
            sessionId,
            utteranceId: message.utterance_id,
            userText: message.text ?? "",
          })
          break
        }
        default:
          break
      }
    })

    socket.on("close", () => {
      console.log("[mock-bot] socket closed, retrying...")
      resolve()
    })

    socket.on("error", (error) => {
      reject(error)
    })
  })
}

function composeReply(activeBotName: string, text: string) {
  const input = text.trim()

  if (!input) {
    return `${activeBotName} is online, but this utterance arrived without a transcript.`
  }

  if (/weather|temperature|forecast|天气|温度/i.test(input)) {
    return `${activeBotName} is a local prototype bot, so I do not fetch live weather yet, but the full mic-to-bot-to-audio loop is up and responding.`
  }

  if (/hello|hi|你好|在吗/i.test(input)) {
    return `Hello from ${activeBotName}. I am running locally through the OpenClaw websocket channel and streaming my answer back in chunks.`
  }

  if (/design|prototype|原型|架构|流程/i.test(input)) {
    return `This prototype proves the README architecture: browser capture, websocket relay, OpenClaw bot streaming, and adapter-based audio playback all work together.`
  }

  return `${activeBotName} heard: ${input}. The server forwarded your transcript over OpenClaw, and I am answering from a real local bot session.`
}

async function streamReply(
  socket: WebSocket,
  options: {
    botName: string
    sessionId: string
    utteranceId: string
    userText: string
  },
) {
  const reply = composeReply(options.botName, options.userText)
  const previews = buildPreviewFrames(options.botName, reply)
  const parts = splitReply(reply)

  for (const [index, preview] of previews.entries()) {
    await delay(120)
    console.log(
      `[mock-bot] BOT_PREVIEW ${index + 1}/${previews.length} ${options.utteranceId}: ${clipTextForLog(preview)}`,
    )
    socket.send(
      JSON.stringify({
        type: "BOT_PREVIEW",
        session_id: options.sessionId,
        utterance_id: options.utteranceId,
        text: preview,
        is_final: index === previews.length - 1,
      }),
    )
  }

  for (const [index, part] of parts.entries()) {
    await delay(170)
    console.log(
      `[mock-bot] TTS_TEXT ${index + 1}/${parts.length} ${options.utteranceId}${index === parts.length - 1 ? " final" : ""}: ${clipTextForLog(part)}`,
    )
    socket.send(
      JSON.stringify({
        type: "TTS_TEXT",
        session_id: options.sessionId,
        utterance_id: options.utteranceId,
        text: part,
        is_final: index === parts.length - 1,
      }),
    )
  }
}

function buildPreviewFrames(activeBotName: string, reply: string) {
  const words = reply.split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return [`${activeBotName} is thinking...`]
  }

  const checkpoints = Array.from(
    new Set([
      Math.max(3, Math.floor(words.length * 0.28)),
      Math.max(5, Math.floor(words.length * 0.58)),
      words.length,
    ]),
  ).filter((count) => count <= words.length)

  return checkpoints.map((count, index) => {
    const snippet = words.slice(0, count).join(" ").trim()
    const isLast = index === checkpoints.length - 1
    if (isLast) {
      return snippet
    }

    return `${snippet}${/[.?!,;:，。！？；：]$/.test(snippet) ? "" : "..."}`
  })
}

function splitReply(reply: string) {
  const pieces = reply
    .split(/(?<=[,.!?，。！？])\s*/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (pieces.length > 0) {
    return pieces
  }

  const fallback: string[] = []
  for (let index = 0; index < reply.length; index += 30) {
    fallback.push(reply.slice(index, index + 30))
  }
  return fallback
}

function isConnectionRefused(error: unknown) {
  if (!(error instanceof Error)) return false

  const cause = (
    error as Error & {
      cause?: { code?: string; errors?: Array<{ code?: string }> }
    }
  ).cause
  if (cause?.code === "ECONNREFUSED") return true
  if (
    Array.isArray(cause?.errors) &&
    cause.errors.some((item) => item.code === "ECONNREFUSED")
  ) {
    return true
  }

  return false
}

function isAlreadyConnected(error: unknown) {
  return (
    error instanceof Error && error.message.includes("BOT_ALREADY_CONNECTED")
  )
}

void main()
