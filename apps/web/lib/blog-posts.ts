export type BlogPost = {
  slug: string
  title: string
  description: string
  publishedAt: string
  category: string
  readingTime: string
  hero: string
  externalLink?: {
    label: string
    href: string
  }
  youtube?: {
    id: string
    title: string
  }
  sections: Array<{
    heading: string
    paragraphs: string[]
  }>
}

export const blogPosts: BlogPost[] = [
  {
    slug: "product-hunt-launch-worklog",
    title:
      "Shipping VoicyClaw to Product Hunt: the work behind a tiny voice layer",
    description:
      "A launch worklog about polishing the VoicyClaw landing page, trial flow, plugin packaging, CI, and release artifacts before sharing it with the wider web.",
    publishedAt: "2026-04-15",
    category: "Launch notes",
    readingTime: "5 min read",
    hero: "A small product launch still needs a real runway: onboarding, packaging, trust signals, and a path for people to hear the product immediately.",
    externalLink: {
      label: "View the Product Hunt launch",
      href: "https://www.producthunt.com/products/voicyclaw?launch=voicyclaw",
    },
    sections: [
      {
        heading: "Why the launch mattered",
        paragraphs: [
          "VoicyClaw started as a simple promise: give OpenClaw agents a voice. That sounds small until you try to make the first minute feel obvious. A visitor has to understand what OpenClaw does, why voice matters, how the bot connects, and what they can try without waiting for a sales call.",
          "The Product Hunt launch forced the project to become more than a local demo. It needed a landing page, a reliable starter path, hosted onboarding, release bundles, plugin checks, and enough documentation that someone outside the development loop could make sense of it.",
        ],
      },
      {
        heading: "The polish work before publishing",
        paragraphs: [
          "A lot of the work was not glamorous. The release pipeline had to produce predictable artifacts. The OpenClaw plugin needed its own lint, tests, and type checks. The server and web app needed a CI path that caught formatting, unit coverage, integration behavior, type safety, and Playwright e2e regressions.",
          "The landing page also changed from a pretty explanation into a first-use flow. The page now tries to answer the obvious launch-day question: can I make an agent speak right now? That is why the trial path, connection status, voice selection, and conversation card became part of the homepage instead of living only in the studio.",
        ],
      },
      {
        heading: "What the launch taught us",
        paragraphs: [
          "Launch work exposes every unclear edge. If the product depends on a CLI step, the copy has to be exact. If the user needs a token, the token has to be ready. If the bot may take time to respond, the runtime timeout has to match the real first-use experience.",
          "The biggest lesson was that a launch is not only a marketing event. It is a product quality exercise. Every friction point that feels acceptable during development becomes painfully visible when strangers arrive with no context.",
        ],
      },
    ],
  },
  {
    slug: "project-hail-mary-voice-origin",
    title: "How a Project Hail Mary dubbing idea became VoicyClaw",
    description:
      "The origin story behind VoicyClaw: a playful alien-dubbing idea, a movie-inspired demo, and the realization that private agents need their own voices.",
    publishedAt: "2026-04-15",
    category: "Origin story",
    readingTime: "4 min read",
    hero: "The project began with a playful question: what if an agent could speak in a character voice quickly enough to feel alive?",
    youtube: {
      id: "NJIEXjGvA4s",
      title: "VoicyClaw Project Hail Mary voice demo",
    },
    sections: [
      {
        heading: "The spark",
        paragraphs: [
          "VoicyClaw came from a promotional experiment around the movie Project Hail Mary. The idea was simple and a little ridiculous in the best way: use the rescue-plan mood, alien communication, and voice transformation as a hook for explaining why agents should not be trapped in text boxes.",
          "That experiment made the product direction clearer. Voice is not just output decoration. When an agent speaks back, the interaction feels more present, more personal, and easier to understand for people who do not want to watch a terminal scroll.",
        ],
      },
      {
        heading: "From video idea to product architecture",
        paragraphs: [
          "A video can fake momentum. A product cannot. Turning the idea into VoicyClaw meant building a real path between browser microphone input, OpenClaw agent execution, streaming replies, and text-to-speech providers.",
          "That is why the project became a voice layer instead of a one-off demo. OpenClaw handles the agent. VoicyClaw handles the room, the connection, the audio path, the selected provider, and the product surface where people can actually try the loop.",
        ],
      },
      {
        heading: "Why the story still matters",
        paragraphs: [
          "The movie-inspired angle is still useful because it keeps the product honest. The goal is not to add a random speak button. The goal is to make private agents feel like something you can talk with, test, and eventually rely on.",
          "That playful origin also helps explain the name. VoicyClaw is intentionally a little strange: a voice layer with claws, built for OpenClaw, trying to make agent interaction more vivid than a chat transcript.",
        ],
      },
    ],
  },
  {
    slug: "product-hunt-zero-votes-retrospective",
    title:
      "A painful launch retrospective: what I learned from getting zero Product Hunt votes",
    description:
      "A candid English retrospective on a zero-vote launch: why trial friction killed the release, why friends should test before launch day, and what VoicyClaw changed next.",
    publishedAt: "2026-04-15",
    category: "Retrospective",
    readingTime: "6 min read",
    hero: "The painful part was not only getting zero votes. The painful part was realizing that the product made interested people work too hard before they could feel anything.",
    sections: [
      {
        heading: "The launch result",
        paragraphs: [
          "I had a rough weekend after launch day. VoicyClaw spent a full 24 hours on Product Hunt and ended with zero votes. I had built a small product with vibe coding energy, made a promotional video using a Project Hail Mary-inspired idea, and expected at least a little movement. Instead, there was almost no signal.",
          "After reviewing the launch, my conclusion was blunt: at the execution level, I did not make the trial experience right. The product was not easy enough to try, and that mistake was fatal.",
        ],
      },
      {
        heading: "Lesson one: trial is not optional",
        paragraphs: [
          "This was not my first Product Hunt launch. A previous project, a thinking gym where people could debate with multiple AI characters, received eight votes on launch day and even led to an invitation from someone to publish on another platform.",
          "When I compared the two launches, the biggest difference was obvious. The earlier project could be tried immediately from the entry point. VoicyClaw had a landing page that looked polished, but a friend later told me they did not understand what the homepage wanted them to do. That feedback made the problem impossible to ignore.",
        ],
      },
      {
        heading:
          "Lesson two: reduce trial friction until it feels unfairly easy",
        paragraphs: [
          "VoicyClaw did have a trial idea, but the released version asked users to sign up before trying it. Even if third-party login only takes a few clicks, that is still a major drop-off point for someone who is only curious.",
          "The deeper product flow also had too much friction. I wanted users to make their small lobster agent speak in three steps, but the first install-and-configure step was not smooth enough. In this situation, letting the agent read the docs and help the user complete setup would probably be a better first-use design.",
        ],
      },
      {
        heading: "Lesson three: friends who test are a reality check",
        paragraphs: [
          "Vibe coding makes it very easy to become excited about your own product. Before this launch, I did not ask enough friends to try VoicyClaw. Before the previous launch, at least eight friends spent real time with the product, and most of them tested it before any account wall.",
          "After the disappointing weekend, I asked friends to try VoicyClaw again. The problems appeared quickly. I did not need to wait for a public launch to discover them. I needed honest first-time users earlier.",
        ],
      },
      {
        heading: "What changes next",
        paragraphs: [
          "The first fix is to make trial access feel like the default path, not a reward after registration. The next fix is to reduce setup friction so that the first successful voice loop happens quickly. The final fix is cultural: no more launch without outside testers.",
          "There are more lessons to unpack around feature selection, Product Hunt promotion, timing, storytelling, and interaction design. But the trial lesson comes first because it is the most concrete. If people cannot try the product easily, the launch is already in trouble.",
        ],
      },
    ],
  },
]

export function getBlogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug)
}
