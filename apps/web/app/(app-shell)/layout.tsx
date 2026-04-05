import { AppShellHeader } from "../../components/app-shell-header"
import { getResolvedAuthMode } from "../../lib/auth-mode"

export const dynamic = "force-dynamic"

export default function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <AppShellHeader authMode={getResolvedAuthMode()} />
      <main className="site-main">{children}</main>
    </div>
  )
}
