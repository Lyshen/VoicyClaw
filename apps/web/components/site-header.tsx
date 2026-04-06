import Link from "next/link"
import type { ReactNode } from "react"

import { VoicyClawBrandIcon } from "./voicyclaw-brand-icon"

type SiteHeaderLink = {
  href: string
  label: string
  active?: boolean
  external?: boolean
}

export function SiteHeader({
  mode,
  navigation,
  actions,
}: {
  mode: "fixed" | "sticky"
  navigation: SiteHeaderLink[]
  actions?: ReactNode
}) {
  return (
    <header className={siteHeaderClassNames[mode]}>
      <div className="mx-auto grid h-20 w-full max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-6 px-6">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-3 leading-none text-2xl font-bold tracking-tight text-zinc-900"
        >
          <VoicyClawBrandIcon
            alt="VoicyClaw"
            className="h-10 w-10 shrink-0 rounded-2xl shadow-lg shadow-amber-500/20"
          />
          <span className="whitespace-nowrap">VoicyClaw</span>
        </Link>

        <nav className="hidden min-w-0 items-center justify-center gap-8 md:flex">
          {navigation.map((item) =>
            item.active ? (
              <span
                key={item.href}
                className="inline-flex h-10 items-center rounded-full bg-amber-50 px-4 text-sm font-semibold text-amber-700"
              >
                {item.label}
              </span>
            ) : item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center text-sm font-medium text-zinc-500 transition-colors hover:text-amber-600"
              >
                {item.label}
              </a>
            ) : item.href.startsWith("#") ? (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex h-10 items-center text-sm font-medium text-zinc-500 transition-colors hover:text-amber-600"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex h-10 items-center text-sm font-medium text-zinc-500 transition-colors hover:text-amber-600"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex shrink-0 items-center justify-end gap-4">
          {actions}
        </div>
      </div>
    </header>
  )
}

const siteHeaderClassNames = {
  fixed:
    "fixed inset-x-0 top-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-md",
  sticky:
    "sticky top-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-md",
} as const
