import { SettingsStudio } from "../../../components/settings-studio"
import { getWebRequestContext } from "../../../lib/web-request-context"

export default async function SettingsPage() {
  const { runtime } = await getWebRequestContext()

  return <SettingsStudio initialRuntime={runtime} />
}
