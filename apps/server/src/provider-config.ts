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
  style?: string
  style_degree?: string | number
  role?: string
  rate?: string
  pitch?: string
  volume?: string
}

type AzureSpeechStreamingTTSConfig = {
  type?: string
  endpoint?: string
  region?: string
  api_key?: string
  voice?: string
  sample_rate?: string | number
  style?: string
  style_degree?: string | number
  role?: string
  rate?: string
  pitch?: string
  volume?: string
  flush_timeout_ms?: string | number
  max_chunk_characters?: string | number
}

type GoogleCloudTTSConfig = {
  type?: string
  endpoint?: string
  service_account_json?: string
  service_account_file?: string
  voice?: string
  sample_rate?: string | number
  speaking_rate?: string | number
}

type GoogleCloudBatchedTTSConfig = {
  type?: string
  endpoint?: string
  service_account_json?: string
  service_account_file?: string
  voice?: string
  sample_rate?: string | number
  speaking_rate?: string | number
  pitch?: string | number
  flush_timeout_ms?: string | number
  max_chunk_characters?: string | number
}

type TencentCloudTTSConfig = {
  type?: string
  endpoint?: string
  app_id?: string | number
  secret_id?: string
  secret_key?: string
  voice_type?: string | number
  fast_voice_type?: string
  sample_rate?: string | number
  codec?: string
  speed?: string | number
  volume?: string | number
  enable_subtitle?: string | boolean
  emotion_category?: string
  emotion_intensity?: string | number
  segment_rate?: string | number
}

type TencentCloudStreamingTTSConfig = {
  type?: string
  endpoint?: string
  app_id?: string | number
  secret_id?: string
  secret_key?: string
  voice_type?: string | number
  fast_voice_type?: string
  sample_rate?: string | number
  codec?: string
  speed?: string | number
  volume?: string | number
  enable_subtitle?: string | boolean
}

type DoubaoStreamTTSConfig = {
  type?: string
  ws_url?: string
  appid?: string | number
  access_token?: string
  model?: string
  resource_id?: string
  speaker?: string
  sample_rate?: string | number
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

export function resolveAzureSpeechStreamingTTSConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  const config = loadProviderConfig(env).AzureSpeechStreamingTTS

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null
  }

  return config as AzureSpeechStreamingTTSConfig
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

export function resolveGoogleCloudBatchedTTSConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  const config = loadProviderConfig(env).GoogleCloudBatchedTTS

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null
  }

  return config as GoogleCloudBatchedTTSConfig
}

export function resolveTencentCloudTTSConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  const config = loadProviderConfig(env).TencentCloudTTS

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null
  }

  return config as TencentCloudTTSConfig
}

export function resolveTencentCloudStreamingTTSConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  const config = loadProviderConfig(env).TencentCloudStreamingTTS

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null
  }

  return config as TencentCloudStreamingTTSConfig
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
