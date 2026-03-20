import { mkdirSync } from "node:fs"
import { resolve } from "node:path"
import { randomUUID } from "node:crypto"
import { DatabaseSync } from "node:sqlite"

export interface PlatformKeyRecord {
  id: string
  token: string
  label: string | null
  channelId: string
  createdAt: string
  lastUsedAt: string | null
}

const databaseFile = resolve(process.cwd(), ".data", "voicyclaw.sqlite")

mkdirSync(resolve(process.cwd(), ".data"), { recursive: true })

const db = new DatabaseSync(databaseFile)

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS platform_keys (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    label TEXT,
    channel_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_used_at TEXT,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bot_registrations (
    id TEXT PRIMARY KEY,
    bot_id TEXT NOT NULL,
    bot_name TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    platform_key_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_connected_at TEXT,
    UNIQUE (bot_id, channel_id),
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (platform_key_id) REFERENCES platform_keys(id) ON DELETE CASCADE
  );
`)

const upsertChannelStatement = db.prepare(`
  INSERT INTO channels (id, name, created_at, updated_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET
    name = excluded.name,
    updated_at = excluded.updated_at
`)

const insertPlatformKeyStatement = db.prepare(`
  INSERT INTO platform_keys (id, token, label, channel_id, created_at, last_used_at)
  VALUES (?, ?, ?, ?, ?, ?)
`)

const selectPlatformKeyByTokenStatement = db.prepare(`
  SELECT
    id,
    token,
    label,
    channel_id AS channelId,
    created_at AS createdAt,
    last_used_at AS lastUsedAt
  FROM platform_keys
  WHERE token = ?
  LIMIT 1
`)

const touchPlatformKeyStatement = db.prepare(`
  UPDATE platform_keys
  SET last_used_at = ?
  WHERE id = ?
`)

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

export function ensureChannel(channelId: string, name: string) {
  const now = new Date().toISOString()
  upsertChannelStatement.run(channelId, name, now, now)
}

export function createPlatformKey(channelId: string, label?: string | null) {
  const now = new Date().toISOString()
  const record: PlatformKeyRecord = {
    id: randomUUID(),
    token: `vc_${randomUUID().replace(/-/g, "")}`,
    label: label?.trim() || "Prototype key",
    channelId,
    createdAt: now,
    lastUsedAt: null
  }

  insertPlatformKeyStatement.run(
    record.id,
    record.token,
    record.label,
    record.channelId,
    record.createdAt,
    record.lastUsedAt
  )

  return record
}

export function findPlatformKeyByToken(token: string) {
  return selectPlatformKeyByTokenStatement.get(token) as PlatformKeyRecord | undefined
}

export function touchPlatformKey(id: string) {
  touchPlatformKeyStatement.run(new Date().toISOString(), id)
}

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
    input.lastConnectedAt ?? null
  )
}

export function getDatabaseFile() {
  return databaseFile
}
