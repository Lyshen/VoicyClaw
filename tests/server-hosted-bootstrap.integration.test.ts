import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { startServerRuntime } from "./support/demo-runtime"

describe.sequential("server hosted bootstrap", () => {
  let runtime: Awaited<ReturnType<typeof startServerRuntime>>

  beforeAll(async () => {
    runtime = await startServerRuntime()
  }, 30_000)

  afterAll(async () => {
    await runtime.stop()
  })

  it("requires a provider and provider subject", async () => {
    const response = await fetch(
      new URL("/api/hosted/bootstrap", runtime.serverUrl),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      message: "provider and providerSubject are required",
    })
  })

  it("bootstraps one starter workspace, project, and key per identity", async () => {
    const requestBody = {
      provider: "clerk",
      providerSubject: "user_clerk_123",
      email: "lyshen@example.com",
      displayName: "Lyshen",
      firstName: "Lyshen",
      fullName: "Lyshen",
      username: "lyshen",
    }

    const firstResponse = await fetch(
      new URL("/api/hosted/bootstrap", runtime.serverUrl),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
    )

    expect(firstResponse.status).toBe(200)
    const first = (await firstResponse.json()) as {
      workspace: { id: string; name: string }
      project: {
        id: string
        name: string
        channelId: string
        botId: string
        displayName: string
      }
      starterKey: { value: string; label: string; createdAt: string } | null
      allowance: {
        label: string
        status: "preview"
        note: string
        currency: "voice-credits"
        grantedCreditsMillis: number
        usedCreditsMillis: number
        remainingCreditsMillis: number
      }
    }

    const secondResponse = await fetch(
      new URL("/api/hosted/bootstrap", runtime.serverUrl),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
    )

    expect(secondResponse.status).toBe(200)
    const second = await secondResponse.json()

    expect(first.workspace.name).toBe("Lyshen Workspace")
    expect(first.project.name).toBe("SayHello")
    expect(first.project.displayName).toBe("SayHello Connector")
    expect(first.project.channelId).toMatch(/^sayhello-/)
    expect(first.project.botId).toMatch(/^openclaw-/)
    expect(first.starterKey?.label).toBe("Starter key")
    expect(first.starterKey?.value).toMatch(/^vcs_/)
    expect(first.allowance).toEqual({
      label: "Free preview allowance",
      status: "preview",
      note: "Starter preview allowance is active. 500.000 voice credits remaining. Billing is not enforced yet.",
      currency: "voice-credits",
      grantedCreditsMillis: 500_000,
      usedCreditsMillis: 0,
      remainingCreditsMillis: 500_000,
    })
    expect(second).toEqual(first)

    const standardKey = await runtime.issueKey(
      first.project.channelId,
      "Manual key",
    )
    expect(standardKey.apiKey).toMatch(/^vc_/)
    expect(standardKey.apiKey.startsWith("vcs_")).toBe(false)

    const registration = await runtime.registerBot({
      apiKey: first.starterKey?.value ?? "",
      botId: "starter-bot",
      botName: "Starter Bot",
      channelId: first.project.channelId,
    })

    expect(registration).toMatchObject({
      ok: true,
      botId: "starter-bot",
      botName: "Starter Bot",
      channelId: first.project.channelId,
    })
  })
})
