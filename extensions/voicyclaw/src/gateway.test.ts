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

  it("dispatches final transcripts with the server-bound connector identity", async () => {
    const controller = new AbortController();
    const account = resolveVoicyClawAccount({
      channels: {
        voicyclaw: {
          token: "vc-token",
        },
      },
    });
    const runtime = createVoicyClawRuntime();
    const setStatus = vi.fn();

    connectMock.mockResolvedValue({
      session_id: "session-1",
      channel_id: "demo-room",
      bot_id: "server-bound-bot",
      bot_name: "Server Bound Bot",
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

    expect(dispatchVoicyClawTranscript).toHaveBeenCalledWith(
      expect.objectContaining({
        account: expect.objectContaining({
          accountId: "default",
          binding: {
            channelId: "demo-room",
            botId: "server-bound-bot",
            botName: "Server Bound Bot",
          },
        }),
      }),
    );
    expect(setStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "default",
        audience: "demo-room",
        connected: true,
      }),
    );
  });

  it("binds the server welcome before the first transcript arrives", async () => {
    const controller = new AbortController();
    const account = resolveVoicyClawAccount({
      channels: {
        voicyclaw: {
          token: "vc-token",
        },
      },
    });
    const runtime = createVoicyClawRuntime();
    const setStatus = vi.fn();
    const welcome = {
      type: "WELCOME" as const,
      session_id: "session-race",
      channel_id: "race-room",
      bot_id: "race-bot",
      bot_name: "Race Bot",
    };

    dispatchVoicyClawTranscript.mockResolvedValue({
      result: { queuedFinal: false },
    });
    connectMock.mockImplementation(async function (this: MockSocketClient) {
      await this.options.onMessage?.(welcome);
      await this.options.onTranscript?.({
        type: "STT_RESULT",
        session_id: "session-race",
        utterance_id: "utt-race",
        text: "hello before connect resolves",
        is_final: true,
      });

      return welcome;
    });
    waitUntilClosedMock.mockImplementation(async () => {
      controller.abort();
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
      setStatus,
    } as never);

    expect(dispatchVoicyClawTranscript).toHaveBeenCalledWith(
      expect.objectContaining({
        account: expect.objectContaining({
          binding: {
            channelId: "race-room",
            botId: "race-bot",
            botName: "Race Bot",
          },
        }),
        message: expect.objectContaining({
          utterance_id: "utt-race",
          is_final: true,
        }),
      }),
    );
  });

  it("dispatches only final transcripts into OpenClaw", async () => {
    const controller = new AbortController();
    const account = resolveVoicyClawAccount({
      channels: {
        voicyclaw: {
          token: "vc-token",
        },
      },
    });
    const runtime = createVoicyClawRuntime();
    const setStatus = vi.fn();

    connectMock.mockResolvedValue({
      session_id: "session-2",
      channel_id: "server-bound-room",
      bot_id: "server-bound-bot",
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
      setStatus,
    } as never);

    expect(dispatchVoicyClawTranscript).toHaveBeenCalledTimes(1);
    expect(dispatchVoicyClawTranscript).toHaveBeenCalledWith(
      expect.objectContaining({
        account: expect.objectContaining({
          accountId: "default",
          binding: {
            channelId: "server-bound-room",
            botId: "server-bound-bot",
          },
        }),
        message: expect.objectContaining({
          utterance_id: "utt-2b",
          text: "final hello",
          is_final: true,
        }),
      }),
    );
    expect(setStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "default",
        connected: true,
        audience: "server-bound-room",
      }),
    );
  });

  it("waits idle when required config is missing instead of opening a socket", async () => {
    const controller = new AbortController();
    controller.abort();

    const account = resolveVoicyClawAccount({
      channels: {
        voicyclaw: {},
      },
    });
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
        lastError: "Missing VoicyClaw token.",
      }),
    );
  });
});

type MockSocketClient = {
  options: MockSocketClientOptions;
  sendText: ReturnType<typeof vi.fn>;
};

type MockSocketClientOptions = {
  token?: string;
  connectTimeoutMs?: number;
  onMessage?: (message: unknown) => Promise<void> | void;
  onTranscript?: (message: unknown) => Promise<void> | void;
};

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}
