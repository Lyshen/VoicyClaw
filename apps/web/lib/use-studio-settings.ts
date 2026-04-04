"use client"

import { useEffect, useState } from "react"

import {
  defaultStudioSettings,
  loadStudioSettings,
  persistStudioSettings,
  type StudioSettings,
} from "./studio-settings"
import type { WebRuntimePayload } from "./web-runtime"

const defaultRuntimePayload: WebRuntimePayload = {
  initialSettings: {
    serverUrl: defaultStudioSettings.serverUrl,
  },
  onboarding: null,
}

export function useStudioSettings() {
  const [settings, setSettings] = useState<StudioSettings>(
    defaultStudioSettings,
  )
  const [runtime, setRuntime] = useState<WebRuntimePayload>(
    defaultRuntimePayload,
  )
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    const bootstrap = async () => {
      const nextRuntime = await loadWebRuntimePayload()
      if (!active) {
        return
      }

      setRuntime(nextRuntime)
      setSettings(
        loadStudioSettings(
          nextRuntime.initialSettings,
          nextRuntime.settingsNamespace,
        ),
      )
      setReady(true)
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!ready) {
      return
    }

    persistStudioSettings(settings, runtime.settingsNamespace)
  }, [ready, runtime.settingsNamespace, settings])

  function updateSetting<Key extends keyof StudioSettings>(
    key: Key,
    value: StudioSettings[Key],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }))
  }

  return {
    settings,
    setSettings,
    updateSetting,
    ready,
    onboarding: runtime.onboarding,
  }
}

async function loadWebRuntimePayload(): Promise<WebRuntimePayload> {
  try {
    const response = await fetch("/api/runtime-config", {
      cache: "no-store",
    })
    if (!response.ok) {
      return defaultRuntimePayload
    }

    return (await response.json()) as WebRuntimePayload
  } catch {
    return defaultRuntimePayload
  }
}
