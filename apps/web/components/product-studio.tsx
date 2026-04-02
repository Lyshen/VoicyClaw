"use client"

import {
  ArrowRight,
  AudioLines,
  Bot,
  CheckCircle2,
  CircleDashed,
  LoaderCircle,
  MessageSquareText,
  Sparkles,
} from "lucide-react"
import { type ReactNode, type RefObject, useEffect, useState } from "react"

import {
  type ConnectionState,
  type TimelineEntry,
  useVoiceStudioSession,
} from "../lib/use-voice-studio-session"

const HOSTED_PROMPTS = [
  "What should I call you?",
  "What do you remember about me?",
  "Give me a short hello in your new voice.",
  "What can you help me do today?",
] as const

const LOCAL_PROMPTS = [
  "Introduce yourself.",
  "Give me a short demo reply.",
  "What can you do in this demo?",
  "Summarize what VoicyClaw does.",
] as const

const VOICE_BARS = [18, 34, 22, 42, 28, 36, 20] as const

type StepId = 1 | 2 | 3
type StepStatus = "done" | "active" | "pending"
type ConversationTimelineEntry = Omit<TimelineEntry, "role"> & {
  role: "user" | "bot" | "preview"
}

export function ProductStudio() {
  const {
    ready,
    onboarding,
    connectionState,
    timeline,
    draftText,
    setDraftText,
    isRecording,
    timelineRef,
    botDisplayName,
    starterBotOnline,
    beginCapture,
    finishCapture,
    sendTextUtterance,
    reconnect,
  } = useVoiceStudioSession({
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
    : "pnpm dev"
  const configLine =
    onboarding?.connectorConfigLine ??
    "Starter key is still provisioning. Refresh in a moment if this stays blank."
  const restartCommand = onboarding ? "openclaw gateway restart" : "pnpm dev"
  const quickPrompts = onboarding ? HOSTED_PROMPTS : LOCAL_PROMPTS
  const conversationEntries = buildConversationEntries(
    timeline.filter(isConversationTimelineEntry),
    botDisplayName,
  )

  const shellPreviewLines = onboarding
    ? [
        { id: "install", prefix: "$", code: installCommand },
        { id: "config", prefix: "cfg", code: configLine },
        { id: "restart", prefix: "$", code: restartCommand },
      ]
    : [
        { id: "install", prefix: "$", code: "pnpm dev" },
        {
          id: "config",
          prefix: ">",
          code: "server + web + mock bot boot together",
        },
        {
          id: "restart",
          prefix: ">",
          code: "wait for demo-room, then click check",
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

  if (!ready) {
    return <StudioBootstrap />
  }

  return (
    <section className="relative overflow-hidden rounded-[2.75rem] border border-amber-100/80 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.10),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,249,240,0.98))] px-6 py-8 text-zinc-900 shadow-[0_40px_120px_rgba(24,24,27,0.12)] lg:px-8 lg:py-10">
      <div className="relative z-10 grid gap-8 xl:grid-cols-[0.74fr_1.26fr]">
        <div className="space-y-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-100/70 px-4 py-1.5 text-sm font-medium text-amber-700">
              <Sparkles className="h-4 w-4" />
              {onboarding ? onboarding.workspace.name : "Local preview"}
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
                    : "Run the local stack. This room turns live when the demo bot joins."}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <StudioStepCard
              step="01"
              title={
                onboarding ? "Add voice in one line" : "Run the local stack"
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
              timelineRef={timelineRef}
              entries={conversationEntries}
              quickPrompts={quickPrompts}
              beginCapture={beginCapture}
              finishCapture={finishCapture}
              sendTextUtterance={sendTextUtterance}
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

function StudioBootstrap() {
  const checklist = [
    "Preparing your workspace",
    "Creating your first voice project",
    "Issuing a starter key",
  ]

  return (
    <section className="relative overflow-hidden rounded-[2.75rem] border border-amber-100/80 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,249,240,0.98))] px-6 py-20 text-zinc-900 shadow-[0_40px_120px_rgba(24,24,27,0.12)]">
      <div className="relative z-10 mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-[0_20px_50px_rgba(245,158,11,0.2)]">
          <LoaderCircle className="h-8 w-8 animate-spin" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Preparing your studio
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-600">
          VoicyClaw is lining up the first-run setup so you can go straight from
          install to conversation.
        </p>

        <div className="mt-10 space-y-3 rounded-[2rem] border border-amber-100 bg-white/80 p-5 text-left shadow-[0_20px_60px_rgba(24,24,27,0.06)]">
          {checklist.map((item, index) => (
            <div
              key={item}
              className="flex items-center gap-3 rounded-2xl border border-amber-100/80 bg-amber-50/70 px-4 py-3"
            >
              {index === checklist.length - 1 ? (
                <LoaderCircle className="h-4 w-4 animate-spin text-amber-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
              <span className="text-sm text-zinc-700">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function StudioStepCard({
  step,
  title,
  status,
  selected,
  onSelect,
}: {
  step: string
  title: string
  status: StepStatus
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      className={`group block w-full cursor-pointer rounded-[2rem] border p-5 text-left transition ${
        selected
          ? "border-amber-300 bg-white ring-2 ring-amber-100 shadow-[0_24px_70px_rgba(245,158,11,0.12)]"
          : status === "done"
            ? "border-emerald-200/90 bg-emerald-50/70 hover:border-emerald-300"
            : status === "active"
              ? "border-zinc-200 bg-white/75 hover:border-amber-200 hover:bg-white"
              : "border-zinc-200/70 bg-white/55 hover:border-zinc-300"
      }`}
      type="button"
      onClick={onSelect}
    >
      <div className="flex items-start gap-5">
        <div
          className={`font-mono text-3xl font-bold ${
            selected
              ? "text-amber-500"
              : status === "done"
                ? "text-emerald-500/75"
                : status === "active"
                  ? "text-amber-400/75"
                  : "text-zinc-300"
          }`}
        >
          {step}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {status === "done" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : status === "active" ? (
                <CircleDashed className="h-4 w-4 text-amber-500" />
              ) : (
                <MessageSquareText className="h-4 w-4 text-zinc-400" />
              )}
              <h2 className="text-lg font-semibold text-zinc-900 lg:text-xl">
                {title}
              </h2>
            </div>

            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${
                selected
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-zinc-200 bg-white/80 text-zinc-500 group-hover:text-zinc-700"
              }`}
            >
              {selected ? "Open" : "View"}
              <ArrowRight
                className={`h-3.5 w-3.5 transition ${
                  selected
                    ? "translate-x-0.5 text-amber-500"
                    : "text-zinc-400 group-hover:translate-x-0.5 group-hover:text-zinc-600"
                }`}
              />
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

function InstallPreviewCard({
  lines,
  copiedId,
  onCopy,
}: {
  lines: Array<{ id: string; prefix: string; code: string }>
  copiedId: string | null
  onCopy: (id: string, text: string) => void
}) {
  return (
    <section className="relative h-[760px] w-full overflow-hidden rounded-[3rem] border border-zinc-900/80 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(251,146,60,0.14),transparent_22%),linear-gradient(180deg,#1c1917,#09090b)] p-2 shadow-[0_40px_120px_rgba(24,24,27,0.32)]">
      <div className="absolute top-0 right-8 h-36 w-36 rounded-full bg-amber-500/20 blur-[84px]" />
      <div className="absolute bottom-8 left-8 h-24 w-24 rounded-full bg-orange-500/10 blur-[64px]" />

      <div className="relative flex h-full flex-col overflow-hidden rounded-[2.6rem] border border-white/12 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_30%),linear-gradient(180deg,rgba(71,63,54,0.42),rgba(27,29,34,0.28))] text-white shadow-[0_30px_90px_rgba(24,24,27,0.28)] backdrop-blur-[20px]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))]" />

        <div className="relative flex items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="rounded-full border border-white/12 bg-white/[0.05] px-4 py-1.5 text-xs font-medium tracking-[0.24em] text-zinc-300 uppercase backdrop-blur-sm">
            Setup
          </span>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col bg-[linear-gradient(180deg,rgba(40,37,34,0.18),rgba(16,17,21,0.10))] px-7 py-7">
          <div className="space-y-1">
            {lines.map((line, index) => (
              <CommandLine
                key={line.id}
                id={line.id}
                prefix={line.prefix}
                code={line.code}
                tone={
                  line.prefix === "cfg"
                    ? "config"
                    : line.prefix === ">"
                      ? "info"
                      : "command"
                }
                actionLabel={copiedId === line.id ? "Copied" : "Copy"}
                onAction={() => onCopy(line.id, line.code)}
                flat
                first={index === 0}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function RoomConnectionCard({
  mode,
  starterBotOnline,
  connectionState,
  botDisplayName,
  onCheck,
  onContinue,
}: {
  mode: "check" | "talk"
  starterBotOnline: boolean
  connectionState: ConnectionState
  botDisplayName: string
  onCheck: () => void
  onContinue: () => void
}) {
  const waiting = !starterBotOnline

  return (
    <RoomShell
      statusLabel={waiting ? "Waiting" : "Live"}
      statusTone={waiting ? "waiting" : "live"}
      icon={<Bot className="h-5 w-5" />}
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <div
          className={`flex h-28 w-28 items-center justify-center rounded-full border ${
            waiting
              ? "border-amber-300/24 bg-amber-400/10 text-amber-100 shadow-[0_18px_46px_rgba(245,158,11,0.12)]"
              : "border-emerald-300/24 bg-emerald-400/10 text-emerald-100 shadow-[0_18px_46px_rgba(16,185,129,0.12)]"
          }`}
        >
          {waiting ? (
            connectionState === "connecting" ? (
              <LoaderCircle className="h-11 w-11 animate-spin" />
            ) : (
              <CircleDashed className="h-11 w-11" />
            )
          ) : (
            <CheckCircle2 className="h-11 w-11" />
          )}
        </div>

        <h3 className="mt-8 text-4xl font-semibold tracking-tight text-white">
          {waiting ? "Bot offline" : "Bot online"}
        </h3>
        <p className="mt-4 text-base leading-7 text-zinc-300">
          {waiting
            ? mode === "check"
              ? "Finish setup, then run one check."
              : "Wait here until your bot comes online."
            : botDisplayName}
        </p>

        <button
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-amber-500 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400"
          type="button"
          onClick={waiting ? onCheck : onContinue}
        >
          {waiting
            ? getCheckButtonLabel(connectionState, starterBotOnline)
            : "Open talk"}
        </button>
      </div>
    </RoomShell>
  )
}

function ConversationCard({
  draftText,
  setDraftText,
  isRecording,
  timelineRef,
  entries,
  quickPrompts,
  beginCapture,
  finishCapture,
  sendTextUtterance,
}: {
  draftText: string
  setDraftText: (value: string) => void
  isRecording: boolean
  timelineRef: RefObject<HTMLDivElement | null>
  entries: ConversationBubble[]
  quickPrompts: readonly string[]
  beginCapture: () => Promise<void>
  finishCapture: () => void
  sendTextUtterance: (overrideText?: string) => void
}) {
  return (
    <RoomShell
      statusLabel="Live"
      statusTone="live"
      icon={<AudioLines className="h-5 w-5" />}
    >
      <div className="flex min-h-0 flex-1 flex-col px-3 pt-12 pb-3">
        <div className="shrink-0 pb-3">
          <div className="flex items-center justify-center">
            <VoicePulseOrb
              active={
                isRecording || entries.some((entry) => entry.role === "preview")
              }
            />
          </div>
        </div>

        <div
          ref={timelineRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1"
        >
          {entries.length === 0 ? (
            <article className="max-w-[90%] rounded-[1.9rem] border border-white/10 bg-white/[0.05] px-4 py-4">
              <p className="text-xs font-medium tracking-[0.22em] text-zinc-500 uppercase">
                First prompt
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Ask its name, ask what it remembers, or let it introduce itself
                in the new voice.
              </p>
            </article>
          ) : (
            entries.map((entry) => (
              <article
                key={entry.id}
                className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-[1.75rem] px-4 py-3 ${
                    entry.role === "user"
                      ? "bg-amber-500 text-zinc-950"
                      : entry.role === "preview"
                        ? "border border-amber-400/20 bg-amber-500/10 text-amber-50"
                        : "border border-white/8 bg-white/[0.05] text-white"
                  }`}
                >
                  <p
                    className={`text-xs font-medium tracking-[0.22em] uppercase ${
                      entry.role === "user"
                        ? "text-zinc-900/70"
                        : entry.role === "preview"
                          ? "text-amber-100/70"
                          : "text-zinc-500"
                    }`}
                  >
                    {entry.label}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                    {entry.text}
                  </p>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="mt-4 shrink-0 border-t border-white/10 pt-4">
          {entries.length === 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-zinc-200 transition hover:border-amber-300/30 hover:bg-amber-500/10 hover:text-white"
                  type="button"
                  onClick={() => sendTextUtterance(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          <div className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.12)]">
            <textarea
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault()
                  sendTextUtterance()
                }
              }}
              placeholder="Speak or type here."
              className="min-h-16 w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-6 text-white outline-none placeholder:text-zinc-500"
            />

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-amber-500 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400"
                type="button"
                onClick={() => sendTextUtterance()}
              >
                Send message
              </button>
              <button
                className={`inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-sm font-semibold transition ${
                  isRecording
                    ? "border-amber-300/30 bg-amber-500/14 text-amber-100"
                    : "border-white/10 bg-white/[0.04] text-zinc-200 hover:border-amber-300/30 hover:bg-amber-500/10"
                }`}
                type="button"
                onPointerDown={() => void beginCapture()}
                onPointerUp={finishCapture}
                onPointerLeave={finishCapture}
                onPointerCancel={finishCapture}
              >
                {isRecording ? "Release to send" : "Hold to talk"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </RoomShell>
  )
}

function RoomShell({
  statusLabel,
  statusTone,
  icon,
  children,
}: {
  statusLabel: string
  statusTone: "setup" | "waiting" | "live"
  icon: ReactNode
  children: ReactNode
}) {
  const statusClasses =
    statusTone === "live"
      ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-100"
      : statusTone === "waiting"
        ? "border-amber-400/20 bg-amber-500/12 text-amber-100"
        : "border-white/10 bg-white/[0.06] text-zinc-100"
  const dotClasses =
    statusTone === "live"
      ? "bg-emerald-300"
      : statusTone === "waiting"
        ? "bg-amber-300"
        : "bg-zinc-300"

  return (
    <section className="relative h-[760px] w-full overflow-hidden rounded-[3rem] border border-zinc-900/80 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(251,146,60,0.14),transparent_22%),linear-gradient(180deg,#1c1917,#09090b)] p-2 shadow-[0_40px_120px_rgba(24,24,27,0.32)]">
      <div className="absolute top-0 right-8 h-36 w-36 rounded-full bg-amber-500/20 blur-[84px]" />
      <div className="absolute bottom-8 left-8 h-24 w-24 rounded-full bg-orange-500/10 blur-[64px]" />

      <div className="relative flex h-full flex-col overflow-hidden rounded-[2.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(112,118,130,0.10),rgba(58,62,72,0.13))] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
        <div className="pointer-events-none absolute top-3.5 left-3.5 rounded-2xl border border-white/8 bg-black/8 p-2.5 text-amber-300">
          {icon}
        </div>
        <div className="absolute top-3.5 right-3.5 z-10">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${statusClasses}`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${dotClasses}`} />
            {statusLabel}
          </span>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </section>
  )
}

function CommandLine({
  id,
  prefix,
  code,
  tone = "command",
  actionLabel,
  onAction,
  flat = false,
  first = false,
}: {
  id: string
  prefix: string
  code: string
  tone?: "command" | "config" | "info"
  actionLabel?: string
  onAction?: () => void
  flat?: boolean
  first?: boolean
}) {
  if (flat) {
    return (
      <div
        className={`group flex items-start gap-4 px-4 py-5 ${
          first ? "" : "border-t border-white/10"
        } ${
          tone === "config"
            ? "rounded-[1.8rem] bg-[linear-gradient(180deg,rgba(245,158,11,0.14),rgba(249,115,22,0.08))] ring-1 ring-inset ring-amber-300/24 backdrop-blur-sm"
            : "bg-transparent"
        }`}
        data-command-id={id}
      >
        <span
          className={`mt-0.5 font-mono text-xs font-semibold uppercase tracking-[0.24em] ${
            prefix === "$"
              ? "text-amber-300"
              : prefix === "cfg"
                ? "text-amber-100/70"
                : "text-zinc-500"
          }`}
        >
          {prefix}
        </span>
        <code
          className={`min-w-0 flex-1 break-all font-mono text-[13px] leading-7 ${
            tone === "config" ? "text-white" : "text-zinc-100"
          }`}
        >
          {code}
        </code>
        {onAction && actionLabel ? (
          <button
            className={`shrink-0 rounded-full border bg-white/[0.04] px-3 py-1 text-xs font-medium transition backdrop-blur-sm ${
              tone === "config"
                ? "border-amber-300/22 text-amber-50 hover:border-amber-300/40 hover:bg-amber-500/12"
                : "border-white/12 text-zinc-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            }`}
            type="button"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    )
  }

  const shellClasses =
    tone === "config"
      ? "border-amber-300/20 bg-amber-500/12 shadow-[0_12px_36px_rgba(245,158,11,0.08)]"
      : tone === "info"
        ? "border-white/10 bg-white/[0.08]"
        : "border-white/10 bg-[#161616]"
  const actionClasses =
    tone === "config"
      ? "border-amber-300/20 text-amber-50 hover:border-amber-300/40 hover:bg-amber-500/12"
      : "border-white/10 text-zinc-300 hover:border-white/20 hover:bg-white/5 hover:text-white"

  return (
    <div
      className={`group flex items-start gap-3 rounded-[1.4rem] border px-4 py-3 ${shellClasses}`}
      data-command-id={id}
    >
      <span
        className={`mt-0.5 font-mono text-xs font-semibold uppercase tracking-[0.24em] ${
          prefix === "$"
            ? "text-amber-300"
            : prefix === "cfg"
              ? "text-amber-100/70"
              : "text-zinc-500"
        }`}
      >
        {prefix}
      </span>
      <code
        className={`min-w-0 flex-1 break-all font-mono text-[13px] leading-6 ${
          tone === "config" ? "text-white" : "text-zinc-100"
        }`}
      >
        {code}
      </code>
      {onAction && actionLabel ? (
        <button
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${actionClasses}`}
          type="button"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

function VoicePulseOrb({ active }: { active: boolean }) {
  return (
    <div
      className={`flex h-30 w-30 items-center justify-center rounded-full border transition ${
        active
          ? "border-orange-300/40 bg-[radial-gradient(circle_at_center,rgba(251,146,60,0.44),rgba(249,115,22,0.24),rgba(245,158,11,0.10),transparent_72%)] shadow-[0_26px_72px_rgba(249,115,22,0.34)]"
          : "border-orange-300/24 bg-[radial-gradient(circle_at_center,rgba(251,146,60,0.24),rgba(249,115,22,0.12),transparent_72%)] shadow-[0_18px_50px_rgba(249,115,22,0.16)]"
      }`}
    >
      <div className="flex h-10 items-end gap-1.5">
        {VOICE_BARS.slice(1, 6).map((height, index) => (
          <span
            key={height}
            className={`w-1.5 rounded-full ${
              active ? "bg-orange-50 animate-pulse" : "bg-orange-200/90"
            }`}
            style={{
              height: active ? height : Math.max(10, height / 3),
              animationDelay: `${index * 120}ms`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

type ConversationBubble = {
  id: string
  role: "user" | "bot" | "preview"
  label: string
  text: string
}

function buildConversationEntries(
  entries: ConversationTimelineEntry[],
  botDisplayName: string,
) {
  return entries
    .filter((entry) => {
      if (entry.role !== "preview") {
        return true
      }

      const utteranceId = entry.id.replace(/^preview-/, "")
      return !entries.some(
        (candidate) =>
          candidate.role === "bot" && candidate.id === `bot-${utteranceId}`,
      )
    })
    .map((entry) => ({
      id: entry.id,
      role: entry.role,
      label:
        entry.role === "user"
          ? "You"
          : entry.role === "preview"
            ? `${botDisplayName} is speaking`
            : botDisplayName,
      text: entry.text,
    }))
}

function isConversationTimelineEntry(
  entry: TimelineEntry,
): entry is ConversationTimelineEntry {
  return entry.role !== "system"
}

function getCheckButtonLabel(
  connectionState: ConnectionState,
  starterBotOnline: boolean,
) {
  if (starterBotOnline) {
    return "Bot is online"
  }

  if (connectionState === "connecting") {
    return "Checking..."
  }

  return "Check bot connection"
}
