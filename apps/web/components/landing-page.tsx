"use client"

import {
  Bot,
  Globe,
  Layers,
  Mic,
  Radio,
  Sparkles,
} from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useRef, useState } from "react"

import {
  LandingHeroAuthControls,
  LandingNavbarAuthControls,
} from "./auth-controls"
import {
  DEFAULT_PROMPTS,
  HOSTED_PROMPTS,
  STUDIO_STEPS,
  VOICE_PATH_META,
} from "./product-studio"
import {
  ConnectAgentCard,
  ConversationCard,
  RoomConnectionCard,
  StudioStepCard,
  StudioSupportCard,
  type StepStatus,
  type VoicePathCardOption,
  VoicePathSelectorCard,
} from "./product-studio-view"
import { SiteHeader } from "./site-header"
import { VoicyClawBrandIcon } from "./voicyclaw-brand-icon"
import {
  getOrCreateTrialSubject,
  hasUsableTrialStarterKey,
  parseTrialBootstrapRecord,
  readCachedTrialBootstrap,
  writeCachedTrialBootstrap,
} from "../lib/trial-bootstrap-cache"
import { TTS_PROVIDER_OPTIONS, type TtsProviderId } from "../lib/studio-provider-catalog"
import type { ConnectionState } from "../lib/voice-studio-session-helpers"
import {
  buildHostedOnboardingState,
  buildConnectorConfigJson,
  type HostedOnboardingRecord,
  STARTER_CONNECTOR_PACKAGE,
} from "../lib/hosted-onboarding-shared"
import { useVoiceStudioSession } from "../lib/use-voice-studio-session"
import { buildWebRuntimePayload } from "../lib/web-runtime"

const waveformBars = Array.from({ length: 60 }, (_, index) => ({
  key: index,
  peakHeight: 40 + ((index * 37) % 120),
  duration: 1.2 + ((index * 17) % 18) / 10,
  delay: (index % 8) * 0.08,
}))
const listeningBars = ["bar-1", "bar-2", "bar-3", "bar-4", "bar-5"] as const
const productHuntBadge = {
  href: "https://www.producthunt.com/products/voicyclaw?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-voicyclaw",
  image:
    "https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1118669&theme=light&t=1775703142013",
}

const featureCards = [
  {
    icon: Radio,
    title: "Live voice studio",
    description: "Open one page to talk, listen, and watch replies stream in.",
  },
  {
    icon: Layers,
    title: "More than one voice",
    description:
      "Switch between Google, Azure, Tencent Cloud, Volcengine, or browser voices.",
  },
  {
    icon: Globe,
    title: "Built for OpenClaw",
    description: "OpenClaw runs the agent. VoicyClaw handles the voice.",
  },
  {
    icon: Bot,
    title: "Starter setup",
    description:
      "Copy one install command, paste the starter config, and bring your bot online.",
  },
]

const footerGroups = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Open Studio", href: "/studio" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "GitHub", href: "https://github.com/Lyshen/VoicyClaw" },
      {
        label: "README",
        href: "https://github.com/Lyshen/VoicyClaw/blob/main/README.md",
      },
      { label: "Studio", href: "/studio" },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "Landing Page", href: "/" },
      { label: "Voice Studio", href: "/studio" },
      { label: "Credits", href: "/credits" },
    ],
  },
]

type TryCard = {
  id: number
  step: string
  title: string
  description: string
}

const tryCards: TryCard[] = [
  {
    id: 1,
    step: STUDIO_STEPS[0].step,
    title: STUDIO_STEPS[0].title,
    description: STUDIO_STEPS[0].description,
  },
  {
    id: 2,
    step: STUDIO_STEPS[1].step,
    title: STUDIO_STEPS[1].title,
    description: STUDIO_STEPS[1].description,
  },
  {
    id: 3,
    step: STUDIO_STEPS[2].step,
    title: STUDIO_STEPS[2].title,
    description: STUDIO_STEPS[2].description,
  },
]

