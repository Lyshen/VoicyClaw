import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocketServer } from "ws";

import { resolveVoicyClawAccount } from "./config.js";
import { VoicyClawSocketClient } from "./socket-client.js";

describe("voicyclaw socket client", () => {
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

  it("completes the HELLO handshake and emits preview/final replies", async () => {
    const receivedMessages: unknown[] = [];
    const server = new WebSocketServer({ port: 0 });
    servers.push(server);

    server.on("connection", (socket) => {
      socket.on("message", (raw, isBinary) => {
        if (isBinary) {
          return;
        }

        const message = JSON.parse(raw.toString());
        receivedMessages.push(message);

        if (message.type === "HELLO") {
          socket.send(
            JSON.stringify({
              type: "WELCOME",
              session_id: "session-1",
              channel_id: "demo-room",
              bot_id: "openclaw-voicyclaw",
            }),
          );
        }
      });
    });

    await onceListening(server);

    const client = new VoicyClawSocketClient({
      account: resolveVoicyClawAccount({
        channels: {
          voicyclaw: {
            url: serverUrl(server),
            token: "vc-token",
            channelId: "demo-room",
          },
        },
      }),
      socketUrl: `${serverUrl(server)}/bot/connect`,
      logger: createLogger(),
    });

    const welcome = await client.connect();

    client.sendPreview("utt-1", "preview chunk");
    client.sendText("utt-1", "final answer", true);
    await waitFor(() => receivedMessages.length >= 3);

    expect(welcome).toMatchObject({
      session_id: "session-1",
      channel_id: "demo-room",
      bot_id: "openclaw-voicyclaw",
    });
    expect(receivedMessages).toEqual([
      {
        type: "HELLO",
        api_key: "vc-token",
        bot_id: "openclaw-voicyclaw",
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

    await client.close();
  });

  it("logs transcript handler failures instead of leaking unhandled rejections", async () => {
    const logger = createLogger();
    const onTranscript = vi.fn(async () => {
      throw new Error("dispatch failed");
    });
    const server = new WebSocketServer({ port: 0 });
    servers.push(server);

    server.on("connection", (socket) => {
      socket.on("message", (raw, isBinary) => {
        if (isBinary) {
          return;
        }

        const message = JSON.parse(raw.toString());
        if (message.type !== "HELLO") {
          return;
        }

        socket.send(
          JSON.stringify({
            type: "WELCOME",
            session_id: "session-2",
            channel_id: "demo-room",
            bot_id: "openclaw-voicyclaw",
          }),
        );
        socket.send(
          JSON.stringify({
            type: "STT_RESULT",
            session_id: "session-2",
            utterance_id: "utt-2",
            text: "hello",
            is_final: true,
          }),
        );
        setTimeout(() => socket.close(), 10);
      });
    });

    await onceListening(server);

    const client = new VoicyClawSocketClient({
      account: resolveVoicyClawAccount({
        channels: {
          voicyclaw: {
            url: serverUrl(server),
            token: "vc-token",
            channelId: "demo-room",
          },
        },
      }),
      socketUrl: `${serverUrl(server)}/bot/connect`,
      logger,
      onTranscript,
    });

    await client.connect();
    await client.waitUntilClosed();

    expect(onTranscript).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "STT_RESULT",
        utterance_id: "utt-2",
        text: "hello",
        is_final: true,
      }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      "[voicyclaw] onTranscript handler failed: dispatch failed",
    );
  });
});

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function serverUrl(server: WebSocketServer) {
  const address = server.address() as AddressInfo;
  return `ws://127.0.0.1:${address.port}`;
}

function onceListening(server: WebSocketServer) {
  if (server.address()) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    server.once("listening", () => resolve());
  });
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 500,
  intervalMs = 10,
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Timed out waiting for condition");
}
