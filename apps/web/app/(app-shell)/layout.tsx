import { AppShellHeader } from "../../components/app-shell-header"
import { getWebRequestContext } from "../../lib/web-request-context"

export const dynamic = "force-dynamic"

export default async function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const {
    auth: { isEnabled },
  } = await getWebRequestContext()

  return (
    <div className="shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <AppShellHeader authEnabled={isEnabled} />
      <main className="site-main">{children}</main>
    </div>
  )
}
