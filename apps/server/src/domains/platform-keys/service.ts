import {
  type PlatformKeyRecord,
  type PlatformKeyType,
  storage,
} from "../../storage"

export function findPlatformKeyByProjectIdAndType(
  projectId: string,
  keyType: PlatformKeyType,
) {
  return storage.platformKeys.findByProjectIdAndType(projectId, keyType)
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
      : storage.projects.findByChannelId(input.channelId)

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
