import { headers } from "next/headers"

import { TrialStudioPage } from "../../components/trial-studio-page"
import { resolvePublicServerUrl } from "../../lib/public-server-url"

export const dynamic = "force-dynamic"

export default async function TryPage() {
  const requestHeaders = await headers()
  const forwardedProto =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http"
  const serverUrl = resolvePublicServerUrl({
    headers: requestHeaders,
    nextUrl: {
      protocol: `${forwardedProto}:`,
    },
  })

  return <TrialStudioPage serverUrl={serverUrl} />
}
