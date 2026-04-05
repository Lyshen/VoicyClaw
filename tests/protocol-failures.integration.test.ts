import { randomUUID } from "node:crypto"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import {
  type OpenClawServerMessage,
  PROTOCOL_VERSION,
} from "../packages/protocol/src/openclaw"
import { startServerRuntime } from "./support/demo-runtime"

const defaultClientSettings = {
  conversationBackend: "local-bot" as const,
  asrMode: "client" as const,
  asrProvider: "browser",
  ttsMode: "client" as const,
  ttsProvider: "browser",
  language: "en-US",
}

describe.sequential("protocol failure paths", () => {
  let runtime: Awaited<ReturnType<typeof startServerRuntime>>
  let sockets: Array<{ close: () => Promise<void> }> = []

  beforeAll(async () => {
    runtime = await startServerRuntime()
  }, 30_000)

  afterEach(async () => {
    await Promise.allSettled(sockets.map((socket) => socket.close()))
    sockets = []
  })

  afterAll(async () => {
    await runtime.stop()
  })

  it("rejects a bot whose first message is not HELLO", async () => {
    const bot = track(await runtime.connectBotRaw())

    bot.sendJson({
      type: "TTS_TEXT",
      session_id: "not-ready",
      utterance_id: "utterance",
      text: "hello",
      is_final: true,
    })

    const error = await bot.waitForMessage(isErrorMessage)

    expect(error).toMatchObject({
      type: "ERROR",
      code: "PROTOCOL_VERSION_UNSUPPORTED",
    })
    expect(error.message).toMatch(/first bot message must be HELLO/i)
    await bot.waitForClose()
  })

  it("rejects a bot with an invalid API key", async () => {
    const bot = track(await runtime.connectBotRaw())

    bot.sendJson({
      type: "HELLO",
      api_key: "vc_invalid",
      protocol_version: PROTOCOL_VERSION,
    })

    const error = await bot.waitForMessage(isErrorMessage)

    expect(error).toMatchObject({
      type: "ERROR",
      code: "AUTH_FAILED",
    })
    await bot.waitForClose()
  })

  it("rejects a second bot that resolves to the same bound bot in one channel", async () => {
    const channelId = makeChannelId()
    const firstKey = await runtime.issueKey(channelId, "First bot key")
    const secondKey = await runtime.issueKey(channelId, "Second bot key")
    const firstBot = track(await runtime.connectBotRaw())
    const secondBot = track(await runtime.connectBotRaw())

    firstBot.sendJson({
      type: "HELLO",
      api_key: firstKey.apiKey,
      protocol_version: PROTOCOL_VERSION,
    })

    const welcome = await firstBot.waitForMessage(isWelcomeMessage)

    secondBot.sendJson({
      type: "HELLO",
      api_key: secondKey.apiKey,
      protocol_version: PROTOCOL_VERSION,
    })

    const error = await secondBot.waitForMessage(isErrorMessage)

    expect(welcome).toMatchObject({
      type: "WELCOME",
      channel_id: channelId,
      bot_id: "local-bot",
    })
    expect(error).toMatchObject({
      type: "ERROR",
      code: "BOT_ALREADY_CONNECTED",
    })
    await secondBot.waitForClose()
  })

  it("accepts a token-only HELLO and resolves the bound channel plus default bot", async () => {
    const channelId = makeChannelId()
    const key = await runtime.issueKey(channelId)
    const bot = track(await runtime.connectBotRaw())

    bot.sendJson({
      type: "HELLO",
      api_key: key.apiKey,
      protocol_version: PROTOCOL_VERSION,
    })

    const welcome = await bot.waitForMessage(isWelcomeMessage)

    expect(welcome).toMatchObject({
      type: "WELCOME",
      channel_id: channelId,
      bot_id: "local-bot",
      bot_name: "Integration key",
    })
  })

  it("returns a notice when a client sends malformed JSON", async () => {
    const client = track(await runtime.connectClientRaw(makeChannelId()))

    client.sendRaw("{not valid json")

    const notice = await client.waitForMessage(
      (message) => message.type === "NOTICE" && message.level === "error",
    )

    expect(notice.message).toMatch(/invalid json/i)
  })

  it("returns a notice when a commit does not match the active utterance", async () => {
    const client = track(
      await runtime.connectClient(defaultClientSettings, {
        channelId: makeChannelId(),
      }),
    )

    client.send({
      type: "START_UTTERANCE",
      utteranceId: "active-utterance",
    })
    client.send({
      type: "COMMIT_UTTERANCE",
      utteranceId: "different-utterance",
      source: "microphone",
      transcript: "hello",
    })

    const notice = await client.waitForMessage(
      (message) => message.type === "NOTICE" && message.level === "error",
    )

    expect(notice.message).toMatch(
      /does not match the active microphone session/i,
    )
  })

  function track<TSocket extends { close: () => Promise<void> }>(
    socket: TSocket,
  ) {
    sockets.push(socket)
    return socket
  }
})

function isErrorMessage(
  message: OpenClawServerMessage,
): message is Extract<OpenClawServerMessage, { type: "ERROR" }> {
  return message.type === "ERROR"
}

function isWelcomeMessage(
  message: OpenClawServerMessage,
): message is Extract<OpenClawServerMessage, { type: "WELCOME" }> {
  return message.type === "WELCOME"
}

function makeChannelId() {
  return `protocol-${randomUUID().slice(0, 8)}`
}
