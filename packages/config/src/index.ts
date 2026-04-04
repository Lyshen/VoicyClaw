import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { parse } from "yaml"

export type RawVoicyClawConfig = Record<string, unknown>

type AppConfigSection = {
  server_port?: string | number
  web_port?: string | number
  public_server_url?: string
  public_server_port?: string | number
  server_url?: string
  default_channel_id?: string
  default_channel_name?: string
}

type AuthConfigSection = {
  mode?: string
  clerk_publishable_key?: string
  clerk_secret_key?: string
}

type StorageConfigSection = {
  driver?: string
  sqlite_file?: string
  mysql_url?: string
  mysql_pool_size?: string | number
}

type DemoBotConfigSection = {
  server_url?: string
  channel_id?: string
  bot_id?: string
  bot_name?: string
  bot_api_key?: string
}

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

const DEFAULT_UNIFIED_CONFIG_RELATIVE_PATHS = [
  "config/voicyclaw.local.yaml",
  "config/voicyclaw.local.yml",
]

const RESERVED_TOP_LEVEL_KEYS = new Set(["App", "Auth", "Storage", "DemoBot"])

const DEFAULT_SERVER_PORT = 3001
const DEFAULT_WEB_PORT = 3000
const DEFAULT_MYSQL_POOL_SIZE = 10
const DEFAULT_CHANNEL_ID = "demo-room"
const DEFAULT_CHANNEL_NAME = "Demo Room"
const DEFAULT_BOT_ID = "demo-clawbot"
const DEFAULT_BOT_NAME = "Studio Claw"

export type AuthMode = "local" | "clerk"
export type StorageDriver = "sqlite" | "mysql"

export type ResolvedAppConfig = {
  serverPort: number
  webPort: number
  publicServerUrl: string | null
  publicServerPort: number
  serverUrl: string
  defaultChannelId: string
  defaultChannelName: string
}

export type ResolvedAuthConfig = {
  requestedMode: AuthMode
  resolvedMode: AuthMode
  clerkPublishableKey: string | null
  clerkSecretKey: string | null
}

export type ResolvedStorageConfig = {
  driver: StorageDriver
  sqliteFile: string
  mysqlUrl: string | null
  mysqlPoolSize: number
}

export type ResolvedDemoBotConfig = {
  serverUrl: string
  channelId: string
  botId: string
  botName: string
  botApiKey: string | null
}

export function loadVoicyClawConfig(
  env: NodeJS.ProcessEnv = process.env,
): RawVoicyClawConfig {
  const filePath = resolveVoicyClawConfigPath(env)

  if (!filePath || !existsSync(filePath)) {
    return {}
  }

  const raw = readFileSync(filePath, "utf8")
  const parsed = parse(raw)

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`VoicyClaw config at ${filePath} must be a YAML object`)
  }

  return parsed as RawVoicyClawConfig
}

export function loadProviderConfig(
  env: NodeJS.ProcessEnv = process.env,
): RawVoicyClawConfig {
  return Object.fromEntries(
    Object.entries(loadVoicyClawConfig(env)).filter(
      ([key]) => !RESERVED_TOP_LEVEL_KEYS.has(key),
    ),
  )
}

export function resolveVoicyClawConfigPath(
  env: NodeJS.ProcessEnv = process.env,
) {
  const configured = resolveConfiguredConfigPath(env)
  if (configured) {
    return configured
  }

  if (shouldAutoloadUnifiedConfig(env)) {
    return resolveDefaultUnifiedConfigPath()
  }

  return null
}

