import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { describe, expect, it } from "vitest";

import {
  bindVoicyClawAccount,
  buildVoicyClawConfigFix,
  buildVoicyClawMissingConfigMessage,
  buildVoicyClawSocketUrl,
  DEFAULT_VOICYCLAW_BASE_URL,
  getVoicyClawAccountName,
  resolveVoicyClawAccount,
} from "./config.js";

describe("voicyclaw config", () => {
  it("defaults to the hosted service and supports token-only hosted config", () => {
    const account = resolveVoicyClawAccount({
      channels: {
        voicyclaw: {
          token: "prod-token",
        },
      },
    } as OpenClawConfig);

    expect(account).toMatchObject({
      accountId: "default",
      url: DEFAULT_VOICYCLAW_BASE_URL,
      configured: true,
    });
    expect(account).not.toHaveProperty("binding");
  });

  it("requires a token even when hosted binding is enabled", () => {
    const account = resolveVoicyClawAccount({
      channels: {
        voicyclaw: {},
      },
    } as OpenClawConfig);

    expect(account).toMatchObject({
      configured: false,
    });
    expect(buildVoicyClawMissingConfigMessage()).toBe(
      "Missing VoicyClaw token.",
    );
    expect(buildVoicyClawConfigFix()).toBe("Set channels.voicyclaw.token.");
  });

  it("applies server binding after welcome and uses the server bot name", () => {
    const account = bindVoicyClawAccount(
      resolveVoicyClawAccount({
        channels: {
          voicyclaw: {
            token: "prod-token",
          },
        },
      } as OpenClawConfig),
      {
        channel_id: "sayhello-demo",
        bot_id: "openclaw-voicyclaw",
        bot_name: "SayHello Connector",
      },
    );

    expect(account.binding).toEqual({
      channelId: "sayhello-demo",
      botId: "openclaw-voicyclaw",
      botName: "SayHello Connector",
    });
    expect(getVoicyClawAccountName(account)).toBe("SayHello Connector");
  });

  it("normalizes the VoicyClaw connect URL onto /bot/connect", () => {
    expect(buildVoicyClawSocketUrl(undefined)).toBe(
      "wss://api.voicyclaw.com/bot/connect",
    );
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
