import { Starter2RoomExperience } from "../../../components/starter2-room"
import { fetchStarter2Room } from "../../../lib/starter2-room"
import { getWebRequestContext } from "../../../lib/web-request-context"

export default async function Starter2Page() {
  const context = await getWebRequestContext()
  const room = await fetchStarter2Room(context.serverUrl, context.onboarding)

  const initialRuntime = {
    ...context.runtime,
    initialSettings: {
      ...context.runtime.initialSettings,
      channelId: room.channelId,
      conversationBackend: "starter2-room" as const,
      asrProvider: "browser" as const,
      ttsProvider: "browser" as const,
    },
    settingsNamespace: context.runtime.settingsNamespace
      ? `${context.runtime.settingsNamespace}.starter2`
      : "starter2",
  }

  return <Starter2RoomExperience initialRuntime={initialRuntime} room={room} />
}
