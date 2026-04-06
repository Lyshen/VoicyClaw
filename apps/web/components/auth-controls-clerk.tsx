"use client"

import { useAuth, useUser } from "@clerk/nextjs"
import Link from "next/link"
import type { ReactNode } from "react"

const GITHUB_REPO_URL = "https://github.com/Lyshen/VoicyClaw"

export function ClerkHeaderAuthControls() {
  return (
    <ClerkAuthGate
      signedIn={<AccountAvatarLink />}
      signedOut={<PrimaryAuthLink href="/sign-in" label="Sign in" />}
    />
  )
}

export function ClerkLandingHeroAuthControls() {
  return (
    <ClerkAuthGate
      signedIn={
        <>
          <HeroPrimaryLink href="/studio" label="Open studio" />
          <HeroSecondaryAnchor href={GITHUB_REPO_URL} label="Open on GitHub" />
        </>
      }
      signedOut={
        <>
          <HeroPrimaryLink href="/sign-up" label="Create account" />
          <HeroSecondaryLink href="/sign-in" label="Sign in" />
        </>
      }
    />
  )
}

export function ClerkLandingCallToActionControls() {
  return (
    <ClerkAuthGate
      signedIn={
        <>
          <CallToActionPrimaryLink href="/studio" label="Open studio" />
          <CallToActionSecondaryAnchor
            href={GITHUB_REPO_URL}
            label="Open on GitHub"
          />
        </>
      }
      signedOut={
        <>
          <CallToActionPrimaryLink href="/sign-up" label="Create account" />
          <CallToActionSecondaryLink href="/sign-in" label="Sign in" />
        </>
      }
    />
  )
}

function AccountAvatarLink() {
  const { user } = useUser()

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
    <Link
      href="/account"
      title={label}
      aria-label="Open account"
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
    </Link>
  )
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

function PrimaryAuthLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:from-amber-600 hover:to-orange-600 active:scale-95"
    >
      {label}
    </Link>
  )
}

function HeroPrimaryLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-10 py-5 text-lg font-bold text-white shadow-xl shadow-amber-500/30 transition-all hover:bg-amber-600 active:scale-95 sm:w-auto"
    >
      {label}
    </Link>
  )
}

function HeroSecondaryLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-10 py-5 text-lg font-bold text-zinc-900 transition-all hover:bg-zinc-50 active:scale-95 sm:w-auto"
    >
      {label}
    </Link>
  )
}

function HeroSecondaryAnchor({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-10 py-5 text-lg font-bold text-zinc-900 transition-all hover:bg-zinc-50 active:scale-95 sm:w-auto"
    >
      {label}
    </a>
  )
}

function CallToActionPrimaryLink({
  href,
  label,
}: {
  href: string
  label: string
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="w-full rounded-2xl bg-zinc-900 px-10 py-5 text-xl font-bold text-white shadow-xl transition-all hover:bg-zinc-800 active:scale-95 sm:w-auto"
    >
      {label}
    </Link>
  )
}

function CallToActionSecondaryLink({
  href,
  label,
}: {
  href: string
  label: string
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="w-full rounded-2xl border border-white/40 bg-white/14 px-10 py-5 text-center text-xl font-bold text-white shadow-xl backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95 sm:w-auto"
    >
      {label}
    </Link>
  )
}

function CallToActionSecondaryAnchor({
  href,
  label,
}: {
  href: string
  label: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="w-full rounded-2xl border border-white/40 bg-white/14 px-10 py-5 text-center text-xl font-bold text-white shadow-xl backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95 sm:w-auto"
    >
      {label}
    </a>
  )
}
