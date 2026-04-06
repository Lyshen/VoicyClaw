"use client"

import { UserButton } from "@clerk/nextjs"

export function AccountSessionPanel() {
  return (
    <section className="card stack-card p-6">
      <div className="card-heading compact">
        <div>
          <p className="card-kicker">Session</p>
          <h2>Manage sign-in</h2>
        </div>
      </div>

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
