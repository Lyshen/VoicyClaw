interface OutputTurnCoordinatorLogger {
  info: (message: string, payload: Record<string, unknown>) => void
  warn: (message: string, payload: Record<string, unknown>) => void
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
}

export class OutputTurnCoordinator {
  private currentTurnId: string | null = null
  private speechGeneration = 0
  private speechQueue = Promise.resolve()

  constructor(private readonly options: OutputTurnCoordinatorOptions) {}

  reset() {
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
      text: clipTextForLog(trimmed)
    })

    const generation = this.ensureActiveTurn(utteranceId)
    if (generation === null) return

    this.speechQueue = this.speechQueue.then(
      () =>
        new Promise<void>((resolve) => {
          if (!this.isActiveTurn(utteranceId, generation)) {
            resolve()
            return
          }

          const utterance = new SpeechSynthesisUtterance(trimmed)
          utterance.lang = language
          utterance.onstart = () => {
            if (!this.isActiveTurn(utteranceId, generation)) return

            this.options.logger?.info("start", {
              utteranceId,
              language: utterance.lang,
              text: clipTextForLog(trimmed)
            })
          }
          utterance.onend = () => {
            if (!this.isActiveTurn(utteranceId, generation)) {
              resolve()
              return
            }

            this.options.logger?.info("end", {
              utteranceId,
              text: clipTextForLog(trimmed)
            })
            resolve()
          }
          utterance.onerror = (event) => {
            if (!this.isActiveTurn(utteranceId, generation)) {
              resolve()
              return
            }

            this.options.logger?.warn("error", {
              utteranceId,
              error: event.error,
              text: clipTextForLog(trimmed)
            })
            resolve()
          }

          speech.speak(utterance)
        })
    )
  }

  async enqueueServerAudio(utteranceId: string, audioBase64: string, sampleRate: number) {
    const generation = this.ensureActiveTurn(utteranceId)
    if (generation === null || !this.isActiveTurn(utteranceId, generation)) return

    await this.options.player.enqueueBase64(audioBase64, sampleRate)
  }

  completeServerAudio(utteranceId: string) {
    if (this.currentTurnId !== utteranceId) return
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
        staleUtteranceId: utteranceId
      })
      return null
    }

    return this.speechGeneration
  }

  private isActiveTurn(utteranceId: string, generation: number) {
    return this.currentTurnId === utteranceId && this.speechGeneration === generation
  }
}

function clipTextForLog(text: string, maxLength = 120) {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`
}
