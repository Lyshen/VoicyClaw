"use client"

import { useEffect, useState } from "react"

import {
  ASR_PROVIDER_GUIDE,
  ASR_PROVIDER_OPTIONS,
  buildApiUrl,
  CONVERSATION_BACKEND_OPTIONS,
  getAsrProviderOption,
  getConversationBackendOption,
  getProviderModeLabel,
  getTtsProviderOption,
  normalizeOpenClawGatewayUrl,
  normalizeServerUrl,
  type ProviderGuide,
  type ProviderMode,
  sanitizeChannelId,
  TTS_PROVIDER_GUIDE,
  TTS_PROVIDER_OPTIONS,
} from "../lib/prototype-settings"
import { usePrototypeSettings } from "../lib/use-prototype-settings"

export function SettingsStudio() {
  const { settings, ready, updateSetting } = usePrototypeSettings()
  const [serverStatus, setServerStatus] = useState("Checking server...")
  const [issuedKey, setIssuedKey] = useState("")
  const [keyMessage, setKeyMessage] = useState(
    "Issue a platform key here to test external ClawBots.",
  )

  const activeAsrProvider = getAsrProviderOption(settings.asrProvider)
  const activeTtsProvider = getTtsProviderOption(settings.ttsProvider)
  const activeBackend = getConversationBackendOption(
    settings.conversationBackend,
  )

  useEffect(() => {
    if (!ready) return
    void pingServer()
  }, [ready, settings.serverUrl])

  async function pingServer() {
    try {
      const response = await fetch(buildApiUrl(settings, "/api/health"))
      if (!response.ok) {
        throw new Error(`health ${response.status}`)
      }

      const payload = (await response.json()) as {
        protocolVersion: string
        connectedBots: number
        connectedClients: number
      }

      setServerStatus(
        `Connected to ${normalizeServerUrl(settings.serverUrl)} · protocol ${payload.protocolVersion} · ${payload.connectedBots} bot / ${payload.connectedClients} client`,
      )
    } catch {
      setServerStatus(
        "Server is unreachable right now. Start `pnpm dev` or confirm the server URL.",
      )
    }
  }

  async function issueKey() {
    setKeyMessage("Issuing a fresh platform key...")

    try {
      const response = await fetch(buildApiUrl(settings, "/api/keys"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          channelId: settings.channelId,
          label: "Settings console",
        }),
      })

      if (!response.ok) {
        throw new Error(`keys ${response.status}`)
      }

      const payload = (await response.json()) as {
        apiKey: string
        wsUrl: string
      }

      setIssuedKey(payload.apiKey)
      setKeyMessage(
        `Key ready. Connect a bot to ${payload.wsUrl} using the OpenClaw HELLO handshake.`,
      )
    } catch {
      setKeyMessage(
        "Could not create a platform key. Make sure the server is running and try again.",
      )
    }
  }

  return (
    <div className="page-stack">
      <section className="hero-card card">
        <div>
          <p className="hero-eyebrow">Voice setup</p>
          <h1 className="hero-title">Set up your VoicyClaw demo</h1>
          <p className="hero-copy">
            Point VoicyClaw at your agent, choose where speech runs, and test
            the voice path you want.
          </p>
        </div>
        <div className="status-row">
          <span className="status-pill neutral">{serverStatus}</span>
          <span
            className={`status-pill ${toneForMode(activeAsrProvider.mode)}`}
          >
            ASR {getProviderModeLabel(activeAsrProvider.mode)}
          </span>
          <span
            className={`status-pill ${toneForMode(activeTtsProvider.mode)}`}
          >
            TTS {getProviderModeLabel(activeTtsProvider.mode)}
          </span>
          <span className="status-pill neutral">{activeBackend.label}</span>
        </div>
      </section>

      <div className="settings-grid">
        <section className="card stack-card">
          <div className="card-heading compact">
            <div>
              <p className="card-kicker">Agent source</p>
              <h2>How VoicyClaw reaches your agent</h2>
            </div>
          </div>
          <p className="support-copy">
            Active path: <strong>{activeBackend.label}</strong>.{" "}
            {activeBackend.runtimeHint}
          </p>
          <div className="provider-option-grid">
            {CONVERSATION_BACKEND_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`provider-option ${settings.conversationBackend === option.id ? "active" : ""}`}
                onClick={() => updateSetting("conversationBackend", option.id)}
              >
                <div className="provider-pill-row">
                  <span className="status-pill neutral">
                    {option.id === "local-bot" ? "Inbound bot" : "Gateway WS"}
                  </span>
                </div>
                <strong>{option.label}</strong>
                <p>{option.summary}</p>
              </button>
            ))}
          </div>
          <p className="support-copy">
            This switch decides how VoicyClaw finds the agent. The ASR and TTS
            cards below still decide where the speech work happens.
          </p>
        </section>

        <section className="card stack-card">
          <div className="card-heading compact">
            <div>
              <p className="card-kicker">Basics</p>
              <h2>Connection settings</h2>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Server URL</span>
              <input
                value={settings.serverUrl}
                onChange={(event) =>
                  updateSetting(
                    "serverUrl",
                    normalizeServerUrl(event.target.value),
                  )
                }
                placeholder="http://localhost:3001"
              />
            </label>
            <label className="field">
              <span>Channel ID</span>
              <input
                value={settings.channelId}
                onChange={(event) =>
                  updateSetting(
                    "channelId",
                    sanitizeChannelId(event.target.value),
                  )
                }
                placeholder="demo-room"
              />
            </label>
            <label className="field">
              <span>Speech language</span>
              <input
                value={settings.language}
                onChange={(event) =>
                  updateSetting("language", event.target.value)
                }
                placeholder="en-US"
              />
            </label>
          </div>
          <p className="support-copy">
            The studio reconnects automatically after you switch an ASR or TTS
            path here, so you can keep testing without a manual refresh.
          </p>
        </section>

        <section className="card stack-card">
          <div className="card-heading compact">
            <div>
              <p className="card-kicker">OpenClaw bridge</p>
              <h2>Gateway settings</h2>
            </div>
            <span
              className={`status-pill ${settings.conversationBackend === "openclaw-gateway" ? "warn" : "neutral"}`}
            >
              {settings.conversationBackend === "openclaw-gateway"
                ? "Active"
                : "Optional"}
            </span>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Gateway URL</span>
              <input
                value={settings.openClawGatewayUrl}
                onChange={(event) =>
                  updateSetting(
                    "openClawGatewayUrl",
                    normalizeOpenClawGatewayUrl(event.target.value),
                  )
                }
                placeholder="ws://127.0.0.1:18789"
              />
              <small className="field-note">
                The MVP bridge connects here when you select OpenClaw Gateway
                mode.
              </small>
            </label>
            <label className="field">
              <span>Gateway token</span>
              <input
                type="password"
                value={settings.openClawGatewayToken}
                onChange={(event) =>
                  updateSetting("openClawGatewayToken", event.target.value)
                }
                placeholder="openclaw gateway token"
              />
              <small className="field-note">
                Stored in browser local storage for this prototype and sent to
                the VoicyClaw server only when the runtime connects.
              </small>
            </label>
          </div>
          <p className="support-copy">
            For a first local test, run OpenClaw on the same machine and use a
            local Gateway WebSocket plus a manually set Gateway token.
          </p>
        </section>

        <ProviderConfigurator
          title="ASR path"
          kicker="Input pipeline"
          activeProviderId={settings.asrProvider}
          activeProviderLabel={activeAsrProvider.label}
          activeProviderMode={activeAsrProvider.mode}
          activeRuntimeHint={activeAsrProvider.runtimeHint}
          options={ASR_PROVIDER_OPTIONS}
          guides={ASR_PROVIDER_GUIDE}
          onSelect={(providerId) => updateSetting("asrProvider", providerId)}
        />

        <ProviderConfigurator
          title="TTS path"
          kicker="Output pipeline"
          activeProviderId={settings.ttsProvider}
          activeProviderLabel={activeTtsProvider.label}
          activeProviderMode={activeTtsProvider.mode}
          activeRuntimeHint={activeTtsProvider.runtimeHint}
          options={TTS_PROVIDER_OPTIONS}
          guides={TTS_PROVIDER_GUIDE}
          onSelect={(providerId) => updateSetting("ttsProvider", providerId)}
        />

        <section className="card stack-card">
          <div className="card-heading compact">
            <div>
              <p className="card-kicker">Server-provider prep</p>
              <h2>Credential wiring</h2>
            </div>
          </div>
          <p className="support-copy">
            Server-side providers read credentials from server config, not from
            browser storage. The easiest setup is
            <code> config/providers.local.yaml </code>
            in the repo root, with env vars as optional overrides. Azure uses
            <code> AzureSpeechTTS </code>
            or <code> AzureSpeechStreamingTTS </code>. Google uses
            <code> GoogleCloudTTS </code>
            or <code> GoogleCloudBatchedTTS </code>. Tencent uses
            <code> TencentCloudTTS </code>
            and <code> TencentCloudStreamingTTS </code>. Volcengine uses
            <code> DoubaoStreamTTS </code>.
          </p>
          <div className="code-block">
            config/providers.local.yaml
            {"\n"}
            AzureSpeechTTS.api_key
            {"\n"}
            AzureSpeechTTS.region or AzureSpeechTTS.endpoint
            {"\n"}
            GoogleCloudTTS.service_account_file
            {"\n"}
            GoogleCloudTTS.service_account_json
            {"\n"}
            GoogleCloudBatchedTTS.service_account_file
            {"\n"}
            GoogleCloudBatchedTTS.service_account_json
            {"\n"}
            GoogleCloudBatchedTTS.voice
            {"\n"}
            TencentCloudTTS.app_id
            {"\n"}
            TencentCloudTTS.secret_id
            {"\n"}
            TencentCloudTTS.secret_key
            {"\n"}
            TencentCloudStreamingTTS.voice_type
            {"\n"}
            DoubaoStreamTTS.appid
            {"\n"}
            DoubaoStreamTTS.access_token
            {"\n"}
            DoubaoStreamTTS.speaker
          </div>
        </section>

        <aside className="card stack-card">
          <div className="card-heading compact">
            <div>
              <p className="card-kicker">Platform keys</p>
              <h2>Create a bot key</h2>
            </div>
            <button
              className="ghost-button"
              type="button"
              onClick={() => void issueKey()}
            >
              Issue key
            </button>
          </div>
          <p className="support-copy">{keyMessage}</p>
          <div className="code-block">{issuedKey || "No key issued yet."}</div>
          <ul className="note-list compact-list">
            <li>
              The demo bot auto-registers itself when you run the root `pnpm
              dev` script.
            </li>
            <li>
              Use this key flow when you are testing the inbound local-bot path,
              including `/api/keys`, `/api/bot/register`, and the HELLO
              handshake.
            </li>
            <li>
              The backend switch above decides how VoicyClaw reaches the agent,
              while the provider cards make it clear which side owns ASR and
              TTS.
            </li>
          </ul>
        </aside>
      </div>
    </div>
  )
}

