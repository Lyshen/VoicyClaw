import type { Metadata } from "next"
import Link from "next/link"

import "./globals.css"

export const metadata: Metadata = {
  title: "VoicyClaw Prototype",
  description: "Runnable OpenClaw voice prototype with a local mock bot",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <div className="ambient ambient-one" />
          <div className="ambient ambient-two" />
          <header className="site-header">
            <Link href="/" className="brand">
              <span className="brand-mark">VC</span>
              <span className="brand-copy">
                <strong>VoicyClaw</strong>
                <small>Talk to claws easily.</small>
              </span>
            </Link>
            <nav className="site-nav">
              <Link href="/" className="nav-link">
                Channel
              </Link>
              <Link href="/settings" className="nav-link">
                Settings
              </Link>
            </nav>
          </header>
          <main className="site-main">{children}</main>
        </div>
      </body>
    </html>
  )
}
