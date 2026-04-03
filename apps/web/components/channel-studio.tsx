"use client"

import { useVoiceStudioSession } from "../lib/use-voice-studio-session"
import { ChannelStudioView } from "./channel-studio-view"

export function ChannelStudio() {
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
    introMessage:
      "Run `pnpm dev` at the repo root to boot the server, the Next.js shell, and the local demo ClawBot together.",
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
