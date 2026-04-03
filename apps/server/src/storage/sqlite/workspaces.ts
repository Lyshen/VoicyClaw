import { randomUUID } from "node:crypto"
import type { WorkspaceRecord } from "../types"
import { db } from "./client"
import "./schema"

const selectDefaultWorkspaceByOwnerStatement = db.prepare(`
  SELECT
    id,
    owner_user_id AS ownerUserId,
    name,
    is_default AS isDefault,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM workspaces
  WHERE owner_user_id = ? AND is_default = 1
  LIMIT 1
`)

const selectWorkspaceByIdStatement = db.prepare(`
  SELECT
    id,
    owner_user_id AS ownerUserId,
    name,
    is_default AS isDefault,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM workspaces
  WHERE id = ?
  LIMIT 1
`)

const insertWorkspaceStatement = db.prepare(`
  INSERT INTO workspaces (
    id,
    owner_user_id,
    name,
    is_default,
    created_at,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?)
`)

export function findDefaultWorkspaceByOwnerUserId(ownerUserId: string) {
  return selectDefaultWorkspaceByOwnerStatement.get(ownerUserId) as
    | WorkspaceRecord
    | undefined
}

export function findWorkspaceById(id: string) {
  return selectWorkspaceByIdStatement.get(id) as WorkspaceRecord | undefined
}

export function createWorkspace(input: {
  ownerUserId: string
  name: string
  isDefault?: boolean
}) {
  const now = new Date().toISOString()
  const workspace: WorkspaceRecord = {
    id: randomUUID(),
    ownerUserId: input.ownerUserId,
    name: input.name.trim(),
    isDefault: input.isDefault ?? false,
    createdAt: now,
    updatedAt: now,
  }

  insertWorkspaceStatement.run(
    workspace.id,
    workspace.ownerUserId,
    workspace.name,
    workspace.isDefault ? 1 : 0,
    workspace.createdAt,
    workspace.updatedAt,
  )

  return workspace
}
