"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { ChannelStateMessage, ServerToClientMessage } from "@voicyclaw/protocol"

import { MicrophoneStreamer, PcmStreamPlayer } from "../lib/audio"
import { buildWsUrl } from "../lib/prototype-settings"
import { usePrototypeSettings } from "../lib/use-prototype-settings"

type ConnectionState = "connecting" | "connected" | "disconnected" | "error"

type TimelineEntry = {
  id: string
  role: "user" | "bot" | "system"
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
  const micRef = useRef<MicrophoneStreamer | null>(null)
  const recognitionRef = useRef<any>(null)
  const activeUtteranceRef = useRef<string | null>(null)
  const clientIdRef = useRef("")
  const draftRef = useRef("")
  const botSpeechBufferRef = useRef<Record<string, string>>({})
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const introShownRef = useRef(false)

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
      playerRef.current?.reset()
      recognitionRef.current?.stop?.()
    }
  }, [])

  const appendSystemMessage = useCallback((text: string) => {
    setTimeline((current) =>
      [...current, createEntry("system", "Runtime", text)].slice(-40)
    )
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

  const speakResponse = useCallback(
    (text: string) => {
      if (!settings.browserVoiceEnabled) return
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = settings.language
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    },
    [settings.browserVoiceEnabled, settings.language]
  )

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
          const combined = [previous, message.text].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
          botSpeechBufferRef.current[message.utteranceId] = combined

          upsertEntry({
            id: `bot-${message.utteranceId}`,
            role: "bot",
            title: message.botId,
            text: combined,
            meta: message.isFinal ? "bot stream complete" : "bot streaming"
          })

          if (message.isFinal) {
            speakResponse(combined)
          }
          break
        }
        case "AUDIO_CHUNK": {
          void playerRef.current?.enqueueBase64(message.audioBase64, message.sampleRate)
          break
        }
        case "AUDIO_END": {
          playerRef.current?.reset()
          break
        }
      }
    },
    [appendSystemMessage, speakResponse, upsertEntry]
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
            asrProvider: settings.openAiAsrKey ? "openai" : "demo",
            ttsProvider: settings.openAiTtsKey ? "openai" : "demo",
            browserSpeechEnabled: settings.browserSpeechEnabled,
            browserVoiceEnabled: settings.browserVoiceEnabled,
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
    handleServerMessage,
    ready,
    reconnectIndex,
    settings.browserSpeechEnabled,
    settings.browserVoiceEnabled,
    settings.channelId,
    settings.language,
    settings.openAiAsrKey,
    settings.openAiTtsKey,
    settings.serverUrl
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
    if (!settings.browserSpeechEnabled) return

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
  }, [settings.browserSpeechEnabled, settings.language])

  const stopRecognition = useCallback(() => {
    recognitionRef.current?.stop?.()
    recognitionRef.current = null
  }, [])

  const beginCapture = useCallback(async () => {
    if (isRecording) return
    if (!micRef.current) return

    const utteranceId = crypto.randomUUID()
    const started = sendControl({
      type: "START_UTTERANCE",
      utteranceId
    })

    if (!started) return

    activeUtteranceRef.current = utteranceId
    setIsRecording(true)

    if (settings.browserSpeechEnabled && !speechSupported) {
      appendSystemMessage(
        "This browser does not expose the Web Speech API, so voice input falls back to manual text in the composer."
      )
    }

    try {
      await micRef.current.start()
      startRecognition()
    } catch {
      activeUtteranceRef.current = null
      setIsRecording(false)
      appendSystemMessage("Microphone access was denied. You can still use the text composer below.")
    }
  }, [appendSystemMessage, isRecording, sendControl, settings.browserSpeechEnabled, speechSupported, startRecognition])

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
      setDraftText("")
    }
  }, [appendSystemMessage, sendControl])

  const botDisplayName = channelState?.bots[0]?.displayName ?? "Waiting for bot"

  return (
    <div className="page-stack">
      <section className="hero-card card">
        <div>
          <p className="hero-eyebrow">Runnable prototype</p>
          <h1 className="hero-title">OpenClaw voice channel cockpit</h1>
          <p className="hero-copy">
            This screen proves the README flow end to end: browser capture, websocket relay,
            OpenClaw bot streaming, live transcript updates, and audio feedback.
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
            <button className="ghost-button" onClick={() => setReconnectIndex((value) => value + 1)}>
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
              placeholder="Speak or type here. The draft also acts as a transcript fallback if browser speech recognition is unavailable."
            />
            <div className="composer-actions">
              <button className="primary-button" onClick={sendTextUtterance}>
                Send text
              </button>
              <button
                className={`record-button ${isRecording ? "active" : ""}`}
                onPointerDown={beginCapture}
                onPointerUp={finishCapture}
                onPointerLeave={finishCapture}
                onPointerCancel={finishCapture}
              >
                {isRecording ? "Release to send" : "Hold to talk"}
              </button>
            </div>
            <p className="composer-hint">
              Browser speech: {settings.browserSpeechEnabled ? "enabled" : "off"} · browser voice:{" "}
              {settings.browserVoiceEnabled ? "enabled" : "off"} · speech API:{" "}
              {speechSupported ? "available" : "not available"}
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
                <strong className="stat-value">demo ASR / demo TTS</strong>
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
              <li>Client websocket sends control JSON plus binary PCM microphone frames.</li>
              <li>Server emits `STT_RESULT` over the OpenClaw protocol to a real local bot session.</li>
              <li>Bot streams `TTS_TEXT` chunks back and the UI paints them live.</li>
              <li>Server TTS returns PCM tone chunks, while optional browser voice keeps the demo human-readable.</li>
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
