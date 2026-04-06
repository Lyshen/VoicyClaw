import {
  buildHostedViewerSummary,
  buildHostedViewerUserSummary,
  type HostedViewerSummary,
  type HostedViewerUserSummary,
  type WorkspaceCreditsSummary,
  type WorkspaceLogsSummary,
} from "./hosted-viewer-shared"
import { getWebRequestContext } from "./web-request-context"

export type HostedViewerGateState =
  | {
      kind: "unavailable"
      serverUrl: string
    }
  | {
      kind: "signed-out"
      serverUrl: string
    }
  | {
      kind: "setup-pending"
      serverUrl: string
      user: HostedViewerUserSummary
    }
  | {
      kind: "ready"
      serverUrl: string
      viewer: HostedViewerSummary
    }

export type CreditsPageState =
  | Exclude<HostedViewerGateState, { kind: "ready" }>
  | {
      kind: "ready"
      serverUrl: string
      viewer: HostedViewerSummary
      credits: WorkspaceCreditsSummary
    }

export type LogsPageState =
  | Exclude<HostedViewerGateState, { kind: "ready" }>
  | {
      kind: "ready"
      serverUrl: string
      viewer: HostedViewerSummary
      logs: WorkspaceLogsSummary
    }

export async function getHostedViewerGateState(): Promise<HostedViewerGateState> {
  const requestContext = await getWebRequestContext()
  const { auth, onboarding, serverUrl } = requestContext

  if (!auth.isEnabled) {
    return {
      kind: "unavailable",
      serverUrl,
    }
  }

  if (!auth.isSignedIn || !auth.user) {
    return {
      kind: "signed-out",
      serverUrl,
    }
  }

  if (!onboarding) {
    return {
      kind: "setup-pending",
      serverUrl,
      user: buildHostedViewerUserSummary(auth.user),
    }
  }

  return {
    kind: "ready",
    serverUrl,
    viewer: buildHostedViewerSummary({
      user: auth.user,
      onboarding,
    }),
  }
}

export async function getCreditsPageState(): Promise<CreditsPageState> {
  const state = await getHostedViewerGateState()
  if (state.kind !== "ready") {
    return state
  }

  const credits = await fetchWorkspaceResource<WorkspaceCreditsSummary>({
    serverUrl: state.serverUrl,
    workspaceId: state.viewer.onboarding.workspace.id,
    resourcePath: "credits",
  })

  return {
    ...state,
    credits,
  }
}

export async function getLogsPageState(input: {
  startAt?: string | null
  endAt?: string | null
}): Promise<LogsPageState> {
  const state = await getHostedViewerGateState()
  if (state.kind !== "ready") {
    return state
  }

  const params = new URLSearchParams()
  if (input.startAt) {
    params.set("start", input.startAt)
  }
  if (input.endAt) {
    params.set("end", input.endAt)
  }

  const resourcePath = params.size > 0 ? `logs?${params.toString()}` : "logs"
  const logs = await fetchWorkspaceResource<WorkspaceLogsSummary>({
    serverUrl: state.serverUrl,
    workspaceId: state.viewer.onboarding.workspace.id,
    resourcePath,
  })

  return {
    ...state,
    logs,
  }
}

async function fetchWorkspaceResource<T>(input: {
  serverUrl: string
  workspaceId: string
  resourcePath: string
}) {
  const response = await fetch(
    new URL(
      `/api/workspaces/${input.workspaceId}/${input.resourcePath}`,
      input.serverUrl,
    ),
    {
      cache: "no-store",
    },
  )

  if (!response.ok) {
    throw new Error(
      `VoicyClaw server returned ${response.status} while loading hosted workspace data from ${input.resourcePath}.`,
    )
  }

  return (await response.json()) as T
}
