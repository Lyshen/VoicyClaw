import Link from "next/link"

export default function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="site-header">
        <Link href="/" className="brand">
          <span className="brand-mark">VC</span>
          <span className="brand-copy">
            <strong>VoicyClaw</strong>
            <small>OpenClaw voice studio.</small>
          </span>
        </Link>
        <nav className="site-nav">
          <Link href="/studio" className="nav-link">
            Studio
          </Link>
          <Link href="/settings" className="nav-link">
            Settings
          </Link>
        </nav>
      </header>
      <main className="site-main">{children}</main>
    </div>
  )
}
