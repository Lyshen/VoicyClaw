import type { ChannelPlugin, PluginRuntime } from "openclaw/plugin-sdk";

import {
  buildVoicyClawConfigFix,
  buildVoicyClawMissingConfigMessage,
  DEFAULT_VOICYCLAW_ACCOUNT_ID,
  listVoicyClawAccountIds,
  type ResolvedVoicyClawAccount,
  resolveVoicyClawAccount,
  type VoicyClawRequiredConfigField,
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
      selectionLabel: "VoicyClaw (Outbound Connector)",
      docsPath: "/channels/voicyclaw",
      blurb:
        "Outbound VoicyClaw connector that lets OpenClaw attach to a hosted voice workspace.",
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
      listAccountIds: (cfg) => listVoicyClawAccountIds(cfg),
      resolveAccount: (cfg, accountId) =>
        resolveVoicyClawAccount(cfg, accountId),
      defaultAccountId: () => DEFAULT_VOICYCLAW_ACCOUNT_ID,
      isEnabled: (account) => account.enabled,
      isConfigured: (account) => account.configured,
      describeAccount: (account) => ({
        accountId: account.accountId,
        name: account.displayName,
        enabled: account.enabled,
        configured: account.configured,
        baseUrl: account.url,
        audience: account.channelId || undefined,
        tokenSource: account.token ? "config" : undefined,
      }),
    },
    status: {
      buildAccountSnapshot: ({ account, runtime }) => {
        const tracked = runtimeState.getSnapshot(account.accountId);

        return {
          accountId: account.accountId,
          name: account.displayName,
          enabled: account.enabled,
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
          audience: account.channelId || undefined,
          tokenSource: account.token ? "config" : undefined,
        };
      },
      resolveAccountState: ({ configured, enabled }) => {
        if (!configured) {
          return "not configured";
        }

        return enabled ? "enabled" : "disabled";
      },
      collectStatusIssues: (accounts) => {
        return accounts.flatMap((account) => {
          const issues = [];
          const missingConfigFields = inferMissingConfigFields(account);

          if (!account.configured) {
            issues.push({
              channel: "voicyclaw",
              accountId: account.accountId,
              kind: "config" as const,
              message: buildVoicyClawMissingConfigMessage(missingConfigFields),
              fix: buildVoicyClawConfigFix(
                account.accountId,
                missingConfigFields,
              ),
            });
          }

          if (
            account.enabled &&
            account.configured &&
            !account.connected &&
            account.lastError
          ) {
            issues.push({
              channel: "voicyclaw",
              accountId: account.accountId,
              kind: "runtime" as const,
              message: `VoicyClaw connector is disconnected: ${account.lastError}`,
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

function inferMissingConfigFields(account: {
  tokenSource?: string;
}): VoicyClawRequiredConfigField[] {
  const missingConfigFields: VoicyClawRequiredConfigField[] = [];

  if (!account.tokenSource) {
    missingConfigFields.push("token");
  }

  return missingConfigFields;
}
