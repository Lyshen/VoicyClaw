import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { OutputTurnCoordinator } from "../apps/web/lib/output-turn-coordinator"

class FakeSpeechSynthesisUtterance {
  lang = ""
  onstart?: () => void
  onend?: () => void
  onerror?: (event: { error: string }) => void

  constructor(readonly text: string) {}
}

class FakeSpeechSynthesis {
  readonly startedTexts: string[] = []
  cancelCalls = 0
  private active: FakeSpeechSynthesisUtterance | null = null

  speak(utterance: FakeSpeechSynthesisUtterance) {
    this.active = utterance
    this.startedTexts.push(utterance.text)
    utterance.onstart?.()
  }

  cancel() {
    this.cancelCalls += 1
    const active = this.active
    this.active = null
    active?.onerror?.({ error: "interrupted" })
  }

  completeActive() {
    const active = this.active
    this.active = null
    active?.onend?.()
  }
}

const originalUtterance = globalThis.SpeechSynthesisUtterance

beforeEach(() => {
  vi.stubGlobal("SpeechSynthesisUtterance", FakeSpeechSynthesisUtterance)
})

afterEach(() => {
  if (originalUtterance) {
    vi.stubGlobal("SpeechSynthesisUtterance", originalUtterance)
    return
  }

  vi.unstubAllGlobals()
})

describe("OutputTurnCoordinator", () => {
  it("drops stale queued client speech when a newer turn begins", async () => {
    const speech = new FakeSpeechSynthesis()
    const player = createFakePlayer()
    const coordinator = new OutputTurnCoordinator({
      player,
      getSpeechSynthesis: () => speech as unknown as SpeechSynthesis,
    })

    coordinator.beginTurn("turn-1")
    coordinator.queueClientSpeech("turn-1", "first sentence", "en-US")
    coordinator.queueClientSpeech("turn-1", "second sentence", "en-US")
    await flushPromises()

    expect(speech.startedTexts).toEqual(["first sentence"])

    coordinator.beginTurn("turn-2")
    coordinator.queueClientSpeech("turn-2", "replacement sentence", "en-US")
    await flushPromises()

    expect(speech.startedTexts).toEqual([
      "first sentence",
      "replacement sentence",
    ])
    expect(player.cancelCalls).toBe(1)

    speech.completeActive()
    await flushPromises()

    expect(speech.startedTexts).toEqual([
      "first sentence",
      "replacement sentence",
    ])
  })

  it("ignores stale server audio after a newer turn becomes active", async () => {
    const player = createFakePlayer()
    const coordinator = new OutputTurnCoordinator({
      player,
      getSpeechSynthesis: () => null,
    })

    coordinator.beginTurn("turn-1")
    await coordinator.enqueueServerAudio("turn-1", "audio-1", 16_000)

    coordinator.beginTurn("turn-2")
    await coordinator.enqueueServerAudio("turn-1", "audio-stale", 16_000)
    await coordinator.enqueueServerAudio("turn-2", "audio-2", 16_000)
    coordinator.completeServerAudio("turn-1")
    coordinator.completeServerAudio("turn-2")

    expect(player.audioCalls).toEqual([
      { audioBase64: "audio-1", sampleRate: 16_000 },
      { audioBase64: "audio-2", sampleRate: 16_000 },
    ])
    expect(player.resetCalls).toBe(1)
  })
})

function createFakePlayer() {
  return {
    audioCalls: [] as Array<{ audioBase64: string; sampleRate: number }>,
    cancelCalls: 0,
    resetCalls: 0,
    async enqueueBase64(audioBase64: string, sampleRate = 16_000) {
      this.audioCalls.push({ audioBase64, sampleRate })
    },
    reset() {
      this.resetCalls += 1
    },
    cancel() {
      this.cancelCalls += 1
    },
  }
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}
