"use client"

import { Sparkles } from "lucide-react"
import { useEffect, useState } from "react"

import {
  TTS_PROVIDER_OPTIONS,
  type TtsProviderId,
} from "../lib/studio-provider-catalog"
import { useVoiceStudioSession } from "../lib/use-voice-studio-session"
import type { WebRuntimePayload } from "../lib/web-runtime"
import {
  buildConversationEntries,
  ConnectAgentCard,
  ConversationCard,
  RoomConnectionCard,
  type StepDescription,
  type StepId,
  type StepStatus,
  StudioStepCard,
  type VoicePathCardOption,
  VoicePathSelectorCard,
} from "./product-studio-view"

const HOSTED_PROMPTS = [
  "What should I call you?",
  "What do you remember about me?",
  "Give me a short hello in your new voice.",
  "What can you help me do today?",
] as const

const DEFAULT_PROMPTS = [
  "Say hello in your new voice.",
  "What can you help me do?",
  "Give me a short intro.",
  "What should I test next?",
] as const

const STUDIO_STEPS: StepDescription[] = [
  {
    step: "01",
    title: "Connect your agent",
    description:
      "Connect your starter bot or point VoicyClaw at your OpenClaw setup.",
  },
  {
    step: "02",
    title: "Choose a voice path",
    description: "Pick the provider and voice path you want to test.",
  },
  {
    step: "03",
    title: "Start talking",
    description: "Speak naturally and hear the reply back.",
  },
]

const VOICE_PATH_META: Record<
  TtsProviderId,
  Omit<VoicePathCardOption, "id" | "selected" | "onSelect">
> = {
  browser: {
    eyebrow: "Default",
    title: "Browser voice",
    description: "The fastest way to hear replies immediately on this device.",
    routeLabel: "On-device output",
    keywords: ["instant", "zero setup"],
    accentClassName: "from-amber-400/28 via-orange-300/18 to-transparent",
    bars: [
      { id: "a", height: 18, width: 7 },
      { id: "b", height: 28, width: 5 },
      { id: "c", height: 20, width: 6 },
      { id: "d", height: 34, width: 7 },
      { id: "e", height: 24, width: 5 },
      { id: "f", height: 30, width: 6 },
    ],
  },
  demo: {
    eyebrow: "Built-in",
    title: "Server voice",
    description: "Keep audio inside the VoicyClaw media pipeline end to end.",
    routeLabel: "Starter server path",
    keywords: ["server audio", "starter-friendly"],
    accentClassName: "from-emerald-400/24 via-teal-300/16 to-transparent",
    bars: [
      { id: "a", height: 16, width: 6 },
      { id: "b", height: 24, width: 5 },
      { id: "c", height: 32, width: 7 },
      { id: "d", height: 20, width: 5 },
      { id: "e", height: 36, width: 7 },
      { id: "f", height: 26, width: 6 },
    ],
  },
  "azure-tts": {
    eyebrow: "Azure",
    title: "Azure clear",
    description: "Simple Azure output for steady, full-reply playback.",
    routeLabel: "Azure full reply",
    keywords: ["clear", "stable"],
    accentClassName: "from-sky-400/24 via-cyan-300/18 to-transparent",
    bars: [
      { id: "a", height: 18, width: 5 },
      { id: "b", height: 30, width: 6 },
      { id: "c", height: 24, width: 5 },
      { id: "d", height: 38, width: 7 },
      { id: "e", height: 22, width: 5 },
      { id: "f", height: 32, width: 6 },
    ],
  },
  "azure-streaming-tts": {
    eyebrow: "Azure",
    title: "Azure segmented",
    description: "Start Azure playback earlier with segmented streaming.",
    routeLabel: "Azure segmented stream",
    keywords: ["faster start", "server"],
    accentClassName: "from-cyan-400/24 via-sky-300/16 to-transparent",
    bars: [
      { id: "a", height: 20, width: 5 },
      { id: "b", height: 36, width: 7 },
      { id: "c", height: 18, width: 5 },
      { id: "d", height: 32, width: 6 },
      { id: "e", height: 26, width: 5 },
      { id: "f", height: 40, width: 7 },
    ],
  },
  "google-tts": {
    eyebrow: "Google",
    title: "Google live",
    description: "A more realtime Google path with Chirp streaming voices.",
    routeLabel: "Google live stream",
    keywords: ["natural", "streaming"],
    accentClassName: "from-violet-400/24 via-fuchsia-300/16 to-transparent",
    bars: [
      { id: "a", height: 16, width: 6 },
      { id: "b", height: 34, width: 7 },
      { id: "c", height: 22, width: 5 },
      { id: "d", height: 40, width: 7 },
      { id: "e", height: 28, width: 6 },
      { id: "f", height: 18, width: 5 },
    ],
  },
  "google-batched-tts": {
    eyebrow: "Google",
    title: "Google balanced",
    description: "Sentence-batched Google playback with a calmer rhythm.",
    routeLabel: "Google batched playback",
    keywords: ["balanced", "lower cost"],
    accentClassName: "from-indigo-400/22 via-violet-300/16 to-transparent",
    bars: [
      { id: "a", height: 18, width: 5 },
      { id: "b", height: 26, width: 6 },
      { id: "c", height: 22, width: 5 },
      { id: "d", height: 30, width: 6 },
      { id: "e", height: 24, width: 5 },
      { id: "f", height: 28, width: 6 },
    ],
  },
  "tencent-tts": {
    eyebrow: "Tencent",
    title: "Tencent stream",
    description: "Full-reply Tencent output through the server audio path.",
    routeLabel: "Tencent unary stream",
    keywords: ["server", "cn-ready"],
    accentClassName: "from-rose-400/24 via-orange-300/18 to-transparent",
    bars: [
      { id: "a", height: 20, width: 5 },
      { id: "b", height: 28, width: 6 },
      { id: "c", height: 34, width: 7 },
      { id: "d", height: 24, width: 5 },
      { id: "e", height: 36, width: 7 },
      { id: "f", height: 22, width: 5 },
    ],
  },
  "tencent-streaming-tts": {
    eyebrow: "Tencent",
    title: "Tencent live",
    description: "Tencent's closest match to a realtime voice path.",
    routeLabel: "Tencent bidirectional",
    keywords: ["realtime", "cn"],
    accentClassName: "from-pink-400/24 via-rose-300/16 to-transparent",
    bars: [
      { id: "a", height: 18, width: 5 },
      { id: "b", height: 38, width: 7 },
      { id: "c", height: 20, width: 5 },
      { id: "d", height: 34, width: 6 },
      { id: "e", height: 26, width: 5 },
      { id: "f", height: 42, width: 7 },
    ],
  },
  "volcengine-tts": {
    eyebrow: "Volcengine",
    title: "Volcengine CN",
    description: "Low-latency server voice output aimed at CN deployments.",
    routeLabel: "Volcengine low latency",
    keywords: ["cn", "low latency"],
    accentClassName: "from-red-400/24 via-orange-300/16 to-transparent",
    bars: [
      { id: "a", height: 22, width: 6 },
      { id: "b", height: 32, width: 7 },
      { id: "c", height: 18, width: 5 },
      { id: "d", height: 36, width: 7 },
      { id: "e", height: 24, width: 5 },
      { id: "f", height: 30, width: 6 },
    ],
  },
}

