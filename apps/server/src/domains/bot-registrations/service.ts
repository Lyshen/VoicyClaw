import { storage } from "../../storage"

export function upsertBotRegistrationRecord(input: {
  botId: string
  botName: string
  channelId: string
  platformKeyId: string
  lastConnectedAt?: string
}) {
  storage.botRegistrations.upsert(input)
}
