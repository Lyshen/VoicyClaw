import type { OpenClawConfig } from "openclaw/plugin-sdk";

export const DEFAULT_VOICYCLAW_ACCOUNT_ID = "default";
export const DEFAULT_VOICYCLAW_BASE_URL = "http://127.0.0.1:3001";
export const DEFAULT_VOICYCLAW_CHANNEL_ID = "default";
export const DEFAULT_VOICYCLAW_BOT_ID = "openclaw-voicyclaw";
export const DEFAULT_VOICYCLAW_DISPLAY_NAME = "VoicyClaw Connector";
export const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
export const DEFAULT_RECONNECT_BACKOFF_MS = 5_000;
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 25_000;

export type VoicyClawAccountConfig = {
  enabled?: boolean;
  url?: string;
  token?: string;
  workspaceId?: string;
  channelId?: string;
  botId?: string;
  displayName?: string;
  connectTimeoutMs?: number;
  reconnectBackoffMs?: number;
  heartbeatIntervalMs?: number;
  devEchoReplies?: boolean;
};

export type ResolvedVoicyClawAccount = {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  url: string;
  token?: string;
  workspaceId?: string;
  channelId: string;
  botId: string;
  displayName: string;
  connectTimeoutMs: number;
  reconnectBackoffMs: number;
  heartbeatIntervalMs: number;
  devEchoReplies: boolean;
  config: VoicyClawAccountConfig;
};

const voicyClawAccountProperties = {
  enabled: { type: "boolean" },
  url: { type: "string" },
  token: { type: "string" },
  workspaceId: { type: "string" },
  channelId: { type: "string" },
  botId: { type: "string" },
  displayName: { type: "string" },
  connectTimeoutMs: { type: "integer", minimum: 1000 },
  reconnectBackoffMs: { type: "integer", minimum: 500 },
  heartbeatIntervalMs: { type: "integer", minimum: 1000 },
  devEchoReplies: { type: "boolean" },
} as const;

const voicyClawAccountSchema = {
  type: "object",
  additionalProperties: false,
  properties: voicyClawAccountProperties,
} as const;

export const voicyClawChannelConfigSchema = {
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      ...voicyClawAccountProperties,
      accounts: {
        type: "object",
        additionalProperties: voicyClawAccountSchema,
      },
    },
  },
  uiHints: {
    enabled: {
      label: "Enabled",
    },
    url: {
      label: "VoicyClaw Base URL",
      placeholder: "https://voice.example.com",
    },
    token: {
      label: "VoicyClaw Token",
      sensitive: true,
    },
    workspaceId: {
      label: "Workspace ID",
      advanced: true,
    },
    channelId: {
      label: "Room / Channel ID",
    },
    botId: {
      label: "Bot ID",
    },
    displayName: {
      label: "Display Name",
    },
    connectTimeoutMs: {
      label: "Connect Timeout (ms)",
      advanced: true,
    },
    reconnectBackoffMs: {
      label: "Reconnect Backoff (ms)",
      advanced: true,
    },
    heartbeatIntervalMs: {
      label: "Heartbeat Interval (ms)",
      advanced: true,
    },
    devEchoReplies: {
      label: "Dev Echo Replies",
      help: "Only for transport smoke tests before real agent dispatch is wired.",
      advanced: true,
    },
    accounts: {
      label: "Accounts",
      advanced: true,
    },
  },
} as const;

export function listVoicyClawAccountIds(cfg: OpenClawConfig) {
  const section = getVoicyClawSection(cfg);
  const accounts = asRecord(section.accounts);
  const accountIds = Object.keys(accounts ?? {}).filter((entry) =>
    entry.trim(),
  );

  if (accountIds.length > 0) {
    return accountIds.sort();
  }

  return [DEFAULT_VOICYCLAW_ACCOUNT_ID];
}

export function resolveVoicyClawAccount(
  cfg: OpenClawConfig,
  accountId?: string | null,
): ResolvedVoicyClawAccount {
  const normalizedAccountId = normalizeAccountId(accountId);
  const section = getVoicyClawSection(cfg);
  const baseConfig = omitAccounts(section);
  const accountConfig = getVoicyClawAccountOverrides(
    section,
    normalizedAccountId,
  );
  const mergedConfig = {
    ...baseConfig,
    ...accountConfig,
  };

  const enabled = readBoolean(mergedConfig.enabled, true);
  const url = readString(mergedConfig.url) ?? DEFAULT_VOICYCLAW_BASE_URL;
  const token = readString(mergedConfig.token);
  const workspaceId = readString(mergedConfig.workspaceId);
  const channelId =
    readString(mergedConfig.channelId) ?? DEFAULT_VOICYCLAW_CHANNEL_ID;
  const botId =
    readString(mergedConfig.botId) ?? buildDefaultBotId(normalizedAccountId);
  const displayName =
    readString(mergedConfig.displayName) ??
    buildDefaultDisplayName(normalizedAccountId);
  const connectTimeoutMs = readPositiveInteger(
    mergedConfig.connectTimeoutMs,
    DEFAULT_CONNECT_TIMEOUT_MS,
  );
  const reconnectBackoffMs = readPositiveInteger(
    mergedConfig.reconnectBackoffMs,
    DEFAULT_RECONNECT_BACKOFF_MS,
  );
  const heartbeatIntervalMs = readPositiveInteger(
    mergedConfig.heartbeatIntervalMs,
    DEFAULT_HEARTBEAT_INTERVAL_MS,
  );
  const devEchoReplies = readBoolean(mergedConfig.devEchoReplies, false);

  return {
    accountId: normalizedAccountId,
    enabled,
    configured: Boolean(token),
    url,
    token,
    workspaceId,
    channelId,
    botId,
    displayName,
    connectTimeoutMs,
    reconnectBackoffMs,
    heartbeatIntervalMs,
    devEchoReplies,
    config: {
      enabled,
      url,
      token,
      workspaceId,
      channelId,
      botId,
      displayName,
      connectTimeoutMs,
      reconnectBackoffMs,
      heartbeatIntervalMs,
      devEchoReplies,
    },
  };
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

function getVoicyClawSection(cfg: OpenClawConfig) {
  return asRecord(cfg.channels?.voicyclaw);
}

function getVoicyClawAccountOverrides(
  section: Record<string, unknown>,
  accountId: string,
) {
  const accounts = asRecord(section.accounts);
  if (!accounts) {
    return {};
  }

  return asRecord(accounts[accountId]);
}

function omitAccounts(section: Record<string, unknown>) {
  const { accounts: _accounts, ...rest } = section;
  return rest;
}

function buildDefaultBotId(accountId: string) {
  if (accountId === DEFAULT_VOICYCLAW_ACCOUNT_ID) {
    return DEFAULT_VOICYCLAW_BOT_ID;
  }

  return `${DEFAULT_VOICYCLAW_BOT_ID}-${accountId}`;
}

function buildDefaultDisplayName(accountId: string) {
  if (accountId === DEFAULT_VOICYCLAW_ACCOUNT_ID) {
    return DEFAULT_VOICYCLAW_DISPLAY_NAME;
  }

  return `${DEFAULT_VOICYCLAW_DISPLAY_NAME} ${accountId}`;
}

function normalizeAccountId(accountId?: string | null) {
  const normalized = accountId?.trim();
  return normalized || DEFAULT_VOICYCLAW_ACCOUNT_ID;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readPositiveInteger(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}
