import {
  type PlatformKeyRecord,
  type PlatformKeyType,
  type ProjectRecord,
  storage,
} from "../../storage"
import { findProjectByChannelId } from "../projects/service"

export async function findPlatformKeyByProjectIdAndType(
  projectId: string,
  keyType: PlatformKeyType,
) {
  return await storage.platformKeys.findByProjectIdAndType(projectId, keyType)
}

export async function ensureStarterPlatformKey(input: {
  channelId: string
  workspaceId: string
  projectId: string
  createdByUserId: string
  label?: string | null
}) {
  return (
    (await findPlatformKeyByProjectIdAndType(input.projectId, "starter")) ??
    (await issuePlatformKeyForChannel({
      channelId: input.channelId,
      label: input.label,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      keyType: "starter",
      createdByUserId: input.createdByUserId,
    }))
  )
}

export async function issuePlatformKeyForChannel(input: {
  channelId: string
  label?: string | null
  workspaceId?: string | null
  projectId?: string | null
  keyType?: PlatformKeyType
  createdByUserId?: string | null
}) {
  const project =
    input.projectId || input.workspaceId
      ? null
      : await findProjectByChannelId(input.channelId)

  return await storage.platformKeys.create(input.channelId, input.label, {
    workspaceId: input.workspaceId ?? project?.workspaceId ?? null,
    projectId: input.projectId ?? project?.id ?? null,
    keyType: input.keyType,
    createdByUserId: input.createdByUserId ?? null,
  })
}

export type PlatformKeyAuthorization =
  | {
      ok: true
      key: PlatformKeyRecord
      channelId: string
      project?: ProjectRecord
    }
  | {
      ok: false
      reason: "not-found"
    }

export async function authorizePlatformKey(
  token: string,
): Promise<PlatformKeyAuthorization> {
  const key = await storage.platformKeys.findByToken(token.trim())
  if (!key) {
    return {
      ok: false,
      reason: "not-found",
    }
  }

  return {
    ok: true,
    key,
    channelId: key.channelId,
    project: (await findProjectByChannelId(key.channelId)) ?? undefined,
  }
}

export async function markPlatformKeyUsed(platformKeyId: string) {
  await storage.platformKeys.touch(platformKeyId)
}
