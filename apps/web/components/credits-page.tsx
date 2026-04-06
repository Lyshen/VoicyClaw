import {
  formatCredits,
  formatCreditsDelta,
  formatDateTime,
} from "../lib/billing-format"
import type { CreditsPageState } from "../lib/hosted-viewer"
import { HostedPageEmptyState } from "./hosted-page-empty-state"
import { SectionCardHeader } from "./section-card-header"

export function CreditsPage({ state }: { state: CreditsPageState }) {
  if (state.kind === "unavailable") {
    return (
      <HostedPageEmptyState
        eyebrow="Credits"
        title="Hosted credits are not available in this deployment"
        copy="This environment is running without hosted sign-in, so credit balance and billing ledger pages stay disabled here."
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
        eyebrow="Credits"
        title="Sign in to see your balance and ledger"
        copy="Hosted credits live behind your account. Sign in first, then come back here for balance, grants, and usage deductions."
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
        eyebrow="Credits"
        title="Your hosted workspace is still being prepared"
        copy={`${state.user.displayName} is signed in, but the starter workspace has not finished provisioning yet. Give it a moment, then reopen credits.`}
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

  const { viewer, credits } = state
  const primaryEmail = viewer.user.email ?? "No primary email"

  return (
    <div className="page-stack">
      <section className="card relative overflow-hidden border-amber-100/80 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,249,240,0.98))] p-6 shadow-[0_28px_90px_rgba(24,24,27,0.08)] lg:p-8">
        <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr] xl:items-end">
          <div className="space-y-5">
            <div>
              <p className="hero-eyebrow">Credits</p>
              <h1 className="hero-title">Balance and credit activity</h1>
              <p className="hero-copy">Balance first. Ledger below.</p>
            </div>

            <div className="status-row">
              <span className="status-pill live">
                {credits.allowance.status}
              </span>
              <span className="status-pill neutral">{primaryEmail}</span>
            </div>

            <p className="text-sm text-zinc-500">Starter preview allowance.</p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white opacity-45"
              >
                Add credit soon
              </button>
              <span className="text-sm text-zinc-500">
                Payments coming soon.
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <BillingMetricCard
              label="Balance"
              value={formatCredits(credits.allowance.remainingCreditsMillis)}
              hint="credits remaining"
              spotlight
            />
            <BillingMetricCard
              label="Granted"
              value={formatCredits(credits.allowance.grantedCreditsMillis)}
              hint="credits added"
            />
            <BillingMetricCard
              label="Used"
              value={formatCredits(credits.allowance.usedCreditsMillis)}
              hint="credits deducted"
            />
            <BillingMetricCard
              label="Metered calls"
              value={credits.usage.totalEvents.toLocaleString("en-US")}
              hint="voice requests"
            />
          </div>
        </div>
      </section>

      <section className="card stack-card p-6">
        <SectionCardHeader
          kicker="Ledger"
          title="Credit activity"
          aside={
            <span className="status-pill neutral">
              {credits.ledger.length === 0
                ? "No entries yet"
                : `${credits.ledger.length} entries`}
            </span>
          }
        />

        {credits.ledger.length === 0 ? (
          <div className="timeline-empty">
            Credit grants, deductions, purchases, and refunds will appear here
            once they happen.
          </div>
        ) : (
          <div className="space-y-3">
            {credits.ledger.map((entry) => (
              <article
                key={entry.id}
                className="rounded-[24px] border border-zinc-200/80 bg-white/85 p-4 shadow-[0_12px_36px_rgba(24,24,27,0.05)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm font-semibold text-zinc-900">
                        {entry.note ?? formatLedgerEntryTitle(entry.entryType)}
                      </strong>
                      <span
                        className={`status-pill ${ledgerToneClassName(entry)}`}
                      >
                        {entry.entryType}
                      </span>
                    </div>

                    <p className="text-sm text-zinc-500">
                      {formatDateTime(entry.createdAt)} ·{" "}
                      {formatLedgerSource(entry.sourceType)}
                    </p>
                  </div>

                  <div className="min-w-[172px] rounded-[20px] bg-zinc-50 px-3 py-3 text-right">
                    <div
                      className={`text-sm font-semibold ${
                        entry.creditsDeltaMillis > 0
                          ? "text-amber-700"
                          : "text-zinc-900"
                      }`}
                    >
                      {formatCreditsDelta(entry.creditsDeltaMillis)} credits
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function BillingMetricCard({
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

function formatLedgerEntryTitle(entryType: "grant" | "usage" | "adjustment") {
  switch (entryType) {
    case "grant":
      return "Credit grant"
    case "usage":
      return "Voice usage"
    case "adjustment":
      return "Manual adjustment"
  }
}

function formatLedgerSource(sourceType: string) {
  return sourceType.replaceAll("-", " ")
}

function ledgerToneClassName(entry: {
  entryType: "grant" | "usage" | "adjustment"
  creditsDeltaMillis: number
}) {
  if (entry.creditsDeltaMillis > 0) {
    return "live"
  }

  return entry.entryType === "adjustment" ? "neutral" : "warn"
}
