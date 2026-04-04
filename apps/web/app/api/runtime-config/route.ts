import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { getWebRuntimePayload } from "../../../lib/web-runtime"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return NextResponse.json(await getWebRuntimePayload(request))
}