export function ProductStudio({
  initialRuntime,
}: {
  initialRuntime: WebRuntimePayload
}) {
  const {
    settings,
    updateSetting,
    onboarding,
    conversationBackend,
    ttsProvider,
    connectionState,
    timeline,
    draftText,
    setDraftText,
    isRecording,
    isBotThinking,
    isBotSpeaking,
    timelineRef,
    botDisplayName,
    starterBotOnline,
    beginCapture,
    finishCapture,
    sendTextUtterance,
    reconnect,
  } = useVoiceStudioSession({
    initialRuntime,
    includeConnectionSummary: false,
  })
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedStep, setSelectedStep] = useState<StepId>(1)

  useEffect(() => {
    setSelectedStep((current) =>
      starterBotOnline && current === 1 ? 2 : current,
    )
  }, [starterBotOnline])

  const gatewayMode = conversationBackend.id === "openclaw-gateway"
  const installCommand =
    gatewayMode && !onboarding
      ? "OpenClaw Gateway already selected"
      : onboarding
        ? `openclaw plugins install ${onboarding.connectorPackageName}`
        : "Sign in to provision your starter workspace"
  const configLine =
    gatewayMode && !onboarding
      ? "Gateway URL and token still live in the advanced route for now."
      : (onboarding?.connectorConfigJson ??
        "Starter config appears here as soon as the starter key is ready.")
  const restartCommand =
    gatewayMode && !onboarding
      ? "Reconnect once your OpenClaw Gateway credentials are ready"
      : onboarding
        ? "openclaw gateway restart"
        : "Refresh after your starter workspace is ready"
  const quickPrompts = onboarding ? HOSTED_PROMPTS : DEFAULT_PROMPTS
  const conversationEntries = buildConversationEntries(timeline, botDisplayName)

  const shellPreviewLines = onboarding
    ? [
        { id: "install", prefix: "$", code: installCommand },
        { id: "config", prefix: "cfg", code: configLine },
        { id: "restart", prefix: "$", code: restartCommand },
      ]
    : [
        { id: "install", prefix: ">", code: "Hosted sign-in required" },
        {
          id: "config",
          prefix: ">",
          code: "Starter workspace appears here after provisioning",
        },
        {
          id: "restart",
          prefix: ">",
          code: "Refresh once setup completes",
        },
      ]

  const stepOneStatus: StepStatus = starterBotOnline ? "done" : "active"
  const stepTwoStatus: StepStatus =
    selectedStep === 3
      ? "done"
      : starterBotOnline || selectedStep === 2
        ? "active"
        : "pending"
  const stepThreeStatus: StepStatus = selectedStep === 3 ? "active" : "pending"

  const voicePathOptions: VoicePathCardOption[] = TTS_PROVIDER_OPTIONS.map(
    (option) => {
      const meta = VOICE_PATH_META[option.id]

      return {
        id: option.id,
        eyebrow: meta.eyebrow,
        title: meta.title,
        description: meta.description,
        routeLabel: meta.routeLabel,
        keywords: meta.keywords,
        accentClassName: meta.accentClassName,
        bars: meta.bars,
        selected: option.id === ttsProvider.id,
        onSelect: () => updateSetting("ttsProvider", option.id),
      }
    },
  )

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current))
      }, 1400)
    } catch {
      setCopiedId(null)
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[2.75rem] border border-amber-100/80 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.10),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,249,240,0.98))] px-6 py-8 text-zinc-900 shadow-[0_40px_120px_rgba(24,24,27,0.12)] lg:px-8 lg:py-10">
      <div className="relative z-10 grid gap-8 xl:grid-cols-[0.74fr_1.26fr]">
        <div className="space-y-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-100/70 px-4 py-1.5 text-sm font-medium text-amber-700">
              <Sparkles className="h-4 w-4" />
              {onboarding ? onboarding.workspace.name : "Hosted setup"}
            </div>

            <div className="max-w-2xl space-y-3">
              <h1 className="text-3xl leading-tight font-semibold tracking-tight text-zinc-900 lg:text-4xl">
                Three steps to make your agent speak.
              </h1>
              <p className="max-w-xl text-[15px] leading-7 text-zinc-600 lg:text-base">
                Connect your bot, choose a voice path, and keep the whole flow
                in Studio.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <StudioStepCard
              {...STUDIO_STEPS[0]}
              status={stepOneStatus}
              selected={selectedStep === 1}
              onSelect={() => setSelectedStep(1)}
            />

            <StudioStepCard
              {...STUDIO_STEPS[1]}
              status={stepTwoStatus}
              selected={selectedStep === 2}
              onSelect={() => setSelectedStep(2)}
            />

            <StudioStepCard
              {...STUDIO_STEPS[2]}
              status={stepThreeStatus}
              selected={selectedStep === 3}
              onSelect={() => setSelectedStep(3)}
            />
          </div>
        </div>

        <div className="flex xl:pl-2">
          {selectedStep === 1 ? (
            <ConnectAgentCard
              title={STUDIO_STEPS[0].title}
              description={
                gatewayMode && !onboarding
                  ? "Point VoicyClaw at your OpenClaw setup, then verify the room is online."
                  : onboarding
                    ? "Run the install command, paste the starter config, restart OpenClaw, then confirm the bot is online."
                    : "Sign in to provision your starter bot, then come back here to finish the connection."
              }
              lines={shellPreviewLines}
              copiedId={copiedId}
              onCopy={(id, text) => void copyText(id, text)}
              connectionTargetLabel={conversationBackend.label}
              workspaceName={
                onboarding?.workspace.name ??
                (gatewayMode ? "Existing OpenClaw setup" : undefined)
              }
              channelId={settings.channelId}
              botId={onboarding?.project.botId}
              starterBotOnline={starterBotOnline}
              connectionState={connectionState}
              botDisplayName={botDisplayName}
              onCheck={() => reconnect()}
              onContinue={() => setSelectedStep(2)}
            />
          ) : selectedStep === 2 ? (
            <VoicePathSelectorCard
              title={STUDIO_STEPS[1].title}
              description={STUDIO_STEPS[1].description}
              connectionReady={starterBotOnline}
              selectedLabel={ttsProvider.label}
              options={voicePathOptions}
              onContinue={() => setSelectedStep(3)}
            />
          ) : starterBotOnline ? (
            <ConversationCard
              draftText={draftText}
              setDraftText={setDraftText}
              isRecording={isRecording}
              isBotThinking={isBotThinking}
              isBotSpeaking={isBotSpeaking}
              timelineRef={timelineRef}
              entries={conversationEntries}
              quickPrompts={quickPrompts}
              beginCapture={beginCapture}
              finishCapture={finishCapture}
              sendTextUtterance={sendTextUtterance}
              botDisplayName={botDisplayName}
            />
          ) : (
            <RoomConnectionCard
              mode="talk"
              starterBotOnline={starterBotOnline}
              connectionState={connectionState}
              botDisplayName={botDisplayName}
              onCheck={() => setSelectedStep(1)}
              onContinue={() => setSelectedStep(3)}
            />
          )}
        </div>
      </div>
    </section>
  )
}