export function resolveAppConfig(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedAppConfig {
  const section = getSection<AppConfigSection>(loadVoicyClawConfig(env), "App")
  const serverPort =
    toNumber(env.PORT) ??
    toNumber(env.VOICYCLAW_SERVER_PORT) ??
    toNumber(section?.server_port) ??
    DEFAULT_SERVER_PORT
  const webPort =
    toNumber(env.VOICYCLAW_WEB_PORT) ??
    toNumber(section?.web_port) ??
    DEFAULT_WEB_PORT
  const publicServerUrl =
    readString(env.VOICYCLAW_PUBLIC_SERVER_URL) ??
    readString(env.NEXT_PUBLIC_VOICYCLAW_SERVER_URL) ??
    readString(section?.public_server_url) ??
    null
  const publicServerPort =
    toNumber(env.VOICYCLAW_PUBLIC_SERVER_PORT) ??
    toNumber(section?.public_server_port) ??
    serverPort
  const serverUrl =
    readString(env.VOICYCLAW_SERVER_URL) ??
    readString(section?.server_url) ??
    `http://127.0.0.1:${serverPort}`
  const defaultChannelId =
    readString(section?.default_channel_id) ?? DEFAULT_CHANNEL_ID
  const defaultChannelName =
    readString(section?.default_channel_name) ?? DEFAULT_CHANNEL_NAME

  return {
    serverPort,
    webPort,
    publicServerUrl,
    publicServerPort,
    serverUrl,
    defaultChannelId,
    defaultChannelName,
  }
}

export function resolveAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedAuthConfig {
  const section = getSection<AuthConfigSection>(
    loadVoicyClawConfig(env),
    "Auth",
  )
  const requestedMode =
    readString(env.NEXT_PUBLIC_VOICYCLAW_AUTH_MODE) === "clerk" ||
    readString(section?.mode) === "clerk"
      ? "clerk"
      : "local"
  const clerkPublishableKey =
    readString(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) ??
    readString(section?.clerk_publishable_key) ??
    null
  const clerkSecretKey =
    readString(env.CLERK_SECRET_KEY) ??
    readString(section?.clerk_secret_key) ??
    null
  const resolvedMode =
    requestedMode === "clerk" && clerkPublishableKey && clerkSecretKey
      ? "clerk"
      : "local"

  return {
    requestedMode,
    resolvedMode,
    clerkPublishableKey,
    clerkSecretKey,
  }
}

export function resolveStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedStorageConfig {
  const section = getSection<StorageConfigSection>(
    loadVoicyClawConfig(env),
    "Storage",
  )
  const mysqlUrl =
    readString(env.VOICYCLAW_MYSQL_URL) ??
    readString(section?.mysql_url) ??
    null
  const explicitDriver =
    readString(env.VOICYCLAW_STORAGE_DRIVER) ??
    readString(section?.driver) ??
    null
  const driver =
    explicitDriver === "mysql" || explicitDriver === "sqlite"
      ? explicitDriver
      : mysqlUrl
        ? "mysql"
        : "sqlite"
  const sqliteFile =
    readString(env.VOICYCLAW_SQLITE_FILE) ??
    readString(section?.sqlite_file) ??
    path.resolve(process.cwd(), ".data", "voicyclaw.sqlite")
  const mysqlPoolSize =
    toNumber(env.VOICYCLAW_MYSQL_POOL_SIZE) ??
    toNumber(section?.mysql_pool_size) ??
    DEFAULT_MYSQL_POOL_SIZE

  return {
    driver,
    sqliteFile,
    mysqlUrl,
    mysqlPoolSize,
  }
}

export function resolveDemoBotConfig(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedDemoBotConfig {
  const section = getSection<DemoBotConfigSection>(
    loadVoicyClawConfig(env),
    "DemoBot",
  )
  const app = resolveAppConfig(env)

  return {
    serverUrl:
      readString(env.VOICYCLAW_SERVER_URL) ??
      readString(section?.server_url) ??
      app.serverUrl,
    channelId:
      readString(env.CHANNEL_ID) ??
      readString(section?.channel_id) ??
      app.defaultChannelId,
    botId:
      readString(env.BOT_ID) ?? readString(section?.bot_id) ?? DEFAULT_BOT_ID,
    botName:
      readString(env.BOT_NAME) ??
      readString(section?.bot_name) ??
      DEFAULT_BOT_NAME,
    botApiKey:
      readString(env.BOT_API_KEY) ?? readString(section?.bot_api_key) ?? null,
  }
}

export function buildRuntimeEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const configPath = resolveVoicyClawConfigPath(env)
  const runtimeEnv = {
    ...env,
    ...(configPath ? { VOICYCLAW_CONFIG: configPath } : {}),
  }
  const app = resolveAppConfig(runtimeEnv)
  const auth = resolveAuthConfig(runtimeEnv)
  const storage = resolveStorageConfig(runtimeEnv)
  const demoBot = resolveDemoBotConfig(runtimeEnv)

  return {
    ...runtimeEnv,
    VOICYCLAW_SERVER_PORT: String(app.serverPort),
    VOICYCLAW_WEB_PORT: String(app.webPort),
    VOICYCLAW_SERVER_URL: demoBot.serverUrl,
    ...(app.publicServerUrl
      ? {
          VOICYCLAW_PUBLIC_SERVER_URL: app.publicServerUrl,
          NEXT_PUBLIC_VOICYCLAW_SERVER_URL: app.publicServerUrl,
        }
      : {
          VOICYCLAW_PUBLIC_SERVER_URL: env.VOICYCLAW_PUBLIC_SERVER_URL ?? "",
          NEXT_PUBLIC_VOICYCLAW_SERVER_URL:
            env.NEXT_PUBLIC_VOICYCLAW_SERVER_URL ?? "",
        }),
    VOICYCLAW_PUBLIC_SERVER_PORT: String(app.publicServerPort),
    NEXT_PUBLIC_VOICYCLAW_AUTH_MODE: auth.requestedMode,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: auth.clerkPublishableKey ?? "",
    CLERK_SECRET_KEY: auth.clerkSecretKey ?? "",
    VOICYCLAW_STORAGE_DRIVER: storage.driver,
    VOICYCLAW_SQLITE_FILE: storage.sqliteFile,
    VOICYCLAW_MYSQL_URL: storage.mysqlUrl ?? "",
    VOICYCLAW_MYSQL_POOL_SIZE: String(storage.mysqlPoolSize),
    CHANNEL_ID: demoBot.channelId,
    BOT_ID: demoBot.botId,
    BOT_NAME: demoBot.botName,
    BOT_API_KEY: demoBot.botApiKey ?? "",
  }
}

export function resolveDefaultUnifiedConfigPath() {
  return findFirstExistingPath(DEFAULT_UNIFIED_CONFIG_RELATIVE_PATHS)
}

export function resolveAzureSpeechTTSConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  return getProviderSection<AzureSpeechTTSConfig>(env, "AzureSpeechTTS")
}

export function resolveAzureSpeechStreamingTTSConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  return getProviderSection<AzureSpeechStreamingTTSConfig>(
    env,
    "AzureSpeechStreamingTTS",
  )
}

export function resolveGoogleCloudTTSConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  return getProviderSection<GoogleCloudTTSConfig>(env, "GoogleCloudTTS")
}

export function resolveGoogleCloudBatchedTTSConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  return getProviderSection<GoogleCloudBatchedTTSConfig>(
    env,
    "GoogleCloudBatchedTTS",
  )
}

export function resolveTencentCloudTTSConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  return getProviderSection<TencentCloudTTSConfig>(env, "TencentCloudTTS")
}

export function resolveTencentCloudStreamingTTSConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  return getProviderSection<TencentCloudStreamingTTSConfig>(
    env,
    "TencentCloudStreamingTTS",
  )
}

export function resolveDoubaoStreamTTSConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  return getProviderSection<DoubaoStreamTTSConfig>(env, "DoubaoStreamTTS")
}

function getProviderSection<T>(env: NodeJS.ProcessEnv, key: string): T | null {
  const config = loadProviderConfig(env)[key]

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null
  }

  return config as T
}

function getSection<T>(config: RawVoicyClawConfig, key: string): T | null {
  const value = config[key]

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as T
}

function readString(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
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

function findFirstExistingPath(
  relativePaths: string[],
  startDir = process.cwd(),
) {
  for (const relativePath of relativePaths) {
    const found = findPathUpwards(relativePath, startDir)
    if (found) {
      return found
    }
  }

  return null
}

function resolveConfiguredConfigPath(env: NodeJS.ProcessEnv) {
  const configured = readString(env.VOICYCLAW_CONFIG)

  if (!configured) {
    return null
  }

  if (path.isAbsolute(configured)) {
    return configured
  }

  return (
    findPathUpwards(configured, process.cwd()) ??
    path.resolve(process.cwd(), configured)
  )
}

function shouldAutoloadUnifiedConfig(env: NodeJS.ProcessEnv) {
  return !isTestEnvironment(env)
}

function isTestEnvironment(env: NodeJS.ProcessEnv) {
  const vitestFlag = readString(env.VITEST) ?? readString(process.env.VITEST)
  const nodeEnv = readString(env.NODE_ENV) ?? readString(process.env.NODE_ENV)

  return Boolean(vitestFlag) || nodeEnv === "test"
}
