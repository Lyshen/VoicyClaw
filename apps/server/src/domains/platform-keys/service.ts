import {
  type PlatformKeyRecord,
  type PlatformKeyType,
  storage,
} from "../../storage"
import { findProjectByChannelId } from "../projects/service"

export function findPlatformKeyByProjectIdAndType(
  projectId: string,
  keyType: PlatformKeyType,
) {
  return storage.platformKeys.findByProjectIdAndType(projectId, keyType)
}

export function ensureStarterPlatformKey(input: {
  channelId: string
  workspaceId: string
  projectId: string
  createdByUserId: string
  label?: string | null
}) {
  return (
    findPlatformKeyByProjectIdAndType(input.projectId, "starter") ??
    issuePlatformKeyForChannel({
      channelId: input.channelId,
      label: input.label,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      keyType: "starter",
      createdByUserId: input.createdByUserId,
    })
  )
}

export function issuePlatformKeyForChannel(input: {
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
      : findProjectByChannelId(input.channelId)

  return storage.platformKeys.create(input.channelId, input.label, {
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
    }
  | {
      ok: false
      reason: "not-found" | "channel-mismatch"
    }

export function authorizePlatformKeyForChannel(
  token: string,
  channelId: string,
): PlatformKeyAuthorization {
  const key = storage.platformKeys.findByToken(token.trim())
  if (!key) {
    return {
      ok: false,
      reason: "not-found",
    }
  }

  if (key.channelId !== channelId) {
    return {
      ok: false,
      reason: "channel-mismatch",
    }
  }

  return {
    ok: true,
    key,
  }
}

export function markPlatformKeyUsed(platformKeyId: string) {
  storage.platformKeys.touch(platformKeyId)
}
