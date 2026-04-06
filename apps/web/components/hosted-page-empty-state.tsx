import { PageActionLink } from "./page-action-link"

export function HostedPageEmptyState({
  eyebrow,
  title,
  copy,
  actions,
}: {
  eyebrow: string
  title: string
  copy: string
  actions: Array<{
    href: string
    label: string
    tone: "primary" | "secondary"
  }>
}) {
  return (
    <div className="page-stack">
      <section className="hero-card card">
        <div>
          <p className="hero-eyebrow">{eyebrow}</p>
          <h1 className="hero-title">{title}</h1>
          <p className="hero-copy">{copy}</p>
        </div>
        <div className="status-row">
          {actions.map((action) => (
            <PageActionLink
              key={`${action.href}-${action.label}`}
              href={action.href}
              label={action.label}
              tone={action.tone}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
