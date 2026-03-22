import { describe, expect, it } from "vitest";

import {
  createHelloMessage,
  parseVoicyClawServerMessage,
  VOICYCLAW_PROTOCOL_VERSION,
} from "./protocol.js";

describe("voicyclaw protocol", () => {
  it("builds the expected HELLO message", () => {
    expect(
      createHelloMessage({
        token: "vc-token",
        botId: "bot-1",
        channelId: "demo-room",
      }),
    ).toEqual({
      type: "HELLO",
      api_key: "vc-token",
      bot_id: "bot-1",
      channel_id: "demo-room",
      protocol_version: VOICYCLAW_PROTOCOL_VERSION,
    });
  });

  it("parses supported server messages and rejects invalid ones", () => {
    expect(
      parseVoicyClawServerMessage({
        type: "WELCOME",
        session_id: "session-1",
        channel_id: "demo-room",
        bot_id: "bot-1",
      }),
    ).toEqual({
      type: "WELCOME",
      session_id: "session-1",
      channel_id: "demo-room",
      bot_id: "bot-1",
    });

    expect(
      parseVoicyClawServerMessage({
        type: "STT_RESULT",
        session_id: "session-1",
        utterance_id: "utt-1",
        text: "hello",
        is_final: true,
      }),
    ).toEqual({
      type: "STT_RESULT",
      session_id: "session-1",
      utterance_id: "utt-1",
      text: "hello",
      is_final: true,
    });

    expect(parseVoicyClawServerMessage({ type: "WELCOME" })).toBeNull();
    expect(parseVoicyClawServerMessage({ type: "UNKNOWN" })).toBeNull();
  });
});
