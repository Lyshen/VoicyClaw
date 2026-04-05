import { randomUUID } from "node:crypto"

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { PROTOCOL_VERSION } from "../packages/protocol/src/openclaw"
import {
  type JsonSocket,
  type RuntimeClient,
  startServerRuntime,
} from "./support/demo-runtime"

type HostedBootstrapPayload = {
  workspace: { id: string; name: string }
  project: {
    id: string
    name: string
    channelId: string
    botId: string
    displayName: string
  }
  starterKey: { value: string; label: string; createdAt: string } | null
}

type WorkspaceBillingPayload = {
  workspaceId: string
  allowance: {
    label: string
    status: "preview"
    note: string
    currency: "voice-credits"
    grantedCreditsMillis: number
    usedCreditsMillis: number
    remainingCreditsMillis: number
  }
  usage: {
    totalEvents: number
    successCount: number
    failureCount: number
    inputChars: number
    outputAudioMs: number
    chargedCreditsMillis: number
  }
  recentEvents: Array<{
    workspaceId: string | null
    projectId: string | null
    channelId: string
    requestId: string
    feature: string
    providerId: string
    status: string
    inputChars: number
    outputAudioMs: number
    chargedCreditsMillis: number
  }>
}

describe.sequential("billing foundation", () => {
  let runtime: Awaited<ReturnType<typeof startServerRuntime>>
  let client: RuntimeClient | null = null
  let bot: JsonSocket<unknown> | null = null

  beforeAll(async () => {
    runtime = await startServerRuntime()
  }, 30_000)

  afterEach(async () => {
    await client?.close()
    await bot?.close()
    client = null
    bot = null
  })

  afterAll(async () => {
    await runtime.stop()
  })

  it("tracks starter allowance and records successful server TTS usage", async () => {
    const bootstrapResponse = await fetch(
      new URL("/api/hosted/bootstrap", runtime.serverUrl),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          provider: "clerk",
          providerSubject: "user_billing_demo",
          email: "billing@example.com",
          displayName: "Billing Demo",
          firstName: "Billing",
          fullName: "Billing Demo",
          username: "billing-demo",
        }),
      },
    )

    expect(bootstrapResponse.status).toBe(200)
    const bootstrap = (await bootstrapResponse.json()) as HostedBootstrapPayload

    const summaryBefore = await fetchWorkspaceBillingSummary(
      bootstrap.workspace.id,
    )
    expect(summaryBefore.allowance.grantedCreditsMillis).toBe(500_000)
    expect(summaryBefore.allowance.usedCreditsMillis).toBe(0)
    expect(summaryBefore.allowance.remainingCreditsMillis).toBe(500_000)
    expect(summaryBefore.usage.totalEvents).toBe(0)

    bot = await runtime.connectBotRaw()
    bot.sendJson({
      type: "HELLO",
      api_key: bootstrap.starterKey?.value ?? "",
      protocol_version: PROTOCOL_VERSION,
    })

    const welcome = (await bot.waitForMessage(
      (message) => (message as { type?: string }).type === "WELCOME",
    )) as { session_id?: string; channel_id?: string; bot_id?: string }
    expect(welcome.session_id).toBeTruthy()
    expect(welcome.channel_id).toBe(bootstrap.project.channelId)
    expect(welcome.bot_id).toBe(bootstrap.project.botId)

    client = await runtime.connectClient(
      {
        conversationBackend: "local-bot",
        asrMode: "client",
        asrProvider: "browser",
        ttsMode: "server",
        ttsProvider: "demo",
        language: "en-US",
      },
      {
        channelId: bootstrap.project.channelId,
      },
    )

    const utteranceId = randomUUID()
    client.send({
      type: "TEXT_UTTERANCE",
      utteranceId,
      text: "Please say hello in your new voice.",
    })

    const sttResult = (await bot.waitForMessage(
      (message) =>
        (message as { type?: string; utterance_id?: string }).type ===
          "STT_RESULT" &&
        (message as { utterance_id?: string }).utterance_id === utteranceId,
    )) as { utterance_id: string }
    expect(sttResult.utterance_id).toBe(utteranceId)

    bot.sendJson({
      type: "TTS_TEXT",
      session_id: welcome.session_id,
      utterance_id: utteranceId,
      text: "Hello from the billing foundation test bot.",
      is_final: true,
    })

    const audioEnd = await client.waitForMessage(
      (message) =>
        message.type === "AUDIO_END" && message.utteranceId === utteranceId,
    )
    const finalText = await client.waitForMessage(
      (message) =>
        message.type === "BOT_TEXT" &&
        message.utteranceId === utteranceId &&
        message.isFinal,
    )

    expect(audioEnd.sampleRate).toBe(16_000)
    expect(finalText.text).toBe("Hello from the billing foundation test bot.")

    const summaryAfter = await fetchWorkspaceBillingSummary(
      bootstrap.workspace.id,
    )
    expect(summaryAfter.usage.totalEvents).toBe(1)
    expect(summaryAfter.usage.successCount).toBe(1)
    expect(summaryAfter.usage.failureCount).toBe(0)
    expect(summaryAfter.usage.inputChars).toBeGreaterThan(0)
    expect(summaryAfter.usage.outputAudioMs).toBeGreaterThan(0)
    expect(summaryAfter.usage.chargedCreditsMillis).toBeGreaterThan(0)
    expect(summaryAfter.allowance.usedCreditsMillis).toBe(
      summaryAfter.usage.chargedCreditsMillis,
    )
    expect(summaryAfter.allowance.remainingCreditsMillis).toBeLessThan(500_000)
    expect(summaryAfter.allowance.note).toContain("voice credits remaining")
    expect(summaryAfter.recentEvents[0]).toMatchObject({
      workspaceId: bootstrap.workspace.id,
      projectId: bootstrap.project.id,
      channelId: bootstrap.project.channelId,
      requestId: utteranceId,
      feature: "tts",
      providerId: "demo",
      status: "succeeded",
    })
  })

  it("records failed server TTS usage without consuming allowance", async () => {
    const failingRuntime = await startServerRuntime({
      env: {
        VOICYCLAW_GOOGLE_BATCHED_TTS_SERVICE_ACCOUNT_JSON: "{}",
        VOICYCLAW_GOOGLE_BATCHED_TTS_VOICE: "en-US-Chirp3-HD-Charon",
      },
    })

    let failingClient: RuntimeClient | null = null
    let failingBot: JsonSocket<unknown> | null = null

    try {
      const bootstrapResponse = await fetch(
        new URL("/api/hosted/bootstrap", failingRuntime.serverUrl),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            provider: "clerk",
            providerSubject: "user_billing_failure_demo",
            email: "billing-failure@example.com",
            displayName: "Billing Failure Demo",
            firstName: "Billing",
            fullName: "Billing Failure Demo",
            username: "billing-failure-demo",
          }),
        },
      )

      expect(bootstrapResponse.status).toBe(200)
      const bootstrap =
        (await bootstrapResponse.json()) as HostedBootstrapPayload

      const summaryBefore = await fetchWorkspaceBillingSummary(
        bootstrap.workspace.id,
        failingRuntime.serverUrl,
      )
      expect(summaryBefore.allowance.remainingCreditsMillis).toBe(500_000)

      failingBot = await failingRuntime.connectBotRaw()
      failingBot.sendJson({
        type: "HELLO",
        api_key: bootstrap.starterKey?.value ?? "",
        protocol_version: PROTOCOL_VERSION,
      })

      const welcome = (await failingBot.waitForMessage(
        (message) => (message as { type?: string }).type === "WELCOME",
      )) as { session_id?: string; channel_id?: string; bot_id?: string }
      expect(welcome.session_id).toBeTruthy()
      expect(welcome.channel_id).toBe(bootstrap.project.channelId)
      expect(welcome.bot_id).toBe(bootstrap.project.botId)

      failingClient = await failingRuntime.connectClient(
        {
          conversationBackend: "local-bot",
          asrMode: "client",
          asrProvider: "browser",
          ttsMode: "server",
          ttsProvider: "google-batched-tts",
          language: "en-US",
        },
        {
          channelId: bootstrap.project.channelId,
        },
      )

      const utteranceId = randomUUID()
      failingClient.send({
        type: "TEXT_UTTERANCE",
        utteranceId,
        text: "Trigger the failing TTS provider path.",
      })

      const notice = await failingClient.waitForMessage(
        (message) => message.type === "NOTICE" && message.level === "error",
      )

      expect(notice.message).toContain("Google Cloud batched TTS")

      const summaryAfter = await fetchWorkspaceBillingSummary(
        bootstrap.workspace.id,
        failingRuntime.serverUrl,
      )
      expect(summaryAfter.usage.totalEvents).toBe(1)
      expect(summaryAfter.usage.successCount).toBe(0)
      expect(summaryAfter.usage.failureCount).toBe(1)
      expect(summaryAfter.usage.chargedCreditsMillis).toBe(0)
      expect(summaryAfter.allowance.usedCreditsMillis).toBe(0)
      expect(summaryAfter.allowance.remainingCreditsMillis).toBe(500_000)
      expect(summaryAfter.recentEvents[0]).toMatchObject({
        workspaceId: bootstrap.workspace.id,
        projectId: bootstrap.project.id,
        channelId: bootstrap.project.channelId,
        requestId: utteranceId,
        feature: "tts",
        providerId: "google-batched-tts",
        status: "failed",
        chargedCreditsMillis: 0,
      })
    } finally {
      await failingClient?.close()
      await failingBot?.close()
      await failingRuntime.stop()
    }
  })

  async function fetchWorkspaceBillingSummary(
    workspaceId: string,
    serverUrl = runtime.serverUrl,
  ) {
    const response = await fetch(
      new URL(`/api/workspaces/${workspaceId}/billing`, serverUrl),
    )

    expect(response.status).toBe(200)
    return (await response.json()) as WorkspaceBillingPayload
  }
})
