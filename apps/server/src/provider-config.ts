import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { parse } from "yaml"

type RawProviderConfig = Record<string, unknown>

type DoubaoStreamTTSConfig = {
  type?: string
  ws_url?: string
  appid?: string | number
  access_token?: string
  resource_id?: string
  speaker?: string
  sample_rate?: string | number
}

export function loadProviderConfig(
  env: NodeJS.ProcessEnv = process.env,
): RawProviderConfig {
  const filePath = resolveProviderConfigPath(env)

  if (!filePath || !existsSync(filePath)) {
    return {}
  }

  const raw = readFileSync(filePath, "utf8")
  const parsed = parse(raw)

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Provider config at ${filePath} must be a YAML object`)
  }

  return parsed as RawProviderConfig
}

export function resolveDoubaoStreamTTSConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  const config = loadProviderConfig(env).DoubaoStreamTTS

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null
  }

  return config as DoubaoStreamTTSConfig
}

function resolveProviderConfigPath(env: NodeJS.ProcessEnv) {
  const configured = env.VOICYCLAW_PROVIDER_CONFIG?.trim()
  const candidate = configured || "config/providers.local.yaml"

  if (!candidate) {
    return null
  }

  return path.resolve(process.cwd(), candidate)
}
