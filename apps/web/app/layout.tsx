import type { Metadata } from "next"

import { AuthProvider } from "../components/auth-provider"

import "./globals.css"

export const metadata: Metadata = {
  title: "VoicyClaw",
  description: "Give OpenClaw agents a voice.",
  icons: {
    icon: "/voicyclaw-icon.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
