import { CreditsPage } from "../../../components/credits-page"
import { getCreditsPageState } from "../../../lib/hosted-viewer"

export default async function CreditsRoute() {
  const state = await getCreditsPageState()
  return <CreditsPage state={state} />
}
