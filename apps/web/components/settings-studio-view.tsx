"use client"

import {
  type ConversationBackendId,
  getProviderModeLabel,
  type ProviderGuide,
  type ProviderMode,
} from "../lib/studio-provider-catalog"
import { SectionCardHeader } from "./section-card-header"

type BackendOption = {
  id: ConversationBackendId
  label: string
  summary: string
  runtimeHint: string
}

type ProviderOption<T extends string> = {
  id: T
  mode: ProviderMode
  label: string
  summary: string
  runtimeHint: string
}

type SettingsStudioViewProps<AsrId extends string, TtsId extends string> = {
  settings: {
    serverUrl: string
    channelId: string
    language: string
    conversationBackend: ConversationBackendId
    openClawGatewayUrl: string
    openClawGatewayToken: string
  }
  onboarding: {
    workspace: { name: string }
    project: { name: string; channelId: string; botId: string }
    allowance: { note: string }
    connectorPackageName: string
    starterKeyProvisioningError?: string | null
    starterKey?: { value: string } | null
    connectorConfigJson?: string | null
  } | null
  serverStatus: string
  starterProjectStatus: string
  starterBotOnline: boolean | null
  issuedKey: string
  keyMessage: string
  activeBackend: BackendOption
  activeAsrProvider: ProviderOption<AsrId>
  activeTtsProvider: ProviderOption<TtsId>
  backendOptions: BackendOption[]
  asrOptions: ProviderOption<AsrId>[]
  ttsOptions: ProviderOption<TtsId>[]
  asrGuides: ProviderGuide[]
  ttsGuides: ProviderGuide[]
  onIssueKey: () => void
  onUpdateServerUrl: (value: string) => void
  onUpdateChannelId: (value: string) => void
  onUpdateLanguage: (value: string) => void
  onUpdateGatewayUrl: (value: string) => void
  onUpdateGatewayToken: (value: string) => void
  onUpdateConversationBackend: (value: ConversationBackendId) => void
  onUpdateAsrProvider: (value: AsrId) => void
  onUpdateTtsProvider: (value: TtsId) => void
}

export function SettingsStudioView<AsrId extends string, TtsId extends string>({
  settings,
  onboarding,
  serverStatus,
  starterProjectStatus,
  starterBotOnline,
  issuedKey,
  keyMessage,
  activeBackend,
  activeAsrProvider,
  activeTtsProvider,
  backendOptions,
  asrOptions,
  ttsOptions,
  asrGuides,
  ttsGuides,
  onIssueKey,
  onUpdateServerUrl,
  onUpdateChannelId,
  onUpdateLanguage,
  onUpdateGatewayUrl,
  onUpdateGatewayToken,
  onUpdateConversationBackend,
  onUpdateAsrProvider,
  onUpdateTtsProvider,
}: SettingsStudioViewProps<AsrId, TtsId>) {
  return (
    <div className="page-stack">
      <section className="hero-card card">
        <div>
          <p className="hero-eyebrow">Advanced settings</p>
          <h1 className="hero-title">Tune voice and connector settings</h1>
          <p className="hero-copy">
            Adjust provider choices, connector details, and low-level runtime
            behavior. Your main product flow stays in Studio.
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
        {onboarding ? (
          <StarterSetupCard
            onboarding={onboarding}
            starterProjectStatus={starterProjectStatus}
            starterBotOnline={starterBotOnline}
          />
        ) : null}

        <AgentSourceCard
          activeBackend={activeBackend}
          backendOptions={backendOptions}
          activeBackendId={settings.conversationBackend}
          onSelect={onUpdateConversationBackend}
        />

        <ConnectionSettingsCard
          serverUrl={settings.serverUrl}
          channelId={settings.channelId}
          language={settings.language}
          onUpdateServerUrl={onUpdateServerUrl}
          onUpdateChannelId={onUpdateChannelId}
          onUpdateLanguage={onUpdateLanguage}
        />

        <GatewaySettingsCard
          active={settings.conversationBackend === "openclaw-gateway"}
          gatewayUrl={settings.openClawGatewayUrl}
          gatewayToken={settings.openClawGatewayToken}
          onUpdateGatewayUrl={onUpdateGatewayUrl}
          onUpdateGatewayToken={onUpdateGatewayToken}
        />

        <ProviderConfigurator
          groupId="asr"
          title="ASR path"
          kicker="Input pipeline"
          activeProviderId={activeAsrProvider.id}
          activeProviderLabel={activeAsrProvider.label}
          activeProviderMode={activeAsrProvider.mode}
          activeRuntimeHint={activeAsrProvider.runtimeHint}
          options={asrOptions}
          guides={asrGuides}
          onSelect={onUpdateAsrProvider}
        />

        <ProviderConfigurator
          groupId="tts"
          title="TTS path"
          kicker="Output pipeline"
          activeProviderId={activeTtsProvider.id}
          activeProviderLabel={activeTtsProvider.label}
          activeProviderMode={activeTtsProvider.mode}
          activeRuntimeHint={activeTtsProvider.runtimeHint}
          options={ttsOptions}
          guides={ttsGuides}
          onSelect={onUpdateTtsProvider}
        />

        <CredentialWiringCard />

        <PlatformKeysCard
          onboarding={onboarding}
          keyMessage={keyMessage}
          issuedKey={issuedKey}
          onIssueKey={onIssueKey}
        />
      </div>
    </div>
  )
}

