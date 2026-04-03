"use client"

import { UserButton, useAuth } from "@clerk/nextjs"
import Link from "next/link"

import type { AuthMode } from "../lib/auth-mode"

export function AppShellAuthControls({ authMode }: { authMode: AuthMode }) {
  if (authMode !== "clerk") {
    return null
  }

  return <ClerkAppShellAuthControls />
}

function ClerkAppShellAuthControls() {
  const { isSignedIn } = useAuth()

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/account"
          className="rounded-full border border-zinc-200 bg-white/90 px-4 py-2 text-sm font-semibold text-zinc-900 shadow-[0_12px_30px_rgba(24,24,27,0.06)] transition hover:border-amber-300 hover:text-amber-700"
        >
          Account
        </Link>
        <div className="landing-user-button">
          <UserButton />
        </div>
      </div>
    )
  }

  return (
    <Link
      href="/sign-in"
      prefetch={false}
      className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:from-amber-600 hover:to-orange-600 active:scale-95"
    >
      Log in
    </Link>
  )
}

export function LandingNavbarAuthControls({
  authMode,
}: {
  authMode: AuthMode
}) {
  if (authMode !== "clerk") {
    return (
      <Link
        href="/studio"
        prefetch={false}
        className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:from-amber-600 hover:to-orange-600 active:scale-95"
      >
        Try the demo
      </Link>
    )
  }

  return <ClerkLandingNavbarAuthControls />
}

function ClerkLandingNavbarAuthControls() {
  const { isSignedIn } = useAuth()

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/account"
          className="rounded-full border border-zinc-200 bg-white/90 px-4 py-2 text-sm font-semibold text-zinc-900 shadow-[0_12px_30px_rgba(24,24,27,0.06)] transition hover:border-amber-300 hover:text-amber-700"
        >
          Account
        </Link>
        <div className="landing-user-button">
          <UserButton />
        </div>
      </div>
    )
  }

  return (
    <Link
      href="/sign-in"
      prefetch={false}
      className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:from-amber-600 hover:to-orange-600 active:scale-95"
    >
      Log in
    </Link>
  )
}

export function LandingHeroAuthControls({ authMode }: { authMode: AuthMode }) {
  void authMode
  return (
    <>
      <Link
        href="/studio"
        prefetch={false}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-10 py-5 text-lg font-bold text-white shadow-xl shadow-amber-500/30 transition-all hover:bg-amber-600 active:scale-95 sm:w-auto"
      >
        Start now
      </Link>
      <a
        href="https://github.com/Lyshen/VoicyClaw"
        target="_blank"
        rel="noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-10 py-5 text-lg font-bold text-zinc-900 transition-all hover:bg-zinc-50 active:scale-95 sm:w-auto"
      >
        Open on GitHub
      </a>
    </>
  )
}

export function LandingCallToActionControls({
  authMode,
}: {
  authMode: AuthMode
}) {
  void authMode
  return (
    <>
      <Link
        href="/studio"
        prefetch={false}
        className="w-full rounded-2xl bg-zinc-900 px-10 py-5 text-xl font-bold text-white shadow-xl transition-all hover:bg-zinc-800 active:scale-95 sm:w-auto"
      >
        Start now
      </Link>
      <a
        href="https://github.com/Lyshen/VoicyClaw"
        target="_blank"
        rel="noreferrer"
        className="w-full rounded-2xl border border-white/40 bg-white/14 px-10 py-5 text-center text-xl font-bold text-white shadow-xl backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95 sm:w-auto"
      >
        Open on GitHub
      </a>
    </>
  )
}
