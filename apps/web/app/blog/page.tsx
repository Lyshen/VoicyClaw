import type { Metadata } from "next"

import { BlogIndexPage } from "../../components/blog-layout"

export const metadata: Metadata = {
  title: "VoicyClaw Blog | Launch notes, demos, and retrospectives",
  description:
    "Read VoicyClaw product notes about the Product Hunt launch, Project Hail Mary voice demo origin, and launch retrospectives.",
  alternates: {
    canonical: "/blog",
  },
}

export default function BlogPage() {
  return <BlogIndexPage />
}
