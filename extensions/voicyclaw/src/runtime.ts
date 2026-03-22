import type { ResolvedVoicyClawAccount } from "./config.js";

export type VoicyClawRuntimeSnapshot = {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  displayName: string;
  botId: string;
  channelId: string;
  baseUrl: string;
  running: boolean;
  connected: boolean;
  sessionId: string | null;
  reconnectAttempts: number;
  lastStartAt: number | null;
  lastStopAt: number | null;
  lastConnectedAt: number | null;
  lastDisconnect: {
    at: number;
    error?: string;
  } | null;
  lastError: string | null;
  lastMessageAt: number | null;
  lastInboundAt: number | null;
  lastOutboundAt: number | null;
};

export type VoicyClawRuntime = ReturnType<typeof createVoicyClawRuntime>;

let currentRuntime: VoicyClawRuntime | null = null;

export function createVoicyClawRuntime() {
  const snapshots = new Map<string, VoicyClawRuntimeSnapshot>();

  const ensureAccount = (account: ResolvedVoicyClawAccount) => {
    const existing = snapshots.get(account.accountId);
    const next: VoicyClawRuntimeSnapshot = {
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      displayName: account.displayName,
      botId: account.botId,
      channelId: account.channelId,
      baseUrl: account.url,
      running: existing?.running ?? false,
      connected: existing?.connected ?? false,
      sessionId: existing?.sessionId ?? null,
      reconnectAttempts: existing?.reconnectAttempts ?? 0,
      lastStartAt: existing?.lastStartAt ?? null,
      lastStopAt: existing?.lastStopAt ?? null,
      lastConnectedAt: existing?.lastConnectedAt ?? null,
      lastDisconnect: existing?.lastDisconnect ?? null,
      lastError: existing?.lastError ?? null,
      lastMessageAt: existing?.lastMessageAt ?? null,
      lastInboundAt: existing?.lastInboundAt ?? null,
      lastOutboundAt: existing?.lastOutboundAt ?? null,
    };

    snapshots.set(account.accountId, next);
    return next;
  };

  const getSnapshot = (accountId: string) => snapshots.get(accountId) ?? null;

  return {
    ensureAccount,
    getSnapshot,
    listSnapshots: () =>
      Array.from(snapshots.values()).sort(compareByAccountId),
    markStarting(account: ResolvedVoicyClawAccount) {
      const snapshot = ensureAccount(account);
      snapshot.running = true;
      snapshot.connected = false;
      snapshot.lastStartAt = Date.now();
      snapshot.lastError = null;
      snapshot.sessionId = null;
    },
    markConnected(account: ResolvedVoicyClawAccount, sessionId: string) {
      const snapshot = ensureAccount(account);
      snapshot.running = true;
      snapshot.connected = true;
      snapshot.sessionId = sessionId;
      snapshot.reconnectAttempts = 0;
      snapshot.lastConnectedAt = Date.now();
      snapshot.lastError = null;
      snapshot.lastDisconnect = null;
    },
    markDisconnected(account: ResolvedVoicyClawAccount, error?: string) {
      const snapshot = ensureAccount(account);
      snapshot.running = account.enabled && account.configured;
      snapshot.connected = false;
      snapshot.sessionId = null;
      snapshot.lastError = error ?? null;
      snapshot.lastDisconnect = {
        at: Date.now(),
        ...(error ? { error } : {}),
      };
      if (account.enabled && account.configured) {
        snapshot.reconnectAttempts += 1;
      }
    },
    markStopped(account: ResolvedVoicyClawAccount) {
      const snapshot = ensureAccount(account);
      snapshot.running = false;
      snapshot.connected = false;
      snapshot.sessionId = null;
      snapshot.lastStopAt = Date.now();
    },
    markInbound(accountId: string) {
      const snapshot = snapshots.get(accountId);
      if (!snapshot) {
        return;
      }

      const now = Date.now();
      snapshot.lastMessageAt = now;
      snapshot.lastInboundAt = now;
    },
    markOutbound(accountId: string) {
      const snapshot = snapshots.get(accountId);
      if (!snapshot) {
        return;
      }

      const now = Date.now();
      snapshot.lastMessageAt = now;
      snapshot.lastOutboundAt = now;
    },
    reset() {
      snapshots.clear();
    },
  };
}

export function setVoicyClawRuntime(runtime: VoicyClawRuntime) {
  currentRuntime = runtime;
}

export function getVoicyClawRuntime() {
  if (!currentRuntime) {
    currentRuntime = createVoicyClawRuntime();
  }

  return currentRuntime;
}

function compareByAccountId(
  left: VoicyClawRuntimeSnapshot,
  right: VoicyClawRuntimeSnapshot,
) {
  return left.accountId.localeCompare(right.accountId);
}
