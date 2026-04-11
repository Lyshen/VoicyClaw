"use client"

import {
  AudioLines,
  Bot,
  Cable,
  LoaderCircle,
  Mic,
  Send,
  Sparkles,
  Volume2,
} from "lucide-react"
import { useMemo } from "react"

import type { Starter2RoomDefinition } from "../lib/starter2-room"
import { useVoiceStudioSession } from "../lib/use-voice-studio-session"
import type { TimelineEntry } from "../lib/voice-studio-session-helpers"
import type { WebRuntimePayload } from "../lib/web-runtime"

const QUICK_PROMPTS = [
  "Claude, give me a crisp plan for this product MVP.",
  "Gemini and DeepSeek, compare two room interaction designs.",
  "OpenAI, summarize what CALL and CLAIM should do in this room.",
  "Everyone, propose a simple Starter 2 demo flow.",
] as const

export function Starter2RoomExperience({
  initialRuntime,
  room,
}: {
  initialRuntime: WebRuntimePayload
  room: Starter2RoomDefinition
}) {
  const {
    connectionState,
    timeline,
    draftText,
    setDraftText,
    timelineRef,
    isRecording,
    isBotThinking,
    beginCapture,
    finishCapture,
    sendTextUtterance,
    reconnect,
  } = useVoiceStudioSession({
    initialRuntime,
    includeConnectionSummary: false,
    introMessage: room.llmProvider.configured
      ? `${room.title} is ready. Mention one or more agents to trigger CALL actions and see CLAIM / DROP events in the room timeline.`
      : `${room.title} is ready in fallback mode. Configure an OpenRouter key on the server to switch the room from mock replies to real model replies.`,
  })

  const conversationEntries = useMemo(
    () =>
      timeline.filter(
        (
          entry,
        ): entry is TimelineEntry & {
          role: "user" | "bot" | "preview"
        } =>
          entry.role === "user" ||
          entry.role === "bot" ||
          entry.role === "preview",
      ),
    [timeline],
  )

  const orchestrationEntries = useMemo(
    () =>
      timeline.filter(
        (entry): entry is TimelineEntry & { role: "orchestration" } =>
          entry.role === "orchestration",
      ),
    [timeline],
  )

  return (
    <section className="relative overflow-hidden rounded-[2.75rem] border border-amber-100/80 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.10),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,249,240,0.98))] px-6 py-8 text-zinc-900 shadow-[0_40px_120px_rgba(24,24,27,0.12)] lg:px-8 lg:py-10">
      <div className="relative z-10 space-y-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-100/70 px-4 py-1.5 text-sm font-medium text-amber-700">
              <Sparkles className="h-4 w-4" />
              Starter 2 Multi-Agent Room
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl leading-tight font-semibold tracking-tight text-zinc-900 lg:text-4xl">
                {room.title}
              </h1>
              <p className="max-w-3xl text-[15px] leading-7 text-zinc-600 lg:text-base">
                A simple room-first product surface for testing explicit agent
                calls, visible CLAIM / DROP behavior, and text-first backend
                orchestration.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StatusPill
              label={connectionState}
              tone={connectionTone(connectionState)}
            />
            <StatusPill
              label={
                room.llmProvider.configured
                  ? "OpenRouter ready"
                  : "Fallback replies"
              }
              tone={room.llmProvider.configured ? "live" : "warn"}
            />
            <StatusPill label={room.channelId} tone="neutral" mono />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <section className="rounded-[2rem] border border-zinc-200 bg-white/85 p-5 shadow-[0_24px_64px_rgba(24,24,27,0.08)]">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-zinc-950 p-3 text-amber-300 shadow-lg shadow-zinc-950/10">
                  <Cable className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold tracking-[0.22em] text-zinc-500 uppercase">
                    Room runtime
                  </p>
                  <p className="text-sm leading-6 text-zinc-600">
                    Provider: {room.llmProvider.id} · Base URL:{" "}
                    {room.llmProvider.baseUrl}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-zinc-200 bg-white/85 p-5 shadow-[0_24px_64px_rgba(24,24,27,0.08)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.22em] text-zinc-500 uppercase">
                    Agents
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-zinc-900">
                    Default room cast
                  </h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
                  <Bot className="h-3.5 w-3.5" />
                  {room.agents.length} agents
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {room.agents.map((agent) => (
                  <article
                    key={agent.id}
                    className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50/90 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-900">
                          {agent.name}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                          {agent.model}
                        </p>
                      </div>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                        {agent.modelProvider}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-zinc-600">
                      <div className="flex items-center gap-2">
                        <Volume2 className="h-3.5 w-3.5 text-zinc-400" />
                        <span>
                          Preferred TTS: {agent.preferredTtsProvider}
                          {agent.preferredTtsVoice
                            ? ` · ${agent.preferredTtsVoice}`
                            : ""}
                        </span>
                      </div>
                      <p className="leading-5 text-zinc-500">{agent.prompt}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </aside>

          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="relative min-h-[760px] overflow-hidden rounded-[3rem] border border-zinc-900/80 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(251,146,60,0.14),transparent_22%),linear-gradient(180deg,#1c1917,#09090b)] p-2 shadow-[0_40px_120px_rgba(24,24,27,0.32)]">
              <div className="absolute top-0 right-8 h-36 w-36 rounded-full bg-amber-500/20 blur-[84px]" />
              <div className="absolute bottom-8 left-8 h-24 w-24 rounded-full bg-orange-500/10 blur-[64px]" />

              <div className="relative flex h-full min-h-[744px] flex-col overflow-hidden rounded-[2.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(112,118,130,0.10),rgba(58,62,72,0.13))] backdrop-blur-xl">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />

                <div className="relative flex items-center justify-between gap-4 border-b border-white/10 px-6 py-5 text-white">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.22em] text-amber-200 uppercase">
                      Conversation
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                      Text-first room trial
                    </h2>
                  </div>
                  <button
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-zinc-200 transition hover:border-amber-300/30 hover:bg-amber-500/10"
                    type="button"
                    onClick={() => reconnect()}
                  >
                    Reconnect
                  </button>
                </div>

                <div
                  ref={timelineRef}
                  className="relative min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5"
                >
                  {conversationEntries.length === 0 ? (
                    <article className="max-w-[90%] rounded-[1.9rem] border border-white/10 bg-white/[0.05] px-4 py-4 text-white">
                      <p className="text-xs font-medium tracking-[0.22em] text-zinc-500 uppercase">
                        First prompt
                      </p>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">
                        Mention one or more agents directly, for example “Claude
                        and Gemini” or “Everyone”.
                      </p>
                    </article>
                  ) : (
                    conversationEntries.map((entry) => (
                      <article
                        key={entry.id}
                        className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-[1.75rem] px-4 py-3 ${bubbleClassName(entry.role)}`}
                        >
                          <p
                            className={`text-xs font-medium tracking-[0.22em] uppercase ${bubbleLabelClassName(entry.role)}`}
                          >
                            {entry.title}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                            {entry.text}
                          </p>
                          <p className="mt-2 text-[11px] text-zinc-400">
                            {entry.meta}
                          </p>
                        </div>
                      </article>
                    ))
                  )}

                  {isBotThinking ? (
                    <article className="flex justify-start">
                      <div className="max-w-[88%] rounded-[1.75rem] border border-white/8 bg-white/[0.05] px-4 py-3 text-white">
                        <p className="text-xs font-medium tracking-[0.22em] text-zinc-500 uppercase">
                          Room
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-sm leading-6 text-zinc-300">
                          <span>Agents are thinking</span>
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                    </article>
                  ) : null}
                </div>

                <div className="relative border-t border-white/10 px-5 py-4">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {QUICK_PROMPTS.map((prompt) => (
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

                  <div className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.12)]">
                    <textarea
                      value={draftText}
                      onChange={(event) => setDraftText(event.target.value)}
                      onKeyDown={(event) => {
                        if (
                          (event.metaKey || event.ctrlKey) &&
                          event.key === "Enter"
                        ) {
                          event.preventDefault()
                          sendTextUtterance()
                        }
                      }}
                      placeholder="Type to the room. Example: Claude and DeepSeek, compare two approaches."
                      className="min-h-20 w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-6 text-white outline-none placeholder:text-zinc-500"
                    />

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-amber-500 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400"
                        type="button"
                        onClick={() => sendTextUtterance()}
                      >
                        <Send className="h-4 w-4" />
                        Send to room
                      </button>
                      <button
                        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition ${
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
                        <Mic className="h-4 w-4" />
                        {isRecording ? "Release to send" : "Hold to talk"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[2.5rem] border border-zinc-200 bg-white/85 p-5 shadow-[0_24px_64px_rgba(24,24,27,0.08)]">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-zinc-950 p-3 text-amber-300 shadow-lg shadow-zinc-950/10">
                  <AudioLines className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-[0.22em] text-zinc-500 uppercase">
                    Orchestration
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-zinc-900">
                    CALL / CLAIM / DROP
                  </h2>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {orchestrationEntries.length === 0 ? (
                  <article className="rounded-[1.6rem] border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-4">
                    <p className="text-sm leading-6 text-zinc-500">
                      No orchestration events yet. Mention an agent name to
                      trigger a visible room action.
                    </p>
                  </article>
                ) : (
                  orchestrationEntries.map((entry) => (
                    <article
                      key={entry.id}
                      className={`rounded-[1.6rem] border px-4 py-4 ${eventCardClassName(entry.title)}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold tracking-[0.22em] uppercase">
                          {entry.title}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {entry.meta}
                        </p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-zinc-700">
                        {entry.text}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  )
}

function bubbleClassName(role: "user" | "bot" | "preview") {
  if (role === "user") {
    return "bg-amber-500 text-zinc-950"
  }

  if (role === "preview") {
    return "border border-amber-400/20 bg-amber-500/10 text-amber-50"
  }

  return "border border-white/8 bg-white/[0.05] text-white"
}

function bubbleLabelClassName(role: "user" | "bot" | "preview") {
  if (role === "user") {
    return "text-zinc-900/70"
  }

  if (role === "preview") {
    return "text-amber-100/70"
  }

  return "text-zinc-500"
}

function eventCardClassName(title: string) {
  if (title === "CALL") {
    return "border-amber-200 bg-amber-50/80"
  }

  if (title === "CLAIM") {
    return "border-emerald-200 bg-emerald-50/80"
  }

  return "border-zinc-200 bg-zinc-50/80"
}

function connectionTone(state: string): "live" | "warn" | "neutral" {
  if (state === "connected") {
    return "live"
  }

  if (state === "error" || state === "disconnected") {
    return "warn"
  }

  return "neutral"
}

function StatusPill({
  label,
  tone,
  mono = false,
}: {
  label: string
  tone: "live" | "warn" | "neutral"
  mono?: boolean
}) {
  const className =
    tone === "live"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-zinc-200 bg-white text-zinc-600"

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${className} ${mono ? "font-mono text-xs" : ""}`}
    >
      {tone === "live" ? (
        <Bot className="h-3.5 w-3.5" />
      ) : (
        <Cable className="h-3.5 w-3.5" />
      )}
      {label}
    </span>
  )
}