function StarterSetupCard({
  onboarding,
  starterProjectStatus,
  starterBotOnline,
}: {
  onboarding: NonNullable<SettingsStudioViewProps<string, string>["onboarding"]>
  starterProjectStatus: string
  starterBotOnline: boolean | null
}) {
  return (
    <section className="card stack-card">
      <SectionCardHeader
        kicker="Starter setup"
        title="Your first voice project is ready"
        aside={
          <span
            className={`status-pill ${
              starterBotOnline === null
                ? "neutral"
                : starterBotOnline
                  ? "live"
                  : "warn"
            }`}
          >
            {starterBotOnline === null
              ? "Checking status"
              : starterBotOnline
                ? "Bot online"
                : "Waiting for bot"}
          </span>
        }
      />
      <p className="support-copy">{starterProjectStatus}</p>
      <div className="stats-grid">
        <div className="stat">
          <span className="stat-label">Workspace</span>
          <strong className="stat-value">{onboarding.workspace.name}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">Voice project</span>
          <strong className="stat-value">{onboarding.project.name}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">Room / Channel</span>
          <strong className="stat-value">{onboarding.project.channelId}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">Bot ID</span>
          <strong className="stat-value">{onboarding.project.botId}</strong>
        </div>
      </div>
      <p className="support-copy">{onboarding.allowance.note}</p>
      <p className="support-copy">
        Preferred connector package:{" "}
        <strong>{onboarding.connectorPackageName}</strong>
      </p>
      {onboarding.starterKeyProvisioningError ? (
        <p className="support-copy">
          Starter key provisioning is still pending:{" "}
          {onboarding.starterKeyProvisioningError}
        </p>
      ) : null}
      <div className="code-block">
        {onboarding.starterKey?.value ??
          "Starter API key is still provisioning."}
      </div>
      <div className="code-block">
        {onboarding.connectorConfigJson ??
          "Connector config becomes available as soon as the starter API key is ready."}
      </div>
    </section>
  )
}

function AgentSourceCard({
  activeBackend,
  backendOptions,
  activeBackendId,
  onSelect,
}: {
  activeBackend: BackendOption
  backendOptions: BackendOption[]
  activeBackendId: ConversationBackendId
  onSelect: (value: ConversationBackendId) => void
}) {
  return (
    <section className="card stack-card">
      <SectionCardHeader
        kicker="Agent source"
        title="How VoicyClaw reaches your agent"
      />
      <p className="support-copy">
        Active path: <strong>{activeBackend.label}</strong>.{" "}
        {activeBackend.runtimeHint}
      </p>
      <div className="provider-option-grid">
        {backendOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`provider-option ${activeBackendId === option.id ? "active" : ""}`}
            onClick={() => onSelect(option.id)}
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
        This switch decides how VoicyClaw finds the agent. The ASR and TTS cards
        below still decide where the speech work happens.
      </p>
    </section>
  )
}

function ConnectionSettingsCard({
  serverUrl,
  channelId,
  language,
  onUpdateServerUrl,
  onUpdateChannelId,
  onUpdateLanguage,
}: {
  serverUrl: string
  channelId: string
  language: string
  onUpdateServerUrl: (value: string) => void
  onUpdateChannelId: (value: string) => void
  onUpdateLanguage: (value: string) => void
}) {
  return (
    <section className="card stack-card">
      <SectionCardHeader kicker="Basics" title="Connection settings" />
      <div className="form-grid">
        <label className="field">
          <span>Server URL</span>
          <input
            value={serverUrl}
            onChange={(event) => onUpdateServerUrl(event.target.value)}
            placeholder="http://localhost:3001"
          />
        </label>
        <label className="field">
          <span>Channel ID</span>
          <input
            value={channelId}
            onChange={(event) => onUpdateChannelId(event.target.value)}
            placeholder="voice-room"
          />
        </label>
        <label className="field">
          <span>Speech language</span>
          <input
            value={language}
            onChange={(event) => onUpdateLanguage(event.target.value)}
            placeholder="en-US"
          />
        </label>
      </div>
      <p className="support-copy">
        The studio reconnects automatically after you switch an ASR or TTS path
        here, so you can keep testing without a manual refresh.
      </p>
    </section>
  )
}

