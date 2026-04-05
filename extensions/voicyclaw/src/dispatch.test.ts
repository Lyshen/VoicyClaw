import { describe, expect, it, vi } from "vitest";
import { resolveVoicyClawAccount } from "./config.js";
import { dispatchVoicyClawTranscript, replyPayloadToText } from "./dispatch.js";

describe("voicyclaw dispatch", () => {
  it("routes a final transcript into OpenClaw and maps block/final replies", async () => {
    const resolveAgentRoute = vi.fn(() => ({
      agentId: "main",
      accountId: "default",
      sessionKey: "voicyclaw:channel:demo-room",
    }));
    const recordInboundSession = vi.fn(async () => undefined);
    const dispatchReplyWithBufferedBlockDispatcher = vi.fn(
      async ({ dispatcherOptions }) => {
        await dispatcherOptions.deliver(
          { text: "preview chunk" },
          { kind: "block" },
        );
        await dispatcherOptions.deliver(
          { text: "final answer" },
          { kind: "final" },
        );
        return { queuedFinal: false, counts: { final: 1, block: 1, tool: 0 } };
      },
    );
    const finalizeInboundContext = vi.fn((value) => value);
    const client = {
      sendPreview: vi.fn(),
      sendText: vi.fn(),
    };
    const account = resolveVoicyClawAccount(
      {
        channels: {
          voicyclaw: {
            token: "vc-token",
            workspaceId: "workspace-1",
          },
        },
      },
      "default",
    );
    const boundAccount = {
      ...account,
      channelId: "demo-room",
      botId: "demo-bot",
    };

    await dispatchVoicyClawTranscript({
      account: boundAccount,
      cfg: { session: { store: "/tmp/sessions.json" } },
      channelRuntime: {
        routing: {
          resolveAgentRoute,
        },
        session: {
          resolveStorePath: vi.fn(() => "/tmp/sessions.json"),
          readSessionUpdatedAt: vi.fn(() => undefined),
          recordInboundSession,
        },
        reply: {
          resolveEnvelopeFormatOptions: vi.fn(() => ({ style: "plain" })),
          formatAgentEnvelope: vi.fn(({ body }) => body),
          finalizeInboundContext,
          dispatchReplyWithBufferedBlockDispatcher,
        },
      } as never,
      client,
      message: {
        type: "STT_RESULT",
        session_id: "session-1",
        utterance_id: "utt-1",
        text: "hello world",
        is_final: true,
      },
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    });

    expect(resolveAgentRoute).toHaveBeenCalledWith({
      cfg: { session: { store: "/tmp/sessions.json" } },
      channel: "voicyclaw",
      accountId: "default",
      peer: {
        kind: "direct",
        id: "workspace-1:demo-room",
      },
    });
    expect(finalizeInboundContext).toHaveBeenCalledWith(
      expect.objectContaining({
        SessionKey: "voicyclaw:channel:demo-room",
        BodyForAgent: "hello world",
        Provider: "voicyclaw",
        Surface: "voicyclaw",
        OriginatingTo: "voicyclaw:workspace-1:demo-room",
      }),
    );
    expect(recordInboundSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "voicyclaw:channel:demo-room",
      }),
    );
    expect(client.sendPreview).toHaveBeenCalledWith(
      "utt-1",
      "preview chunk",
      false,
    );
    expect(client.sendText).toHaveBeenCalledWith("utt-1", "final answer", true);
  });

  it("normalizes text and media links into a text-only transport payload", () => {
    expect(
      replyPayloadToText({
        text: "answer",
        mediaUrl: "https://example.com/a.png",
        mediaUrls: ["https://example.com/b.png"],
      }),
    ).toBe("answer\nhttps://example.com/a.png\nhttps://example.com/b.png");
  });
});
