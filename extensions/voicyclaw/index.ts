import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

import { createVoicyClawChannel } from "./src/channel.js";
import { createVoicyClawRuntime, setVoicyClawRuntime } from "./src/runtime.js";

const plugin = {
  id: "voicyclaw",
  name: "VoicyClaw",
  description: "VoicyClaw plugin for OpenClaw",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    const runtime = createVoicyClawRuntime();

    setVoicyClawRuntime(runtime);

    api.registerChannel({
      plugin: createVoicyClawChannel(runtime, api.runtime.channel),
    });
    api.registerGatewayMethod("voicyclaw.status", ({ respond }) => {
      respond(true, {
        accounts: runtime.listSnapshots(),
      });
    });
  },
};

export default plugin;
