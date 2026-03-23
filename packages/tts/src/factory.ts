import type { TTSAdapter } from "./interface"
import { DemoTTSProvider } from "./providers/demo"
import {
  VolcengineTTSProvider,
  type VolcengineTTSProviderOptions,
} from "./providers/volcengine"

export type ServerTTSProviderId = "demo" | "volcengine-tts"

export type ServerTTSProviderConfig =
  | {
      id: "demo"
    }
  | {
      id: "volcengine-tts"
      options: VolcengineTTSProviderOptions
    }

export function createServerTTSAdapter(
  config: ServerTTSProviderConfig,
): TTSAdapter {
  switch (config.id) {
    case "demo":
      return new DemoTTSProvider()
    case "volcengine-tts":
      return new VolcengineTTSProvider(config.options)
  }
}
