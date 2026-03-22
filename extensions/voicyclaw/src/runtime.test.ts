import { describe, expect, it } from "vitest";

import { resolveVoicyClawAccount } from "./config.js";
import { createVoicyClawRuntime } from "./runtime.js";

describe("voicyclaw runtime", () => {
  it("tracks start, connect, traffic, and disconnect transitions", () => {
    const runtime = createVoicyClawRuntime();
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

    runtime.markStarting(account);
    runtime.markConnected(account, "session-1");
    runtime.markInbound(account.accountId);
    runtime.markOutbound(account.accountId);
    runtime.markDisconnected(account, "socket closed");

    expect(runtime.getSnapshot(account.accountId)).toMatchObject({
      accountId: "default",
      connected: false,
      running: true,
      reconnectAttempts: 1,
      lastError: "socket closed",
    });
  });

  it("marks stopped connectors as no longer running", () => {
    const runtime = createVoicyClawRuntime();
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

    runtime.markStarting(account);
    runtime.markStopped(account);

    expect(runtime.getSnapshot(account.accountId)).toMatchObject({
      running: false,
      connected: false,
      sessionId: null,
    });
  });
});
