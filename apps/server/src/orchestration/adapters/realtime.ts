import { getStarter2RoomDefinition } from "../../domains/starter2/service"
import type { ClientSession, RealtimeRuntime } from "../../realtime-runtime"
import type { RoomConfig, RoomParticipant, Utterance } from "../types"

function getUserParticipant(client: ClientSession): RoomParticipant {
  return {
    id: client.id,
    kind: "user",
    name: "User",
  }
}

export function buildRoomConfigFromRealtime(
  runtime: RealtimeRuntime,
  client: ClientSession,
): RoomConfig {
  const channel = runtime.getOrCreateRuntimeChannel(client.channelId)
  const participants: RoomParticipant[] = [getUserParticipant(client)]

  if (client.settings?.conversationBackend === "starter2-room") {
    const room = getStarter2RoomDefinition({ channelId: client.channelId })

    for (const agent of room.agents) {
      participants.push({
        id: agent.id,
        kind: "agent",
        name: agent.name,
      })
    }

    return {
      roomId: channel.id,
      participants,
    }
  }

  for (const bot of channel.bots.values()) {
    const runtimeInfo = bot.toRuntimeInfo()
    participants.push({
      id: runtimeInfo.botId,
      kind: "agent",
      name: runtimeInfo.displayName,
    })
  }

  return {
    roomId: channel.id,
    participants,
  }
}

export function buildUtteranceFromTranscript(
  client: ClientSession,
  utteranceId: string,
  text: string,
): Utterance {
  return {
    roomId: client.channelId,
    speakerId: client.id,
    utteranceId,
    text,
  }
}
