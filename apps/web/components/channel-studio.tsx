"use client"

import { useVoiceStudioSession } from "../lib/use-voice-studio-session"
import type { WebRuntimePayload } from "../lib/web-runtime"
import { ChannelStudioView } from "./channel-studio-view"

export function ChannelStudio({
  initialRuntime,
}: {
  initialRuntime: WebRuntimePayload
}) {
  const {
    settings,
    onboarding,
    connectionState,
    timeline,
    draftText,
    setDraftText,
    channelState,
    micLevel,
    isRecording,
    asrProvider,
    ttsProvider,
    timelineRef,
    botDisplayName,
    adapterSummary,
    speechStatus,
    starterBotOnline,
    beginCapture,
    finishCapture,
    sendTextUtterance,
    reconnect,
  } = useVoiceStudioSession({
    initialRuntime,
    introMessage:
      "Use this console to inspect the live room, streaming replies, and runtime state in detail.",
    includeConnectionSummary: true,
  })

  return (
    <ChannelStudioView
      settings={settings}
      onboarding={onboarding}
      connectionState={connectionState}
      timeline={timeline}
      draftText={draftText}
      setDraftText={setDraftText}
      channelState={channelState}
      micLevel={micLevel}
      isRecording={isRecording}
      asrProviderLabel={asrProvider.label}
      ttsProviderLabel={ttsProvider.label}
      timelineRef={timelineRef}
      botDisplayName={botDisplayName}
      adapterSummary={adapterSummary}
      speechStatus={speechStatus}
      starterBotOnline={starterBotOnline}
      onBeginCapture={beginCapture}
      onFinishCapture={finishCapture}
      onSendTextUtterance={() => sendTextUtterance()}
      onReconnect={reconnect}
    />
  )
}
