import { auth, clerkClient } from "@clerk/nextjs/server"
import { headers } from "next/headers"
import { cache } from "react"

import { getResolvedAuthMode, type AuthMode } from "./auth-mode"
import { resolvePublicServerUrl } from "./public-server-url"

export type RequestAuthUser = {
  id: string
  firstName?: string | null
  fullName?: string | null
  username?: string | null
  primaryEmailAddress?: {
    emailAddress?: string | null
  } | null
  emailAddresses?: Array<{
    emailAddress?: string | null
  }>
}

export type RequestAuthContext = {
  authMode: AuthMode
  isEnabled: boolean
  isSignedIn: boolean
  serverUrl: string
  userId: string | null
  user: RequestAuthUser | null
}

export const getRequestAuthContext = cache(
  async (): Promise<RequestAuthContext> => {
    const authMode = getResolvedAuthMode()
    const requestHeaders = await headers()
    const forwardedProto =
      requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http"
    const serverUrl = resolvePublicServerUrl({
      headers: requestHeaders,
      nextUrl: {
        protocol: `${forwardedProto}:`,
      },
    })

    if (authMode !== "clerk") {
      return {
        authMode,
        isEnabled: false,
        isSignedIn: false,
        serverUrl,
        userId: null,
        user: null,
      }
    }

    const { userId } = await auth()
    if (!userId) {
      return {
        authMode,
        isEnabled: true,
        isSignedIn: false,
        serverUrl,
        userId: null,
        user: null,
      }
    }

    const client = await clerkClient()
    const user = (await client.users.getUser(userId)) as RequestAuthUser

    return {
      authMode,
      isEnabled: true,
      isSignedIn: true,
      serverUrl,
      userId,
      user,
    }
  },
)
