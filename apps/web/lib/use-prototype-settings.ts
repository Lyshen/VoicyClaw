"use client"

import { useEffect, useState } from "react"

import {
  defaultSettings,
  loadPrototypeSettings,
  type PrototypeSettings,
  persistPrototypeSettings,
} from "./prototype-settings"

export function usePrototypeSettings() {
  const [settings, setSettings] = useState<PrototypeSettings>(defaultSettings)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    const bootstrap = async () => {
      const runtimeDefaults = await loadRuntimeDefaults()
      if (!active) {
        return
      }

      setSettings(loadPrototypeSettings(runtimeDefaults))
      setReady(true)
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    persistPrototypeSettings(settings)
  }, [ready, settings])

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
  }
}

async function loadRuntimeDefaults(): Promise<Partial<PrototypeSettings>> {
  try {
    const response = await fetch("/api/runtime-config", {
      cache: "no-store",
    })
    if (!response.ok) {
      return {}
    }

    const payload = (await response.json()) as Partial<PrototypeSettings>
    return payload
  } catch {
    return {}
  }
}