type ProviderConfiguratorProps<T extends string> = {
  title: string
  kicker: string
  activeProviderId: T
  activeProviderLabel: string
  activeProviderMode: ProviderMode
  activeRuntimeHint: string
  options: Array<{
    id: T
    mode: ProviderMode
    label: string
    summary: string
    runtimeHint: string
  }>
  guides: ProviderGuide[]
  onSelect: (providerId: T) => void
}

function ProviderConfigurator<T extends string>({
  title,
  kicker,
  activeProviderId,
  activeProviderLabel,
  activeProviderMode,
  activeRuntimeHint,
  options,
  guides,
  onSelect,
}: ProviderConfiguratorProps<T>) {
  return (
    <section className="card stack-card provider-section">
      <div className="card-heading compact">
        <div>
          <p className="card-kicker">{kicker}</p>
          <h2>{title}</h2>
        </div>
        <span className={`status-pill ${toneForMode(activeProviderMode)}`}>
          {getProviderModeLabel(activeProviderMode)}
        </span>
      </div>

      <p className="support-copy">
        Active provider: <strong>{activeProviderLabel}</strong>.{" "}
        {activeRuntimeHint}
      </p>

      <div className="provider-option-grid">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`provider-option ${activeProviderId === option.id ? "active" : ""}`}
            onClick={() => onSelect(option.id)}
          >
            <div className="provider-pill-row">
              <span className={`status-pill ${toneForMode(option.mode)}`}>
                {getProviderModeLabel(option.mode)}
              </span>
              <span className="provider-meta">
                {option.mode === "client" ? "Browser / OS" : "VoicyClaw server"}
              </span>
            </div>
            <strong>{option.label}</strong>
            <p>{option.summary}</p>
          </button>
        ))}
      </div>

      <div className="guide-stack">
        <div className="card-heading compact provider-guide-heading">
          <div>
            <p className="card-kicker">Provider guide</p>
            <h2>What to try next</h2>
          </div>
        </div>
        <div className="guide-card-grid">
          {guides.map((guide) => {
            const tone = guide.status === "next" ? "neutral" : "warn"
            const label = guide.status === "next" ? "Next up" : "Planned"

            return (
              <article key={guide.id} className="guide-card">
                <div className="provider-pill-row">
                  <strong>{guide.label}</strong>
                  <span className={`status-pill ${tone}`}>{label}</span>
                </div>
                <p>{guide.summary}</p>
                <small className="field-note">{guide.keyHint}</small>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function toneForMode(mode: ProviderMode) {
  return mode === "client" ? "live" : "warn"
}
