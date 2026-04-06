"use client"

import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { useCallback } from "react"

import type { MicrophoneStreamer } from "./audio"
import type { OutputTurnCoordinator } from "./output-turn-coordinator"

type BrowserRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: any) => void) | null
  onend: (() => void) | null
  start: () => void
  stop?: () => void
}

type BrowserRecognitionConstructor = new () => BrowserRecognition

type UseVoiceStudioCaptureArgs = {
  asrProviderId: string
  browserAsrEnabled: boolean
  speechSupported: boolean
  language: string
  isRecording: boolean
  appendSystemMessage: (text: string) => void
  sendControl: (payload: unknown) => boolean
  setDraftText: Dispatch<SetStateAction<string>>
  setIsRecording: Dispatch<SetStateAction<boolean>>
  setPendingReplyUtteranceId: Dispatch<SetStateAction<string | null>>
  micRef: MutableRefObject<MicrophoneStreamer | null>
  outputRef: MutableRefObject<OutputTurnCoordinator | null>
  recognitionRef: MutableRefObject<BrowserRecognition | null>
  activeUtteranceRef: MutableRefObject<string | null>
  draftRef: MutableRefObject<string>
  demoAssistNoticeRef: MutableRefObject<boolean>
}

function getBrowserRecognition(): BrowserRecognitionConstructor | null {
  const recognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

  return recognition ?? null
}

function getCaptureBlockReason({
  asrProviderId,
  browserAsrEnabled,
  speechSupported,
}: Pick<
  UseVoiceStudioCaptureArgs,
  "asrProviderId" | "browserAsrEnabled" | "speechSupported"
>) {
  if (browserAsrEnabled && !speechSupported) {
    return "Browser speech input is unavailable here. Switch ASR to the built-in server path or use the text composer."
  }

  if (asrProviderId === "demo" && !speechSupported) {
    return "Built-in server ASR still relies on browser transcript assist today. Use the text composer or switch back to browser speech input on this device."
  }

  return null
}

export function useVoiceStudioCapture({
  asrProviderId,
  browserAsrEnabled,
  speechSupported,
  language,
  isRecording,
  appendSystemMessage,
  sendControl,
  setDraftText,
  setIsRecording,
  setPendingReplyUtteranceId,
  micRef,
  outputRef,
  recognitionRef,
  activeUtteranceRef,
  draftRef,
  demoAssistNoticeRef,
}: UseVoiceStudioCaptureArgs) {
  const startRecognition = useCallback(() => {
    const Recognition = getBrowserRecognition()
    if (!speechSupported || !Recognition) {
      return
    }

    const recognition = new Recognition()
    recognition.lang = language
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
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
  }, [language, recognitionRef, setDraftText, speechSupported])

  const stopRecognition = useCallback(() => {
    recognitionRef.current?.stop?.()
    recognitionRef.current = null
  }, [recognitionRef])

  const beginCapture = useCallback(async () => {
    if (isRecording || !micRef.current) {
      return
    }

    const blockReason = getCaptureBlockReason({
      asrProviderId,
      browserAsrEnabled,
      speechSupported,
    })
    if (blockReason) {
      appendSystemMessage(blockReason)
      return
    }

    if (
      asrProviderId === "demo" &&
      speechSupported &&
      !demoAssistNoticeRef.current
    ) {
      appendSystemMessage(
        "Built-in server ASR is active. Until a vendor ASR adapter lands, the browser transcript assist stays on so this path remains runnable.",
      )
      demoAssistNoticeRef.current = true
    }

    const utteranceId = crypto.randomUUID()
    const started = sendControl({
      type: "START_UTTERANCE",
      utteranceId,
    })
    if (!started) {
      return
    }

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
    activeUtteranceRef,
    appendSystemMessage,
    asrProviderId,
    browserAsrEnabled,
    demoAssistNoticeRef,
    isRecording,
    micRef,
    outputRef,
    sendControl,
    setIsRecording,
    speechSupported,
    startRecognition,
  ])

  const finishCapture = useCallback(() => {
    if (!activeUtteranceRef.current) {
      return
    }

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
  }, [
    activeUtteranceRef,
    draftRef,
    micRef,
    sendControl,
    setIsRecording,
    setPendingReplyUtteranceId,
    stopRecognition,
  ])

  return {
    beginCapture,
    finishCapture,
    stopRecognition,
  }
}
