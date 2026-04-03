"use client"

import type {
  ChannelStateMessage,
  ServerToClientMessage,
} from "@voicyclaw/protocol"
import { useCallback, useEffect, useRef, useState } from "react"

import { MicrophoneStreamer, PcmStreamPlayer } from "./audio"
import { OutputTurnCoordinator } from "./output-turn-coordinator"
import {
  buildWsUrl,
  getAsrProviderOption,
  getConversationBackendOption,
  getProviderModeLabel,
  getTtsProviderOption,
} from "./prototype-settings"
import { usePrototypeSettings } from "./use-prototype-settings"
import {
  buildClientHelloMessage,
  type ConnectionState,
  createTimelineEntry,
  handleVoiceStudioServerMessage,
  type TimelineEntry,
} from "./voice-studio-session-helpers"

type UseVoiceStudioSessionOptions = {
  introMessage?: string | null
  includeConnectionSummary?: boolean
}

export function useVoiceStudioSession(
  options: UseVoiceStudioSessionOptions = {},
) {
  const { introMessage = null, includeConnectionSummary = true } = options
  const { settings, ready, onboarding } = usePrototypeSettings()
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting")
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [draftText, setDraftText] = useState("")
  const [channelState, setChannelState] = useState<ChannelStateMessage | null>(
    null,
  )
  const [micLevel, setMicLevel] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [reconnectIndex, setReconnectIndex] = useState(0)
  const [pendingReplyUtteranceId, setPendingReplyUtteranceId] = useState<
    string | null
  >(null)
  const [playingUtteranceId, setPlayingUtteranceId] = useState<string | null>(
    null,
  )

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
  const playbackIdleTimeoutRef = useRef<number | null>(null)

  const asrProvider = getAsrProviderOption(settings.asrProvider)
  const ttsProvider = getTtsProviderOption(settings.ttsProvider)
  const conversationBackend = getConversationBackendOption(
    settings.conversationBackend,
  )
  const browserAsrEnabled = asrProvider.mode === "client"
  const browserTtsEnabled = ttsProvider.mode === "client"
  const canUseRecognitionAssist =
    speechSupported && (browserAsrEnabled || asrProvider.id === "demo")

  if (!clientIdRef.current) {
    clientIdRef.current =
      typeof crypto !== "undefined" ? crypto.randomUUID() : "web-client"
  }

  useEffect(() => {
    draftRef.current = draftText
  }, [draftText])

  useEffect(() => {
    setSpeechSupported(
      typeof window !== "undefined" &&
        Boolean(
          (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition,
        ),
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
          typeof window !== "undefined" && "speechSynthesis" in window
            ? window.speechSynthesis
            : null,
        onPlaybackStateChange: ({ isPlaying, utteranceId }) => {
          if (playbackIdleTimeoutRef.current !== null) {
            window.clearTimeout(playbackIdleTimeoutRef.current)
            playbackIdleTimeoutRef.current = null
          }

          if (isPlaying) {
            setPlayingUtteranceId(utteranceId)
            return
          }

          playbackIdleTimeoutRef.current = window.setTimeout(() => {
            setPlayingUtteranceId((current) =>
              current === utteranceId ? null : current,
            )
            playbackIdleTimeoutRef.current = null
          }, 180)
        },
        logger: {
          info: (message, payload) => {
            console.info(`[voicyclaw][output-turn] ${message}`, payload)
          },
          warn: (message, payload) => {
            console.warn(`[voicyclaw][output-turn] ${message}`, payload)
          },
        },
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
        onLevel: setMicLevel,
      })
    }

    return () => {
      micRef.current?.stop()
      outputRef.current?.reset()
      recognitionRef.current?.stop?.()
      if (playbackIdleTimeoutRef.current !== null) {
        window.clearTimeout(playbackIdleTimeoutRef.current)
        playbackIdleTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    outputRef.current?.reset()
  }, [ttsProvider.id, ttsProvider.mode])

  const appendSystemMessage = useCallback((text: string) => {
    setTimeline((current) =>
      [...current, createTimelineEntry("system", "Runtime", text)].slice(-40),
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

  const handleServerMessage = useCallback(
    (message: ServerToClientMessage) => {
      handleVoiceStudioServerMessage(message, {
        browserTtsEnabled,
        language: settings.language,
        ttsMode: ttsProvider.mode,
        output: outputRef.current,
        botSpeechBuffer: botSpeechBufferRef.current,
        appendSystemMessage,
        upsertEntry,
        setChannelState,
        setConnectionState,
        setPendingReplyUtteranceId,
      })
    },
    [
      appendSystemMessage,
      browserTtsEnabled,
      settings.language,
      ttsProvider.mode,
      upsertEntry,
    ],
  )

  useEffect(() => {
    timelineRef.current?.scrollTo({
      top: timelineRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [timeline])

  useEffect(() => {
    if (!ready) return

    if (introMessage && !introShownRef.current) {
      appendSystemMessage(introMessage)
      introShownRef.current = true
    }

    if (includeConnectionSummary) {
      appendSystemMessage(
        `Conversation backend: ${conversationBackend.label}. ASR is ${getProviderModeLabel(asrProvider.mode).toLowerCase()} and TTS is ${getProviderModeLabel(ttsProvider.mode).toLowerCase()}.`,
      )
    }

    const ws = new WebSocket(buildWsUrl(settings))
    ws.binaryType = "arraybuffer"
    wsRef.current = ws
    setConnectionState("connecting")

    ws.onopen = () => {
      ws.send(
        JSON.stringify(
          buildClientHelloMessage({
            clientId: clientIdRef.current,
            settings,
            asrProvider,
            ttsProvider,
          }),
        ),
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
      setPendingReplyUtteranceId(null)
      setPlayingUtteranceId(null)
    }

    ws.onclose = () => {
      setConnectionState("disconnected")
      setPendingReplyUtteranceId(null)
      setPlayingUtteranceId(null)
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
    conversationBackend.label,
    handleServerMessage,
    includeConnectionSummary,
    introMessage,
    ready,
    reconnectIndex,
    settings.channelId,
    settings.conversationBackend,
    settings.language,
    settings.openClawGatewayToken,
    settings.openClawGatewayUrl,
    settings.serverUrl,
    ttsProvider.id,
    ttsProvider.mode,
  ])

  const sendControl = useCallback(
    (payload: unknown) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        appendSystemMessage(
          "WebSocket is offline. Reconnect the channel or start the server first.",
        )
        return false
      }

      ws.send(JSON.stringify(payload))
      return true
    },
    [appendSystemMessage],
  )

  const startRecognition = useCallback(() => {
    if (!canUseRecognitionAssist) return

    const Recognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
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
        "Browser SpeechRecognition is unavailable here. Switch ASR to the server demo path or use the text composer.",
      )
      return
    }

    if (asrProvider.id === "demo" && !speechSupported) {
      appendSystemMessage(
        "Demo Server ASR still relies on browser transcript assist in this prototype. Use the text composer or switch back to Browser SpeechRecognition on this device.",
      )
      return
    }

    if (
      asrProvider.id === "demo" &&
      speechSupported &&
      !demoAssistNoticeRef.current
    ) {
      appendSystemMessage(
        "Demo Server ASR is active. Until a real server ASR adapter lands, the browser transcript assist stays on so this path remains runnable.",
      )
      demoAssistNoticeRef.current = true
    }

    const utteranceId = crypto.randomUUID()
    const started = sendControl({
      type: "START_UTTERANCE",
      utteranceId,
    })

    if (!started) return

    outputRef.current?.beginTurn(utteranceId)

    activeUtteranceRef.current = utteranceId
    setIsRecording(true)

    try {
      await micRef.current.start()
      startRecognition()
    } catch {
      activeUtteranceRef.current = null
      setIsRecording(false)
      appendSystemMessage(
        "Microphone access was denied. You can still use the text composer below.",
      )
    }
  }, [
    appendSystemMessage,
    asrProvider.id,
    browserAsrEnabled,
    isRecording,
    sendControl,
    speechSupported,
    startRecognition,
  ])

  const finishCapture = useCallback(() => {
    if (!activeUtteranceRef.current) return

    const utteranceId = activeUtteranceRef.current
    activeUtteranceRef.current = null
    setIsRecording(false)
    micRef.current?.stop()
    stopRecognition()

    if (
      sendControl({
        type: "COMMIT_UTTERANCE",
        utteranceId,
        transcript: draftRef.current.trim(),
        source: "microphone",
      })
    ) {
      setPendingReplyUtteranceId(utteranceId)
    }
  }, [sendControl, stopRecognition])

  const sendTextUtterance = useCallback(
    (overrideText?: string) => {
      const text = overrideText?.trim() || draftRef.current.trim()
      if (!text) {
        appendSystemMessage("Type a prompt before sending a text utterance.")
        return
      }

      const utteranceId = crypto.randomUUID()
      if (
        sendControl({
          type: "TEXT_UTTERANCE",
          utteranceId,
          text,
        })
      ) {
        outputRef.current?.beginTurn(utteranceId)
        setPendingReplyUtteranceId(utteranceId)
        setDraftText("")
      }
    },
    [appendSystemMessage, sendControl],
  )

  const reconnect = useCallback(() => {
    setReconnectIndex((value) => value + 1)
  }, [])

  const botDisplayName = channelState?.bots[0]?.displayName ?? "Waiting for bot"
  const adapterSummary = `${asrProvider.label} / ${ttsProvider.label}`
  const speechStatus = speechSupported ? "available" : "not available"
  const starterBotOnline = (channelState?.botCount ?? 0) > 0
  const isBotThinking = pendingReplyUtteranceId !== null
  const isBotSpeaking = playingUtteranceId !== null

  return {
    settings,
    ready,
    onboarding,
    connectionState,
    timeline,
    draftText,
    setDraftText,
    channelState,
    micLevel,
    isRecording,
    speechSupported,
    asrProvider,
    ttsProvider,
    conversationBackend,
    timelineRef,
    botDisplayName,
    adapterSummary,
    speechStatus,
    starterBotOnline,
    isBotThinking,
    isBotSpeaking,
    beginCapture,
    finishCapture,
    sendTextUtterance,
    reconnect,
  }
}

export type {
  ConnectionState,
  TimelineEntry,
} from "./voice-studio-session-helpers"
export { badgeTone, getStarterTitle } from "./voice-studio-session-helpers"
