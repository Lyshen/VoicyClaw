import type { ChannelPlugin, PluginRuntime } from "openclaw/plugin-sdk";

import {
  buildVoicyClawConfigFix,
  buildVoicyClawMissingConfigMessage,
  DEFAULT_VOICYCLAW_ACCOUNT_ID,
  getVoicyClawAccountName,
  getVoicyClawAudience,
  type ResolvedVoicyClawAccount,
  resolveVoicyClawAccount,
  voicyClawChannelConfigSchema,
} from "./config.js";
import { createVoicyClawGatewayAdapter } from "./gateway.js";
import type { VoicyClawRuntime } from "./runtime.js";

export function createVoicyClawChannel(
  runtimeState: VoicyClawRuntime,
  channelRuntime: PluginRuntime["channel"],
): ChannelPlugin<ResolvedVoicyClawAccount> {
  return {
    id: "voicyclaw",
    meta: {
      id: "voicyclaw",
      label: "VoicyClaw",
      selectionLabel: "VoicyClaw",
      docsPath: "/channels/voicyclaw",
      blurb: "Connect OpenClaw to VoicyClaw over WebSocket.",
      aliases: ["voiceclaw"],
    },
    capabilities: {
      chatTypes: ["direct"],
    },
    reload: {
      configPrefixes: ["channels.voicyclaw"],
    },
    configSchema: voicyClawChannelConfigSchema,
    config: {
      listAccountIds: () => [DEFAULT_VOICYCLAW_ACCOUNT_ID],
      resolveAccount: (cfg) => resolveVoicyClawAccount(cfg),
      defaultAccountId: () => DEFAULT_VOICYCLAW_ACCOUNT_ID,
      isEnabled: () => true,
      isConfigured: (account) => account.configured,
      describeAccount: (account) => ({
        accountId: account.accountId,
        name: getVoicyClawAccountName(account),
        enabled: true,
        configured: account.configured,
        baseUrl: account.url,
        audience: getVoicyClawAudience(account),
      }),
    },
    status: {
      buildAccountSnapshot: ({ account, runtime }) => {
        const tracked = runtimeState.getSnapshot(account.accountId);

        return {
          accountId: account.accountId,
          name:
            tracked?.name ?? runtime?.name ?? getVoicyClawAccountName(account),
          enabled: true,
          configured: account.configured,
          running: tracked?.running ?? runtime?.running ?? false,
          connected: tracked?.connected ?? runtime?.connected ?? false,
          reconnectAttempts:
            tracked?.reconnectAttempts ?? runtime?.reconnectAttempts ?? 0,
          lastConnectedAt:
            tracked?.lastConnectedAt ?? runtime?.lastConnectedAt ?? null,
          lastDisconnect:
            tracked?.lastDisconnect ?? runtime?.lastDisconnect ?? null,
          lastError: tracked?.lastError ?? runtime?.lastError ?? null,
          lastStartAt: tracked?.lastStartAt ?? runtime?.lastStartAt ?? null,
          lastStopAt: tracked?.lastStopAt ?? runtime?.lastStopAt ?? null,
          lastMessageAt:
            tracked?.lastMessageAt ?? runtime?.lastMessageAt ?? null,
          lastInboundAt:
            tracked?.lastInboundAt ?? runtime?.lastInboundAt ?? null,
          lastOutboundAt:
            tracked?.lastOutboundAt ?? runtime?.lastOutboundAt ?? null,
          baseUrl: account.url,
          audience: tracked?.channelId || getVoicyClawAudience(account),
        };
      },
      resolveAccountState: ({ configured }) => {
        if (!configured) {
          return "not configured";
        }

        return "enabled";
      },
      collectStatusIssues: (accounts) => {
        return accounts.flatMap((account) => {
          const issues = [];

          if (!account.configured) {
            issues.push({
              channel: "voicyclaw",
              accountId: account.accountId,
              kind: "config" as const,
              message: buildVoicyClawMissingConfigMessage(),
              fix: buildVoicyClawConfigFix(),
            });
          }

          if (account.configured && !account.connected && account.lastError) {
            issues.push({
              channel: "voicyclaw",
              accountId: account.accountId,
              kind: "runtime" as const,
              message: `VoicyClaw is disconnected: ${account.lastError}`,
              fix: "Check the VoicyClaw base URL and token, then restart the gateway.",
            });
          }

          return issues;
        });
      },
    },
    gateway: createVoicyClawGatewayAdapter(runtimeState, channelRuntime),
  };
}
