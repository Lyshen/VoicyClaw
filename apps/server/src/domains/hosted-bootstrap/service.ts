import type {
  PlatformKeyRecord,
  ProjectRecord,
  WorkspaceRecord,
} from "../../storage"
import {
  buildHostedAllowanceSnapshot,
  ensureStarterPreviewAllowance,
} from "../billing/service"
import { ensureStarterPlatformKey } from "../platform-keys/service"
import { ensureStarterProject } from "../projects/service"
import { upsertHostedUser } from "../users/service"
import {
  buildStarterWorkspaceName,
  ensureDefaultWorkspaceForUser,
} from "../workspaces/service"

const STARTER_KEY_LABEL = "Starter key"

export interface HostedBootstrapInput {
  provider: "clerk"
  providerSubject: string
  email?: string | null
  displayName?: string | null
  firstName?: string | null
  fullName?: string | null
  username?: string | null
}

export interface HostedBootstrapRecord {
  version: 1
  workspace: {
    id: string
    name: string
  }
  project: {
    id: string
    name: string
    channelId: string
    botId: string
    displayName: string
  }
  starterKey: {
    value: string
    label: string
    createdAt: string
    expiresAt?: string | null
  } | null
  allowance: {
    label: string
    status: "preview"
    note: string
    currency: "voice-credits"
    grantedCreditsMillis: number
    usedCreditsMillis: number
    remainingCreditsMillis: number
  }
}

export async function bootstrapHostedResources(
  input: HostedBootstrapInput,
): Promise<HostedBootstrapRecord> {
  const user = await upsertHostedUser(input)
  const workspace = await ensureDefaultWorkspaceForUser({
    ownerUserId: user.id,
    name: buildStarterWorkspaceName(input),
  })
  const project = await ensureStarterProject(workspace.id)

  const starterKey = await ensureStarterPlatformKey({
    channelId: project.channelId,
    label: STARTER_KEY_LABEL,
    workspaceId: workspace.id,
    projectId: project.id,
    createdByUserId: user.id,
  })

  await ensureStarterPreviewAllowance(workspace.id)

  return await buildHostedBootstrapRecord(workspace, project, starterKey)
}

async function buildHostedBootstrapRecord(
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
      label: starterKey.label ?? STARTER_KEY_LABEL,
      createdAt: starterKey.createdAt,
      expiresAt: starterKey.expiresAt,
    },
    allowance,
  }
}
