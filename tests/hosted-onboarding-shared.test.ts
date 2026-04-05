import { describe, expect, it } from "vitest"

import {
  buildConnectorConfigJson,
  buildConnectorConfigLine,
  buildHostedOnboardingState,
  buildSettingsStorageNamespace,
  buildStarterOnboardingRecord,
  buildStarterWorkspaceName,
  withHostedStarterKey,
} from "../apps/web/lib/hosted-onboarding-shared"

describe("hosted onboarding shared helpers", () => {
  it("builds a friendly default workspace name", () => {
    expect(
      buildStarterWorkspaceName({
        firstName: "Lyshen",
      }),
    ).toBe("Lyshen Workspace")

    expect(
      buildStarterWorkspaceName({
        firstName: null,
        fullName: null,
        username: null,
      }),
    ).toBe("My Workspace")
  })

  it("builds a stable starter record from a user id", () => {
    const record = buildStarterOnboardingRecord("user_test_123", {
      firstName: "Lyshen",
    })

    expect(record.workspace.name).toBe("Lyshen Workspace")
    expect(record.project.name).toBe("SayHello")
    expect(record.project.channelId).toMatch(/^sayhello-/)
    expect(record.project.botId).toMatch(/^openclaw-/)
    expect(record.starterKey).toBeNull()
  })

  it("adds a starter key and connector state without changing the core record", () => {
    const base = buildStarterOnboardingRecord("user_test_456", {
      username: "studio-claw",
    })
    const withKey = withHostedStarterKey(base, "vc_test")
    const state = buildHostedOnboardingState(
      withKey,
      "https://voice.example.com",
    )

    expect(state.starterKey?.value).toBe("vc_test")
    expect(state.settingsNamespace).toBe(
      buildSettingsStorageNamespace(base.workspace.id, base.project.id),
    )
    expect(state.connectorConfigJson).toContain('"token": "vc_test"')
    expect(state.connectorConfigLine).toContain('"token":"vc_test"')
    expect(state.connectorConfigJson).toContain(
      '"url": "https://voice.example.com"',
    )
  })

  it("builds the OpenClaw connector config snippet for custom servers", () => {
    const json = buildConnectorConfigJson({
      serverUrl: "https://voice.example.com",
      channelId: "sayhello-demo",
      apiKey: "vc_demo",
    })

    expect(json).toContain('"url": "https://voice.example.com"')
    expect(json).toContain('"channelId": "sayhello-demo"')
    expect(json).toContain('"token": "vc_demo"')
  })

  it("builds the compact one-line connector config for custom servers", () => {
    const line = buildConnectorConfigLine({
      serverUrl: "https://voice.example.com",
      channelId: "sayhello-demo",
      apiKey: "vc_demo",
    })

    expect(line).toContain('"url":"https://voice.example.com"')
    expect(line).toContain('"channelId":"sayhello-demo"')
    expect(line).toContain('"token":"vc_demo"')
  })

  it("omits the base url when the hosted default is already implied", () => {
    const json = buildConnectorConfigJson({
      serverUrl: "https://api.voicyclaw.com",
      channelId: "sayhello-demo",
      apiKey: "vc_demo",
    })
    const line = buildConnectorConfigLine({
      serverUrl: "https://api.voicyclaw.com",
      channelId: "sayhello-demo",
      apiKey: "vc_demo",
    })

    expect(json).not.toContain('"url"')
    expect(line).not.toContain('"url"')
    expect(json).toContain('"channelId": "sayhello-demo"')
    expect(line).toContain('"channelId":"sayhello-demo"')
  })
})
