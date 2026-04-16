import Link from "next/link"

import type { BlogPost } from "../lib/blog-posts"
import { blogPosts } from "../lib/blog-posts"
import { SiteHeader } from "./site-header"
import { VoicyClawBrandIcon } from "./voicyclaw-brand-icon"

const blogNavigation = [
  { href: "/", label: "Home" },
  { href: "/#try-now", label: "Try now" },
  { href: "/blog", label: "Blog", active: true },
  {
    href: "https://github.com/Lyshen/VoicyClaw",
    label: "GitHub",
    external: true,
  },
]

export function BlogIndexPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 [color-scheme:light]">
      <SiteHeader mode="sticky" navigation={blogNavigation} />
      <main>
        <section className="relative overflow-hidden border-b border-amber-100 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_30%),linear-gradient(180deg,#fff7ed,#ffffff)] px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-4 py-1.5 text-sm font-semibold text-amber-700 shadow-sm">
              <VoicyClawBrandIcon alt="VoicyClaw" className="h-5 w-5" />
              VoicyClaw field notes
            </div>
            <h1 className="max-w-4xl text-5xl leading-tight font-bold tracking-tight text-zinc-950 lg:text-7xl">
              Notes on giving private agents a voice.
            </h1>
            <p className="mt-8 max-w-3xl text-xl leading-relaxed text-zinc-600">
              Launch notes, build logs, retrospectives, and demos from the
              VoicyClaw project. This page gives search engines and readers a
              growing trail of product context beyond the homepage.
            </p>
          </div>
        </section>

        <section className="px-6 py-20">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-3">
            {blogPosts.map((post) => (
              <BlogPostCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

function BlogPostCard({ post }: { post: BlogPost }) {
  return (
    <article className="group flex min-h-full flex-col rounded-[2rem] border border-zinc-100 bg-zinc-50 p-7 transition-all hover:-translate-y-1 hover:border-amber-200 hover:bg-amber-50/40 hover:shadow-[0_24px_70px_rgba(24,24,27,0.08)]">
      <div className="mb-6 flex items-center justify-between gap-4 text-xs font-semibold tracking-[0.18em] text-amber-600 uppercase">
        <span>{post.category}</span>
        <span className="text-zinc-400">{post.readingTime}</span>
      </div>
      <h2 className="text-2xl leading-tight font-bold text-zinc-950">
        <Link href={`/blog/${post.slug}`} className="hover:text-amber-600">
          {post.title}
        </Link>
      </h2>
      <p className="mt-5 flex-1 leading-relaxed text-zinc-600">
        {post.description}
      </p>
      <Link
        href={`/blog/${post.slug}`}
        className="mt-8 inline-flex text-sm font-bold text-amber-600 transition-colors group-hover:text-orange-600"
      >
        Read the note →
      </Link>
    </article>
  )
}

export function BlogArticlePage({ post }: { post: BlogPost }) {
  return (
    <div className="min-h-screen bg-white text-zinc-900 [color-scheme:light]">
      <SiteHeader mode="sticky" navigation={blogNavigation} />
      <main>
        <article>
          <header className="border-b border-amber-100 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_32%),linear-gradient(180deg,#fff7ed,#ffffff)] px-6 py-20">
            <div className="mx-auto max-w-4xl">
              <Link
                href="/blog"
                className="mb-8 inline-flex text-sm font-bold text-amber-700 hover:text-orange-600"
              >
                ← Back to blog
              </Link>
              <div className="mb-6 flex flex-wrap items-center gap-3 text-sm font-semibold text-zinc-500">
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                  {post.category}
                </span>
                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-zinc-700 shadow-sm">
                  By {post.author}
                </span>
                <time dateTime={post.publishedAt}>{post.publishedAt}</time>
                <span>{post.readingTime}</span>
              </div>
              <h1 className="text-4xl leading-tight font-bold tracking-tight text-zinc-950 lg:text-6xl">
                {post.title}
              </h1>
              <p className="mt-8 text-xl leading-relaxed text-zinc-600">
                {post.hero}
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-sm font-medium">
                <span className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-amber-800 shadow-sm">
                  {post.author}
                </span>
                <span className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-zinc-700 shadow-sm">
                  Edited with GPT
                </span>
              </div>
              {post.externalLink ? (
                <a
                  href={post.externalLink.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-8 inline-flex rounded-full bg-zinc-950 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-zinc-900/10 transition-transform hover:-translate-y-0.5"
                >
                  {post.externalLink.label}
                </a>
              ) : null}
            </div>
          </header>

          <div className="mx-auto max-w-4xl px-6 py-16">
            {post.youtube ? (
              <div className="mb-14 overflow-hidden rounded-[2rem] border border-zinc-100 bg-zinc-950 shadow-[0_30px_90px_rgba(24,24,27,0.12)]">
                <iframe
                  className="aspect-video w-full"
                  src={`https://www.youtube.com/embed/${post.youtube.id}`}
                  title={post.youtube.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : null}

            <div className="space-y-12">
              {post.sections.map((section) => (
                <section key={section.heading}>
                  <h2 className="text-3xl font-bold tracking-tight text-zinc-950">
                    {section.heading}
                  </h2>
                  <div className="mt-5 space-y-5 text-lg leading-8 text-zinc-600">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </article>
      </main>
    </div>
  )
}
