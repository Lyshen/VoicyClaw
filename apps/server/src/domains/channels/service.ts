import { storage } from "../../storage"

export function ensureStoredChannel(channelId: string, name: string) {
  storage.channels.ensure(channelId, name)
}
