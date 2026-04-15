import type {
  PlatformKeyRecord,
  ProjectRecord,
  WorkspaceRecord,
} from "../../storage"
import {
  buildHostedAllowanceSnapshot,
  ensureStarterPreviewAllowance,
} from "../billing/service"
import type { HostedBootstrapRecord } from "../hosted-bootstrap/service"
import { ensureTrialPlatformKey } from "../platform-keys/service"
import { ensureStarterProject } from "../projects/service"
import { upsertTrialUser } from "../users/service"
import { ensureDefaultWorkspaceForUser } from "../workspaces/service"

const TRY_KEY_LABEL = "Try now key"
const TRY_WORKSPACE_NAME = "Try now Workspace"

export interface TrialBootstrapInput {
  trialSubject: string
  displayName?: string | null
}

export async function bootstrapTrialResources(
  input: TrialBootstrapInput,
): Promise<HostedBootstrapRecord> {
  const trialSubject = input.trialSubject.trim()
  const user = await upsertTrialUser({
    providerSubject: trialSubject,
    displayName: input.displayName ?? "Try now guest",
  })
  const workspace = await ensureDefaultWorkspaceForUser({
    ownerUserId: user.id,
    name: TRY_WORKSPACE_NAME,
  })
  const project = await ensureStarterProject(workspace.id)
  const starterKey = await ensureTrialPlatformKey({
    channelId: project.channelId,
    label: TRY_KEY_LABEL,
    workspaceId: workspace.id,
    projectId: project.id,
    createdByUserId: user.id,
  })

  await ensureStarterPreviewAllowance(workspace.id)

  return await buildTrialBootstrapRecord(workspace, project, starterKey)
}

async function buildTrialBootstrapRecord(
  workspace: WorkspaceRecord,
  project: ProjectRecord,
  starterKey: PlatformKeyRecord,
): Promise<HostedBootstrapRecord> {
  const allowance = await buildHostedAllowanceSnapshot(workspace.id)

  return {
    version: 1,
    workspace: {
      id: workspace.id,
      name: workspace.name,
    },
    project: {
      id: project.id,
      name: project.name,
      channelId: project.channelId,
      botId: project.botId,
      displayName: project.displayName,
    },
    starterKey: {
      value: starterKey.token,
      label: starterKey.label ?? TRY_KEY_LABEL,
      createdAt: starterKey.createdAt,
      expiresAt: starterKey.expiresAt,
    },
    allowance,
  }
}
