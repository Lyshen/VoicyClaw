import { mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  buildRuntimeEnvironment,
  loadProviderConfig,
  loadVoicyClawConfig,
  resolveAppConfig,
  resolveAuthConfig,
  resolveDemoBotConfig,
  resolveStorageConfig,
} from "@voicyclaw/config"
import { describe, expect, it } from "vitest"

describe("unified config package", () => {
  it("loads a single yaml file with runtime and provider sections", () => {
    const cwd = mkdtempSync(path.join(os.tmpdir(), "voicyclaw-config-"))
    const filePath = path.join(cwd, "voicyclaw.local.yaml")
    writeFileSync(
      filePath,
      [
        "App:",
        "  server_port: 4301",
        "  web_port: 4300",
        "  public_server_url: https://voice.example.com",
        "  default_channel_id: launch-room",
        "  default_channel_name: Launch Room",
        "",
        "Auth:",
        "  mode: clerk",
        "  clerk_publishable_key: pk_live_example",
        "  clerk_secret_key: sk_live_example",
        "",
        "Storage:",
        "  driver: mysql",
        "  mysql_url: mysql://root:secret@127.0.0.1:3306/voice",
        "  mysql_pool_size: 24",
        "",
        "DemoBot:",
        "  channel_id: launch-room",
        "  bot_id: launch-bot",
        "  bot_name: Launch Bot",
        "",
        "GoogleCloudTTS:",
        "  voice: en-US-Chirp3-HD-Leda",
      ].join("\n"),
    )

    const env = {
      VOICYCLAW_CONFIG: filePath,
    }

    expect(loadVoicyClawConfig(env).App).toBeTruthy()
    expect(loadProviderConfig(env)).toEqual({
      GoogleCloudTTS: {
        voice: "en-US-Chirp3-HD-Leda",
      },
    })
    expect(resolveAppConfig(env)).toEqual({
      serverPort: 4301,
      webPort: 4300,
      publicServerUrl: "https://voice.example.com",
      publicServerPort: 4301,
      serverUrl: "http://127.0.0.1:4301",
      defaultChannelId: "launch-room",
      defaultChannelName: "Launch Room",
    })
    expect(resolveAuthConfig(env)).toEqual({
      requestedMode: "clerk",
      resolvedMode: "clerk",
      clerkPublishableKey: "pk_live_example",
      clerkSecretKey: "sk_live_example",
    })
    expect(resolveStorageConfig(env)).toEqual({
      driver: "mysql",
      sqliteFile: path.resolve(process.cwd(), ".data", "voicyclaw.sqlite"),
      mysqlUrl: "mysql://root:secret@127.0.0.1:3306/voice",
      mysqlPoolSize: 24,
    })
    expect(resolveDemoBotConfig(env)).toEqual({
      serverUrl: "http://127.0.0.1:4301",
      channelId: "launch-room",
      botId: "launch-bot",
      botName: "Launch Bot",
      botApiKey: null,
    })
  })

  it("builds process env from the unified yaml file", () => {
    const cwd = mkdtempSync(path.join(os.tmpdir(), "voicyclaw-runtime-env-"))
    const filePath = path.join(cwd, "voicyclaw.local.yaml")
    writeFileSync(
      filePath,
      [
        "App:",
        "  server_port: 5301",
        "  web_port: 5300",
        "  public_server_url: https://voice.example.com",
        "",
        "Auth:",
        "  mode: clerk",
        "  clerk_publishable_key: pk_live_example",
        "  clerk_secret_key: sk_live_example",
        "",
        "Storage:",
        "  driver: mysql",
        "  mysql_url: mysql://root:secret@127.0.0.1:3306/voice",
        "  mysql_pool_size: 24",
        "",
        "DemoBot:",
        "  channel_id: launch-room",
        "  bot_id: launch-bot",
        "  bot_name: Launch Bot",
      ].join("\n"),
    )

    const runtimeEnv = buildRuntimeEnvironment({
      VOICYCLAW_CONFIG: filePath,
    })

    expect(runtimeEnv.VOICYCLAW_CONFIG).toBe(filePath)
    expect(runtimeEnv.VOICYCLAW_SERVER_PORT).toBe("5301")
    expect(runtimeEnv.VOICYCLAW_WEB_PORT).toBe("5300")
    expect(runtimeEnv.NEXT_PUBLIC_VOICYCLAW_AUTH_MODE).toBe("clerk")
    expect(runtimeEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toBe("pk_live_example")
    expect(runtimeEnv.CLERK_SECRET_KEY).toBe("sk_live_example")
    expect(runtimeEnv.VOICYCLAW_STORAGE_DRIVER).toBe("mysql")
    expect(runtimeEnv.VOICYCLAW_MYSQL_URL).toBe(
      "mysql://root:secret@127.0.0.1:3306/voice",
    )
    expect(runtimeEnv.VOICYCLAW_MYSQL_POOL_SIZE).toBe("24")
    expect(runtimeEnv.CHANNEL_ID).toBe("launch-room")
    expect(runtimeEnv.BOT_ID).toBe("launch-bot")
    expect(runtimeEnv.BOT_NAME).toBe("Launch Bot")
  })
})
