"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { AppShellAuthControls } from "./auth-controls"
import { ClerkAppShellAccountLink } from "./auth-controls-clerk"
import { VoicyClawBrandIcon } from "./voicyclaw-brand-icon"

export function AppShellHeader({ authEnabled }: { authEnabled: boolean }) {
  const pathname = usePathname()
  const leadingLink = { href: "/studio", label: "Studio" }
  const trailingLinks = [
    { href: "/settings", label: "Settings" },
    { href: "/console", label: "Console" },
  ]

  return (
    <header className="site-header">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900"
        >
          <VoicyClawBrandIcon
            alt="VoicyClaw"
            className="h-10 w-10 rounded-2xl shadow-lg shadow-amber-500/20"
          />
          VoicyClaw
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {pathname === leadingLink.href ? (
            <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
              {leadingLink.label}
            </span>
          ) : (
            <Link
              href={leadingLink.href}
              className="text-sm font-medium text-zinc-500 transition-colors hover:text-amber-600"
            >
              {leadingLink.label}
            </Link>
          )}
          {authEnabled ? (
            <ClerkAppShellAccountLink pathname={pathname} />
          ) : null}
          {trailingLinks.map((link) => {
            const active = pathname === link.href

            return active ? (
              <span
                key={link.href}
                className="rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700"
              >
                {link.label}
              </span>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-zinc-500 transition-colors hover:text-amber-600"
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        <div className="flex items-center gap-4">
          <AppShellAuthControls authEnabled={authEnabled} />
        </div>
      </div>
    </header>
  )
}
