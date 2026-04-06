"use client"

import {
  Globe,
  Layers,
  MessageSquare,
  Mic,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react"
import { motion } from "motion/react"

import {
  LandingCallToActionControls,
  LandingHeroAuthControls,
  LandingNavbarAuthControls,
} from "./auth-controls"
import { SiteHeader } from "./site-header"
import { VoicyClawBrandIcon } from "./voicyclaw-brand-icon"

const waveformBars = Array.from({ length: 60 }, (_, index) => ({
  key: index,
  peakHeight: 40 + ((index * 37) % 120),
  duration: 1.2 + ((index * 17) % 18) / 10,
  delay: (index % 8) * 0.08,
}))
const listeningBars = ["bar-1", "bar-2", "bar-3", "bar-4", "bar-5"] as const

const valueProps = [
  {
    icon: MessageSquare,
    title: "Talk, don't type",
    description: "Speak to your agent and hear it answer back.",
  },
  {
    icon: Zap,
    title: "Real-time replies",
    description: "Replies can start playing before the full answer is done.",
  },
  {
    icon: ShieldCheck,
    title: "Your own keys",
    description: "Use your own provider keys and stay in control of the setup.",
  },
]

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
    icon: Settings,
    title: "Quick setup",
    description: "Pick a provider, paste your keys, and start.",
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
      { label: "Settings", href: "/settings" },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "Landing Page", href: "/" },
      { label: "Voice Studio", href: "/studio" },
      { label: "Provider Config", href: "/settings" },
    ],
  },
]

export function LandingPage({ authEnabled }: { authEnabled: boolean }) {
  return (
    <div className="min-h-screen bg-white text-zinc-900 [color-scheme:light] selection:bg-amber-200">
      <Navbar authEnabled={authEnabled} />
      <main>
        <Hero authEnabled={authEnabled} />
        <ValueProps />
        <Features />
        <HowItWorks />
        <CallToAction authEnabled={authEnabled} />
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

function ValueProps() {
  return (
    <section className="bg-zinc-50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 md:grid-cols-3">
          {valueProps.map((item, index) => {
            const Icon = item.icon

            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100">
                  <Icon className="h-6 w-6 text-amber-600" />
                </div>
                <h3 className="mb-3 text-xl font-bold">{item.title}</h3>
                <p className="leading-relaxed text-zinc-500">
                  {item.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
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
          <div className="hidden lg:block">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-100 px-6 py-3 font-semibold text-zinc-900">
              Live Demo
            </div>
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

function CallToAction({ authEnabled }: { authEnabled: boolean }) {
  return (
    <section id="get-started" className="bg-white py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="relative overflow-hidden rounded-[3rem] bg-amber-500 p-12 text-center text-white shadow-2xl shadow-amber-500/40 lg:p-20">
          <div className="absolute inset-0 h-full w-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />

          <div className="relative z-10">
            <h2 className="mb-8 text-4xl font-bold lg:text-6xl">
              Try the live studio now.
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-xl text-amber-50 opacity-90 lg:text-2xl">
              Your live room is already waiting. Open the studio first, then
              fine-tune the voice path in Settings.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <LandingCallToActionControls authEnabled={authEnabled} />
            </div>

            <p className="mt-10 font-medium text-amber-100 opacity-80">
              Same live flow. Cleaner front door.
            </p>
          </div>
        </div>
      </div>
    </section>
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
