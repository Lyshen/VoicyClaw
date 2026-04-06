"use client"

import { useCallback, useEffect, useState } from "react"

import type { HostedOnboardingState } from "./hosted-onboarding-shared"
import type { StudioSettings } from "./studio-settings"
import { buildApiUrl, normalizeServerUrl } from "./studio-settings"

type UseSettingsStudioStateArgs = {
  settings: StudioSettings
  onboarding: HostedOnboardingState | null
}

export function useSettingsStudioState({
  settings,
  onboarding,
}: UseSettingsStudioStateArgs) {
  const [serverStatus, setServerStatus] = useState("Checking server...")
  const [starterProjectStatus, setStarterProjectStatus] = useState(
    "Checking starter project...",
  )
  const [starterBotOnline, setStarterBotOnline] = useState<boolean | null>(null)
  const [issuedKey, setIssuedKey] = useState("")
  const [keyMessage, setKeyMessage] = useState(
    "Issue a platform key here to test external ClawBots.",
  )

  useEffect(() => {
    void fetchServerStatus(settings, setServerStatus)
  }, [settings.serverUrl])

  useEffect(() => {
    if (!onboarding) {
      return
    }

    void fetchStarterProjectStatus(
      settings,
      onboarding,
      setStarterBotOnline,
      setStarterProjectStatus,
    )
  }, [onboarding, settings.serverUrl])

  const issueKey = useCallback(async () => {
    setKeyMessage("Issuing a fresh platform key...")

    try {
      const response = await fetch(buildApiUrl(settings, "/api/keys"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          channelId: settings.channelId,
          label: "Settings panel",
        }),
      })

      if (!response.ok) {
        throw new Error(`keys ${response.status}`)
      }

      const payload = (await response.json()) as {
        apiKey: string
        wsUrl: string
      }

      setIssuedKey(payload.apiKey)
      setKeyMessage(
        `Key ready. Connect a bot to ${payload.wsUrl} using the OpenClaw HELLO handshake.`,
      )
    } catch {
      setKeyMessage(
        "Could not create a platform key. Make sure the server is running and try again.",
      )
    }
  }, [settings.channelId, settings.serverUrl])

  return {
    serverStatus,
    starterProjectStatus,
    starterBotOnline,
    issuedKey,
    keyMessage,
    issueKey,
  }
}

async function fetchServerStatus(
  settings: StudioSettings,
  setServerStatus: (value: string) => void,
) {
  try {
    const response = await fetch(buildApiUrl(settings, "/api/health"))
    if (!response.ok) {
      throw new Error(`health ${response.status}`)
    }

    const payload = (await response.json()) as {
      protocolVersion: string
      connectedBots: number
      connectedClients: number
    }

    setServerStatus(
      `Connected to ${normalizeServerUrl(settings.serverUrl)} · protocol ${payload.protocolVersion} · ${payload.connectedBots} bot / ${payload.connectedClients} client`,
    )
  } catch {
    setServerStatus(
      "Server is unreachable right now. Confirm the server URL and make sure the backend is running.",
    )
  }
}

async function fetchStarterProjectStatus(
  settings: StudioSettings,
  onboarding: HostedOnboardingState,
  setStarterBotOnline: (value: boolean | null) => void,
  setStarterProjectStatus: (value: string) => void,
) {
  try {
    const response = await fetch(
      buildApiUrl(settings, `/api/channels/${onboarding.project.channelId}`),
    )
    if (!response.ok) {
      throw new Error(`channel ${response.status}`)
    }

    const payload = (await response.json()) as {
      botCount: number
      clientCount: number
    }

    setStarterBotOnline(payload.botCount > 0)
    setStarterProjectStatus(
      `${payload.botCount} bot / ${payload.clientCount} client on ${onboarding.project.channelId}`,
    )
  } catch {
    setStarterBotOnline(null)
    setStarterProjectStatus(
      "Starter project status is unavailable right now. The setup data is still ready.",
    )
  }
}
