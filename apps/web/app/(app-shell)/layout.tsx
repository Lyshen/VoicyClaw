import { AppShellHeader } from "../../components/app-shell-header"

export default function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <AppShellHeader />
      <main className="site-main">{children}</main>
    </div>
  )
}
