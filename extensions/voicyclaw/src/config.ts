import type { OpenClawConfig } from "openclaw/plugin-sdk";

export const DEFAULT_VOICYCLAW_ACCOUNT_ID = "default";
export const DEFAULT_VOICYCLAW_BASE_URL = "https://api.voicyclaw.com";
export const DEFAULT_VOICYCLAW_DISPLAY_NAME = "VoicyClaw Connector";
export const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
export const DEFAULT_RECONNECT_BACKOFF_MS = 5_000;
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 25_000;
const REQUIRED_VOICYCLAW_CONFIG_FIELDS = ["token"] as const;

export type VoicyClawRequiredConfigField =
  (typeof REQUIRED_VOICYCLAW_CONFIG_FIELDS)[number];

export type VoicyClawAccountConfig = {
  enabled?: boolean;
  url?: string;
  token?: string;
  workspaceId?: string;
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
  missingConfigFields: VoicyClawRequiredConfigField[];
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
      placeholder: DEFAULT_VOICYCLAW_BASE_URL,
    },
    token: {
      label: "VoicyClaw Token",
      sensitive: true,
    },
    workspaceId: {
      label: "Workspace ID",
      advanced: true,
    },
    displayName: {
      label: "Display Name",
      advanced: true,
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
  const channelId = "";
  const botId = "";
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
  const missingConfigFields: VoicyClawRequiredConfigField[] = token
    ? []
    : ["token"];

  return {
    accountId: normalizedAccountId,
    enabled,
    configured: missingConfigFields.length === 0,
    missingConfigFields,
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

export function buildVoicyClawMissingConfigMessage(
  missingConfigFields: readonly VoicyClawRequiredConfigField[],
) {
  if (missingConfigFields.length === 0) {
    return "VoicyClaw connector config is complete.";
  }

  return `Missing VoicyClaw ${formatConfigFieldLabels(missingConfigFields)}.`;
}

export function buildVoicyClawConfigFix(
  accountId: string,
  missingConfigFields: readonly VoicyClawRequiredConfigField[],
) {
  if (missingConfigFields.length === 0) {
    return "No connector config changes are required.";
  }

  const topLevelPaths = formatConfigPaths(
    "channels.voicyclaw",
    missingConfigFields,
  );

  if (accountId === DEFAULT_VOICYCLAW_ACCOUNT_ID) {
    return `Set ${topLevelPaths}.`;
  }

  const accountPaths = formatConfigPaths(
    `channels.voicyclaw.accounts.${accountId}`,
    missingConfigFields,
  );
  return `Set ${topLevelPaths} or ${accountPaths}.`;
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

function buildDefaultDisplayName(accountId: string) {
  if (accountId === DEFAULT_VOICYCLAW_ACCOUNT_ID) {
    return DEFAULT_VOICYCLAW_DISPLAY_NAME;
  }

  return `${DEFAULT_VOICYCLAW_DISPLAY_NAME} ${accountId}`;
}

function formatConfigFieldLabels(
  missingConfigFields: readonly VoicyClawRequiredConfigField[],
) {
  return joinLabelList(missingConfigFields);
}

function formatConfigPaths(
  prefix: string,
  missingConfigFields: readonly VoicyClawRequiredConfigField[],
) {
  return joinLabelList(
    missingConfigFields.map((field) => `${prefix}.${field}`),
  );
}

function joinLabelList(values: readonly string[]) {
  if (values.length === 0) {
    return "";
  }

  if (values.length === 1) {
    return values[0] ?? "";
  }

  if (values.length === 2) {
    return `${values[0] ?? ""} and ${values[1] ?? ""}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1) ?? ""}`;
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
