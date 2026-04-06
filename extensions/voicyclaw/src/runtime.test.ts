import { describe, expect, it } from "vitest";

import { bindVoicyClawAccount, resolveVoicyClawAccount } from "./config.js";
import { createVoicyClawRuntime } from "./runtime.js";

describe("voicyclaw runtime", () => {
  it("tracks start, connect, traffic, and disconnect transitions", () => {
    const runtime = createVoicyClawRuntime();
    const account = resolveVoicyClawAccount({
      channels: {
        voicyclaw: {
          token: "vc-token",
        },
      },
    });
    const connectedAccount = bindVoicyClawAccount(account, {
      channel_id: "demo-room",
      bot_id: "demo-bot",
      bot_name: "Demo Bot",
    });

    runtime.markStarting(account);
    runtime.markConnected(connectedAccount, "session-1");
    runtime.markInbound(account.accountId);
    runtime.markOutbound(account.accountId);
    runtime.markDisconnected(connectedAccount, "socket closed");

    expect(runtime.getSnapshot(account.accountId)).toMatchObject({
      accountId: "default",
      name: "Demo Bot",
      channelId: "demo-room",
      botId: "demo-bot",
      connected: false,
      running: true,
      reconnectAttempts: 1,
      lastError: "socket closed",
    });
  });

  it("marks stopped connectors as no longer running", () => {
    const runtime = createVoicyClawRuntime();
    const account = resolveVoicyClawAccount({
      channels: {
        voicyclaw: {
          token: "vc-token",
        },
      },
    });

    runtime.markStarting(account);
    runtime.markStopped(account);

    expect(runtime.getSnapshot(account.accountId)).toMatchObject({
      running: false,
      connected: false,
      sessionId: null,
    });
  });
});
