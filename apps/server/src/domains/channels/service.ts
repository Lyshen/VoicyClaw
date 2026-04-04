import { storage } from "../../storage"

export async function ensureStoredChannel(channelId: string, name: string) {
  await storage.channels.ensure(channelId, name)
}
