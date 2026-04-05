export const VOICYCLAW_PROTOCOL_VERSION = "0.1" as const;

export type VoicyClawProtocolVersion = typeof VOICYCLAW_PROTOCOL_VERSION;

export type VoicyClawHelloMessage = {
  type: "HELLO";
  api_key: string;
  protocol_version: VoicyClawProtocolVersion;
};

export type VoicyClawWelcomeMessage = {
  type: "WELCOME";
  session_id: string;
  channel_id: string;
  bot_id: string;
  bot_name?: string;
};

export type VoicyClawErrorMessage = {
  type: "ERROR";
  code:
    | "AUTH_FAILED"
    | "BOT_ALREADY_CONNECTED"
    | "PROTOCOL_VERSION_UNSUPPORTED";
  message: string;
};

export type VoicyClawDisconnectMessage = {
  type: "DISCONNECT";
  session_id: string;
  reason: string;
};

export type VoicyClawAudioStartMessage = {
  type: "AUDIO_START";
  session_id: string;
  utterance_id: string;
};

export type VoicyClawAudioEndMessage = {
  type: "AUDIO_END";
  session_id: string;
  utterance_id: string;
};

export type VoicyClawSttResultMessage = {
  type: "STT_RESULT";
  session_id: string;
  utterance_id: string;
  text: string;
  is_final: boolean;
};

export type VoicyClawTtsTextMessage = {
  type: "TTS_TEXT";
  session_id: string;
  utterance_id: string;
  text: string;
  is_final: boolean;
};

export type VoicyClawPreviewTextMessage = {
  type: "BOT_PREVIEW";
  session_id: string;
  utterance_id: string;
  text: string;
  is_final: boolean;
};

export type VoicyClawServerMessage =
  | VoicyClawWelcomeMessage
  | VoicyClawErrorMessage
  | VoicyClawDisconnectMessage
  | VoicyClawAudioStartMessage
  | VoicyClawAudioEndMessage
  | VoicyClawSttResultMessage;

export function createHelloMessage(params: {
  token: string;
}): VoicyClawHelloMessage {
  return {
    type: "HELLO",
    api_key: params.token,
    protocol_version: VOICYCLAW_PROTOCOL_VERSION,
  };
}

export function createPreviewTextMessage(params: {
  sessionId: string;
  utteranceId: string;
  text: string;
  isFinal?: boolean;
}): VoicyClawPreviewTextMessage {
  return {
    type: "BOT_PREVIEW",
    session_id: params.sessionId,
    utterance_id: params.utteranceId,
    text: params.text,
    is_final: params.isFinal ?? false,
  };
}

export function createTtsTextMessage(params: {
  sessionId: string;
  utteranceId: string;
  text: string;
  isFinal?: boolean;
}): VoicyClawTtsTextMessage {
  return {
    type: "TTS_TEXT",
    session_id: params.sessionId,
    utterance_id: params.utteranceId,
    text: params.text,
    is_final: params.isFinal ?? true,
  };
}

export function parseVoicyClawServerMessage(
  value: unknown,
): VoicyClawServerMessage | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }

  switch (value.type) {
    case "WELCOME":
      return isString(value.session_id) &&
        isString(value.channel_id) &&
        isString(value.bot_id)
        ? {
            type: "WELCOME",
            session_id: value.session_id,
            channel_id: value.channel_id,
            bot_id: value.bot_id,
            bot_name: isString(value.bot_name) ? value.bot_name : undefined,
          }
        : null;

    case "ERROR":
      return isString(value.code) && isString(value.message)
        ? {
            type: "ERROR",
            code: value.code as VoicyClawErrorMessage["code"],
            message: value.message,
          }
        : null;

    case "DISCONNECT":
      return isString(value.session_id) && isString(value.reason)
        ? {
            type: "DISCONNECT",
            session_id: value.session_id,
            reason: value.reason,
          }
        : null;

    case "AUDIO_START":
      return isString(value.session_id) && isString(value.utterance_id)
        ? {
            type: "AUDIO_START",
            session_id: value.session_id,
            utterance_id: value.utterance_id,
          }
        : null;

    case "AUDIO_END":
      return isString(value.session_id) && isString(value.utterance_id)
        ? {
            type: "AUDIO_END",
            session_id: value.session_id,
            utterance_id: value.utterance_id,
          }
        : null;

    case "STT_RESULT":
      return isString(value.session_id) &&
        isString(value.utterance_id) &&
        isString(value.text) &&
        typeof value.is_final === "boolean"
        ? {
            type: "STT_RESULT",
            session_id: value.session_id,
            utterance_id: value.utterance_id,
            text: value.text,
            is_final: value.is_final,
          }
        : null;

    default:
      return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
