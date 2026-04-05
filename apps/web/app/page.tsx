import { LandingPage } from "../components/landing-page"
import { getResolvedAuthMode } from "../lib/auth-mode"

export const dynamic = "force-dynamic"

export default function Page() {
  return <LandingPage authMode={getResolvedAuthMode()} />
}
