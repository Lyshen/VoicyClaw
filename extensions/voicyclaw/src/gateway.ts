import type { ChannelGatewayAdapter, PluginRuntime } from "openclaw/plugin-sdk";
import type { ResolvedVoicyClawAccount } from "./config.js";
import { buildVoicyClawSocketUrl } from "./config.js";
import { dispatchVoicyClawTranscript } from "./dispatch.js";
import type { VoicyClawRuntime } from "./runtime.js";
import { VoicyClawSocketClient } from "./socket-client.js";

export function createVoicyClawGatewayAdapter(
  runtime: VoicyClawRuntime,
  channelRuntime: PluginRuntime["channel"],
): ChannelGatewayAdapter<ResolvedVoicyClawAccount> {
  return {
    startAccount: async (ctx) => {
      const account = ctx.account;
      runtime.ensureAccount(account);

      if (!account.enabled) {
        runtime.markStopped(account);
        ctx.setStatus({
          accountId: account.accountId,
          running: false,
          connected: false,
          lastStopAt: Date.now(),
        });
        await waitUntilAbortSignal(ctx.abortSignal);
        return;
      }

      if (!account.configured) {
        runtime.markStopped(account);
        ctx.setStatus({
          accountId: account.accountId,
          running: false,
          connected: false,
          lastStopAt: Date.now(),
          lastError: "missing VoicyClaw token",
        });
        await waitUntilAbortSignal(ctx.abortSignal);
        return;
      }

      while (!ctx.abortSignal.aborted) {
        const socketUrl = buildVoicyClawSocketUrl(account.url);
        let client: VoicyClawSocketClient | null = null;

        runtime.markStarting(account);
        ctx.setStatus({
          accountId: account.accountId,
          running: true,
          connected: false,
          lastStartAt: Date.now(),
          lastError: null,
          baseUrl: account.url,
          audience: account.channelId,
        });

        try {
          client = new VoicyClawSocketClient({
            account,
            socketUrl,
            logger: ctx.log ?? consoleLogger,
            onTranscript: async (message) => {
              runtime.markInbound(account.accountId);
              ctx.setStatus({
                accountId: account.accountId,
                lastInboundAt: Date.now(),
              });

              if (!message.is_final) {
                return;
              }

              if (account.devEchoReplies) {
                client?.sendText(
                  message.utterance_id,
                  `VoicyClaw plugin echo: ${message.text || "(empty transcript)"}`,
                  true,
                );
                runtime.markOutbound(account.accountId);
                ctx.setStatus({
                  accountId: account.accountId,
                  lastOutboundAt: Date.now(),
                });
                return;
              }

              const activeClient = client;
              if (!activeClient) {
                return;
              }

              await dispatchVoicyClawTranscript({
                account,
                cfg: ctx.cfg,
                channelRuntime,
                client: activeClient,
                message,
                log: ctx.log ?? consoleLogger,
                onOutbound: () => {
                  runtime.markOutbound(account.accountId);
                  ctx.setStatus({
                    accountId: account.accountId,
                    lastOutboundAt: Date.now(),
                  });
                },
              });
            },
          });

          const welcome = await client.connect();
          runtime.markConnected(account, welcome.session_id);
          ctx.setStatus({
            accountId: account.accountId,
            running: true,
            connected: true,
            lastConnectedAt: Date.now(),
            lastError: null,
            lastDisconnect: null,
          });
          ctx.log?.info?.(
            `[voicyclaw] connected ${account.accountId} to ${socketUrl}`,
          );

          await client.waitUntilClosed();
          if (ctx.abortSignal.aborted) {
            break;
          }

          runtime.markDisconnected(account, "socket closed");
          ctx.setStatus({
            accountId: account.accountId,
            running: true,
            connected: false,
            lastError: "socket closed",
            lastDisconnect: {
              at: Date.now(),
              error: "socket closed",
            },
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          runtime.markDisconnected(account, message);
          ctx.setStatus({
            accountId: account.accountId,
            running: true,
            connected: false,
            lastError: message,
            lastDisconnect: {
              at: Date.now(),
              error: message,
            },
          });
          ctx.log?.warn?.(
            `[voicyclaw] connector ${account.accountId} disconnected: ${message}`,
          );
        } finally {
          await client?.close().catch(() => undefined);
        }

        if (ctx.abortSignal.aborted) {
          break;
        }

        await sleep(account.reconnectBackoffMs, ctx.abortSignal);
      }

      runtime.markStopped(account);
      ctx.setStatus({
        accountId: account.accountId,
        running: false,
        connected: false,
        lastStopAt: Date.now(),
      });
    },
  };
}

const consoleLogger = {
  info: (message: string) => console.log(message),
  warn: (message: string) => console.warn(message),
  error: (message: string) => console.error(message),
};

async function sleep(ms: number, signal: AbortSignal) {
  if (signal.aborted) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = globalThis.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const cleanup = () => {
      globalThis.clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      cleanup();
      resolve();
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function waitUntilAbortSignal(signal: AbortSignal) {
  if (signal.aborted) {
    return;
  }

  await new Promise<void>((resolve) => {
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
}
