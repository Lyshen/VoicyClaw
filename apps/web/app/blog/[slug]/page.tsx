import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BlogArticlePage } from "../../../components/blog-layout"
import { blogPosts, getBlogPost } from "../../../lib/blog-posts"

type BlogArticleRouteProps = {
  params: Promise<{
    slug: string
  }>
}

export function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }))
}

export async function generateMetadata({
  params,
}: BlogArticleRouteProps): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)

  if (!post) {
    return {}
  }

  return {
    title: `${post.title} | VoicyClaw Blog`,
    description: post.description,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.publishedAt,
    },
  }
}

export default async function BlogArticleRoute({
  params,
}: BlogArticleRouteProps) {
  const { slug } = await params
  const post = getBlogPost(slug)

  if (!post) {
    notFound()
  }

  return <BlogArticlePage post={post} />
}
