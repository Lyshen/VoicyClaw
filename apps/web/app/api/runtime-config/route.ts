import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { getRuntimeConfig } from "../../../lib/runtime-config"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return NextResponse.json(await getRuntimeConfig(request))
}