const TRY_VOICE_PROVIDER_OPTIONS = TTS_PROVIDER_OPTIONS.filter(
  (option) => option.id !== "browser" && option.id !== "demo",
)
const DEFAULT_TRY_VOICE_PROVIDER_ID: TtsProviderId =
  TRY_VOICE_PROVIDER_OPTIONS[0]?.id ?? "azure-tts"

export function LandingPage({
  authEnabled,
  serverUrl,
}: {
  authEnabled: boolean
  serverUrl: string
}) {
  return (
    <div className="min-h-screen bg-white text-zinc-900 [color-scheme:light] selection:bg-amber-200">
      <Navbar authEnabled={authEnabled} />
      <main>
        <Hero authEnabled={authEnabled} />
        <HowItWorks />
        <Features />
        <TryNowSection serverUrl={serverUrl} />
      </main>
      <Footer />
    </div>
  )
}

function Navbar({ authEnabled }: { authEnabled: boolean }) {
  return (
    <SiteHeader
      mode="fixed"
      navigation={[
        { href: "#features", label: "Features" },
        { href: "#how-it-works", label: "How it works" },
        {
          href: "https://github.com/Lyshen/VoicyClaw",
          label: "GitHub",
          external: true,
        },
      ]}
      actions={<LandingNavbarAuthControls authEnabled={authEnabled} />}
    />
  )
}

function Hero({ authEnabled }: { authEnabled: boolean }) {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-amber-50 via-white to-white pb-20 pt-32 lg:pb-40 lg:pt-48">
      <div className="relative z-10 mx-auto max-w-7xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-100 px-4 py-1.5 text-sm font-medium text-amber-700"
        >
          <Sparkles className="h-4 w-4" />
          Voice for OpenClaw
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mb-8 max-w-6xl text-5xl leading-[1.1] font-bold tracking-tight text-zinc-900 lg:text-8xl"
        >
          Give OpenClaw a voice.
          <br />
          <span className="bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
            Speak in. Hear it answer.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto mb-12 max-w-3xl text-xl leading-relaxed text-zinc-500 lg:text-2xl"
        >
          Speak to your OpenClaw agent. Hear the reply right away.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col items-center justify-center gap-5 sm:flex-row"
        >
          <LandingHeroAuthControls authEnabled={authEnabled} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-10 flex flex-col items-center gap-3"
        >
          <p className="text-xs font-semibold tracking-[0.24em] text-zinc-400 uppercase">
            Featured on Product Hunt
          </p>
          <a
            href={productHuntBadge.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex overflow-hidden rounded-2xl shadow-sm transition-transform hover:-translate-y-0.5"
          >
            <img
              alt="VoicyClaw - specific voice of private agent | Product Hunt"
              width={250}
              height={54}
              src={productHuntBadge.image}
              className="h-[54px] w-[250px] max-w-full"
            />
          </a>
        </motion.div>
      </div>

      <Waveform />
    </section>
  )
}

