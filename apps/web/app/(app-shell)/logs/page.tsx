import { LogsPage } from "../../../components/logs-page"
import { getLogsPageState } from "../../../lib/hosted-viewer"

type LogsRouteProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function LogsRoute({ searchParams }: LogsRouteProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const state = await getLogsPageState({
    startAt: readIsoSearchParam(resolvedSearchParams.start),
    endAt: readIsoSearchParam(resolvedSearchParams.end),
  })

  return <LogsPage state={state} />
}

function readIsoSearchParam(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value
  const trimmed = candidate?.trim()
  if (!trimmed) {
    return null
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}
