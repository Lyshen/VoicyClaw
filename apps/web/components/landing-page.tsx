"use client"

import {
  ArrowRight,
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
import Link from "next/link"

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
    title: "Natural conversations",
    description:
      "Speak naturally and hear responses instantly. It feels like talking to a real assistant, not filling in a form.",
  },
  {
    icon: Zap,
    title: "Streaming by default",
    description:
      "VoicyClaw is built for real-time voice. Replies can start playing while your agent is still thinking.",
  },
  {
    icon: ShieldCheck,
    title: "Your keys, your control",
    description:
      "Use your own provider keys for Google, Azure, Tencent Cloud, Volcengine, and more without handing them to a hosted black box.",
  },
]

const featureCards = [
  {
    icon: Radio,
    title: "Real-time listening",
    description:
      "Handle live spoken turns, interruptions, and quick back-and-forth exchanges without leaving the browser.",
  },
  {
    icon: Layers,
    title: "Multiple TTS providers",
    description:
      "Switch between premium bidirectional streaming and lower-cost single-request voices depending on your use case.",
  },
  {
    icon: Globe,
    title: "Ready for real channels",
    description:
      "Start in the web studio today, then connect VoicyClaw to the channels where your OpenClaw agents already work.",
  },
  {
    icon: Settings,
    title: "Simple setup",
    description:
      "Bring your existing OpenClaw agent, choose a provider, paste your keys, and start testing voice in minutes.",
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

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 [color-scheme:light] selection:bg-amber-200">
      <Navbar />
      <main>
        <Hero />
        <ValueProps />
        <Features />
        <HowItWorks />
        <CallToAction />
      </main>
      <Footer />
    </div>
  )
}

function Navbar() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 shadow-lg shadow-amber-500/20">
            <Mic className="h-6 w-6 text-white" />
          </div>
          VoicyClaw
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-sm font-medium text-zinc-500 transition-colors hover:text-amber-600"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-sm font-medium text-zinc-500 transition-colors hover:text-amber-600"
          >
            How it works
          </a>
          <a
            href="https://github.com/Lyshen/VoicyClaw"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-zinc-500 transition-colors hover:text-amber-600"
          >
            GitHub
          </a>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/studio"
            className="rounded-2xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-zinc-800 active:scale-95"
          >
            Try for free
          </Link>
        </div>
      </div>
    </nav>
  )
}

function Hero() {
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
          Open-source voice for OpenClaw agents
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mb-8 max-w-5xl text-5xl leading-[1.1] font-bold tracking-tight text-zinc-900 lg:text-8xl"
        >
          Give OpenClaw agents a voice.
          <br />
          <span className="bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
            Talk like a real person.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto mb-12 max-w-3xl text-xl leading-relaxed text-zinc-500 lg:text-2xl"
        >
          VoicyClaw turns your OpenClaw bot into a live voice experience. Speak,
          listen, interrupt, and hear answers back in real time with your own
          provider keys.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col items-center justify-center gap-5 sm:flex-row"
        >
          <Link
            href="/studio"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-10 py-5 text-lg font-bold text-white shadow-xl shadow-amber-500/30 transition-all hover:bg-amber-600 active:scale-95 sm:w-auto"
          >
            Get Started Now <ArrowRight className="h-5 w-5" />
          </Link>
          <a
            href="https://github.com/Lyshen/VoicyClaw"
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-10 py-5 text-lg font-bold text-zinc-900 transition-all hover:bg-zinc-50 active:scale-95 sm:w-auto"
          >
            <Globe className="h-5 w-5" /> View Source
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
              Everything you need for a{" "}
              <span className="text-amber-500">voice-first</span> OpenClaw
              experience.
            </h2>
            <p className="text-xl text-zinc-500">
              Start with the studio, test providers side by side, and keep the
              path open for real production channels later.
            </p>
          </div>
          <div className="hidden lg:block">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-100 px-6 py-3 font-semibold text-zinc-900">
              Web Studio Beta
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
        "Bring your OpenClaw setup and point VoicyClaw at the same backend you already use.",
    },
    {
      step: "02",
      title: "Choose a voice path",
      description:
        "Pick the provider and voice you want to test, from premium streaming TTS to cheaper single-request voices.",
    },
    {
      step: "03",
      title: "Start talking",
      description:
        "Open the web studio, speak naturally, and hear your agent respond with live voice output.",
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
            Simple to launch,
            <br />
            powerful to use.
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

function CallToAction() {
  return (
    <section id="get-started" className="bg-white py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="relative overflow-hidden rounded-[3rem] bg-amber-500 p-12 text-center text-white shadow-2xl shadow-amber-500/40 lg:p-20">
          <div className="absolute inset-0 h-full w-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />

          <div className="relative z-10">
            <h2 className="mb-8 text-4xl font-bold lg:text-6xl">
              Ready to start talking?
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-xl text-amber-50 opacity-90 lg:text-2xl">
              Open the current studio build and start testing the voice
              experience right away.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/studio"
                className="w-full rounded-2xl bg-zinc-900 px-10 py-5 text-xl font-bold text-white shadow-xl transition-all hover:bg-zinc-800 active:scale-95 sm:w-auto"
              >
                Open Studio
              </Link>
              <a
                href="https://github.com/Lyshen/VoicyClaw/blob/main/README.md"
                target="_blank"
                rel="noreferrer"
                className="w-full rounded-2xl bg-white px-10 py-5 text-xl font-bold text-amber-600 shadow-xl transition-all hover:bg-amber-50 active:scale-95 sm:w-auto"
              >
                Read the Docs
              </a>
            </div>

            <p className="mt-10 font-medium text-amber-100 opacity-80">
              The current flow stays the same. This page is just the new front
              door.
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500">
                <Mic className="h-5 w-5 text-white" />
              </div>
              VoicyClaw
            </div>
            <p className="leading-relaxed text-zinc-500">
              Voice-first infrastructure for OpenClaw agents, with a polished
              studio today and real delivery channels on the roadmap.
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
