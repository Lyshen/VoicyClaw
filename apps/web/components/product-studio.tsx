"use client"

import { Sparkles } from "lucide-react"
import { useEffect, useState } from "react"

import { useVoiceStudioSession } from "../lib/use-voice-studio-session"
import type { WebRuntimePayload } from "../lib/web-runtime"
import {
  buildConversationEntries,
  ConversationCard,
  InstallPreviewCard,
  RoomConnectionCard,
  type StepId,
  type StepStatus,
  StudioStepCard,
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

export function ProductStudio({
  initialRuntime,
}: {
  initialRuntime: WebRuntimePayload
}) {
  const {
    onboarding,
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
    if (starterBotOnline) {
      setSelectedStep(3)
    }
  }, [starterBotOnline])

  const installCommand = onboarding
    ? `openclaw plugins install ${onboarding.connectorPackageName}`
    : "Sign in to provision your starter workspace"
  const configLine =
    onboarding?.connectorConfigLine ??
    "Starter workspace is still provisioning. Refresh in a moment if this stays blank."
  const restartCommand = onboarding
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
          code: "Open Account or refresh once setup completes",
        },
      ]

  const stepOneStatus: StepStatus = onboarding?.starterKey?.value
    ? "done"
    : onboarding
      ? "active"
      : "done"
  const stepTwoStatus: StepStatus = starterBotOnline ? "done" : "active"
  const stepThreeStatus: StepStatus = starterBotOnline ? "active" : "pending"

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
                Three steps to hear your bot.
              </h1>
              <p className="max-w-xl text-[15px] leading-7 text-zinc-600 lg:text-base">
                {starterBotOnline
                  ? `${botDisplayName} is live. Ask its name and keep talking.`
                  : onboarding
                    ? "Install once. This room turns live when your bot joins."
                    : "Sign in once. This room turns live when your starter workspace is ready."}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <StudioStepCard
              step="01"
              title={
                onboarding
                  ? "Add voice in one line"
                  : "Provision starter workspace"
              }
              status={stepOneStatus}
              selected={selectedStep === 1}
              onSelect={() => setSelectedStep(1)}
            />

            <StudioStepCard
              step="02"
              title="Check bot online"
              status={stepTwoStatus}
              selected={selectedStep === 2}
              onSelect={() => setSelectedStep(2)}
            />

            <StudioStepCard
              step="03"
              title="Start talking"
              status={stepThreeStatus}
              selected={selectedStep === 3}
              onSelect={() => setSelectedStep(3)}
            />
          </div>
        </div>

        <div className="flex xl:pl-2">
          {selectedStep === 1 ? (
            <InstallPreviewCard
              lines={shellPreviewLines}
              copiedId={copiedId}
              onCopy={(id, text) => void copyText(id, text)}
            />
          ) : selectedStep === 2 ? (
            <RoomConnectionCard
              mode="check"
              starterBotOnline={starterBotOnline}
              connectionState={connectionState}
              botDisplayName={botDisplayName}
              onCheck={() => {
                setSelectedStep(2)
                reconnect()
              }}
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
              onCheck={() => {
                setSelectedStep(2)
                reconnect()
              }}
              onContinue={() => setSelectedStep(3)}
            />
          )}
        </div>
      </div>
    </section>
  )
}
