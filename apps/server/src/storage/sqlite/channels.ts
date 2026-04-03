import { db } from "./client"
import "./schema"

const upsertChannelStatement = db.prepare(`
  INSERT INTO channels (id, name, created_at, updated_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET
    name = excluded.name,
    updated_at = excluded.updated_at
`)

export function ensureChannel(channelId: string, name: string) {
  const now = new Date().toISOString()
  upsertChannelStatement.run(channelId, name, now, now)
}
