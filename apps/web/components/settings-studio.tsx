"use client"
import {
  ASR_PROVIDER_GUIDE,
  ASR_PROVIDER_OPTIONS,
  CONVERSATION_BACKEND_OPTIONS,
  getAsrProviderOption,
  getConversationBackendOption,
  getTtsProviderOption,
  normalizeOpenClawGatewayUrl,
  normalizeServerUrl,
  sanitizeChannelId,
  TTS_PROVIDER_GUIDE,
  TTS_PROVIDER_OPTIONS,
} from "../lib/prototype-settings"
import { usePrototypeSettings } from "../lib/use-prototype-settings"
import { useSettingsStudioState } from "../lib/use-settings-studio-state"
import { SettingsStudioView } from "./settings-studio-view"

export function SettingsStudio() {
  const { settings, ready, updateSetting, onboarding } = usePrototypeSettings()
  const activeAsrProvider = getAsrProviderOption(settings.asrProvider)
  const activeTtsProvider = getTtsProviderOption(settings.ttsProvider)
  const activeBackend = getConversationBackendOption(
    settings.conversationBackend,
  )
  const {
    serverStatus,
    starterProjectStatus,
    starterBotOnline,
    issuedKey,
    keyMessage,
    issueKey,
  } = useSettingsStudioState({
    ready,
    settings,
    onboarding,
  })

  return (
    <SettingsStudioView
      settings={settings}
      onboarding={onboarding}
      serverStatus={serverStatus}
      starterProjectStatus={starterProjectStatus}
      starterBotOnline={starterBotOnline}
      issuedKey={issuedKey}
      keyMessage={keyMessage}
      activeBackend={activeBackend}
      activeAsrProvider={activeAsrProvider}
      activeTtsProvider={activeTtsProvider}
      backendOptions={CONVERSATION_BACKEND_OPTIONS}
      asrOptions={ASR_PROVIDER_OPTIONS}
      ttsOptions={TTS_PROVIDER_OPTIONS}
      asrGuides={ASR_PROVIDER_GUIDE}
      ttsGuides={TTS_PROVIDER_GUIDE}
      onIssueKey={() => void issueKey()}
      onUpdateServerUrl={(value) =>
        updateSetting("serverUrl", normalizeServerUrl(value))
      }
      onUpdateChannelId={(value) =>
        updateSetting("channelId", sanitizeChannelId(value))
      }
      onUpdateLanguage={(value) => updateSetting("language", value)}
      onUpdateGatewayUrl={(value) =>
        updateSetting("openClawGatewayUrl", normalizeOpenClawGatewayUrl(value))
      }
      onUpdateGatewayToken={(value) =>
        updateSetting("openClawGatewayToken", value)
      }
      onUpdateConversationBackend={(value) =>
        updateSetting("conversationBackend", value)
      }
      onUpdateAsrProvider={(value) => updateSetting("asrProvider", value)}
      onUpdateTtsProvider={(value) => updateSetting("ttsProvider", value)}
    />
  )
}
