import { getResolvedAuthMode } from "../lib/auth-mode"

export async function AuthProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  if (getResolvedAuthMode() !== "clerk") {
    return children
  }

  const { ClerkAuthProvider } = await import("./clerk-auth-provider")
  return <ClerkAuthProvider>{children}</ClerkAuthProvider>
}
