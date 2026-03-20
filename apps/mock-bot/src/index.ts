import { Buffer } from "node:buffer"
import { setTimeout as delay } from "node:timers/promises"

import { PROTOCOL_VERSION, decodeAudioFrame } from "@voicyclaw/protocol"
import WebSocket from "ws"

const serverUrl = process.env.VOICYCLAW_SERVER_URL ?? "http://localhost:3001"
const channelId = process.env.CHANNEL_ID ?? "demo-room"
const botId = process.env.BOT_ID ?? "demo-clawbot"
const botName = process.env.BOT_NAME ?? "Studio Claw"

async function main() {
  while (true) {
    try {
      const apiKey = await getApiKey()
      const registration = await registerBot(apiKey)
      await connectBot(apiKey, registration.wsUrl)
    } catch (error) {
      if (isConnectionRefused(error)) {
        console.log("[mock-bot] waiting for the server to come online...")
      } else {
        console.error("[mock-bot]", error)
      }
      await delay(2_000)
    }
  }
}

async function getApiKey() {
  if (process.env.BOT_API_KEY?.trim()) {
    return process.env.BOT_API_KEY.trim()
  }

  const response = await fetch(new URL("/api/keys", serverUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      channelId,
      label: `${botName} bootstrap`
    })
  })

  if (!response.ok) {
    throw new Error(`Unable to issue platform key: ${response.status}`)
  }

  const payload = (await response.json()) as { apiKey: string }
  return payload.apiKey
}

async function registerBot(apiKey: string) {
  const response = await fetch(new URL("/api/bot/register", serverUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      apiKey,
      botId,
      botName,
      channelId
    })
  })

  if (!response.ok) {
    throw new Error(`Unable to register bot: ${response.status}`)
  }

  return (await response.json()) as {
    wsUrl: string
    channelId: string
    botId: string
  }
}

async function connectBot(apiKey: string, wsUrl: string) {
  const socket = new WebSocket(wsUrl)
  let sessionId = ""

  return new Promise<void>((resolve, reject) => {
    socket.on("open", () => {
      socket.send(
        JSON.stringify({
          type: "HELLO",
          api_key: apiKey,
          bot_id: botId,
          channel_id: channelId,
          protocol_version: PROTOCOL_VERSION
        })
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
        code?: string
        message?: string
      }

      switch (message.type) {
        case "WELCOME": {
          sessionId = message.session_id ?? ""
          console.log(`[mock-bot] connected as ${botName} in ${channelId}`)
          break
        }
        case "ERROR": {
          reject(new Error(`[mock-bot] ${message.code}: ${message.message}`))
          socket.close()
          break
        }
        case "STT_RESULT": {
          if (!message.is_final || !sessionId || !message.utterance_id) return
          const reply = composeReply(message.text ?? "")
          const parts = splitReply(reply)

          for (const [index, part] of parts.entries()) {
            await delay(160)
            socket.send(
              JSON.stringify({
                type: "TTS_TEXT",
                session_id: sessionId,
                utterance_id: message.utterance_id,
                text: part,
                is_final: index === parts.length - 1
              })
            )
          }
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

function composeReply(text: string) {
  const input = text.trim()

  if (!input) {
    return `${botName} is online, but this utterance arrived without a transcript.`
  }

  if (/weather|temperature|forecast|天气|温度/i.test(input)) {
    return `${botName} is a local prototype bot, so I do not fetch live weather yet, but the full mic-to-bot-to-audio loop is up and responding.`
  }

  if (/hello|hi|你好|在吗/i.test(input)) {
    return `Hello from ${botName}. I am running locally through the OpenClaw websocket channel and streaming my answer back in chunks.`
  }

  if (/design|prototype|原型|架构|流程/i.test(input)) {
    return `This prototype proves the README architecture: browser capture, websocket relay, OpenClaw bot streaming, and adapter-based audio playback all work together.`
  }

  return `${botName} heard: ${input}. The server forwarded your transcript over OpenClaw, and I am answering from a real local bot session.`
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

  const cause = (error as Error & { cause?: { code?: string; errors?: Array<{ code?: string }> } }).cause
  if (cause?.code === "ECONNREFUSED") return true
  if (Array.isArray(cause?.errors) && cause.errors.some((item) => item.code === "ECONNREFUSED")) {
    return true
  }

  return false
}

void main()
