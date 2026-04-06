import {
  formatCredits,
  formatDateTime,
  formatDurationMs,
  shortId,
} from "../lib/billing-format"
import type { LogsPageState } from "../lib/hosted-viewer"
import { HostedPageEmptyState } from "./hosted-page-empty-state"
import { LogsFilterForm } from "./logs-filter-form"
import { SectionCardHeader } from "./section-card-header"

export function LogsPage({ state }: { state: LogsPageState }) {
  if (state.kind === "unavailable") {
    return (
      <HostedPageEmptyState
        eyebrow="Logs"
        title="Hosted logs are not available in this deployment"
        copy="This environment does not have hosted sign-in enabled, so voice usage history is only available in hosted mode."
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
      <HostedPageEmptyState
        eyebrow="Logs"
        title="Sign in to inspect usage logs"
        copy="Hosted usage logs sit behind your account. Sign in to filter by time range and inspect recent metered voice activity."
        actions={[
          {
            href: "/sign-in",
            label: "Sign in",
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
      <HostedPageEmptyState
        eyebrow="Logs"
        title="Your hosted workspace is still being prepared"
        copy={`${state.user.displayName} is signed in, but the starter workspace has not finished provisioning yet. Reopen logs once setup completes.`}
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

  const { viewer, logs } = state
  const primaryEmail = viewer.user.email ?? "No primary email"
  const successRate =
    logs.usage.totalEvents > 0
      ? Math.round((logs.usage.successCount / logs.usage.totalEvents) * 100)
      : 0

  return (
    <div className="page-stack">
      <section className="card relative overflow-hidden border-amber-100/80 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,249,240,0.98))] p-6 shadow-[0_28px_90px_rgba(24,24,27,0.08)] lg:p-8">
        <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr] xl:items-end">
          <div className="space-y-5">
            <div>
              <p className="hero-eyebrow">Logs</p>
              <h1 className="hero-title">
                Usage history with time-range filters
              </h1>
              <p className="hero-copy">
                Filter server-side voice usage by start and end time, then scan
                every metered reply in one focused view.
              </p>
            </div>

            <div className="status-row">
              <span className="status-pill live">{logs.allowance.status}</span>
              <span className="status-pill neutral">{primaryEmail}</span>
              <span className="status-pill neutral">
                {logs.events.length} events shown
              </span>
            </div>

            <p className="text-sm leading-7 text-zinc-500">
              {logs.filters.startAt || logs.filters.endAt
                ? `Filtered window: ${logs.filters.startAt ? formatDateTime(logs.filters.startAt) : "Any start"} to ${logs.filters.endAt ? formatDateTime(logs.filters.endAt) : "Now"}.`
                : "No time filter is active. Showing the latest metered voice events."}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              label="Calls"
              value={logs.usage.totalEvents.toLocaleString("en-US")}
              hint="metered events"
              spotlight
            />
            <MetricCard
              label="Success rate"
              value={`${successRate}%`}
              hint={`${logs.usage.successCount} succeeded`}
            />
            <MetricCard
              label="Charged"
              value={formatCredits(logs.usage.chargedCreditsMillis)}
              hint="credits"
            />
            <MetricCard
              label="Generated"
              value={formatDurationMs(logs.usage.outputAudioMs)}
              hint="audio output"
            />
          </div>
        </div>
      </section>

      <section className="card stack-card p-6">
        <SectionCardHeader kicker="Filters" title="Time range" />
        <LogsFilterForm
          initialStartAt={logs.filters.startAt}
          initialEndAt={logs.filters.endAt}
        />
      </section>

      <section className="card stack-card p-6">
        <SectionCardHeader
          kicker="Usage events"
          title="Voice activity"
          aside={
            <span className="status-pill neutral">
              {logs.events.length === 0
                ? "No events found"
                : `${logs.events.length} events`}
            </span>
          }
        />

        {logs.events.length === 0 ? (
          <div className="timeline-empty">
            No voice usage matched this filter window.
          </div>
        ) : (
          <div className="space-y-3">
            {logs.events.map((event) => (
              <article
                key={event.id}
                className="rounded-[24px] border border-zinc-200/80 bg-white/85 p-4 shadow-[0_12px_36px_rgba(24,24,27,0.05)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
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
                      {formatDateTime(event.createdAt)} · request{" "}
                      {shortId(event.requestId)}
                    </p>
                  </div>

                  <div className="min-w-[172px] rounded-[20px] bg-zinc-50 px-3 py-3 text-right">
                    <div className="text-sm font-semibold text-zinc-900">
                      {formatCredits(event.chargedCreditsMillis)} credits
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
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
  )
}

function MetricCard({
  label,
  value,
  hint,
  spotlight = false,
}: {
  label: string
  value: string
  hint: string
  spotlight?: boolean
}) {
  return (
    <div
      className={`rounded-[24px] border p-4 shadow-[0_12px_36px_rgba(24,24,27,0.04)] ${
        spotlight
          ? "border-amber-200 bg-white shadow-[0_16px_44px_rgba(245,158,11,0.08)]"
          : "border-zinc-200/80 bg-white/80"
      }`}
    >
      <div className="text-xs font-semibold tracking-[0.16em] text-amber-700 uppercase">
        {label}
      </div>
      <div
        className={`mt-2 font-semibold tracking-tight text-zinc-900 ${
          spotlight ? "text-4xl" : "text-2xl"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-sm text-zinc-500">{hint}</div>
    </div>
  )
}
