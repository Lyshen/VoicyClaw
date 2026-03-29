import { LandingPage } from "../components/landing-page"
import { getResolvedAuthMode } from "../lib/auth-mode"

export default function Page() {
  return <LandingPage authMode={getResolvedAuthMode()} />
}
