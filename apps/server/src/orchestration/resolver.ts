import type {
  ResolutionResult,
  RoomConfig,
  RoomParticipant,
  Utterance,
} from "./types"

const GROUP_PATTERNS = [
  /\ball\b/i,
  /\beveryone\b/i,
  /\byou all\b/i,
  /\ball of you\b/i,
]

function normalizeToken(value: string) {
  return value.trim().toLowerCase()
}

function getParticipantTokens(participant: RoomParticipant) {
  return [participant.id, participant.name].map(normalizeToken).filter(Boolean)
}

function includesToken(text: string, token: string) {
  if (!token) {
    return false
  }

  return text.includes(token)
}

export function resolveUtteranceTargets(
  room: RoomConfig,
  utterance: Utterance,
): ResolutionResult {
  const normalizedText = normalizeToken(utterance.text)

  if (!normalizedText) {
    return {
      utteranceId: utterance.utteranceId,
      targets: [],
    }
  }

  if (GROUP_PATTERNS.some((pattern) => pattern.test(normalizedText))) {
    return {
      utteranceId: utterance.utteranceId,
      targets: ["*"],
    }
  }

  const targets = room.participants
    .filter((participant) => participant.id !== utterance.speakerId)
    .filter((participant) =>
      getParticipantTokens(participant).some((token) =>
        includesToken(normalizedText, token),
      ),
    )
    .map((participant) => participant.id)

  return {
    utteranceId: utterance.utteranceId,
    targets,
  }
}
