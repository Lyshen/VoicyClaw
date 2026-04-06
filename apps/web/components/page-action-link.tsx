import Link from "next/link"

export function PageActionLink({
  href,
  label,
  tone,
}: {
  href: string
  label: string
  tone: "primary" | "secondary"
}) {
  return (
    <Link href={href} className={pageActionLinkClassNames[tone]}>
      {label}
    </Link>
  )
}

const pageActionLinkClassNames = {
  primary:
    "rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600",
  secondary:
    "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:border-amber-300 hover:text-amber-700",
} as const
