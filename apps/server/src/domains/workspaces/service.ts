import { storage, type WorkspaceRecord } from "../../storage"
import { normalizeOptionalString } from "../users/service"

export async function findWorkspaceById(workspaceId: string) {
  return await storage.workspaces.findById(workspaceId)
}

export async function ensureDefaultWorkspaceForUser(input: {
  ownerUserId: string
  name: string
}) {
  return (
    (await storage.workspaces.findDefaultByOwnerUserId(input.ownerUserId)) ??
    (await storage.workspaces.create({
      ownerUserId: input.ownerUserId,
      name: input.name,
      isDefault: true,
    }))
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
