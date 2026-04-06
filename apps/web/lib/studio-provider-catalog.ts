export type ProviderMode = "client" | "server"
export type AsrProviderId = "browser" | "demo"
export type TtsProviderId =
  | "browser"
  | "demo"
  | "azure-tts"
  | "azure-streaming-tts"
  | "google-tts"
  | "google-batched-tts"
  | "tencent-tts"
  | "tencent-streaming-tts"
  | "volcengine-tts"
export type ConversationBackendId = "local-bot" | "openclaw-gateway"

export type ProviderOption<T extends string> = {
  id: T
  mode: ProviderMode
  label: string
  summary: string
  runtimeHint: string
}

export type ConversationBackendOption = {
  id: ConversationBackendId
  label: string
  summary: string
  runtimeHint: string
}

export type ProviderGuide = {
  id: string
  label: string
  status: "next" | "planned"
  summary: string
  keyHint: string
}

export const CONVERSATION_BACKEND_OPTIONS: ConversationBackendOption[] = [
  {
    id: "local-bot",
    label: "VoicyClaw Inbound Bot",
    summary:
      "Delivers turns to bots connected through VoicyClaw's inbound bot socket, including starter workspace bots and token-only installs.",
    runtimeHint:
      "Default hosted path for starter workspaces and bots that connect with a VoicyClaw platform key.",
  },
  {
    id: "openclaw-gateway",
    label: "OpenClaw Gateway",
    summary:
      "VoicyClaw sends final transcript turns to an OpenClaw Gateway over its WebSocket chat API.",
    runtimeHint:
      "Use this when your agent already lives behind a Gateway URL and token.",
  },
]

export const ASR_PROVIDER_OPTIONS: ProviderOption<AsrProviderId>[] = [
  {
    id: "browser",
    mode: "client",
    label: "Browser Speech Input",
    summary:
      "Fastest zero-setup ASR path. Uses the browser or OS speech stack directly.",
    runtimeHint:
      "Best for quick iteration when your browser exposes Web Speech.",
  },
  {
    id: "demo",
    mode: "server",
    label: "Built-in Server ASR",
    summary:
      "Routes microphone audio through the VoicyClaw server and keeps a browser transcript assist while vendor ASR adapters are still being wired.",
    runtimeHint:
      "Use this when you want to exercise the server-owned input path without waiting for a vendor adapter.",
  },
]

export const TTS_PROVIDER_OPTIONS: ProviderOption<TtsProviderId>[] = [
  {
    id: "browser",
    mode: "client",
    label: "Browser Voice Output",
    summary:
      "Speaks the bot reply in the browser for the fastest zero-setup voice output.",
    runtimeHint:
      "Recommended when you want the answer read aloud immediately without server audio playback.",
  },
  {
    id: "demo",
    mode: "server",
    label: "Built-in Server TTS",
    summary:
      "Streams built-in PCM frames from the server so the VoicyClaw media pipeline stays visible end to end.",
    runtimeHint:
      "Best when you want to verify the server-side audio path instead of browser voice output.",
  },
  {
    id: "azure-tts",
    mode: "server",
    label: "Azure Speech TTS (Unary)",
    summary:
      "Sends the full bot reply to Azure Speech once, then streams PCM audio chunks back from the server.",
    runtimeHint:
      "Use this when you want the simplest Azure Speech path with official server-side streaming audio output.",
  },
  {
    id: "azure-streaming-tts",
    mode: "server",
    label: "Azure Speech TTS (Segmented)",
    summary:
      "Batches the bot text stream into sentence-ish Azure Speech requests so playback can start earlier without changing the shared server pipeline.",
    runtimeHint:
      "Use this when you want Azure to feel closer to a realtime voice path, while keeping the batching logic isolated inside the provider adapter.",
  },
  {
    id: "google-tts",
    mode: "server",
    label: "Google Cloud TTS (Streaming)",
    summary:
      "Uses Google Chirp 3 HD bidirectional streaming from the VoicyClaw server and returns raw PCM for browser playback.",
    runtimeHint:
      "Use this when you want the best Google realtime voice path with Chirp 3 HD streaming voices.",
  },
  {
    id: "google-batched-tts",
    mode: "server",
    label: "Google Cloud TTS (Batched)",
    summary:
      "Uses Google unary Text-to-Speech with sentence batching in the server for lower-cost WaveNet or Neural2 style playback.",
    runtimeHint:
      "Use this when you want cheaper Google voices with good conversational pacing, without changing the shared server pipeline.",
  },
  {
    id: "tencent-tts",
    mode: "server",
    label: "Tencent Cloud TTS (Unary Streaming)",
    summary:
      "Sends the full bot reply into Tencent Cloud's one-way websocket TTS API and streams raw PCM audio back from the server.",
    runtimeHint:
      "Use this when you want Tencent Cloud's official streaming-audio output path without changing the shared server pipeline.",
  },
  {
    id: "tencent-streaming-tts",
    mode: "server",
    label: "Tencent Cloud TTS (Bidirectional)",
    summary:
      "Uses Tencent Cloud's bidirectional websocket TTS API so text can stream in while PCM audio streams back out.",
    runtimeHint:
      "Use this when you want the closest Tencent Cloud match to a realtime voice path.",
  },
  {
    id: "volcengine-tts",
    mode: "server",
    label: "Volcengine TTS",
    summary:
      "Streams bidirectional Volcengine speech audio from the VoicyClaw server for CN-market low-latency playback.",
    runtimeHint:
      "Requires server-side Volcengine credentials from server config or VOICYCLAW_VOLCENGINE_* environment variables.",
  },
]