function GatewaySettingsCard({
  active,
  gatewayUrl,
  gatewayToken,
  onUpdateGatewayUrl,
  onUpdateGatewayToken,
}: {
  active: boolean
  gatewayUrl: string
  gatewayToken: string
  onUpdateGatewayUrl: (value: string) => void
  onUpdateGatewayToken: (value: string) => void
}) {
  return (
    <section className="card stack-card">
      <SectionCardHeader
        kicker="OpenClaw bridge"
        title="Gateway settings"
        aside={
          <span className={`status-pill ${active ? "warn" : "neutral"}`}>
            {active ? "Active" : "Optional"}
          </span>
        }
      />
      <div className="form-grid">
        <label className="field">
          <span>Gateway URL</span>
          <input
            value={gatewayUrl}
            onChange={(event) => onUpdateGatewayUrl(event.target.value)}
            placeholder="ws://127.0.0.1:18789"
          />
          <small className="field-note">
            The MVP bridge connects here when you select OpenClaw Gateway mode.
          </small>
        </label>
        <label className="field">
          <span>Gateway token</span>
          <input
            type="password"
            value={gatewayToken}
            onChange={(event) => onUpdateGatewayToken(event.target.value)}
            placeholder="openclaw gateway token"
          />
          <small className="field-note">
            Stored in browser storage for this setup and sent to the VoicyClaw
            server only when the runtime connects.
          </small>
        </label>
      </div>
      <p className="support-copy">
        For a first Gateway test, point this at an OpenClaw Gateway WebSocket
        and set the matching Gateway token.
      </p>
    </section>
  )
}

type ProviderConfiguratorProps<T extends string> = {
  groupId: string
  title: string
  kicker: string
  activeProviderId: T
  activeProviderLabel: string
  activeProviderMode: ProviderMode
  activeRuntimeHint: string
  options: ProviderOption<T>[]
  guides: ProviderGuide[]
  onSelect: (providerId: T) => void
}

function ProviderConfigurator<T extends string>({
  groupId,
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
      <SectionCardHeader
        kicker={kicker}
        title={title}
        aside={
          <span className={`status-pill ${toneForMode(activeProviderMode)}`}>
            {getProviderModeLabel(activeProviderMode)}
          </span>
        }
      />

      <p className="support-copy">
        Active provider: <strong>{activeProviderLabel}</strong>.{" "}
        {activeRuntimeHint}
      </p>

      <div className="provider-option-grid">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            data-testid={`${groupId}-provider-${option.id}`}
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
        <SectionCardHeader
          kicker="Provider guide"
          title="What to try next"
          className="provider-guide-heading"
        />
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

function CredentialWiringCard() {
  return (
    <section className="card stack-card">
      <SectionCardHeader
        kicker="Server-provider prep"
        title="Credential wiring"
      />
      <p className="support-copy">
        Server-side providers read credentials from server config, not from
        browser storage. YAML config or env vars both work. Azure uses
        <code> AzureSpeechTTS </code>
        or <code> AzureSpeechStreamingTTS </code>. Google uses
        <code> GoogleCloudTTS </code>
        or <code> GoogleCloudBatchedTTS </code>. Tencent uses
        <code> TencentCloudTTS </code>
        and <code> TencentCloudStreamingTTS </code>. Volcengine uses
        <code> DoubaoStreamTTS </code>.
      </p>
      <div className="code-block">
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
  )
}

function PlatformKeysCard({
  onboarding,
  keyMessage,
  issuedKey,
  onIssueKey,
}: {
  onboarding: SettingsStudioViewProps<string, string>["onboarding"]
  keyMessage: string
  issuedKey: string
  onIssueKey: () => void
}) {
  return (
    <aside className="card stack-card">
      <SectionCardHeader
        kicker={onboarding ? "Extra platform keys" : "Platform keys"}
        title={onboarding ? "Issue another bot key" : "Create a bot key"}
        aside={
          <button className="ghost-button" type="button" onClick={onIssueKey}>
            {onboarding ? "Issue another key" : "Issue key"}
          </button>
        }
      />
      <p className="support-copy">{keyMessage}</p>
      <div className="code-block">{issuedKey || "No key issued yet."}</div>
      <ul className="note-list compact-list">
        <li>
          Use this flow when you want an extra bot key for another OpenClaw
          install or device.
        </li>
        <li>
          The issued token is for the VoicyClaw inbound bot path, including
          `/api/keys` and the token-only HELLO handshake.
        </li>
        <li>
          The backend switch above decides how VoicyClaw reaches the agent,
          while the provider cards make it clear which side owns ASR and TTS.
        </li>
      </ul>
    </aside>
  )
}

function toneForMode(mode: ProviderMode) {
  return mode === "client" ? "live" : "warn"
}
