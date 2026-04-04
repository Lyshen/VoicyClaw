import { randomUUID } from "node:crypto"
import { type ProjectRecord, storage } from "../../storage"
import { ensureStoredChannel } from "../channels/service"

export const STARTER_PROJECT_NAME = "SayHello"
const STARTER_PROJECT_SLUG = "sayhello"
export const STARTER_PROJECT_DISPLAY_NAME = "SayHello Connector"

export async function findProjectByChannelId(channelId: string) {
  return await storage.projects.findByChannelId(channelId)
}

export async function ensureStarterProject(workspaceId: string) {
  return (
    (await storage.projects.findStarterByWorkspaceId(workspaceId)) ??
    (await createStarterProject(workspaceId))
  )
}

async function createStarterProject(workspaceId: string) {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8)
  const channelId = `${STARTER_PROJECT_SLUG}-${suffix}`

  await ensureStoredChannel(channelId, STARTER_PROJECT_NAME)

  return await storage.projects.create({
    workspaceId,
    name: STARTER_PROJECT_NAME,
    projectType: "starter",
    channelId,
    botId: `openclaw-${suffix}`,
    displayName: STARTER_PROJECT_DISPLAY_NAME,
  })
}

export type { ProjectRecord }
