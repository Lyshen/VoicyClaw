interface OutputTurnCoordinatorLogger {
  info: (message: string, payload: Record<string, unknown>) => void
  warn: (message: string, payload: Record<string, unknown>) => void
}

type OutputPlaybackSource = "client" | "server"

type OutputPlaybackStateChange = {
  isPlaying: boolean
  source: OutputPlaybackSource
  utteranceId: string
}

interface OutputTurnPlayer {
  enqueueBase64: (audioBase64: string, sampleRate?: number) => Promise<void>
  reset: () => void
  cancel: () => void
}

interface OutputTurnCoordinatorOptions {
  player: OutputTurnPlayer
  getSpeechSynthesis?: () => SpeechSynthesis | null
  logger?: OutputTurnCoordinatorLogger
  onPlaybackStateChange?: (event: OutputPlaybackStateChange) => void
}

export class OutputTurnCoordinator {
  private currentTurnId: string | null = null
  private speechGeneration = 0
  private speechQueue = Promise.resolve()
  private queuedClientChunks = 0
  private clientPlaybackTurnId: string | null = null
  private serverPlaybackTurnId: string | null = null

  constructor(private readonly options: OutputTurnCoordinatorOptions) {}

  reset() {
    this.flushClientPlayback()
    this.flushServerPlayback()
    this.currentTurnId = null
    this.speechGeneration += 1
    this.speechQueue = Promise.resolve()
    this.options.player.cancel()
    this.options.getSpeechSynthesis?.()?.cancel()
  }

  beginTurn(utteranceId: string) {
    if (this.currentTurnId === utteranceId) {
      return
    }

    if (this.currentTurnId !== null) {
      this.reset()
    }
    this.currentTurnId = utteranceId
  }

  queueClientSpeech(utteranceId: string, text: string, language: string) {
    const trimmed = text.trim()
    if (!trimmed) return

    const speech = this.options.getSpeechSynthesis?.() ?? null
    if (!speech) return

    this.options.logger?.info("queue", {
      utteranceId,
      language,
      text: clipTextForLog(trimmed),
    })

    const generation = this.ensureActiveTurn(utteranceId)
    if (generation === null) return
    this.queuedClientChunks += 1

    this.speechQueue = this.speechQueue.then(
      () =>
        new Promise<void>((resolve) => {
          if (!this.isActiveTurn(utteranceId, generation)) {
            this.finishClientChunk(utteranceId)
            resolve()
            return
          }

          const utterance = new SpeechSynthesisUtterance(trimmed)
          utterance.lang = language
          utterance.onstart = () => {
            if (!this.isActiveTurn(utteranceId, generation)) return
            if (this.clientPlaybackTurnId !== utteranceId) {
              this.clientPlaybackTurnId = utteranceId
              this.options.onPlaybackStateChange?.({
                isPlaying: true,
                source: "client",
                utteranceId,
              })
            }

            this.options.logger?.info("start", {
              utteranceId,
              language: utterance.lang,
              text: clipTextForLog(trimmed),
            })
          }
          utterance.onend = () => {
            this.finishClientChunk(utteranceId)

            if (this.isActiveTurn(utteranceId, generation)) {
              this.options.logger?.info("end", {
                utteranceId,
                text: clipTextForLog(trimmed),
              })
            }
            resolve()
          }
          utterance.onerror = (event) => {
            this.finishClientChunk(utteranceId)

            if (this.isActiveTurn(utteranceId, generation)) {
              this.options.logger?.warn("error", {
                utteranceId,
                error: event.error,
                text: clipTextForLog(trimmed),
              })
            }
            resolve()
          }

          speech.speak(utterance)
        }),
    )
  }

  async enqueueServerAudio(
    utteranceId: string,
    audioBase64: string,
    sampleRate: number,
  ) {
    const generation = this.ensureActiveTurn(utteranceId)
    if (generation === null || !this.isActiveTurn(utteranceId, generation))
      return

    if (this.serverPlaybackTurnId !== utteranceId) {
      this.serverPlaybackTurnId = utteranceId
      this.options.onPlaybackStateChange?.({
        isPlaying: true,
        source: "server",
        utteranceId,
      })
    }

    await this.options.player.enqueueBase64(audioBase64, sampleRate)
  }

  completeServerAudio(utteranceId: string) {
    if (this.currentTurnId !== utteranceId) return
    if (this.serverPlaybackTurnId === utteranceId) {
      this.options.onPlaybackStateChange?.({
        isPlaying: false,
        source: "server",
        utteranceId,
      })
      this.serverPlaybackTurnId = null
    }
    this.options.player.reset()
  }

  private ensureActiveTurn(utteranceId: string) {
    if (this.currentTurnId === null) {
      this.currentTurnId = utteranceId
      return this.speechGeneration
    }

    if (this.currentTurnId !== utteranceId) {
      this.options.logger?.info("drop-stale", {
        activeUtteranceId: this.currentTurnId,
        staleUtteranceId: utteranceId,
      })
      return null
    }

    return this.speechGeneration
  }

  private isActiveTurn(utteranceId: string, generation: number) {
    return (
      this.currentTurnId === utteranceId && this.speechGeneration === generation
    )
  }

  private finishClientChunk(utteranceId: string) {
    this.queuedClientChunks = Math.max(0, this.queuedClientChunks - 1)
    if (
      this.queuedClientChunks > 0 ||
      this.clientPlaybackTurnId !== utteranceId
    ) {
      return
    }

    this.options.onPlaybackStateChange?.({
      isPlaying: false,
      source: "client",
      utteranceId,
    })
    this.clientPlaybackTurnId = null
  }

  private flushClientPlayback() {
    this.queuedClientChunks = 0
    if (!this.clientPlaybackTurnId) {
      return
    }

    this.options.onPlaybackStateChange?.({
      isPlaying: false,
      source: "client",
      utteranceId: this.clientPlaybackTurnId,
    })
    this.clientPlaybackTurnId = null
  }

  private flushServerPlayback() {
    if (!this.serverPlaybackTurnId) {
      return
    }

    this.options.onPlaybackStateChange?.({
      isPlaying: false,
      source: "server",
      utteranceId: this.serverPlaybackTurnId,
    })
    this.serverPlaybackTurnId = null
  }
}

function clipTextForLog(text: string, maxLength = 120) {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`
}
