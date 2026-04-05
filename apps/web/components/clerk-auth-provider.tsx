import { ClerkProvider } from "@clerk/nextjs"

import { getResolvedAuthConfig } from "../lib/auth-mode"

export function ClerkAuthProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const auth = getResolvedAuthConfig()

  return (
    <ClerkProvider
      publishableKey={auth.clerkPublishableKey ?? undefined}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      {children}
    </ClerkProvider>
  )
}
