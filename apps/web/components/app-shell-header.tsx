"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { VoicyClawBrandIcon } from "./voicyclaw-brand-icon"

const shellLinks = [
  {
    href: "/studio",
    label: "Studio",
  },
  {
    href: "/settings",
    label: "Settings",
  },
] as const

export function AppShellHeader() {
  const pathname = usePathname()

  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <VoicyClawBrandIcon
          alt="VoicyClaw"
          className="h-[46px] w-[46px] rounded-[14px]"
        />
        <span className="brand-copy">
          <strong>VoicyClaw</strong>
          <small>Voice studio for OpenClaw.</small>
        </span>
      </Link>

      <nav className="site-nav">
        {shellLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link ${pathname === link.href ? "active" : ""}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="site-header-actions">
        <Link href="/" className="site-header-button">
          Back to home
        </Link>
      </div>
    </header>
  )
}
