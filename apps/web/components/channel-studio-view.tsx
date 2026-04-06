"use client"

import { badgeTone } from "../lib/use-voice-studio-session"
import type {
  ConnectionState,
  TimelineEntry,
} from "../lib/voice-studio-session-helpers"

type ChannelStudioViewProps = {
  settings: {
    channelId: string
  }
  onboarding: {
    workspace: { name: string }
    project: { name: string; channelId: string; botId: string }
  } | null
  connectionState: ConnectionState
  timeline: TimelineEntry[]
  draftText: string
  setDraftText: (value: string) => void
  channelState: {
    botCount: number
    clientCount: number
  } | null
  micLevel: number
  isRecording: boolean
  asrProviderLabel: string
  ttsProviderLabel: string
  timelineRef: React.RefObject<HTMLDivElement | null>
  botDisplayName: string
  adapterSummary: string
  speechStatus: string
  starterBotOnline: boolean
  onBeginCapture: () => Promise<void>
  onFinishCapture: () => void
  onSendTextUtterance: () => void
  onReconnect: () => void
}

export function ChannelStudioView({
  settings,
  onboarding,
  connectionState,
  timeline,
  draftText,
  setDraftText,
  channelState,
  micLevel,
  isRecording,
  asrProviderLabel,
  ttsProviderLabel,
  timelineRef,
  botDisplayName,
  adapterSummary,
  speechStatus,
  starterBotOnline,
  onBeginCapture,
  onFinishCapture,
  onSendTextUtterance,
  onReconnect,
}: ChannelStudioViewProps) {
  return (
    <div className="page-stack">
      <section className="hero-card card">
        <div>
          <p className="hero-eyebrow">Voice console</p>
          <h1 className="hero-title">Inspect the live room</h1>
          <p className="hero-copy">
            {onboarding
              ? "This is the full console view for your starter voice project. Use it when you want to inspect transport, streaming text, and runtime state in detail."
              : "This is the live room console. Speak or type, watch replies stream in, and inspect the raw runtime behavior."}
          </p>
        </div>
        <div className="status-row">
          <span className={`status-pill ${badgeTone(connectionState)}`}>
            websocket {connectionState}
          </span>
          <span
            className={`status-pill ${channelState?.botCount ? "live" : "warn"}`}
          >
            {channelState?.botCount ?? 0} bot online
          </span>
          <span className="status-pill neutral">
            channel {settings.channelId}
          </span>
          {onboarding ? (
            <span className="status-pill neutral">
              workspace {onboarding.workspace.name}
            </span>
          ) : null}
        </div>
      </section>

      <div className="workspace-grid">
        <section className="card transcript-card">
          <div className="card-heading">
            <div>
              <p className="card-kicker">Channel</p>
              <h2>Live conversation</h2>
            </div>
            <button
              className="ghost-button"
              type="button"
              onClick={onReconnect}
            >
              Reconnect
            </button>
          </div>

          <div className="timeline" ref={timelineRef}>
            {timeline.length === 0 ? (
              <div className="timeline-empty">
                Hold the talk button or type your first message below.
              </div>
            ) : (
              timeline.map((entry) => (
                <article
                  key={entry.id}
                  className={`timeline-entry ${entry.role}`}
                >
                  <div className="entry-meta">
                    <span className="entry-title">{entry.title}</span>
                    <span>{entry.meta}</span>
                  </div>
                  <p className="entry-text">{entry.text}</p>
                </article>
              ))
            )}
          </div>

          <div className="composer">
            <textarea
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault()
                  onSendTextUtterance()
                }
              }}
              placeholder="Speak or type here."
            />
            <div className="composer-actions">
              <button
                className="primary-button"
                type="button"
                onClick={onSendTextUtterance}
              >
                Send message
              </button>
              <button
                className={`record-button ${isRecording ? "active" : ""}`}
                type="button"
                onPointerDown={() => void onBeginCapture()}
                onPointerUp={onFinishCapture}
                onPointerLeave={onFinishCapture}
                onPointerCancel={onFinishCapture}
              >
                {isRecording ? "Release to send" : "Hold to talk"}
              </button>
            </div>
            <p className="composer-hint">
              ASR: {asrProviderLabel} · TTS: {ttsProviderLabel} · browser
              speech: {speechStatus}
            </p>
          </div>
        </section>

        <aside className="sidebar-stack">
          <section className="card radar-card">
            <div className="card-heading compact">
              <div>
                <p className="card-kicker">Runtime</p>
                <h2>Live signal</h2>
              </div>
            </div>
            <div className="radar-orb">
              <span className="orb-core" />
              <span
                className="orb-pulse"
                style={{ transform: `scale(${1 + micLevel * 1.4})` }}
              />
            </div>
            <div className="meter">
              <span
                className="meter-fill"
                style={{ width: `${Math.max(6, micLevel * 100)}%` }}
              />
            </div>
            <div className="stats-grid">
              <div className="stat">
                <span className="stat-label">Lead bot</span>
                <strong className="stat-value">{botDisplayName}</strong>
              </div>
              <div className="stat">
                <span className="stat-label">Listeners</span>
                <strong className="stat-value">
                  {channelState?.clientCount ?? 0}
                </strong>
              </div>
              <div className="stat">
                <span className="stat-label">Mic state</span>
                <strong className="stat-value">
                  {isRecording ? "recording" : "idle"}
                </strong>
              </div>
              <div className="stat">
                <span className="stat-label">Adapters</span>
                <strong className="stat-value">{adapterSummary}</strong>
              </div>
            </div>
          </section>

          {onboarding ? (
            <section className="card notes-card">
              <div className="card-heading compact">
                <div>
                  <p className="card-kicker">Starter setup</p>
                  <h2>{onboarding.project.name}</h2>
                </div>
                <span
                  className={`status-pill ${starterBotOnline ? "live" : "warn"}`}
                >
                  {starterBotOnline ? "Bot online" : "Waiting for bot"}
                </span>
              </div>
              <div className="stats-grid">
                <div className="stat">
                  <span className="stat-label">Workspace</span>
                  <strong className="stat-value">
                    {onboarding.workspace.name}
                  </strong>
                </div>
                <div className="stat">
                  <span className="stat-label">Voice project</span>
                  <strong className="stat-value">
                    {onboarding.project.name}
                  </strong>
                </div>
                <div className="stat">
                  <span className="stat-label">Room / Channel</span>
                  <strong className="stat-value">
                    {onboarding.project.channelId}
                  </strong>
                </div>
                <div className="stat">
                  <span className="stat-label">Bot ID</span>
                  <strong className="stat-value">
                    {onboarding.project.botId}
                  </strong>
                </div>
              </div>
              <p className="support-copy">
                Open Settings to copy your starter API key and the connector
                config snippet for OpenClaw.
              </p>
            </section>
          ) : null}

          <section className="card notes-card">
            <div className="card-heading compact">
              <div>
                <p className="card-kicker">Checklist</p>
                <h2>What to test</h2>
              </div>
            </div>
            <ul className="note-list">
              <li>
                Voice input and typed input both reach the same agent flow.
              </li>
              <li>
                Replies can show up in pieces before the full answer is done.
              </li>
              <li>
                Browser-owned and server-owned voice paths can both be tested
                here.
              </li>
              <li>
                Settings lets you switch providers without changing the main
                studio flow.
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
