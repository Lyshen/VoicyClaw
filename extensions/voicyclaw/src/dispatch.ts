import type {
  OpenClawConfig,
  PluginRuntime,
  ReplyPayload,
} from "openclaw/plugin-sdk";

import type { ResolvedVoicyClawAccount } from "./config.js";
import type { VoicyClawSttResultMessage } from "./protocol.js";

type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

type VoicyClawReplyClient = {
  sendPreview: (utteranceId: string, text: string, isFinal?: boolean) => void;
  sendText: (utteranceId: string, text: string, isFinal?: boolean) => void;
};

type VoicyClawChannelRuntime = Pick<
  PluginRuntime["channel"],
  "reply" | "routing" | "session"
>;

export async function dispatchVoicyClawTranscript(params: {
  account: ResolvedVoicyClawAccount;
  cfg: OpenClawConfig;
  channelRuntime: VoicyClawChannelRuntime;
  client: VoicyClawReplyClient;
  message: VoicyClawSttResultMessage;
  log: Logger;
  onOutbound?: () => void;
}) {
  const { account, cfg, channelRuntime, client, message, log, onOutbound } =
    params;
  const route = channelRuntime.routing.resolveAgentRoute({
    cfg,
    channel: "voicyclaw",
    accountId: account.accountId,
    peer: {
      kind: "direct",
      id: buildVoicyClawPeerId(account),
    },
  });
  const storePath = channelRuntime.session.resolveStorePath(
    cfg.session?.store,
    {
      agentId: route.agentId,
    },
  );
  const previousTimestamp = channelRuntime.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });
  const envelopeOptions =
    channelRuntime.reply.resolveEnvelopeFormatOptions(cfg);
  const receivedAt = Date.now();
  const body = channelRuntime.reply.formatAgentEnvelope({
    channel: "VoicyClaw",
    from: buildConversationLabel(account),
    timestamp: receivedAt,
    previousTimestamp,
    envelope: envelopeOptions,
    body: message.text,
  });
  const ctxPayload = channelRuntime.reply.finalizeInboundContext({
    Body: body,
    BodyForAgent: message.text,
    RawBody: message.text,
    CommandBody: message.text,
    From: buildVoicyClawTarget(account),
    To: buildVoicyClawTarget(account),
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: "direct",
    ConversationLabel: buildConversationLabel(account),
    SenderName: "VoicyClaw User",
    SenderId: buildVoicyClawPeerId(account),
    Provider: "voicyclaw",
    Surface: "voicyclaw",
    MessageSid: message.utterance_id,
    MessageSidFull: message.utterance_id,
    Timestamp: receivedAt,
    OriginatingChannel: "voicyclaw",
    OriginatingTo: buildVoicyClawTarget(account),
    CommandAuthorized: true,
  });

  await channelRuntime.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (error) => {
      log.warn(
        `[voicyclaw] failed recording inbound session for ${message.utterance_id}: ${String(
          error,
        )}`,
      );
    },
  });

  const result =
    await channelRuntime.reply.dispatchReplyWithBufferedBlockDispatcher({
      ctx: ctxPayload,
      cfg,
      dispatcherOptions: {
        deliver: async (payload, info) => {
          const text = replyPayloadToText(payload);
          if (!text) {
            return;
          }

          if (info.kind === "final") {
            client.sendText(message.utterance_id, text, true);
          } else {
            client.sendPreview(message.utterance_id, text, false);
          }
          onOutbound?.();
        },
        onReplyStart: () => {
          log.info(
            `[voicyclaw] agent reply started for ${message.utterance_id} on ${route.sessionKey}`,
          );
        },
        onError: (error, info) => {
          log.warn(
            `[voicyclaw] ${info.kind} reply failed for ${message.utterance_id}: ${String(
              error,
            )}`,
          );
        },
      },
    });

  log.info(
    `[voicyclaw] dispatched ${message.utterance_id} via ${route.agentId} (queuedFinal=${String(
      result.queuedFinal,
    )})`,
  );

  return {
    route,
    ctxPayload,
    result,
  };
}

function buildConversationLabel(account: ResolvedVoicyClawAccount) {
  return getRequiredBinding(account).channelId;
}

function buildVoicyClawPeerId(account: ResolvedVoicyClawAccount) {
  return getRequiredBinding(account).channelId;
}

function buildVoicyClawTarget(account: ResolvedVoicyClawAccount) {
  return `voicyclaw:${buildVoicyClawPeerId(account)}`;
}

function getRequiredBinding(account: ResolvedVoicyClawAccount) {
  if (!account.binding) {
    throw new Error("VoicyClaw binding is not ready.");
  }

  return account.binding;
}

export function replyPayloadToText(payload: ReplyPayload) {
  const parts = [
    payload.text?.trim(),
    payload.mediaUrl?.trim(),
    ...(payload.mediaUrls ?? []).map((entry) => entry.trim()),
  ].filter(Boolean);

  return parts.join("\n").trim();
}
