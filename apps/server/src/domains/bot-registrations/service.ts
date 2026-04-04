import { storage } from "../../storage"

export async function upsertBotRegistrationRecord(input: {
  botId: string
  botName: string
  channelId: string
  platformKeyId: string
  lastConnectedAt?: string
}) {
  await storage.botRegistrations.upsert(input)
}
