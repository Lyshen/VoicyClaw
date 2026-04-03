import { randomUUID } from "node:crypto"
import { type ProjectRecord, storage } from "../../storage"
import { ensureStoredChannel } from "../channels/service"

export const STARTER_PROJECT_NAME = "SayHello"
const STARTER_PROJECT_SLUG = "sayhello"
export const STARTER_PROJECT_DISPLAY_NAME = "SayHello Connector"

export function findProjectByChannelId(channelId: string) {
  return storage.projects.findByChannelId(channelId)
}

export function ensureStarterProject(workspaceId: string) {
  return (
    storage.projects.findStarterByWorkspaceId(workspaceId) ??
    createStarterProject(workspaceId)
  )
}

function createStarterProject(workspaceId: string) {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8)
  const channelId = `${STARTER_PROJECT_SLUG}-${suffix}`

  ensureStoredChannel(channelId, STARTER_PROJECT_NAME)

  return storage.projects.create({
    workspaceId,
    name: STARTER_PROJECT_NAME,
    projectType: "starter",
    channelId,
    botId: `openclaw-${suffix}`,
    displayName: STARTER_PROJECT_DISPLAY_NAME,
  })
}

export type { ProjectRecord }
