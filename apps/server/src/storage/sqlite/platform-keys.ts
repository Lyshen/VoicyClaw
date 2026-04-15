import { randomUUID } from "node:crypto"
import type { PlatformKeyRecord, PlatformKeyType } from "../types"
import { db } from "./client"
import "./schema"

const insertPlatformKeyStatement = db.prepare(`
  INSERT INTO platform_keys (
    id,
    token,
    label,
    channel_id,
    workspace_id,
    project_id,
    key_type,
    created_by_user_id,
    created_at,
    expires_at,
    last_used_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const selectPlatformKeyByProjectAndTypeStatement = db.prepare(`
  SELECT
    id,
    token,
    label,
    channel_id AS channelId,
    workspace_id AS workspaceId,
    project_id AS projectId,
    key_type AS keyType,
    created_by_user_id AS createdByUserId,
    created_at AS createdAt,
    expires_at AS expiresAt,
    last_used_at AS lastUsedAt
  FROM platform_keys
  WHERE project_id = ? AND key_type = ?
  ORDER BY created_at DESC
  LIMIT 1
`)

const selectPlatformKeyByTokenStatement = db.prepare(`
  SELECT
    id,
    token,
    label,
    channel_id AS channelId,
    workspace_id AS workspaceId,
    project_id AS projectId,
    key_type AS keyType,
    created_by_user_id AS createdByUserId,
    created_at AS createdAt,
    expires_at AS expiresAt,
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

export function findPlatformKeyByProjectIdAndType(
  projectId: string,
  keyType: PlatformKeyType,
) {
  return selectPlatformKeyByProjectAndTypeStatement.get(projectId, keyType) as
    | PlatformKeyRecord
    | undefined
}

export function createPlatformKey(
  channelId: string,
  label?: string | null,
  options?: {
    workspaceId?: string | null
    projectId?: string | null
    keyType?: PlatformKeyType
    createdByUserId?: string | null
    expiresAt?: string | null
  },
) {
  const now = new Date().toISOString()
  const keyType = options?.keyType ?? "standard"
  const prefix =
    keyType === "trial" ? "try_" : keyType === "starter" ? "vcs_" : "vc_"
  const record: PlatformKeyRecord = {
    id: randomUUID(),
    token: `${prefix}${randomUUID().replace(/-/g, "")}`,
    label: label?.trim() || "Prototype key",
    channelId,
    workspaceId: options?.workspaceId ?? null,
    projectId: options?.projectId ?? null,
    keyType,
    createdByUserId: options?.createdByUserId ?? null,
    createdAt: now,
    expiresAt: options?.expiresAt ?? null,
    lastUsedAt: null,
  }

  insertPlatformKeyStatement.run(
    record.id,
    record.token,
    record.label,
    record.channelId,
    record.workspaceId,
    record.projectId,
    record.keyType,
    record.createdByUserId,
    record.createdAt,
    record.expiresAt,
    record.lastUsedAt,
  )

  return record
}

export function findPlatformKeyByToken(token: string) {
  return selectPlatformKeyByTokenStatement.get(token) as
    | PlatformKeyRecord
    | undefined
}

export function touchPlatformKey(id: string) {
  touchPlatformKeyStatement.run(new Date().toISOString(), id)
}
