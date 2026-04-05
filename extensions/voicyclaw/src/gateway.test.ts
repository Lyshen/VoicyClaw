import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveVoicyClawAccount } from "./config.js";
import { createVoicyClawGatewayAdapter } from "./gateway.js";
import { createVoicyClawRuntime } from "./runtime.js";

const {
  dispatchVoicyClawTranscript,
  connectMock,
  waitUntilClosedMock,
  closeMock,
  socketInstances,
} = vi.hoisted(() => ({
  dispatchVoicyClawTranscript: vi.fn(),
  connectMock: vi.fn(),
  waitUntilClosedMock: vi.fn(),
  closeMock: vi.fn(),
  socketInstances: [] as MockSocketClient[],
}));

vi.mock("./dispatch.js", () => ({
  dispatchVoicyClawTranscript,
}));

vi.mock("./socket-client.js", () => ({
  VoicyClawSocketClient: class MockVoicyClawSocketClient {
    readonly options: MockSocketClientOptions;
    readonly sendPreview = vi.fn();
    readonly sendText = vi.fn();

    constructor(options: MockSocketClientOptions) {
      this.options = options;
      socketInstances.push(this);
    }

    connect() {
      return connectMock.call(this);
    }

    waitUntilClosed() {
      return waitUntilClosedMock.call(this);
    }

    close() {
      return closeMock.call(this);
    }
  },
}));

describe("voicyclaw gateway adapter", () => {
  beforeEach(() => {
    dispatchVoicyClawTranscript.mockReset();
    connectMock.mockReset();
    waitUntilClosedMock.mockReset();
    closeMock.mockReset();
    socketInstances.length = 0;
  });

  it("echoes final transcripts in devEchoReplies mode without invoking OpenClaw dispatch", async () => {
    const controller = new AbortController();
    const account = resolveVoicyClawAccount(
      {
        channels: {
          voicyclaw: {
            token: "vc-token",
            channelId: "demo-room",
            devEchoReplies: true,
          },
        },
      },
      "default",
    );
    const runtime = createVoicyClawRuntime();
    const setStatus = vi.fn();

    connectMock.mockResolvedValue({
      session_id: "session-1",
      channel_id: "demo-room",
      bot_id: account.botId,
    });
    waitUntilClosedMock.mockImplementation(async function (
      this: MockSocketClient,
    ) {
      if (this.options.onTranscript) {
        await this.options.onTranscript({
          type: "STT_RESULT",
          session_id: "session-1",
          utterance_id: "utt-1",
          text: "hello",
          is_final: true,
        });
      }
      controller.abort();
    });
    closeMock.mockResolvedValue(undefined);

    const adapter = createVoicyClawGatewayAdapter(runtime, {} as never);
    const { startAccount } = adapter;
    if (!startAccount) {
      throw new Error("startAccount is not available");
    }

    await startAccount({
      account,
      cfg: {},
      abortSignal: controller.signal,
      log: createLogger(),
      setStatus,
    } as never);

    expect(socketInstances).toHaveLength(1);
    const socket = socketInstances[0];
    if (!socket) {
      throw new Error("socket instance was not created");
    }

    expect(socket.sendText).toHaveBeenCalledWith(
      "utt-1",
      "VoicyClaw plugin echo: hello",
      true,
    );
    expect(dispatchVoicyClawTranscript).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "default",
        lastOutboundAt: expect.any(Number),
      }),
    );
  });

  it("dispatches only final transcripts into OpenClaw", async () => {
    const controller = new AbortController();
    const account = resolveVoicyClawAccount(
      {
        channels: {
          voicyclaw: {
            token: "vc-token",
            channelId: "demo-room",
          },
        },
      },
      "default",
    );
    const runtime = createVoicyClawRuntime();

    connectMock.mockResolvedValue({
      session_id: "session-2",
      channel_id: "demo-room",
      bot_id: account.botId,
    });
    waitUntilClosedMock.mockImplementation(async function (
      this: MockSocketClient,
    ) {
      if (this.options.onTranscript) {
        await this.options.onTranscript({
          type: "STT_RESULT",
          session_id: "session-2",
          utterance_id: "utt-2a",
          text: "partial hello",
          is_final: false,
        });
        await this.options.onTranscript({
          type: "STT_RESULT",
          session_id: "session-2",
          utterance_id: "utt-2b",
          text: "final hello",
          is_final: true,
        });
      }
      controller.abort();
    });
    dispatchVoicyClawTranscript.mockResolvedValue({
      result: { queuedFinal: false },
    });
    closeMock.mockResolvedValue(undefined);

    const channelRuntime = {
      reply: {},
      routing: {},
      session: {},
    } as never;
    const adapter = createVoicyClawGatewayAdapter(runtime, channelRuntime);
    const { startAccount } = adapter;
    if (!startAccount) {
      throw new Error("startAccount is not available");
    }

    await startAccount({
      account,
      cfg: {},
      abortSignal: controller.signal,
      log: createLogger(),
      setStatus: vi.fn(),
    } as never);

    expect(dispatchVoicyClawTranscript).toHaveBeenCalledTimes(1);
    expect(dispatchVoicyClawTranscript).toHaveBeenCalledWith(
      expect.objectContaining({
        account,
        message: expect.objectContaining({
          utterance_id: "utt-2b",
          text: "final hello",
          is_final: true,
        }),
      }),
    );
  });

  it("waits idle when required config is missing instead of opening a socket", async () => {
    const controller = new AbortController();
    controller.abort();

    const account = resolveVoicyClawAccount(
      {
        channels: {
          voicyclaw: {
            token: "vc-token",
          },
        },
      },
      "default",
    );
    const runtime = createVoicyClawRuntime();
    const setStatus = vi.fn();

    const adapter = createVoicyClawGatewayAdapter(runtime, {} as never);
    const { startAccount } = adapter;
    if (!startAccount) {
      throw new Error("startAccount is not available");
    }

    await startAccount({
      account,
      cfg: {},
      abortSignal: controller.signal,
      log: createLogger(),
      setStatus,
    } as never);

    expect(connectMock).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "default",
        running: false,
        connected: false,
        lastError: "Missing VoicyClaw room / channel id.",
      }),
    );
  });
});

type MockSocketClient = {
  options: MockSocketClientOptions;
  sendText: ReturnType<typeof vi.fn>;
};

type MockSocketClientOptions = {
  onTranscript?: (message: unknown) => Promise<void> | void;
};

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}
