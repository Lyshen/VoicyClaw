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

type WorkspaceCreditsPayload = {
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
  ledger: Array<{
    id: string
    workspaceId: string
    entryType: "grant" | "usage" | "adjustment"
    sourceType: string
    sourceId: string
    creditsDeltaMillis: number
    note: string | null
    createdAt: string
  }>
}

type WorkspaceLogsPayload = {
  workspaceId: string
  allowance: WorkspaceCreditsPayload["allowance"]
  usage: WorkspaceCreditsPayload["usage"]
  filters: {
    startAt: string | null
    endAt: string | null
  }
  events: Array<{
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

    const creditsBefore = await fetchWorkspaceCreditsSummary(
      bootstrap.workspace.id,
    )
    expect(creditsBefore.allowance.grantedCreditsMillis).toBe(500_000)
    expect(creditsBefore.allowance.usedCreditsMillis).toBe(0)
    expect(creditsBefore.allowance.remainingCreditsMillis).toBe(500_000)
    expect(creditsBefore.usage.totalEvents).toBe(0)
    expect(creditsBefore.ledger[0]).toMatchObject({
      workspaceId: bootstrap.workspace.id,
      entryType: "grant",
      sourceType: "starter-preview",
      sourceId: "starter-preview-v1",
      creditsDeltaMillis: 500_000,
    })

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

    const creditsAfter = await fetchWorkspaceCreditsSummary(
      bootstrap.workspace.id,
    )
    expect(creditsAfter.usage.totalEvents).toBe(1)
    expect(creditsAfter.usage.successCount).toBe(1)
    expect(creditsAfter.usage.failureCount).toBe(0)
    expect(creditsAfter.usage.inputChars).toBeGreaterThan(0)
    expect(creditsAfter.usage.outputAudioMs).toBeGreaterThan(0)
    expect(creditsAfter.usage.chargedCreditsMillis).toBeGreaterThan(0)
    expect(creditsAfter.allowance.usedCreditsMillis).toBe(
      creditsAfter.usage.chargedCreditsMillis,
    )
    expect(creditsAfter.allowance.remainingCreditsMillis).toBeLessThan(500_000)
    expect(creditsAfter.allowance.note).toContain("voice credits remaining")
    expect(creditsAfter.ledger[0]).toMatchObject({
      workspaceId: bootstrap.workspace.id,
      entryType: "usage",
      sourceType: "tts-usage",
      creditsDeltaMillis: -creditsAfter.usage.chargedCreditsMillis,
      note: "demo TTS usage",
    })

    const logsAfter = await fetchWorkspaceUsageLog(bootstrap.workspace.id)
    expect(logsAfter.filters).toEqual({
      startAt: null,
      endAt: null,
    })
    expect(logsAfter.events[0]).toMatchObject({
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

      const creditsBefore = await fetchWorkspaceCreditsSummary(
        bootstrap.workspace.id,
        failingRuntime.serverUrl,
      )
      expect(creditsBefore.allowance.remainingCreditsMillis).toBe(500_000)

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

      const creditsAfter = await fetchWorkspaceCreditsSummary(
        bootstrap.workspace.id,
        failingRuntime.serverUrl,
      )
      expect(creditsAfter.usage.totalEvents).toBe(1)
      expect(creditsAfter.usage.successCount).toBe(0)
      expect(creditsAfter.usage.failureCount).toBe(1)
      expect(creditsAfter.usage.chargedCreditsMillis).toBe(0)
      expect(creditsAfter.allowance.usedCreditsMillis).toBe(0)
      expect(creditsAfter.allowance.remainingCreditsMillis).toBe(500_000)
      expect(creditsAfter.ledger).toHaveLength(1)

      const logsAfter = await fetchWorkspaceUsageLog(
        bootstrap.workspace.id,
        failingRuntime.serverUrl,
      )
      expect(logsAfter.events[0]).toMatchObject({
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

  async function fetchWorkspaceCreditsSummary(
    workspaceId: string,
    serverUrl = runtime.serverUrl,
  ) {
    const response = await fetch(
      new URL(`/api/workspaces/${workspaceId}/credits`, serverUrl),
    )

    expect(response.status).toBe(200)
    return (await response.json()) as WorkspaceCreditsPayload
  }

  async function fetchWorkspaceUsageLog(
    workspaceId: string,
    serverUrl = runtime.serverUrl,
  ) {
    const response = await fetch(
      new URL(`/api/workspaces/${workspaceId}/logs`, serverUrl),
    )

    expect(response.status).toBe(200)
    return (await response.json()) as WorkspaceLogsPayload
  }
})
