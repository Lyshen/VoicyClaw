import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocketServer } from "ws";

import { resolveVoicyClawAccount } from "./config.js";
import { createVoicyClawGatewayAdapter } from "./gateway.js";
import { createVoicyClawRuntime } from "./runtime.js";

describe("voicyclaw smoke workflow", () => {
  const servers: WebSocketServer[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => {
              if (error) {
                reject(error);
                return;
              }

              resolve();
            });
          }),
      ),
    );
    servers.length = 0;
  });

  it("covers HELLO/WELCOME/STT_RESULT/BOT_PREVIEW/TTS_TEXT against a fake VoicyClaw server", async () => {
    const controller = new AbortController();
    const receivedMessages: unknown[] = [];
    const helloReceived = createDeferred<void>();
    const replyCompleted = createDeferred<void>();

    const server = new WebSocketServer({ port: 0 });
    servers.push(server);
    await onceListening(server);

    server.on("connection", (socket, request) => {
      expect(request.url).toBe("/bot/connect");

      socket.on("message", (raw, isBinary) => {
        if (isBinary) {
          return;
        }

        const message = JSON.parse(raw.toString());
        receivedMessages.push(message);

        if (message.type === "HELLO") {
          helloReceived.resolve();
          socket.send(
            JSON.stringify({
              type: "WELCOME",
              session_id: "session-1",
              channel_id: "demo-room",
              bot_id: "openclaw-local",
            }),
          );
          socket.send(
            JSON.stringify({
              type: "STT_RESULT",
              session_id: "session-1",
              utterance_id: "utt-1",
              text: "hello smoke",
              is_final: true,
            }),
          );
        }

        if (message.type === "TTS_TEXT" && message.is_final === true) {
          replyCompleted.resolve();
          controller.abort();
          socket.close();
        }
      });
    });

    const runtime = createVoicyClawRuntime();
    const channelRuntime = createChannelRuntime();
    const adapter = createVoicyClawGatewayAdapter(runtime, channelRuntime);
    const startAccount = adapter.startAccount;
    if (!startAccount) {
      throw new Error("startAccount is not available");
    }

    const account = resolveVoicyClawAccount(
      {
        channels: {
          voicyclaw: {
            url: serverBaseUrl(server),
            token: "vc-smoke-token",
            channelId: "demo-room",
            botId: "openclaw-local",
            displayName: "OpenClaw Smoke",
            reconnectBackoffMs: 100,
          },
        },
        session: {
          store: "/tmp/voicyclaw-smoke-sessions.json",
        },
      },
      "default",
    );
    const setStatus = vi.fn();

    const startPromise = startAccount({
      account,
      cfg: {
        session: {
          store: "/tmp/voicyclaw-smoke-sessions.json",
        },
      },
      abortSignal: controller.signal,
      log: createLogger(),
      setStatus,
    } as never);

    await helloReceived.promise;
    await replyCompleted.promise;
    await startPromise;

    expect(receivedMessages).toEqual([
      {
        type: "HELLO",
        api_key: "vc-smoke-token",
        bot_id: "openclaw-local",
        channel_id: "demo-room",
        protocol_version: "0.1",
      },
      {
        type: "BOT_PREVIEW",
        session_id: "session-1",
        utterance_id: "utt-1",
        text: "preview chunk",
        is_final: false,
      },
      {
        type: "TTS_TEXT",
        session_id: "session-1",
        utterance_id: "utt-1",
        text: "final answer",
        is_final: true,
      },
    ]);
    expect(setStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "default",
        connected: true,
      }),
    );
    expect(setStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "default",
        lastInboundAt: expect.any(Number),
      }),
    );
    expect(setStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "default",
        lastOutboundAt: expect.any(Number),
      }),
    );
  });
});

function createChannelRuntime() {
  return {
    routing: {
      resolveAgentRoute: vi.fn(() => ({
        agentId: "main",
        accountId: "default",
        sessionKey: "voicyclaw:channel:demo-room",
      })),
    },
    session: {
      resolveStorePath: vi.fn(() => "/tmp/voicyclaw-smoke-sessions.json"),
      readSessionUpdatedAt: vi.fn(() => undefined),
      recordInboundSession: vi.fn(async () => undefined),
    },
    reply: {
      resolveEnvelopeFormatOptions: vi.fn(() => ({ style: "plain" })),
      formatAgentEnvelope: vi.fn(({ body }) => body),
      finalizeInboundContext: vi.fn((value) => value),
      dispatchReplyWithBufferedBlockDispatcher: vi.fn(
        async ({ dispatcherOptions }) => {
          await dispatcherOptions.deliver(
            { text: "preview chunk" },
            { kind: "block" },
          );
          await dispatcherOptions.deliver(
            { text: "final answer" },
            { kind: "final" },
          );

          return {
            queuedFinal: false,
            counts: {
              final: 1,
              block: 1,
              tool: 0,
            },
          };
        },
      ),
    },
  } as never;
}

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

function onceListening(server: WebSocketServer) {
  if (server.address()) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    server.once("listening", () => resolve());
  });
}

function serverBaseUrl(server: WebSocketServer) {
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}
