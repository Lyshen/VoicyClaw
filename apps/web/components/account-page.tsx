import Link from "next/link"

import type { AccountSummaryState } from "../lib/account-summary"
import { AccountSessionPanel } from "./account-session-panel"

export function AccountPage({ state }: { state: AccountSummaryState }) {
  if (state.kind === "unavailable") {
    return (
      <EmptyAccountState
        eyebrow="Account"
        title="Hosted account is not configured for this deployment"
        copy="This environment does not have hosted sign-in enabled, so profile, billing, and workspace setup are unavailable here."
        actions={[
          {
            href: "/studio",
            label: "Open studio",
            tone: "secondary",
          },
          {
            href: "/settings",
            label: "Open settings",
            tone: "secondary",
          },
        ]}
      />
    )
  }

  if (state.kind === "signed-out") {
    return (
      <EmptyAccountState
        eyebrow="Account"
        title="Sign in to load your hosted workspace"
        copy="Your profile, starter workspace, metered usage, and billing summary all live behind the same hosted account. Sign in first, then come back here."
        actions={[
          {
            href: "/sign-in",
            label: "Log in",
            tone: "primary",
          },
          {
            href: "/sign-up",
            label: "Create account",
            tone: "secondary",
          },
        ]}
      />
    )
  }

  if (state.kind === "setup-pending") {
    return (
      <EmptyAccountState
        eyebrow="Account"
        title="We are still finishing your hosted workspace"
        copy={`${state.user.displayName} is signed in, but the hosted starter workspace has not finished loading yet. Refresh in a moment, or open Studio and Settings while provisioning catches up.`}
        actions={[
          {
            href: "/studio",
            label: "Open studio",
            tone: "primary",
          },
          {
            href: "/settings",
            label: "Open settings",
            tone: "secondary",
          },
        ]}
      />
    )
  }

  const { user, onboarding, billing } = state.summary

  return (
    <div className="page-stack">
      <section className="hero-card card">
        <div>
          <p className="hero-eyebrow">Account</p>
          <h1 className="hero-title">Profile, usage, and billing</h1>
          <p className="hero-copy">
            Your starter workspace is live. This page tracks the preview
            allowance, recent TTS usage, and the bot you are wiring into
            VoicyClaw.
          </p>
        </div>

        <div className="status-row">
          <span className="status-pill live">
            {formatCredits(billing.allowance.remainingCreditsMillis)} voice
            credits left
          </span>
          <span className="status-pill neutral">{user.displayName}</span>
          <span className="status-pill neutral">
            {onboarding.workspace.name}
          </span>
          <span className="status-pill neutral">
            {billing.usage.totalEvents} metered TTS calls
          </span>
        </div>
      </section>

      <div className="workspace-grid">
        <div className="page-stack">
          <section className="card stack-card p-6">
            <div className="card-heading compact">
              <div>
                <p className="card-kicker">Allowance</p>
                <h2>Starter preview balance</h2>
              </div>
              <span className="status-pill live">
                {billing.allowance.status}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                label="Remaining"
                value={formatCredits(billing.allowance.remainingCreditsMillis)}
                hint="voice credits"
              />
              <MetricCard
                label="Granted"
                value={formatCredits(billing.allowance.grantedCreditsMillis)}
                hint="voice credits"
              />
              <MetricCard
                label="Used"
                value={formatCredits(billing.allowance.usedCreditsMillis)}
                hint="voice credits"
              />
            </div>

            <p className="support-copy text-sm leading-7">
              {billing.allowance.note}
            </p>
          </section>

          <section className="card stack-card p-6">
            <div className="card-heading compact">
              <div>
                <p className="card-kicker">Usage</p>
                <h2>Workspace TTS summary</h2>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                label="Success"
                value={String(billing.usage.successCount)}
                hint="completed calls"
              />
              <MetricCard
                label="Failed"
                value={String(billing.usage.failureCount)}
                hint="not charged"
              />
              <MetricCard
                label="Charged"
                value={formatCredits(billing.usage.chargedCreditsMillis)}
                hint="voice credits"
              />
              <MetricCard
                label="Input"
                value={billing.usage.inputChars.toLocaleString("en-US")}
                hint="characters"
              />
              <MetricCard
                label="Audio"
                value={formatDurationMs(billing.usage.outputAudioMs)}
                hint="generated"
              />
              <MetricCard
                label="Events"
                value={String(billing.usage.totalEvents)}
                hint="total records"
              />
            </div>
          </section>

          <section className="card stack-card p-6">
            <div className="card-heading compact">
              <div>
                <p className="card-kicker">Recent usage</p>
                <h2>Latest metered events</h2>
              </div>
            </div>

            {billing.recentEvents.length === 0 ? (
              <div className="timeline-empty">
                Send a few server-side TTS replies and the latest events will
                show up here.
              </div>
            ) : (
              <div className="space-y-3">
                {billing.recentEvents.map((event) => (
                  <article
                    key={event.id}
                    className="rounded-[20px] border border-zinc-200/80 bg-white/85 p-4 shadow-[0_12px_36px_rgba(24,24,27,0.05)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm font-semibold text-zinc-900">
                            {event.providerId}
                          </strong>
                          <span
                            className={`status-pill ${
                              event.status === "succeeded" ? "live" : "warn"
                            }`}
                          >
                            {event.status}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500">
                          {formatDate(event.createdAt)} · request{" "}
                          {shortId(event.requestId)}
                        </p>
                      </div>

                      <div className="text-right text-sm text-zinc-600">
                        <div>
                          {formatCredits(event.chargedCreditsMillis)} credits
                        </div>
                        <div>
                          {event.inputChars.toLocaleString("en-US")} chars ·{" "}
                          {formatDurationMs(event.outputAudioMs)}
                        </div>
                      </div>
                    </div>

                    {event.errorMessage ? (
                      <p className="mt-3 rounded-2xl bg-orange-50 px-3 py-2 text-sm text-orange-700">
                        {event.errorMessage}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="sidebar-stack">
          <section className="card stack-card p-6">
            <div className="card-heading compact">
              <div>
                <p className="card-kicker">Profile</p>
                <h2>Your account</h2>
              </div>
            </div>

            <DetailRow label="Name" value={user.displayName} />
            <DetailRow label="Email" value={user.email ?? "No primary email"} />
            <DetailRow label="Username" value={user.username ?? "Not set"} />
            <DetailRow label="User ID" value={shortId(user.id)} mono />
          </section>

          <AccountSessionPanel />

          <section className="card stack-card p-6">
            <div className="card-heading compact">
              <div>
                <p className="card-kicker">Workspace</p>
                <h2>Hosted starter setup</h2>
              </div>
            </div>

            <DetailRow label="Workspace" value={onboarding.workspace.name} />
            <DetailRow label="Project" value={onboarding.project.name} />
            <DetailRow
              label="Channel"
              value={onboarding.project.channelId}
              mono
            />
            <DetailRow label="Bot" value={onboarding.project.botId} mono />
            <DetailRow
              label="Starter key"
              value={onboarding.starterKey?.label ?? "Provisioning issue"}
            />
          </section>

          <section className="card stack-card p-6">
            <div className="card-heading compact">
              <div>
                <p className="card-kicker">Next step</p>
                <h2>Keep testing live voice</h2>
              </div>
            </div>

            <p className="support-copy text-sm leading-7">
              Use Studio for the real conversation loop, and use Settings when
              you want to tune providers or connector wiring.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/studio"
                className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
              >
                Open studio
              </Link>
              <Link
                href="/settings"
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:border-amber-300 hover:text-amber-700"
              >
                Open settings
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function EmptyAccountState({
  eyebrow,
  title,
  copy,
  actions,
}: {
  eyebrow: string
  title: string
  copy: string
  actions: Array<{
    href: string
    label: string
    tone: "primary" | "secondary"
  }>
}) {
  return (
    <div className="page-stack">
      <section className="hero-card card">
        <div>
          <p className="hero-eyebrow">{eyebrow}</p>
          <h1 className="hero-title">{title}</h1>
          <p className="hero-copy">{copy}</p>
        </div>
        <div className="status-row">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={
                action.tone === "primary"
                  ? "rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
                  : "rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:border-amber-300 hover:text-amber-700"
              }
            >
              {action.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-[20px] border border-zinc-200/80 bg-white/80 p-4 shadow-[0_12px_36px_rgba(24,24,27,0.04)]">
      <div className="text-xs font-semibold tracking-[0.16em] text-amber-700 uppercase">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
        {value}
      </div>
      <div className="mt-1 text-sm text-zinc-500">{hint}</div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[20px] border border-zinc-200/70 bg-white/75 px-4 py-3">
      <span className="text-sm text-zinc-500">{label}</span>
      <span
        className={`text-right text-sm text-zinc-900 ${
          mono ? "font-mono" : "font-medium"
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function formatCredits(value: number) {
  return (value / 1000).toFixed(3)
}

function formatDurationMs(value: number) {
  if (value <= 0) {
    return "0s"
  }

  if (value < 1000) {
    return `${value}ms`
  }

  return `${(value / 1000).toFixed(2)}s`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function shortId(value: string) {
  return value.length <= 12 ? value : `${value.slice(0, 8)}...`
}
