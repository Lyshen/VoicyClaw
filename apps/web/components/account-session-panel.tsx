"use client"

import { UserButton } from "@clerk/nextjs"

import { SectionCardHeader } from "./section-card-header"

export function AccountSessionPanel() {
  return (
    <section className="card stack-card p-6">
      <SectionCardHeader kicker="Session" title="Manage sign-in" />

      <p className="support-copy text-sm leading-7">
        Use the session controls here when you want to manage the current
        Clerk-backed sign-in session.
      </p>

      <div className="landing-user-button">
        <UserButton />
      </div>
    </section>
  )
}
