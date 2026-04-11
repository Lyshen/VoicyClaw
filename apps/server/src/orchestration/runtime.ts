import { resolveUtteranceTargets } from "./resolver"
import type {
  OrchestrationAction,
  OrchestrationDerivation,
  ResolutionResult,
  RoomConfig,
  Utterance,
} from "./types"

export function deriveActionsFromResolution(
  utterance: Utterance,
  resolution: ResolutionResult,
): OrchestrationAction[] {
  return resolution.targets.map((target) => ({
    roomId: utterance.roomId,
    actorId: utterance.speakerId,
    action: "CALL" as const,
    target,
  }))
}

export function deriveOrchestration(
  room: RoomConfig,
  utterance: Utterance,
): OrchestrationDerivation {
  const resolution = resolveUtteranceTargets(room, utterance)
  const actions = deriveActionsFromResolution(utterance, resolution)

  return {
    room,
    utterance,
    resolution,
    actions,
  }
}
