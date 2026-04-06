"use client"

import { useAuth, useClerk, useUser } from "@clerk/nextjs"
import Link from "next/link"
import type { ReactNode } from "react"
import { useEffect, useId, useRef, useState } from "react"

const GITHUB_REPO_URL = "https://github.com/Lyshen/VoicyClaw"

export function AppShellAuthControls({
  authEnabled,
}: {
  authEnabled: boolean
}) {
  return (
    <AuthControls
      authEnabled={authEnabled}
      signedIn={<AccountMenuButton />}
      signedOut={<ActionLink href="/sign-in" label="Sign in" kind="header" />}
    />
  )
}

export function LandingNavbarAuthControls({
  authEnabled,
}: {
  authEnabled: boolean
}) {
  return (
    <AuthControls
      authEnabled={authEnabled}
      disabled={<ActionLink href="/studio" label="Open studio" kind="header" />}
      signedIn={<AccountMenuButton />}
      signedOut={<ActionLink href="/sign-in" label="Sign in" kind="header" />}
    />
  )
}

export function LandingHeroAuthControls({
  authEnabled,
}: {
  authEnabled: boolean
}) {
  return (
    <AuthControls
      authEnabled={authEnabled}
      disabled={
        <>
          <ActionLink href="/studio" label="Start now" kind="hero-primary" />
          <ActionLink
            href={GITHUB_REPO_URL}
            label="Open on GitHub"
            kind="hero-secondary"
            external
          />
        </>
      }
      signedIn={
        <>
          <ActionLink href="/studio" label="Open studio" kind="hero-primary" />
          <ActionLink
            href={GITHUB_REPO_URL}
            label="Open on GitHub"
            kind="hero-secondary"
            external
          />
        </>
      }
      signedOut={
        <>
          <ActionLink
            href="/sign-up"
            label="Create account"
            kind="hero-primary"
          />
          <ActionLink href="/sign-in" label="Sign in" kind="hero-secondary" />
        </>
      }
    />
  )
}

export function LandingCallToActionControls({
  authEnabled,
}: {
  authEnabled: boolean
}) {
  return (
    <AuthControls
      authEnabled={authEnabled}
      disabled={
        <>
          <ActionLink href="/studio" label="Start now" kind="cta-primary" />
          <ActionLink
            href={GITHUB_REPO_URL}
            label="Open on GitHub"
            kind="cta-secondary"
            external
          />
        </>
      }
      signedIn={
        <>
          <ActionLink href="/studio" label="Open studio" kind="cta-primary" />
          <ActionLink
            href={GITHUB_REPO_URL}
            label="Open on GitHub"
            kind="cta-secondary"
            external
          />
        </>
      }
      signedOut={
        <>
          <ActionLink
            href="/sign-up"
            label="Create account"
            kind="cta-primary"
          />
          <ActionLink href="/sign-in" label="Sign in" kind="cta-secondary" />
        </>
      }
    />
  )
}

function AuthControls({
  authEnabled,
  disabled = null,
  signedIn,
  signedOut = null,
}: {
  authEnabled: boolean
  disabled?: ReactNode
  signedIn: ReactNode
  signedOut?: ReactNode
}) {
  if (!authEnabled) {
    return disabled
  }

  return <ClerkAuthGate signedIn={signedIn} signedOut={signedOut} />
}

function ClerkAuthGate({
  signedIn,
  signedOut = null,
}: {
  signedIn: ReactNode
  signedOut?: ReactNode
}) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return null
  }

  return isSignedIn ? signedIn : signedOut
}

function AccountMenuButton() {
  const clerk = useClerk()
  const { user } = useUser()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  if (!user) {
    return null
  }

  const primaryEmail =
    user.primaryEmailAddress?.emailAddress ||
    user.emailAddresses?.[0]?.emailAddress
  const label =
    user.fullName?.trim() ||
    primaryEmail ||
    user.username?.trim() ||
    "VoicyClaw account"
  const initial = label.charAt(0).toUpperCase()
  const imageUrl = user.imageUrl?.trim()

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        title={label}
        aria-label="Open user menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className="group flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white/90 shadow-[0_12px_30px_rgba(24,24,27,0.06)] transition hover:border-amber-300 hover:shadow-[0_18px_44px_rgba(245,158,11,0.16)]"
      >
        {imageUrl ? (
          // biome-ignore lint/performance/noImgElement: Clerk avatar URLs are remote and not wired into the app image pipeline.
          <img
            src={imageUrl}
            alt={label}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-sm font-semibold text-white">
            {initial}
          </span>
        )}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="User menu"
          className="absolute top-[calc(100%+0.75rem)] right-0 z-50 min-w-[180px] rounded-[1.4rem] border border-zinc-200 bg-white/96 p-2 shadow-[0_24px_60px_rgba(24,24,27,0.14)] backdrop-blur-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              clerk.openUserProfile()
            }}
            className="flex h-11 w-full items-center rounded-2xl px-3 text-left text-sm font-medium text-zinc-700 transition hover:bg-amber-50 hover:text-amber-700"
          >
            Personal
          </button>
          <Link
            href="/credits"
            role="menuitem"
            prefetch={false}
            onClick={() => setOpen(false)}
            className="flex h-11 items-center rounded-2xl px-3 text-sm font-medium text-zinc-700 transition hover:bg-amber-50 hover:text-amber-700"
          >
            Credits
          </Link>
          <Link
            href="/logs"
            role="menuitem"
            prefetch={false}
            onClick={() => setOpen(false)}
            className="flex h-11 items-center rounded-2xl px-3 text-sm font-medium text-zinc-700 transition hover:bg-amber-50 hover:text-amber-700"
          >
            Logs
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              void clerk.signOut({ redirectUrl: "/" })
            }}
            className="flex h-11 w-full items-center rounded-2xl px-3 text-left text-sm font-medium text-zinc-700 transition hover:bg-amber-50 hover:text-amber-700"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ActionLink({
  href,
  label,
  kind,
  external = false,
}: {
  href: string
  label: string
  kind:
    | "header"
    | "hero-primary"
    | "hero-secondary"
    | "cta-primary"
    | "cta-secondary"
  external?: boolean
}) {
  const className = actionLinkClassNames[kind]

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {label}
      </a>
    )
  }

  return (
    <Link href={href} prefetch={false} className={className}>
      {label}
    </Link>
  )
}

const actionLinkClassNames = {
  header:
    "rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:from-amber-600 hover:to-orange-600 active:scale-95",
  "hero-primary":
    "flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-10 py-5 text-lg font-bold text-white shadow-xl shadow-amber-500/30 transition-all hover:bg-amber-600 active:scale-95 sm:w-auto",
  "hero-secondary":
    "flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-10 py-5 text-lg font-bold text-zinc-900 transition-all hover:bg-zinc-50 active:scale-95 sm:w-auto",
  "cta-primary":
    "w-full rounded-2xl bg-zinc-900 px-10 py-5 text-xl font-bold text-white shadow-xl transition-all hover:bg-zinc-800 active:scale-95 sm:w-auto",
  "cta-secondary":
    "w-full rounded-2xl border border-white/40 bg-white/14 px-10 py-5 text-center text-xl font-bold text-white shadow-xl backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95 sm:w-auto",
} as const
