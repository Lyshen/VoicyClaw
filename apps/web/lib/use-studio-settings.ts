"use client"

import { useCallback, useEffect, useState } from "react"

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

export function useStudioSettings(
  initialRuntime: WebRuntimePayload = defaultRuntimePayload,
) {
  const [runtime] = useState<WebRuntimePayload>(initialRuntime)
  const [settings, setSettings] = useState<StudioSettings>(() =>
    buildRuntimeDefaults(initialRuntime),
  )
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setSettings(
      loadStudioSettings(runtime.initialSettings, runtime.settingsNamespace),
    )
    setHydrated(true)
  }, [runtime.initialSettings, runtime.settingsNamespace])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    persistStudioSettings(settings, runtime.settingsNamespace)
  }, [hydrated, runtime.settingsNamespace, settings])

  const updateSetting = useCallback(
    <Key extends keyof StudioSettings>(
      key: Key,
      value: StudioSettings[Key],
    ) => {
      setSettings((current) => {
        if (current[key] === value) {
          return current
        }

        return {
          ...current,
          [key]: value,
        }
      })
    },
    [],
  )

  return {
    settings,
    setSettings,
    updateSetting,
    onboarding: runtime.onboarding,
  }
}

function buildRuntimeDefaults(runtime: WebRuntimePayload): StudioSettings {
  return {
    ...defaultStudioSettings,
    ...runtime.initialSettings,
  }
}
