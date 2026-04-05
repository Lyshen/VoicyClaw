import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import { getResolvedAuthConfig } from "./lib/auth-mode"

const isProtectedRoute = createRouteMatcher([
  "/studio(.*)",
  "/account(.*)",
  "/settings(.*)",
  "/console(.*)",
])

const authConfig = getResolvedAuthConfig()

const proxy =
  authConfig.resolvedMode === "clerk"
    ? clerkMiddleware(
        async (auth, req) => {
          if (isProtectedRoute(req)) {
            await auth.protect({
              unauthenticatedUrl: new URL("/sign-in", req.url).toString(),
            })
          }
        },
        {
          publishableKey: authConfig.clerkPublishableKey ?? undefined,
          secretKey: authConfig.clerkSecretKey ?? undefined,
        },
      )
    : () => NextResponse.next()

export default proxy

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|png|jpg|jpeg|gif|webp|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
