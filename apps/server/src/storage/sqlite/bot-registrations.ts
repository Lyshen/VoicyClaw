import { randomUUID } from "node:crypto"
import { db } from "./client"
import "./schema"

const upsertBotRegistrationStatement = db.prepare(`
  INSERT INTO bot_registrations (
    id,
    bot_id,
    bot_name,
    channel_id,
    platform_key_id,
    created_at,
    updated_at,
    last_connected_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (bot_id, channel_id) DO UPDATE SET
    bot_name = excluded.bot_name,
    platform_key_id = excluded.platform_key_id,
    updated_at = excluded.updated_at,
    last_connected_at = excluded.last_connected_at
`)

export function upsertBotRegistration(input: {
  botId: string
  botName: string
  channelId: string
  platformKeyId: string
  lastConnectedAt?: string
}) {
  const now = new Date().toISOString()
  upsertBotRegistrationStatement.run(
    randomUUID(),
    input.botId,
    input.botName,
    input.channelId,
    input.platformKeyId,
    now,
    now,
    input.lastConnectedAt ?? null,
  )
}
