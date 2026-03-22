import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { describe, expect, it } from "vitest";

import {
  buildVoicyClawSocketUrl,
  DEFAULT_VOICYCLAW_ACCOUNT_ID,
  listVoicyClawAccountIds,
  resolveVoicyClawAccount,
} from "./config.js";

describe("voicyclaw config", () => {
  it("returns the default account when no accounts are configured", () => {
    const cfg = { channels: {} } as OpenClawConfig;

    expect(listVoicyClawAccountIds(cfg)).toEqual([
      DEFAULT_VOICYCLAW_ACCOUNT_ID,
    ]);
  });

  it("merges top-level defaults with account-specific overrides", () => {
    const cfg = {
      channels: {
        voicyclaw: {
          url: "https://voice.example.com",
          channelId: "global-room",
          accounts: {
            prod: {
              token: "prod-token",
              channelId: "prod-room",
              botId: "prod-bot",
            },
          },
        },
      },
    } as OpenClawConfig;

    expect(listVoicyClawAccountIds(cfg)).toEqual(["prod"]);
    expect(resolveVoicyClawAccount(cfg, "prod")).toMatchObject({
      accountId: "prod",
      configured: true,
      url: "https://voice.example.com",
      channelId: "prod-room",
      botId: "prod-bot",
      token: "prod-token",
    });
  });

  it("normalizes the VoicyClaw connect URL onto /bot/connect", () => {
    expect(buildVoicyClawSocketUrl("https://voice.example.com")).toBe(
      "wss://voice.example.com/bot/connect",
    );
    expect(buildVoicyClawSocketUrl("ws://127.0.0.1:3001/custom")).toBe(
      "ws://127.0.0.1:3001/custom/bot/connect",
    );
    expect(buildVoicyClawSocketUrl("http://127.0.0.1:3001/bot/connect")).toBe(
      "ws://127.0.0.1:3001/bot/connect",
    );
  });
});
