"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { ChannelStateMessage, ServerToClientMessage } from "@voicyclaw/protocol"

import { MicrophoneStreamer, PcmStreamPlayer } from "../lib/audio"
import { OutputTurnCoordinator } from "../lib/output-turn-coordinator"
import {
  buildWsUrl,
  getAsrProviderOption,
  getProviderModeLabel,
  getTtsProviderOption
} from "../lib/prototype-settings"
import { usePrototypeSettings } from "../lib/use-prototype-settings"

type ConnectionState = "connecting" | "connected" | "disconnected" | "error"

type TimelineEntry = {
  id: string
  role: "user" | "bot" | "system" | "preview"
  title: string
  text: string
  meta: string
}

export function ChannelStudio() {
  const { settings, ready } = usePrototypeSettings()
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting")
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [draftText, setDraftText] = useState("")
  const [channelState, setChannelState] = useState<ChannelStateMessage | null>(null)
  const [micLevel, setMicLevel] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [reconnectIndex, setReconnectIndex] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const playerRef = useRef<PcmStreamPlayer | null>(null)
  const outputRef = useRef<OutputTurnCoordinator | null>(null)
  const micRef = useRef<MicrophoneStreamer | null>(null)
  const recognitionRef = useRef<any>(null)
  const activeUtteranceRef = useRef<string | null>(null)
  const clientIdRef = useRef("")
  const draftRef = useRef("")
  const botSpeechBufferRef = useRef<Record<string, string>>({})
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const introShownRef = useRef(false)
  const demoAssistNoticeRef = useRef(false)

  const asrProvider = getAsrProviderOption(settings.asrProvider)
  const ttsProvider = getTtsProviderOption(settings.ttsProvider)
  const browserAsrEnabled = asrProvider.mode === "client"
  const browserTtsEnabled = ttsProvider.mode === "client"
  const canUseRecognitionAssist = speechSupported && (browserAsrEnabled || asrProvider.id === "demo")

  if (!clientIdRef.current) {
    clientIdRef.current = typeof crypto !== "undefined" ? crypto.randomUUID() : "web-client"
  }

  useEffect(() => {
    draftRef.current = draftText
  }, [draftText])

  useEffect(() => {
    setSpeechSupported(
      typeof window !== "undefined" &&
        Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    )
  }, [])

  useEffect(() => {
    if (!playerRef.current) {
      playerRef.current = new PcmStreamPlayer()
    }

    if (!outputRef.current && playerRef.current) {
      outputRef.current = new OutputTurnCoordinator({
        player: playerRef.current,
        getSpeechSynthesis: () =>
          typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null,
        logger: {
          info: (message, payload) => {
            console.info(`[voicyclaw][output-turn] ${message}`, payload)
          },
          warn: (message, payload) => {
            console.warn(`[voicyclaw][output-turn] ${message}`, payload)
          }
        }
      })
    }

    if (!micRef.current) {
      micRef.current = new MicrophoneStreamer({
        onChunk: (chunk) => {
          const ws = wsRef.current
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(chunk)
          }
        },
        onLevel: setMicLevel
      })
    }

    return () => {
      micRef.current?.stop()
      outputRef.current?.reset()
      recognitionRef.current?.stop?.()
    }
  }, [])

  useEffect(() => {
    outputRef.current?.reset()
  }, [ttsProvider.id, ttsProvider.mode])

  const appendSystemMessage = useCallback((text: string) => {
    setTimeline((current) => [...current, createEntry("system", "Runtime", text)].slice(-40))
  }, [])

  const upsertEntry = useCallback((entry: TimelineEntry) => {
    setTimeline((current) => {
      const index = current.findIndex((item) => item.id === entry.id)
      if (index === -1) {
        return [...current, entry].slice(-40)
      }

      const next = [...current]
      next[index] = entry
      return next
    })
  }, [])

  const handleServerMessage = useCallback(
    (message: ServerToClientMessage) => {
      switch (message.type) {
        case "SESSION_READY": {
          setConnectionState("connected")
          break
        }
        case "CHANNEL_STATE": {
          setChannelState(message)
          break
        }
        case "NOTICE": {
          appendSystemMessage(message.message)
          break
        }
        case "BOT_PREVIEW": {
          upsertEntry({
            id: `preview-${message.utteranceId}`,
            role: "preview",
            title: `${message.botId} preview`,
            text: message.text,
            meta: message.isFinal ? "preview locked" : "preview streaming"
          })
          break
        }
        case "TRANSCRIPT": {
          upsertEntry({
            id: `user-${message.utteranceId}`,
            role: "user",
            title: "You",
            text: message.text,
            meta: message.isFinal ? "ASR final" : "ASR interim"
          })
          break
        }
        case "BOT_TEXT": {
          const previous = botSpeechBufferRef.current[message.utteranceId] ?? ""
          const combined = [previous, message.text]
            .filter(Boolean)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()

          botSpeechBufferRef.current[message.utteranceId] = combined

          upsertEntry({
            id: `bot-${message.utteranceId}`,
            role: "bot",
            title: message.botId,
            text: combined,
            meta: message.isFinal ? "bot stream complete" : "bot block streaming"
          })

          if (browserTtsEnabled) {
            outputRef.current?.queueClientSpeech(message.utteranceId, message.text, settings.language)
          }
          break
        }
        case "AUDIO_CHUNK": {
          if (ttsProvider.mode === "server") {
            void outputRef.current?.enqueueServerAudio(
              message.utteranceId,
              message.audioBase64,
              message.sampleRate
            )
          }
          break
        }
        case "AUDIO_END": {
          if (ttsProvider.mode === "server") {
            outputRef.current?.completeServerAudio(message.utteranceId)
          }
          break
        }
      }
    },
    [appendSystemMessage, browserTtsEnabled, settings.language, ttsProvider.mode, upsertEntry]
  )

  useEffect(() => {
    timelineRef.current?.scrollTo({
      top: timelineRef.current.scrollHeight,
      behavior: "smooth"
    })
  }, [timeline])

  useEffect(() => {
    if (!ready) return

    if (!introShownRef.current) {
      appendSystemMessage(
        "Run `pnpm dev` at the repo root to boot the server, the Next.js shell, and the local demo ClawBot together."
      )
      introShownRef.current = true
    }

    const ws = new WebSocket(buildWsUrl(settings))
    ws.binaryType = "arraybuffer"
    wsRef.current = ws
    setConnectionState("connecting")

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "CLIENT_HELLO",
          clientId: clientIdRef.current,
          channelId: settings.channelId,
          settings: {
            asrMode: asrProvider.mode,
            asrProvider: asrProvider.id,
            ttsMode: ttsProvider.mode,
            ttsProvider: ttsProvider.id,
            language: settings.language
          }
        })
      )
    }

    ws.onmessage = (event) => {
      if (typeof event.data !== "string") return

      try {
        handleServerMessage(JSON.parse(event.data) as ServerToClientMessage)
      } catch {
        appendSystemMessage("Received an unreadable server message.")
      }
    }

    ws.onerror = () => {
      setConnectionState("error")
    }

    ws.onclose = () => {
      setConnectionState("disconnected")
    }

    return () => {
      ws.close()
      if (wsRef.current === ws) {
        wsRef.current = null
      }
    }
  }, [
    appendSystemMessage,
    asrProvider.id,
    asrProvider.mode,
    handleServerMessage,
    ready,
    reconnectIndex,
    settings.channelId,
    settings.language,
    settings.serverUrl,
    ttsProvider.id,
    ttsProvider.mode
  ])

  const sendControl = useCallback(
    (payload: unknown) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        appendSystemMessage("WebSocket is offline. Reconnect the channel or start the server first.")
        return false
      }

      ws.send(JSON.stringify(payload))
      return true
    },
    [appendSystemMessage]
  )

  const startRecognition = useCallback(() => {
    if (!canUseRecognitionAssist) return

    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Recognition) return

    const recognition = new Recognition()
    recognition.lang = settings.language
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event: any) => {
      let transcript = ""
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += `${event.results[index][0]?.transcript ?? ""} `
      }
      setDraftText(transcript.trim())
    }
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null
      }
    }
    recognition.start()
    recognitionRef.current = recognition
  }, [canUseRecognitionAssist, settings.language])

  const stopRecognition = useCallback(() => {
    recognitionRef.current?.stop?.()
    recognitionRef.current = null
  }, [])

  const beginCapture = useCallback(async () => {
    if (isRecording) return
    if (!micRef.current) return

    if (browserAsrEnabled && !speechSupported) {
      appendSystemMessage(
        "Browser SpeechRecognition is unavailable here. Switch ASR to the server demo path or use the text composer."
      )
      return
    }

    if (asrProvider.id === "demo" && !speechSupported) {
      appendSystemMessage(
        "Demo Server ASR still relies on browser transcript assist in this prototype. Use the text composer or switch back to Browser SpeechRecognition on this device."
      )
      return
    }

    if (asrProvider.id === "demo" && speechSupported && !demoAssistNoticeRef.current) {
      appendSystemMessage(
        "Demo Server ASR is active. Until a real server ASR adapter lands, the browser transcript assist stays on so this path remains runnable."
      )
      demoAssistNoticeRef.current = true
    }

    const utteranceId = crypto.randomUUID()
    const started = sendControl({
      type: "START_UTTERANCE",
      utteranceId
    })

    if (!started) return

    outputRef.current?.reset()

    activeUtteranceRef.current = utteranceId
    setIsRecording(true)

    try {
      await micRef.current.start()
      startRecognition()
    } catch {
      activeUtteranceRef.current = null
      setIsRecording(false)
      appendSystemMessage("Microphone access was denied. You can still use the text composer below.")
    }
  }, [
    appendSystemMessage,
    asrProvider.id,
    browserAsrEnabled,
    isRecording,
    sendControl,
    speechSupported,
    startRecognition
  ])

  const finishCapture = useCallback(() => {
    if (!activeUtteranceRef.current) return

    const utteranceId = activeUtteranceRef.current
    activeUtteranceRef.current = null
    setIsRecording(false)
    micRef.current?.stop()
    stopRecognition()

    sendControl({
      type: "COMMIT_UTTERANCE",
      utteranceId,
      transcript: draftRef.current.trim(),
      source: "microphone"
    })
  }, [sendControl, stopRecognition])

  const sendTextUtterance = useCallback(() => {
    const text = draftRef.current.trim()
    if (!text) {
      appendSystemMessage("Type a prompt before sending a text utterance.")
      return
    }

    const utteranceId = crypto.randomUUID()
    if (
      sendControl({
        type: "TEXT_UTTERANCE",
        utteranceId,
        text
      })
    ) {
      outputRef.current?.reset()
      setDraftText("")
    }
  }, [appendSystemMessage, sendControl])

  const botDisplayName = channelState?.bots[0]?.displayName ?? "Waiting for bot"
  const adapterSummary = `${asrProvider.label} / ${ttsProvider.label}`
  const speechStatus = speechSupported ? "available" : "not available"

  return (
    <div className="page-stack">
      <section className="hero-card card">
        <div>
          <p className="hero-eyebrow">Runnable prototype</p>
          <h1 className="hero-title">OpenClaw voice channel cockpit</h1>
          <p className="hero-copy">
            This screen now simulates a preview stream plus a final bot text stream, so you can
            watch the mock bot think, answer in blocks, and hand those blocks to client TTS.
          </p>
        </div>
        <div className="status-row">
          <span className={`status-pill ${badgeTone(connectionState)}`}>
            websocket {connectionState}
          </span>
          <span className={`status-pill ${channelState?.botCount ? "live" : "warn"}`}>
            {channelState?.botCount ?? 0} bot online
          </span>
          <span className="status-pill neutral">channel {settings.channelId}</span>
        </div>
      </section>

      <div className="workspace-grid">
        <section className="card transcript-card">
          <div className="card-heading">
            <div>
              <p className="card-kicker">Channel</p>
              <h2>Conversation stream</h2>
            </div>
            <button className="ghost-button" type="button" onClick={() => setReconnectIndex((value) => value + 1)}>
              Reconnect
            </button>
          </div>

          <div className="timeline" ref={timelineRef}>
            {timeline.length === 0 ? (
              <div className="timeline-empty">
                Hold the push-to-talk button or type into the composer to send the first utterance.
              </div>
            ) : (
              timeline.map((entry) => (
                <article key={entry.id} className={`timeline-entry ${entry.role}`}>
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
                  sendTextUtterance()
                }
              }}
              placeholder="Speak or type here. The draft doubles as a transcript assist for the current prototype."
            />
            <div className="composer-actions">
              <button className="primary-button" type="button" onClick={sendTextUtterance}>
                Send text
              </button>
              <button
                className={`record-button ${isRecording ? "active" : ""}`}
                type="button"
                onPointerDown={beginCapture}
                onPointerUp={finishCapture}
                onPointerLeave={finishCapture}
                onPointerCancel={finishCapture}
              >
                {isRecording ? "Release to send" : "Hold to talk"}
              </button>
            </div>
            <p className="composer-hint">
              ASR: {asrProvider.label} ({getProviderModeLabel(asrProvider.mode)}) · TTS: {ttsProvider.label} ({getProviderModeLabel(ttsProvider.mode)}) · speech API: {speechStatus}
            </p>
          </div>
        </section>

        <aside className="sidebar-stack">
          <section className="card radar-card">
            <div className="card-heading compact">
              <div>
                <p className="card-kicker">Runtime</p>
                <h2>Signal monitor</h2>
              </div>
            </div>
            <div className="radar-orb">
              <span className="orb-core" />
              <span className="orb-pulse" style={{ transform: `scale(${1 + micLevel * 1.4})` }} />
            </div>
            <div className="meter">
              <span className="meter-fill" style={{ width: `${Math.max(6, micLevel * 100)}%` }} />
            </div>
            <div className="stats-grid">
              <div className="stat">
                <span className="stat-label">Lead bot</span>
                <strong className="stat-value">{botDisplayName}</strong>
              </div>
              <div className="stat">
                <span className="stat-label">Listeners</span>
                <strong className="stat-value">{channelState?.clientCount ?? 0}</strong>
              </div>
              <div className="stat">
                <span className="stat-label">Mic state</span>
                <strong className="stat-value">{isRecording ? "recording" : "idle"}</strong>
              </div>
              <div className="stat">
                <span className="stat-label">Adapters</span>
                <strong className="stat-value">{adapterSummary}</strong>
              </div>
            </div>
          </section>

          <section className="card notes-card">
            <div className="card-heading compact">
              <div>
                <p className="card-kicker">Checklist</p>
                <h2>What this proves</h2>
              </div>
            </div>
            <ul className="note-list">
              <li>Client websocket still sends control JSON plus binary PCM microphone frames.</li>
              <li>The mock bot now emits a preview stream before it commits final answer blocks.</li>
              <li>Final bot blocks keep streaming over the channel while client TTS can speak them locally.</li>
              <li>Settings let you flip the prototype between browser-owned and server-owned media paths.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}

function createEntry(role: TimelineEntry["role"], title: string, text: string): TimelineEntry {
  return {
    id: `${role}-${crypto.randomUUID()}`,
    role,
    title,
    text,
    meta: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    })
  }
}

function badgeTone(state: ConnectionState) {
  switch (state) {
    case "connected":
      return "live"
    case "connecting":
      return "neutral"
    case "disconnected":
      return "warn"
    case "error":
      return "danger"
  }
}
