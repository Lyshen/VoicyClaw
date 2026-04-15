import { LandingPage } from "../components/landing-page"
import { getWebRequestContext } from "../lib/web-request-context"

export const dynamic = "force-dynamic"

export default async function Page() {
  const {
    serverUrl,
    auth: { isEnabled },
  } = await getWebRequestContext()

  return <LandingPage authEnabled={isEnabled} serverUrl={serverUrl} />
}
