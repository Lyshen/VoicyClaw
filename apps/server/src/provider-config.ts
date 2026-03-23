import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { parse } from "yaml"

type RawProviderConfig = Record<string, unknown>

type AzureSpeechTTSConfig = {
  type?: string
  endpoint?: string
  region?: string
  api_key?: string
  voice?: string
  sample_rate?: string | number
}

type GoogleCloudTTSConfig = {
  type?: string
  endpoint?: string
  access_token?: string
  api_key?: string
  service_account_json?: string
  service_account_file?: string
  voice?: string
  sample_rate?: string | number
  speaking_rate?: string | number
  pitch?: string | number
}

const DEFAULT_PROVIDER_CONFIG_RELATIVE_PATHS = [
  "config/providers.local.yaml",
  "config/providers.local.yml",
]
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))

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

export function resolveAzureSpeechTTSConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  const config = loadProviderConfig(env).AzureSpeechTTS

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null
  }

  return config as AzureSpeechTTSConfig
}

export function resolveGoogleCloudTTSConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  const config = loadProviderConfig(env).GoogleCloudTTS

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null
  }

  return config as GoogleCloudTTSConfig
}

function resolveProviderConfigPath(env: NodeJS.ProcessEnv) {
  const configured = env.VOICYCLAW_PROVIDER_CONFIG?.trim()
  if (configured) {
    if (path.isAbsolute(configured)) {
      return configured
    }

    return (
      findPathUpwards(configured, process.cwd()) ??
      findPathUpwards(configured, MODULE_DIR) ??
      path.resolve(process.cwd(), configured)
    )
  }

  for (const relativePath of DEFAULT_PROVIDER_CONFIG_RELATIVE_PATHS) {
    const found =
      findPathUpwards(relativePath, process.cwd()) ??
      findPathUpwards(relativePath, MODULE_DIR)

    if (found) {
      return found
    }
  }

  return null
}

function findPathUpwards(relativePath: string, startDir: string) {
  let current = path.resolve(startDir)

  while (true) {
    const candidate = path.join(current, relativePath)
    if (existsSync(candidate)) {
      return candidate
    }

    const parent = path.dirname(current)
    if (parent === current) {
      return null
    }

    current = parent
  }
}
