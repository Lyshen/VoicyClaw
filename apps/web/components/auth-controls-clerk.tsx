"use client"

import { UserButton, useAuth } from "@clerk/nextjs"
import Link from "next/link"

export function ClerkAppShellAuthControls() {
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

export function ClerkLandingNavbarAuthControls() {
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
