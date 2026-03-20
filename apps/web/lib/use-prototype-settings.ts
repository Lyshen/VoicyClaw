"use client"

import { useEffect, useState } from "react"

import {
  defaultSettings,
  loadPrototypeSettings,
  persistPrototypeSettings,
  type PrototypeSettings
} from "./prototype-settings"

export function usePrototypeSettings() {
  const [settings, setSettings] = useState<PrototypeSettings>(defaultSettings)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setSettings(loadPrototypeSettings())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    persistPrototypeSettings(settings)
  }, [ready, settings])

  function updateSetting<Key extends keyof PrototypeSettings>(
    key: Key,
    value: PrototypeSettings[Key]
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value
    }))
  }

  return {
    settings,
    setSettings,
    updateSetting,
    ready
  }
}
