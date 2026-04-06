import type { OpenClawConfig } from "openclaw/plugin-sdk";

export const DEFAULT_VOICYCLAW_ACCOUNT_ID = "default";
export const DEFAULT_VOICYCLAW_BASE_URL = "https://api.voicyclaw.com";
export const DEFAULT_VOICYCLAW_CONNECTOR_NAME = "VoicyClaw Connector";
export const DEFAULT_VOICYCLAW_CONNECT_TIMEOUT_MS = 10_000;
export const DEFAULT_VOICYCLAW_RECONNECT_BACKOFF_MS = 5_000;

export type ResolvedVoicyClawBinding = {
  channelId: string;
  botId: string;
  botName?: string;
};

export type ResolvedVoicyClawAccount = {
  accountId: string;
  configured: boolean;
  url: string;
  token?: string;
  binding?: ResolvedVoicyClawBinding;
};

const voicyClawChannelProperties = {
  url: { type: "string" },
  token: { type: "string" },
} as const;

export const voicyClawChannelConfigSchema = {
  schema: {
    type: "object",
    additionalProperties: false,
    properties: voicyClawChannelProperties,
  },
  uiHints: {
    url: {
      label: "VoicyClaw Base URL",
      placeholder: DEFAULT_VOICYCLAW_BASE_URL,
    },
    token: {
      label: "VoicyClaw Token",
      sensitive: true,
    },
  },
} as const;

export function resolveVoicyClawAccount(
  cfg: OpenClawConfig,
): ResolvedVoicyClawAccount {
  const section = getVoicyClawSection(cfg);
  const url = readString(section.url) ?? DEFAULT_VOICYCLAW_BASE_URL;
  const token = readString(section.token);

  return {
    accountId: DEFAULT_VOICYCLAW_ACCOUNT_ID,
    configured: Boolean(token),
    url,
    token,
  };
}

export function bindVoicyClawAccount(
  account: ResolvedVoicyClawAccount,
  welcome: {
    channel_id: string;
    bot_id: string;
    bot_name?: string;
  },
): ResolvedVoicyClawAccount {
  const botName = welcome.bot_name?.trim();

  return {
    ...account,
    binding: {
      channelId: welcome.channel_id,
      botId: welcome.bot_id,
      ...(botName ? { botName } : {}),
    },
  };
}

export function getVoicyClawAccountName(account: ResolvedVoicyClawAccount) {
  return account.binding?.botName?.trim() || DEFAULT_VOICYCLAW_CONNECTOR_NAME;
}

export function getVoicyClawAudience(account: ResolvedVoicyClawAccount) {
  return account.binding?.channelId;
}

export function buildVoicyClawSocketUrl(input: string | undefined) {
  const raw = (input?.trim() || DEFAULT_VOICYCLAW_BASE_URL).trim();
  const withScheme = /^(wss?|https?):\/\//i.test(raw) ? raw : `http://${raw}`;
  const url = new URL(withScheme);

  if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else if (url.protocol === "https:") {
    url.protocol = "wss:";
  }

  if (!url.pathname || url.pathname === "/") {
    url.pathname = "/bot/connect";
  } else if (!url.pathname.endsWith("/bot/connect")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/bot/connect`;
  }

  url.hash = "";
  return url.toString();
}

export function buildVoicyClawMissingConfigMessage() {
  return "Missing VoicyClaw token.";
}

export function buildVoicyClawConfigFix() {
  return "Set channels.voicyclaw.token.";
}

function getVoicyClawSection(cfg: OpenClawConfig) {
  return asRecord(cfg.channels?.voicyclaw);
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
