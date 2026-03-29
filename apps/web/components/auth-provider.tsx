import { ClerkProvider } from "@clerk/nextjs"

import { getResolvedAuthMode } from "../lib/auth-mode"

export function AuthProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  if (getResolvedAuthMode() !== "clerk") {
    return children
  }

  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
      {children}
    </ClerkProvider>
  )
}
