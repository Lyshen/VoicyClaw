"use client"

import { usePathname } from "next/navigation"

import { AppShellAuthControls } from "./auth-controls"
import { SiteHeader } from "./site-header"

export function AppShellHeader({ authEnabled }: { authEnabled: boolean }) {
  const pathname = usePathname()
  const navigationLinks = [
    { href: "/studio", label: "Studio" },
    { href: "/settings", label: "Settings" },
  ]

  return (
    <SiteHeader
      mode="sticky"
      navigation={navigationLinks.map((link) => ({
        ...link,
        active: pathname === link.href,
      }))}
      actions={<AppShellAuthControls authEnabled={authEnabled} />}
    />
  )
}
