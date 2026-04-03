import { storage, type WorkspaceRecord } from "../../storage"
import { normalizeOptionalString } from "../users/service"

export function findWorkspaceById(workspaceId: string) {
  return storage.workspaces.findById(workspaceId)
}

export function ensureDefaultWorkspaceForUser(input: {
  ownerUserId: string
  name: string
}) {
  return (
    storage.workspaces.findDefaultByOwnerUserId(input.ownerUserId) ??
    storage.workspaces.create({
      ownerUserId: input.ownerUserId,
      name: input.name,
      isDefault: true,
    })
  )
}

export function buildStarterWorkspaceName(input: {
  firstName?: string | null
  fullName?: string | null
  username?: string | null
}) {
  const preferredName =
    normalizeOptionalString(input.firstName) ??
    normalizeOptionalString(input.fullName) ??
    normalizeOptionalString(input.username)

  if (!preferredName) {
    return "My Workspace"
  }

  return `${preferredName} Workspace`
}

export type { WorkspaceRecord }
