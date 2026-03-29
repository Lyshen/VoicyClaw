import { SignIn } from "@clerk/nextjs"
import { notFound } from "next/navigation"

import { getResolvedAuthMode } from "../../../lib/auth-mode"

export default function SignInPage() {
  if (getResolvedAuthMode() !== "clerk") {
    notFound()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-amber-50 px-6 py-16">
      <SignIn fallbackRedirectUrl="/studio" signUpUrl="/sign-up" />
    </main>
  )
}
