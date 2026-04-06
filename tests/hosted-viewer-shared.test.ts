import { describe, expect, it } from "vitest"

import type { HostedOnboardingState } from "../apps/web/lib/hosted-onboarding-shared"
import { buildHostedViewerSummary } from "../apps/web/lib/hosted-viewer-shared"

describe("hosted viewer shared helpers", () => {
  it("builds a complete hosted viewer summary from onboarding data", () => {
    const onboarding = {
      version: 1 as const,
      workspace: {
        id: "ws-demo",
        name: "Demo Workspace",
      },
      project: {
        id: "sayhello-demo",
        name: "SayHello",
        channelId: "sayhello-demo",
        botId: "openclaw-demo",
        displayName: "SayHello Connector",
      },
      starterKey: {
        value: "vc_demo",
        label: "Starter key",
        createdAt: "2026-04-03T00:00:00.000Z",
      },
      allowance: {
        label: "Free preview allowance",
        status: "preview" as const,
        note: "Starter preview allowance is active.",
        currency: "voice-credits" as const,
        grantedCreditsMillis: 500_000,
        usedCreditsMillis: 12_500,
        remainingCreditsMillis: 487_500,
      },
      connectorConfigJson: "{}",
      connectorConfigLine: "{}",
      connectorPackageName: "@voicyclaw/voicyclaw",
      settingsNamespace: "ws-demo.sayhello-demo",
    } satisfies HostedOnboardingState

    expect(
      buildHostedViewerSummary({
        user: {
          id: "user_demo",
          fullName: "Lyshen Demo",
          username: "lyshen-demo",
          firstName: "Lyshen",
          primaryEmailAddress: {
            emailAddress: "lyshen@example.com",
          },
          emailAddresses: [],
        },
        onboarding,
      }),
    ).toEqual({
      user: {
        id: "user_demo",
        displayName: "Lyshen Demo",
        email: "lyshen@example.com",
        username: "lyshen-demo",
      },
      onboarding,
    })
  })

  it("falls back to a generic label when the user profile is sparse", () => {
    const onboarding = {
      version: 1 as const,
      workspace: {
        id: "ws-demo",
        name: "Demo Workspace",
      },
      project: {
        id: "sayhello-demo",
        name: "SayHello",
        channelId: "sayhello-demo",
        botId: "openclaw-demo",
        displayName: "SayHello Connector",
      },
      starterKey: null,
      allowance: {
        label: "Free preview allowance",
        status: "preview" as const,
        note: "Starter preview allowance is active.",
        currency: "voice-credits" as const,
        grantedCreditsMillis: 500_000,
        usedCreditsMillis: 0,
        remainingCreditsMillis: 500_000,
      },
      connectorConfigJson: null,
      connectorConfigLine: null,
      connectorPackageName: "@voicyclaw/voicyclaw",
      settingsNamespace: "ws-demo.sayhello-demo",
    } satisfies HostedOnboardingState

    expect(
      buildHostedViewerSummary({
        user: {
          id: "user_demo",
          emailAddresses: [],
        },
        onboarding,
      }).user,
    ).toEqual({
      id: "user_demo",
      displayName: "VoicyClaw user",
      email: null,
      username: null,
    })
  })
})
