import { getDatabaseFile } from "./client"

export {
  createUsageEvent,
  createWorkspaceAllowanceLedgerEntry,
  ensureWorkspaceAllowanceLedgerEntry,
  findActiveBillingRate,
  getWorkspaceAllowanceSummary,
  getWorkspaceUsageSummary,
  listWorkspaceUsageEvents,
  upsertBillingRate,
} from "./billing"
export { upsertBotRegistration } from "./bot-registrations"
export { ensureChannel } from "./channels"
export { getDatabaseFile } from "./client"
export {
  createPlatformKey,
  findPlatformKeyByProjectIdAndType,
  findPlatformKeyByToken,
  touchPlatformKey,
} from "./platform-keys"
export {
  createProject,
  findProjectByChannelId,
  findStarterProjectByWorkspaceId,
} from "./projects"
export { upsertUserForIdentity } from "./users"
export {
  createWorkspace,
  findDefaultWorkspaceByOwnerUserId,
  findWorkspaceById,
} from "./workspaces"

export async function initStorage() {}

export function describeStorageTarget() {
  return `SQLite ready at ${getDatabaseFile()}`
}
