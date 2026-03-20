"use client"

import { useEffect, useState } from "react"

import { buildApiUrl, normalizeServerUrl, sanitizeChannelId } from "../lib/prototype-settings"
import { usePrototypeSettings } from "../lib/use-prototype-settings"

export function SettingsStudio() {
  const { settings, ready, updateSetting } = usePrototypeSettings()
  const [serverStatus, setServerStatus] = useState("Checking server...")
  const [issuedKey, setIssuedKey] = useState("")
  const [keyMessage, setKeyMessage] = useState("Issue a platform key here to test external ClawBots.")

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
        `Connected to ${normalizeServerUrl(settings.serverUrl)} · protocol ${payload.protocolVersion} · ${payload.connectedBots} bot / ${payload.connectedClients} client`
      )
    } catch {
      setServerStatus("Server is unreachable right now. Start `pnpm dev` or confirm the server URL.")
    }
  }

  async function issueKey() {
    setKeyMessage("Issuing a fresh platform key...")

    try {
      const response = await fetch(buildApiUrl(settings, "/api/keys"), {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          channelId: settings.channelId,
          label: "Settings console"
        })
      })

      if (!response.ok) {
        throw new Error(`keys ${response.status}`)
      }

      const payload = (await response.json()) as {
        apiKey: string
        wsUrl: string
      }

      setIssuedKey(payload.apiKey)
      setKeyMessage(`Key ready. Connect a bot to ${payload.wsUrl} using the OpenClaw HELLO handshake.`)
    } catch {
      setKeyMessage("Could not create a platform key. Make sure the server is running and try again.")
    }
  }

  return (
    <div className="page-stack">
      <section className="hero-card card">
        <div>
          <p className="hero-eyebrow">Prototype settings</p>
          <h1 className="hero-title">Control the local demo surface</h1>
          <p className="hero-copy">
            These values stay in local storage. The current prototype keeps vendor keys on the
            client and defaults to demo adapters so the repo runs without secrets.
          </p>
        </div>
        <div className="status-row">
          <span className="status-pill neutral">{serverStatus}</span>
        </div>
      </section>

      <div className="settings-grid">
        <section className="card">
          <div className="card-heading compact">
            <div>
              <p className="card-kicker">Channel setup</p>
              <h2>Connection defaults</h2>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Server URL</span>
              <input
                value={settings.serverUrl}
                onChange={(event) => updateSetting("serverUrl", normalizeServerUrl(event.target.value))}
                placeholder="http://localhost:3001"
              />
            </label>
            <label className="field">
              <span>Channel ID</span>
              <input
                value={settings.channelId}
                onChange={(event) => updateSetting("channelId", sanitizeChannelId(event.target.value))}
                placeholder="demo-room"
              />
            </label>
            <label className="field">
              <span>Speech language</span>
              <input
                value={settings.language}
                onChange={(event) => updateSetting("language", event.target.value)}
                placeholder="en-US"
              />
            </label>
            <label className="field checkbox-row">
              <input
                type="checkbox"
                checked={settings.browserSpeechEnabled}
                onChange={(event) => updateSetting("browserSpeechEnabled", event.target.checked)}
              />
              <span>Use browser speech recognition when the browser supports it</span>
            </label>
            <label className="field checkbox-row">
              <input
                type="checkbox"
                checked={settings.browserVoiceEnabled}
                onChange={(event) => updateSetting("browserVoiceEnabled", event.target.checked)}
              />
              <span>Read final bot text aloud with the browser speech engine</span>
            </label>
          </div>
        </section>

        <section className="card">
          <div className="card-heading compact">
            <div>
              <p className="card-kicker">Vendor placeholders</p>
              <h2>Bring-your-own keys</h2>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>OpenAI ASR key</span>
              <input
                type="password"
                value={settings.openAiAsrKey}
                onChange={(event) => updateSetting("openAiAsrKey", event.target.value)}
                placeholder="sk-..."
              />
            </label>
            <label className="field">
              <span>OpenAI TTS key</span>
              <input
                type="password"
                value={settings.openAiTtsKey}
                onChange={(event) => updateSetting("openAiTtsKey", event.target.value)}
                placeholder="sk-..."
              />
            </label>
          </div>
          <p className="support-copy">
            The current prototype still runs with demo adapters, but the UI is already shaped around
            the README requirement that users bring their own ASR and TTS credentials.
          </p>
        </section>

        <aside className="card">
          <div className="card-heading compact">
            <div>
              <p className="card-kicker">Platform keys</p>
              <h2>Bot onboarding</h2>
            </div>
            <button className="ghost-button" onClick={() => void issueKey()}>
              Issue key
            </button>
          </div>
          <p className="support-copy">{keyMessage}</p>
          <div className="code-block">{issuedKey || "No key issued yet."}</div>
          <ul className="note-list compact-list">
            <li>The demo bot auto-registers itself when you run the root `pnpm dev` script.</li>
            <li>Use this key flow to verify `/api/keys` and `/api/bot/register` against another bot.</li>
            <li>The websocket handshake still follows the OpenClaw `HELLO → WELCOME` contract.</li>
          </ul>
        </aside>
      </div>
    </div>
  )
}