function Waveform() {
  return (
    <div className="pointer-events-none absolute bottom-0 left-1/2 flex -translate-x-1/2 items-end gap-1.5 opacity-30">
      {waveformBars.map((bar) => (
        <motion.div
          key={bar.key}
          className="w-2 rounded-t-full bg-amber-400"
          animate={{
            height: [40, bar.peakHeight, 40],
          }}
          transition={{
            duration: bar.duration,
            delay: bar.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  )
}

function Features() {
  return (
    <section id="features" className="bg-white py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-20 flex flex-col items-end justify-between gap-8 lg:flex-row">
          <div className="max-w-2xl">
            <h2 className="mb-6 text-4xl font-bold tracking-tight lg:text-5xl">
              Everything you need to{" "}
              <span className="text-amber-500">hear your agent work</span>.
            </h2>
            <p className="text-xl text-zinc-500">
              Mic in, agent runs, voice out. The whole loop stays in one place.
            </p>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {featureCards.map((feature, index) => {
            const Icon = feature.icon

            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group rounded-[2.5rem] border border-zinc-100 bg-zinc-50 p-10 transition-all hover:border-amber-200 hover:bg-amber-50/30"
              >
                <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm transition-transform group-hover:scale-110">
                  <Icon className="h-6 w-6 text-amber-500" />
                </div>
                <h3 className="mb-4 text-2xl font-bold">{feature.title}</h3>
                <p className="text-lg leading-relaxed text-zinc-500">
                  {feature.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    {
      step: "01",
      title: "Connect your agent",
      description:
        "Connect your starter bot or point VoicyClaw at your OpenClaw setup.",
    },
    {
      step: "02",
      title: "Choose a voice path",
      description: "Pick the provider and voice path you want to test.",
    },
    {
      step: "03",
      title: "Start talking",
      description: "Speak naturally and hear the reply back.",
    },
  ]

  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden bg-zinc-900 py-32 text-white"
    >
      <div className="absolute top-0 right-0 h-full w-1/2 translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/10 blur-[120px]" />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-20 px-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-10 text-4xl leading-tight font-bold lg:text-6xl">
            Three steps to make
            <br />
            your agent speak.
          </h2>

          <div className="space-y-12">
            {steps.map((item) => (
              <div key={item.step} className="flex gap-8">
                <div className="font-mono text-4xl font-bold text-amber-500 opacity-50">
                  {item.step}
                </div>
                <div>
                  <h4 className="mb-3 text-2xl font-bold">{item.title}</h4>
                  <p className="text-lg leading-relaxed text-zinc-400">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="rounded-[3rem] border border-white/10 bg-zinc-800 p-4 shadow-2xl">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2.2rem] bg-zinc-950">
              <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-amber-500 shadow-2xl shadow-amber-500/50">
                  <Mic className="h-10 w-10 text-white" />
                </div>
                <h3 className="mb-4 text-2xl font-bold">Listening...</h3>
                <div className="flex h-8 items-center gap-1">
                  {listeningBars.map((barId, index) => (
                    <motion.div
                      key={barId}
                      className="w-1.5 rounded-full bg-amber-500"
                      animate={{ height: [10, 30, 10] }}
                      transition={{
                        duration: 0.5,
                        delay: index * 0.1,
                        repeat: Infinity,
                      }}
                    />
                  ))}
                </div>
                <p className="mt-12 italic text-zinc-400">
                  “How can I help you today?”
                </p>
              </div>

              <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
                <div className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md" />
                <div className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold backdrop-blur-md">
                  LIVE
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function TryNowSection({ serverUrl }: { serverUrl: string }) {
  const [selectedStep, setSelectedStep] = useState(1)
  const [selectedVoicePath, setSelectedVoicePath] =
    useState<TtsProviderId>(DEFAULT_TRY_VOICE_PROVIDER_ID)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [trialToken, setTrialToken] = useState<string | null>(null)
  const [trialRecord, setTrialRecord] = useState<HostedOnboardingRecord | null>(null)
  const [botStatus, setBotStatus] = useState<"idle" | "checking" | "online" | "offline" | "error">("idle")
  const starterBotOnline = botStatus === "online"
  const connectionState: ConnectionState =
    botStatus === "checking"
      ? "connecting"
      : botStatus === "online"
        ? "connected"
        : botStatus === "error"
          ? "error"
          : "disconnected"
  const statusPanelValue =
    botStatus === "online"
      ? "Bot is online"
      : botStatus === "checking"
        ? "Checking connection"
        : botStatus === "error"
          ? "Status unavailable"
          : "Waiting for bot"
  const voicePathOptions: VoicePathCardOption[] = TRY_VOICE_PROVIDER_OPTIONS.map((option) => {
    const meta = VOICE_PATH_META[option.id]

    return {
      id: option.id,
      eyebrow: meta.eyebrow,
      title: meta.title,
      description: meta.description,
      routeLabel: meta.routeLabel,
      keywords: meta.keywords,
      accentClassName: meta.accentClassName,
      bars: meta.bars,
      selected: selectedVoicePath === option.id,
      onSelect: () => setSelectedVoicePath(option.id),
    }
  })

  async function refreshBotStatus(record: HostedOnboardingRecord) {
    setTrialRecord(record)
    setBotStatus("checking")

    try {
      const response = await fetch(
        new URL(`/api/channels/${encodeURIComponent(record.project.channelId)}`, serverUrl),
      )

      if (!response.ok) {
        throw new Error(`channel ${response.status}`)
      }

      const payload = (await response.json()) as {
        botCount: number
      }

      setBotStatus(payload.botCount > 0 ? "online" : "offline")
    } catch {
      setBotStatus("error")
    }
  }

  async function refreshTrialPreview(forceRefresh = false) {
    const trialSubject = getOrCreateTrialSubject()

    if (!trialSubject) {
      setTrialToken(null)
      setTrialRecord(null)
      setBotStatus("error")
      return null
    }

    const cachedRecord = forceRefresh ? null : readCachedTrialBootstrap(trialSubject)

    if (cachedRecord && hasUsableTrialStarterKey(cachedRecord)) {
      setTrialToken(cachedRecord.starterKey?.value ?? null)
      await refreshBotStatus(cachedRecord)
      return cachedRecord
    }

    try {
      const response = await fetch(new URL("/api/try/bootstrap", serverUrl), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          trialSubject,
          displayName: "Try now guest",
        }),
      })

      if (!response.ok) {
        return null
      }

      const payload = (await response.json()) as HostedOnboardingRecord
      const record = parseTrialBootstrapRecord(payload)

      if (!record || !hasUsableTrialStarterKey(record)) {
        return null
      }

      writeCachedTrialBootstrap(trialSubject, record)
      setTrialToken(record.starterKey?.value ?? null)
      await refreshBotStatus(record)
      return record
    } catch {
      setBotStatus("error")
      return null
    }
  }

  useEffect(() => {
    function handleFocus() {
      void refreshTrialPreview()
    }

    void refreshTrialPreview()
    window.addEventListener("focus", handleFocus)

    return () => {
      window.removeEventListener("focus", handleFocus)
    }
  }, [])

  const installLines = [
    {
      id: "install",
      prefix: "$",
      code: `openclaw plugins install ${STARTER_CONNECTOR_PACKAGE}`,
    },
    {
      id: "config",
      prefix: "cfg",
      code: buildConnectorConfigJson({
        apiKey: trialToken ?? "try_••••••••••••",
        serverUrl,
      }),
    },
    {
      id: "restart",
      prefix: "$",
      code: "openclaw gateway restart",
    },
  ]

  function getCardStatus(cardId: number): StepStatus {
    if (cardId === selectedStep) {
      return "active"
    }

    if (cardId < selectedStep) {
      return "done"
    }

    return "pending"
  }

  async function copyPreviewText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current))
      }, 1400)
    } catch {
      setCopiedId(null)
    }
  }

  function refreshTryNowSection() {
    void refreshTrialPreview(true)
  }

  return (
    <section
      id="try-now"
      className="bg-[linear-gradient(180deg,rgba(255,247,237,0.92),rgba(255,251,245,0.98))] py-32"
    >
      <div className="mx-auto max-w-7xl px-6">
        <section className="relative overflow-hidden rounded-[2.75rem] border border-amber-200/80 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.14),transparent_24%),linear-gradient(180deg,rgba(255,252,248,0.98),rgba(255,245,230,0.98))] px-6 py-8 text-zinc-900 shadow-[0_40px_120px_rgba(24,24,27,0.12)] lg:px-8 lg:py-10">
          <div className="relative z-10 grid gap-8 xl:grid-cols-[0.74fr_1.26fr]">
            <div className="space-y-8">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-100/70 px-4 py-1.5 text-sm font-medium text-amber-700">
                  <Sparkles className="h-4 w-4" />
                  Try now without login
                </div>

                <div className="max-w-2xl">
                  <h2 className="text-3xl leading-tight font-semibold tracking-tight text-zinc-900 lg:text-4xl">
                    Three steps to make your agent speak.
                  </h2>
                </div>
              </div>

              <div className="space-y-4">
                {tryCards.map((card) => (
                  <StudioStepCard
                    key={card.step}
                    step={card.step}
                    title={card.title}
                    description={card.description}
                    status={getCardStatus(card.id)}
                    selected={selectedStep === card.id}
                    onSelect={() => setSelectedStep(card.id)}
                  />
                ))}

                <StudioSupportCard
                  step="04"
                  title="Give us support"
                  action={
                    <a
                      href={productHuntBadge.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex overflow-hidden rounded-2xl shadow-sm transition-transform hover:-translate-y-0.5"
                    >
                      <img
                        alt="VoicyClaw - specific voice of private agent | Product Hunt"
                        width={250}
                        height={54}
                        src={productHuntBadge.image}
                        className="h-[54px] w-[250px] max-w-full"
                      />
                    </a>
                  }
                />
              </div>
            </div>

            <div className="flex xl:pl-2">
              {selectedStep === 1 ? (
                <ConnectAgentCard
                  title={STUDIO_STEPS[0].title}
                  lines={installLines}
                  copiedId={copiedId}
                  onCopy={(id, text) => void copyPreviewText(id, text)}
                  connectionTargetLabel="VoicyClaw Inbound Bot"
                  workspaceName="Starter workspace"
                  channelId={trialRecord?.project.channelId ?? "sayhello-demo"}
                  botId={trialRecord?.project.botId ?? "openclaw-demo"}
                  starterBotOnline={starterBotOnline}
                  connectionState={connectionState}
                  botDisplayName={trialRecord?.project.displayName ?? "SayHello Connector"}
                  onCheck={refreshTryNowSection}
                  onContinue={() => setSelectedStep(2)}
                  statusPanel={{
                    label: "Bot status",
                    value: statusPanelValue,
                    tone: starterBotOnline ? "success" : "warning",
                  }}
                  hideSetupStats
                  hideFooter
                />
              ) : selectedStep === 2 ? (
                <VoicePathSelectorCard
                  title={STUDIO_STEPS[1].title}
                  connectionReady={true}
                  selectedLabel={
                    TRY_VOICE_PROVIDER_OPTIONS.find((option) => option.id === selectedVoicePath)
                      ?.label ?? "Azure Speech TTS (Unary)"
                  }
                  options={voicePathOptions}
                  onContinue={() => setSelectedStep(3)}
                />
              ) : (
                <TryNowConversationPanel
                  record={trialRecord}
                  serverUrl={serverUrl}
                  selectedVoicePath={selectedVoicePath}
                  onBackToSetup={() => setSelectedStep(1)}
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}

function TryNowConversationPanel({
  record,
  serverUrl,
  selectedVoicePath,
  onBackToSetup,
}: {
  record: HostedOnboardingRecord | null
  serverUrl: string
  selectedVoicePath: TtsProviderId
  onBackToSetup: () => void
}) {
  const runtime = record
    ? buildWebRuntimePayload({
        serverUrl,
        onboarding: buildHostedOnboardingState(record, serverUrl),
      })
    : null

  if (!runtime || !record) {
    return (
      <RoomConnectionCard
        mode="talk"
        starterBotOnline={false}
        connectionState="disconnected"
        botDisplayName="Waiting for bot"
        onCheck={onBackToSetup}
        onContinue={() => undefined}
      />
    )
  }

  return (
    <TryNowLiveConversation
      runtime={runtime}
      selectedVoicePath={selectedVoicePath}
      onBackToSetup={onBackToSetup}
    />
  )
}

function TryNowLiveConversation({
  runtime,
  selectedVoicePath,
  onBackToSetup,
}: {
  runtime: ReturnType<typeof buildWebRuntimePayload>
  selectedVoicePath: TtsProviderId
  onBackToSetup: () => void
}) {
  const {
    settings,
    updateSetting,
    connectionState,
    timeline,
    draftText,
    setDraftText,
    isRecording,
    isBotThinking,
    isBotSpeaking,
    timelineRef,
    botDisplayName,
    starterBotOnline,
    beginCapture,
    finishCapture,
    sendTextUtterance,
  } = useVoiceStudioSession({
    initialRuntime: runtime,
    includeConnectionSummary: false,
  })

  useEffect(() => {
    if (settings.ttsProvider !== selectedVoicePath) {
      updateSetting("ttsProvider", selectedVoicePath)
    }

    if (settings.conversationBackend !== "local-bot") {
      updateSetting("conversationBackend", "local-bot")
    }
  }, [selectedVoicePath, settings.conversationBackend, settings.ttsProvider, updateSetting])

  if (!starterBotOnline) {
    return (
      <RoomConnectionCard
        mode="talk"
        starterBotOnline={starterBotOnline}
        connectionState={connectionState}
        botDisplayName={botDisplayName}
        onCheck={onBackToSetup}
        onContinue={() => undefined}
      />
    )
  }

  return (
    <ConversationCard
      draftText={draftText}
      setDraftText={setDraftText}
      isRecording={isRecording}
      isBotThinking={isBotThinking}
      isBotSpeaking={isBotSpeaking}
      timelineRef={timelineRef}
      entries={timeline
        .filter(
          (entry): entry is typeof entry & { role: "user" | "bot" | "preview" } =>
            entry.role !== "system",
        )
        .filter((entry) => !(entry.role === "preview" && entry.text.trim().length === 0))
        .map((entry) => ({
          id: entry.id,
          role: entry.role,
          label:
            entry.role === "user"
              ? "You"
              : entry.role === "preview"
                ? `${botDisplayName} is speaking`
                : botDisplayName,
          text: entry.text,
        }))}
      quickPrompts={HOSTED_PROMPTS.length > 0 ? HOSTED_PROMPTS : DEFAULT_PROMPTS}
      beginCapture={beginCapture}
      finishCapture={finishCapture}
      sendTextUtterance={sendTextUtterance}
      botDisplayName={botDisplayName}
      submitOnEnter
      hideSendButton
      emphasizeHoldToTalk
      showEntryLabels={false}
    />
  )
}

function Footer() {
  return (
    <footer className="border-t border-zinc-100 bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 flex flex-col items-start justify-between gap-12 md:flex-row">
          <div className="max-w-xs">
            <div className="mb-6 flex items-center gap-2 text-2xl font-bold">
              <VoicyClawBrandIcon
                alt="VoicyClaw"
                className="h-8 w-8 rounded-lg"
              />
              VoicyClaw
            </div>
            <p className="leading-relaxed text-zinc-500">
              VoicyClaw is the voice layer for OpenClaw. It turns agent replies
              into something you can actually hear.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-12 sm:grid-cols-3">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <h4 className="mb-6 font-bold">{group.title}</h4>
                <ul className="space-y-4 text-sm text-zinc-500">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="transition-colors hover:text-amber-600"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-6 border-t border-zinc-100 pt-12 text-sm text-zinc-400 sm:flex-row">
          <p>© 2026 VoicyClaw. All rights reserved.</p>
          <div className="flex items-center gap-8">
            <a
              href="https://github.com/Lyshen/VoicyClaw/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-zinc-900"
            >
              License
            </a>
            <a
              href="https://github.com/Lyshen/VoicyClaw"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 transition-colors hover:text-zinc-900"
            >
              <Globe className="h-5 w-5" />
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
