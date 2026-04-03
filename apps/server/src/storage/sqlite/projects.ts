import { randomUUID } from "node:crypto"
import type { ProjectRecord, ProjectType } from "../types"
import { db } from "./client"
import "./schema"

const selectStarterProjectByWorkspaceStatement = db.prepare(`
  SELECT
    id,
    workspace_id AS workspaceId,
    name,
    project_type AS projectType,
    channel_id AS channelId,
    bot_id AS botId,
    display_name AS displayName,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM projects
  WHERE workspace_id = ? AND project_type = 'starter'
  LIMIT 1
`)

const selectProjectByChannelStatement = db.prepare(`
  SELECT
    id,
    workspace_id AS workspaceId,
    name,
    project_type AS projectType,
    channel_id AS channelId,
    bot_id AS botId,
    display_name AS displayName,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM projects
  WHERE channel_id = ?
  LIMIT 1
`)

const insertProjectStatement = db.prepare(`
  INSERT INTO projects (
    id,
    workspace_id,
    name,
    project_type,
    channel_id,
    bot_id,
    display_name,
    created_at,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

export function findStarterProjectByWorkspaceId(workspaceId: string) {
  return selectStarterProjectByWorkspaceStatement.get(workspaceId) as
    | ProjectRecord
    | undefined
}

export function findProjectByChannelId(channelId: string) {
  return selectProjectByChannelStatement.get(channelId) as
    | ProjectRecord
    | undefined
}

export function createProject(input: {
  workspaceId: string
  name: string
  projectType: ProjectType
  channelId: string
  botId: string
  displayName: string
}) {
  const now = new Date().toISOString()
  const project: ProjectRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    name: input.name.trim(),
    projectType: input.projectType,
    channelId: input.channelId.trim(),
    botId: input.botId.trim(),
    displayName: input.displayName.trim(),
    createdAt: now,
    updatedAt: now,
  }

  insertProjectStatement.run(
    project.id,
    project.workspaceId,
    project.name,
    project.projectType,
    project.channelId,
    project.botId,
    project.displayName,
    project.createdAt,
    project.updatedAt,
  )

  return project
}
