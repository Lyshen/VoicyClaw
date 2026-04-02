"use client"

import { useEffect, useState } from "react"

import {
  defaultSettings,
  loadPrototypeSettings,
  type PrototypeSettings,
  persistPrototypeSettingsWithNamespace,
} from "./prototype-settings"
import type { RuntimeConfigPayload } from "./runtime-config"

export function usePrototypeSettings() {
  const [settings, setSettings] = useState<PrototypeSettings>(defaultSettings)
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfigPayload>({
    settingsDefaults: {
      serverUrl: defaultSettings.serverUrl,
    },
    onboarding: null,
  })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    const bootstrap = async () => {
      const nextRuntimeConfig = await loadRuntimeDefaults()
      if (!active) {
        return
      }

      setRuntimeConfig(nextRuntimeConfig)
      setSettings(
        loadPrototypeSettings(
          nextRuntimeConfig.settingsDefaults,
          nextRuntimeConfig.settingsStorageNamespace,
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
    if (!ready) return
    persistPrototypeSettingsWithNamespace(
      settings,
      runtimeConfig.settingsStorageNamespace,
    )
  }, [ready, runtimeConfig.settingsStorageNamespace, settings])

  function updateSetting<Key extends keyof PrototypeSettings>(
    key: Key,
    value: PrototypeSettings[Key],
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
    onboarding: runtimeConfig.onboarding,
  }
}

async function loadRuntimeDefaults(): Promise<RuntimeConfigPayload> {
  try {
    const response = await fetch("/api/runtime-config", {
      cache: "no-store",
    })
    if (!response.ok) {
      return {
        settingsDefaults: {},
        onboarding: null,
      }
    }

    const payload = (await response.json()) as RuntimeConfigPayload
    return payload
  } catch {
    return {
      settingsDefaults: {},
      onboarding: null,
    }
  }
}
