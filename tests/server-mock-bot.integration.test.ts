import { randomUUID } from "node:crypto"

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { RuntimeClient, startDemoRuntime } from "./support/demo-runtime"

const defaultClientSettings = {
  asrMode: "client" as const,
  asrProvider: "browser",
  ttsMode: "client" as const,
  ttsProvider: "browser",
  language: "en-US"
}

describe.sequential("server + mock-bot integration", () => {
  let runtime: Awaited<ReturnType<typeof startDemoRuntime>>
  let client: RuntimeClient | null = null

  beforeAll(async () => {
    runtime = await startDemoRuntime()
  }, 30_000)

  afterEach(async () => {
    await client?.close()
    client = null
  })

  afterAll(async () => {
    await runtime.stop()
  })

  it("relays preview and final bot text for a text utterance", async () => {
    client = await runtime.connectClient(defaultClientSettings)

    const utteranceId = randomUUID()
    client.send({
      type: "TEXT_UTTERANCE",
      utteranceId,
      text: "hello"
    })

    const preview = await client.waitForMessage(
      (message) =>
        message.type === "BOT_PREVIEW" && message.utteranceId === utteranceId && message.isFinal
    )
    const finalText = await client.waitForMessage(
      (message) =>
        message.type === "BOT_TEXT" && message.utteranceId === utteranceId && message.isFinal
    )

    expect(preview.text).toMatch(/Hello from Integration Bot/i)
    expect(finalText.text).toMatch(/chunks\./i)
  })

  it("streams demo audio frames when server TTS is selected", async () => {
    client = await runtime.connectClient({
      ...defaultClientSettings,
      ttsMode: "server",
      ttsProvider: "demo"
    })

    const utteranceId = randomUUID()
    client.send({
      type: "TEXT_UTTERANCE",
      utteranceId,
      text: "design prototype"
    })

    const audioChunk = await client.waitForMessage(
      (message) => message.type === "AUDIO_CHUNK" && message.utteranceId === utteranceId
    )
    const audioEnd = await client.waitForMessage(
      (message) => message.type === "AUDIO_END" && message.utteranceId === utteranceId
    )
    const finalText = await client.waitForMessage(
      (message) =>
        message.type === "BOT_TEXT" && message.utteranceId === utteranceId && message.isFinal
    )

    expect(audioChunk.audioBase64.length).toBeGreaterThan(0)
    expect(audioEnd.sampleRate).toBe(16_000)
    expect(finalText.text).toMatch(/work together\./i)
  })
})
