"use client"

import { useEffect, useState } from "react"

import { ProductStudio } from "./product-studio"
import { StudioBootstrap } from "./product-studio-view"
import {
  buildHostedOnboardingState,
  type HostedOnboardingRecord,
} from "../lib/hosted-onboarding-shared"
import {
  buildWebRuntimePayload,
  type WebRuntimePayload,
} from "../lib/web-runtime"

const TRIAL_SUBJECT_STORAGE_KEY = "voicyclaw.try.subject"

export function TrialStudioPage({ serverUrl }: { serverUrl: string }) {
  const [runtime, setRuntime] = useState<WebRuntimePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function bootstrapTrial() {
      try {
        setError(null)
        const trialSubject = getOrCreateTrialSubject()
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
          let message = `${response.status}`

          try {
            const payload = (await response.json()) as {
              message?: string
            }

            if (payload.message?.trim()) {
              message = `${message}: ${payload.message.trim()}`
            }
          } catch {
            message = `${response.status}`
          }

          throw new Error(`Could not prepare your try workspace (${message}).`)
        }

        const record = (await response.json()) as HostedOnboardingRecord
        const onboarding = buildHostedOnboardingState(record, serverUrl)
        const nextRuntime = buildWebRuntimePayload({
          serverUrl,
          onboarding,
        })

        if (!cancelled) {
          setRuntime(nextRuntime)
        }
      } catch (nextError) {
        if (!cancelled) {
          setRuntime(null)
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Could not prepare your try workspace.",
          )
        }
      }
    }

    void bootstrapTrial()

    return () => {
      cancelled = true
    }
  }, [retryToken, serverUrl])

  if (runtime) {
    return <ProductStudio initialRuntime={runtime} />
  }

  if (!error) {
    return <StudioBootstrap />
  }

  return (
    <section className="relative overflow-hidden rounded-[2.75rem] border border-rose-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,247,247,0.98))] px-6 py-16 text-zinc-900 shadow-[0_40px_120px_rgba(24,24,27,0.12)]">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Could not prepare the try workspace
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-600">{error}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button
            type="button"
            onClick={() => setRetryToken((current) => current + 1)}
            className="inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 transition hover:border-amber-200 hover:text-amber-700"
          >
            Back to landing page
          </a>
        </div>
      </div>
    </section>
  )
}

function getOrCreateTrialSubject() {
  if (typeof window === "undefined") {
    return buildTrialSubject()
  }

  const existing = window.localStorage.getItem(TRIAL_SUBJECT_STORAGE_KEY)?.trim()
  if (existing) {
    return existing
  }

  const trialSubject = buildTrialSubject()
  window.localStorage.setItem(TRIAL_SUBJECT_STORAGE_KEY, trialSubject)
  return trialSubject
}

function buildTrialSubject() {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return `try-session-${suffix}`
}