export const ASR_PROVIDER_GUIDE: ProviderGuide[] = [
  {
    id: "openai-whisper",
    label: "OpenAI Whisper",
    status: "next",
    summary:
      "Primary server ASR target for a production-grade hosted transcript pipeline.",
    keyHint:
      "Stage an OpenAI ASR key below; server wiring is the next adapter to land.",
  },
  {
    id: "azure-speech",
    label: "Azure Speech",
    status: "planned",
    summary:
      "Enterprise speech stack with wide language coverage and strong regional options.",
    keyHint: "Will require Azure speech credentials once the adapter is added.",
  },
  {
    id: "volcengine-asr",
    label: "Volcengine ASR",
    status: "planned",
    summary:
      "Priority CN server provider for lower-latency regional speech recognition.",
    keyHint: "Will use server-side credentials managed in VoicyClaw settings.",
  },
]

export const TTS_PROVIDER_GUIDE: ProviderGuide[] = [
  {
    id: "openai-tts",
    label: "OpenAI TTS",
    status: "next",
    summary: "Primary server TTS target for natural hosted voice output.",
    keyHint:
      "Stage an OpenAI TTS key below; server synthesis wiring is queued next.",
  },
  {
    id: "openai-tts-planned",
    label: "OpenAI TTS",
    status: "planned",
    summary:
      "Alternative hosted voice path once we broaden beyond browser, built-in server voice, Azure, and Google.",
    keyHint: "Will require an OpenAI API key once that adapter is added.",
  },
  {
    id: "volcengine-tts",
    label: "Volcengine TTS",
    status: "next",
    summary:
      "Available now as a server provider when the backend is configured with Volcengine credentials.",
    keyHint:
      "Use server config or set VOICYCLAW_VOLCENGINE_* env vars; env vars override YAML.",
  },
]

export function getProviderModeLabel(mode: ProviderMode) {
  return mode === "client" ? "Client provider" : "Server provider"
}

export function getAsrProviderOption(providerId: string | undefined) {
  return (
    ASR_PROVIDER_OPTIONS.find((option) => option.id === providerId) ??
    ASR_PROVIDER_OPTIONS[0]
  )
}

export function getTtsProviderOption(providerId: string | undefined) {
  return (
    TTS_PROVIDER_OPTIONS.find((option) => option.id === providerId) ??
    TTS_PROVIDER_OPTIONS[0]
  )
}

export function getConversationBackendOption(backendId: string | undefined) {
  return (
    CONVERSATION_BACKEND_OPTIONS.find((option) => option.id === backendId) ??
    CONVERSATION_BACKEND_OPTIONS[0]
  )
}
