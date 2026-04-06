import type { ReactNode } from "react"

export function SectionCardHeader({
  kicker,
  title,
  aside,
  className,
}: {
  kicker: string
  title: ReactNode
  aside?: ReactNode
  className?: string
}) {
  return (
    <div
      className={
        className ? `card-heading compact ${className}` : "card-heading compact"
      }
    >
      <div>
        <p className="card-kicker">{kicker}</p>
        <h2>{title}</h2>
      </div>
      {aside ?? null}
    </div>
  )
}
