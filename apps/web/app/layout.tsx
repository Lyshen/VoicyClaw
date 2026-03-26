import type { Metadata } from "next"

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
      <body>{children}</body>
    </html>
  )
}
