import { mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  loadProviderConfig,
  resolveDoubaoStreamTTSConfig,
} from "../apps/server/src/provider-config"

describe("provider config", () => {
  it("loads a YAML provider config file", () => {
    const cwd = mkdtempSync(
      path.join(os.tmpdir(), "voicyclaw-provider-config-"),
    )
    const filePath = path.join(cwd, "providers.local.yaml")
    writeFileSync(
      filePath,
      [
        "DoubaoStreamTTS:",
        "  type: doubao_stream",
        "  ws_url: wss://openspeech.bytedance.com/api/v3/tts/bidirection",
        "  appid: 123456",
        "  access_token: token",
        "  resource_id: volc.service_type.10029",
        "  speaker: zh_female_demo",
      ].join("\n"),
    )

    const env = {
      VOICYCLAW_PROVIDER_CONFIG: filePath,
    }

    expect(loadProviderConfig(env).DoubaoStreamTTS).toBeTruthy()
    expect(resolveDoubaoStreamTTSConfig(env)).toMatchObject({
      type: "doubao_stream",
      appid: 123456,
      access_token: "token",
      speaker: "zh_female_demo",
    })
  })
})
