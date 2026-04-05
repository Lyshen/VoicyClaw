import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { describe, expect, it } from "vitest";

import {
  buildVoicyClawConfigFix,
  buildVoicyClawMissingConfigMessage,
  buildVoicyClawSocketUrl,
  DEFAULT_VOICYCLAW_ACCOUNT_ID,
  DEFAULT_VOICYCLAW_BASE_URL,
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
          workspaceId: "workspace-global",
          accounts: {
            prod: {
              token: "prod-token",
              displayName: "Prod Connector",
            },
          },
        },
      },
    } as OpenClawConfig;

    expect(listVoicyClawAccountIds(cfg)).toEqual(["prod"]);
    expect(resolveVoicyClawAccount(cfg, "prod")).toMatchObject({
      accountId: "prod",
      configured: true,
      missingConfigFields: [],
      url: "https://voice.example.com",
      workspaceId: "workspace-global",
      channelId: "",
      botId: "",
      displayName: "Prod Connector",
      token: "prod-token",
    });
  });

  it("defaults to the hosted service and supports token-only hosted config", () => {
    const account = resolveVoicyClawAccount(
      {
        channels: {
          voicyclaw: {
            token: "prod-token",
          },
        },
      } as OpenClawConfig,
      "default",
    );

    expect(account).toMatchObject({
      url: DEFAULT_VOICYCLAW_BASE_URL,
      configured: true,
      channelId: "",
      botId: "",
      missingConfigFields: [],
    });
    expect(
      buildVoicyClawMissingConfigMessage(account.missingConfigFields),
    ).toBe("VoicyClaw connector config is complete.");
    expect(
      buildVoicyClawConfigFix(account.accountId, account.missingConfigFields),
    ).toBe("No connector config changes are required.");
  });

  it("requires a token even when hosted binding is enabled", () => {
    const account = resolveVoicyClawAccount(
      {
        channels: {
          voicyclaw: {},
        },
      } as OpenClawConfig,
      "default",
    );

    expect(account).toMatchObject({
      configured: false,
      missingConfigFields: ["token"],
      channelId: "",
      botId: "",
    });
    expect(
      buildVoicyClawMissingConfigMessage(account.missingConfigFields),
    ).toBe("Missing VoicyClaw token.");
    expect(
      buildVoicyClawConfigFix(account.accountId, account.missingConfigFields),
    ).toBe("Set channels.voicyclaw.token.");
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
