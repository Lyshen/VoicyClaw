import { ChannelStudio } from "../../../components/channel-studio"
import { getWebRequestContext } from "../../../lib/web-request-context"

export default async function ConsolePage() {
  const { runtime } = await getWebRequestContext()

  return <ChannelStudio initialRuntime={runtime} />
}
