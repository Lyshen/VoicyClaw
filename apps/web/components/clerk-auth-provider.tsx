import { ClerkProvider } from "@clerk/nextjs"

export function ClerkAuthProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
      {children}
    </ClerkProvider>
  )
}
