"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Code2,
  Database,
  Layers,
  MessageSquare,
  PlayCircle,
  Shield,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HeroText } from "@/components/animations/hero-text";
import { StatCounter } from "@/components/animations/stat-counter";
import {
  Reveal,
  RevealItem,
  RevealStagger,
} from "@/components/animations/reveal";

/* ────────────────────────────────────────────────────────────
   Brand palette (matches logo)
   cyan   #22d3ee
   blue   #3b82f6
   violet #7c3aed
   teal   #2dd4bf
   ──────────────────────────────────────────────────────────── */

const TOOLS = [
  {
    icon: Wand2,
    title: "English → SQL",
    description:
      "Describe what you want in plain English. Get production-quality SQL with clause-by-clause explanations.",
    accent: "from-cyan-400 to-blue-500",
    href: "/tools",
  },
  {
    icon: BookOpen,
    title: "SQL → English",
    description:
      "Paste any query. Get a line-by-line breakdown with best practices and common pitfalls.",
    accent: "from-teal-400 to-emerald-500",
    href: "/tools",
  },
  {
    icon: PlayCircle,
    title: "Simulate",
    description:
      "Preview what a query would return without touching a real database — including errors and fixes.",
    accent: "from-amber-400 to-orange-500",
    href: "/tools",
  },
  {
    icon: MessageSquare,
    title: "Ask Anything",
    description:
      "General SQL questions, concept clarifications, small talk — streamed token by token.",
    accent: "from-blue-400 to-violet-500",
    href: "/tools",
  },
];

const FEATURES = [
  {
    icon: Database,
    title: "Grounded in real docs",
    description:
      "144 chunks of SQL documentation indexed in Pinecone. Every answer cites its source.",
  },
  {
    icon: Zap,
    title: "Streamed responses",
    description:
      "Token-by-token streaming so you see answers as they're generated. No waiting.",
  },
  {
    icon: Layers,
    title: "3-tier cache",
    description:
      "In-memory, SQLite, and semantic caching. Repeat questions are instant.",
  },
  {
    icon: Shield,
    title: "Self-correcting",
    description:
      "When SQL errors happen, the LLM detects, explains, and suggests fixes.",
  },
  {
    icon: Code2,
    title: "Multi-dialect",
    description: "PostgreSQL, MySQL, and SQLite. Switch dialects per question.",
  },
  {
    icon: Sparkles,
    title: "Zero setup",
    description: "No database, no CSV uploads, no configuration. Just ask.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Ask or paste",
    description:
      "Type an English question or paste a SQL query. Choose your dialect if it matters.",
  },
  {
    step: "02",
    title: "Retrieval + reasoning",
    description:
      "The system retrieves relevant SQL documentation and reasons over it with Groq.",
  },
  {
    step: "03",
    title: "Grounded answer",
    description:
      "You get SQL, explanations, and citations — with cache badges showing how fast it was.",
  },
];

const EXAMPLE_QUERIES = [
  {
    question: "Top 5 customers by revenue",
    sql: `SELECT u.user_id, u.full_name, SUM(o.total_amount) AS total
FROM users u
JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.full_name
ORDER BY total DESC
LIMIT 5;`,
  },
  {
    question: "Users with no orders",
    sql: `SELECT * FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM orders o
  WHERE o.user_id = u.user_id
);`,
  },
  {
    question: "Running total of orders",
    sql: `SELECT order_date, total_amount,
  SUM(total_amount) OVER (
    ORDER BY order_date
  ) AS running_total
FROM orders
ORDER BY order_date;`,
  },
];

const FAQ = [
  {
    q: "Do I need a database?",
    a: "No. QueryMentor simulates execution previews with an LLM instead of running queries against a real database.",
  },
  {
    q: "Which SQL dialects are supported?",
    a: "PostgreSQL, MySQL, and SQLite. Choose the dialect when you ask a question.",
  },
  {
    q: "How does it stay grounded?",
    a: "Retrieval-Augmented Generation: your question retrieves relevant chunks from the SQL reference, which the LLM uses to answer.",
  },
  {
    q: "Is my data stored?",
    a: "No. Questions and answers may be cached in-memory for performance, but nothing is persisted to a database.",
  },
];

export default function Home() {
  return (
    <div className="relative w-full overflow-hidden">
      {/* ═══════════════════════════════════════════════════════
          AURORA BACKGROUND — fixed behind everything
          ═══════════════════════════════════════════════════════ */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-violet-500/20 blur-[120px]" />
        <div className="absolute top-1/3 -left-32 h-96 w-96 rounded-full bg-violet-500/15 blur-[100px]" />
        <div className="absolute top-1/2 -right-32 h-96 w-96 rounded-full bg-cyan-500/15 blur-[100px]" />
      </div>

      <div className="container mx-auto max-w-7xl space-y-28 px-4 pb-24 w-full">
        {/* ═══════════════════════════════════════════════════════
            HERO — fits in 100vh minus navbar (3.5rem) and main padding (5rem)
            ═══════════════════════════════════════════════════════ */}
        <section className="relative flex min-h-[calc(100vh-8.5rem)] w-full flex-col items-center justify-center text-center">
          {/* animated grid overlay */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(to_right,#a1a1aa_1px,transparent_1px),linear-gradient(to_bottom,#a1a1aa_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
          />

          <Reveal>
            <Badge
              variant="outline"
              className="group relative mb-8 inline-flex items-center gap-2 overflow-hidden border-border/60 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-violet-500/10 px-3.5 py-1.5 text-muted-foreground backdrop-blur"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-400" />
              </span>
              <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-indigo-600 bg-clip-text font-medium text-transparent dark:from-cyan-400 dark:via-blue-400 dark:to-violet-400">
                Powered by RAG + Groq
              </span>
            </Badge>
          </Reveal>

          <h1 className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center gap-2 font-display text-5xl font-semibold leading-[1.02] tracking-tight md:text-8xl">
            <HeroText text="Your AI" delay={0.1} />
            <span className="relative inline-block">
              {/* soft glow behind the gradient text — dark mode only */}
              <span
                aria-hidden
                className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 opacity-40 blur-2xl dark:block"
              />
              {/*
                Plain text (not HeroText) so bg-clip-text clips through
                the characters. Different gradients per theme:
                - Light: deep blue/violet for contrast on white
                - Dark:  bright cyan/blue/violet matching the logo glow
              */}
              <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent dark:from-cyan-400 dark:via-blue-500 dark:to-violet-500">
                SQL&nbsp;Mentor
              </span>
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            className="mx-auto mt-8 w-full max-w-2xl text-center text-lg text-muted-foreground md:text-xl"
          >
            Write, explain, and simulate SQL queries in seconds. Grounded in
            real documentation. No database required.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.05, duration: 0.5 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-3"
          >
            {/* Primary CTA with shimmer */}
            <Button
              size="lg"
              render={<Link href="/tools" />}
              className="group relative overflow-hidden bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-7 text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30 hover:brightness-110"
            >
              <span className="relative z-10 flex flex-row items-center gap-2 whitespace-nowrap">
                Open SQL Tools
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
              {/* shimmer sweep */}
              <span
                aria-hidden
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              />
            </Button>

            {/* Secondary CTA */}
            <Button
              size="lg"
              variant="outline"
              render={<Link href="/tools#chat" />}
              className="border-border/60 bg-background/40 backdrop-blur transition-all hover:border-violet-500/50 hover:bg-violet-500/5"
            >
              <span className="flex flex-row items-center gap-2 whitespace-nowrap">
                Ask a question
              </span>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.5 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground"
          >
            {["No sign-up", "Free to use", "Open source"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />
                {t}
              </span>
            ))}
          </motion.div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            STATS STRIP — gradient-bordered
            ═══════════════════════════════════════════════════════ */}
        <Reveal>
          <section className="relative w-full">
            <div className="rounded-2xl bg-gradient-to-r from-cyan-500/40 via-blue-500/40 to-violet-500/40 p-[1px]">
              <div className="rounded-2xl bg-background/90 backdrop-blur">
                <div className="grid grid-cols-2 divide-x divide-border/60 md:grid-cols-4">
                  {[
                    { label: "Indexed chunks", value: 144 },
                    { label: "API endpoints", value: 4 },
                    { label: "Cache tiers", value: 3 },
                    { label: "Databases needed", value: 0 },
                  ].map((s) => (
                    <div key={s.label} className="px-6 py-8 text-center">
                      <div className="font-display text-3xl font-semibold md:text-4xl">
                        <span className="bg-gradient-to-br from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                          <StatCounter value={s.value} />
                        </span>
                      </div>
                      <div className="mt-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* ═══════════════════════════════════════════════════════
            FOUR TOOLS
            ═══════════════════════════════════════════════════════ */}
        <section className="w-full">
          <Reveal>
            <div className="mb-12 text-center">
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                <span className="h-px w-6 bg-gradient-to-r from-transparent to-violet-500/60" />
                Capabilities
                <span className="h-px w-6 bg-gradient-to-l from-transparent to-cyan-500/60" />
              </div>
              <h2 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
                Four tools,{" "}
                <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                  one interface
                </span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Everything you need to write, understand, and test SQL — in one
                place.
              </p>
            </div>
          </Reveal>

          <RevealStagger className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              return (
                <RevealItem key={t.title}>
                  <Link href={t.href} className="group block h-full">
                    <motion.div
                      whileHover={{ y: -6 }}
                      transition={{ duration: 0.25 }}
                      className="relative h-full"
                    >
                      <div
                        className={`pointer-events-none absolute -inset-[1px] rounded-xl bg-gradient-to-br ${t.accent} opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-30`}
                      />
                      <Card className="relative h-full border-border/60 bg-card/60 backdrop-blur transition-colors group-hover:border-transparent">
                        <CardHeader>
                          <div
                            className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${t.accent} p-[1px]`}
                          >
                            <div className="flex h-full w-full items-center justify-center rounded-xl bg-background">
                              <Icon className="h-4 w-4 text-foreground" />
                            </div>
                          </div>
                          <CardTitle className="flex items-center justify-between font-display text-lg">
                            {t.title}
                            <ArrowRight className="h-4 w-4 -translate-x-2 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                          </CardTitle>
                          <CardDescription className="pt-1.5 text-sm leading-relaxed">
                            {t.description}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    </motion.div>
                  </Link>
                </RevealItem>
              );
            })}
          </RevealStagger>
        </section>

        {/* ═══════════════════════════════════════════════════════
            FEATURES GRID
            ═══════════════════════════════════════════════════════ */}
        <section className="w-full">
          <Reveal>
            <div className="mb-12 text-center">
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                <span className="h-px w-6 bg-gradient-to-r from-transparent to-violet-500/60" />
                Under the hood
                <span className="h-px w-6 bg-gradient-to-l from-transparent to-cyan-500/60" />
              </div>
              <h2 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
                Built for{" "}
                <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                  real SQL work
                </span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Production-grade engineering behind a simple interface.
              </p>
            </div>
          </Reveal>

          <RevealStagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <RevealItem key={f.title}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="h-full"
                  >
                    <Card className="group h-full border-border/60 bg-card/40 backdrop-blur transition-all hover:border-violet-500/40 hover:bg-card/60 hover:shadow-lg hover:shadow-violet-500/5">
                      <CardHeader>
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-violet-500/10 transition-colors group-hover:border-violet-500/40">
                          <Icon className="h-4 w-4 text-foreground transition-colors group-hover:text-violet-400" />
                        </div>
                        <CardTitle className="text-base font-semibold">
                          {f.title}
                        </CardTitle>
                        <CardDescription className="pt-1.5 text-sm leading-relaxed">
                          {f.description}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </motion.div>
                </RevealItem>
              );
            })}
          </RevealStagger>
        </section>

        {/* ═══════════════════════════════════════════════════════
            HOW IT WORKS
            ═══════════════════════════════════════════════════════ */}
        <section className="w-full">
          <Reveal>
            <div className="mb-12 text-center">
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                <span className="h-px w-6 bg-gradient-to-r from-transparent to-violet-500/60" />
                Pipeline
                <span className="h-px w-6 bg-gradient-to-l from-transparent to-cyan-500/60" />
              </div>
              <h2 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
                How it{" "}
                <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                  works
                </span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Three steps, one grounded answer.
              </p>
            </div>
          </Reveal>

          <RevealStagger className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <RevealItem key={step.step}>
                <div className="group relative h-full overflow-hidden rounded-xl border border-border/60 bg-card/40 p-6 backdrop-blur transition-all hover:border-violet-500/40 hover:bg-card/60">
                  <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                  <div className="font-display text-5xl font-semibold">
                    <span className="bg-gradient-to-br from-cyan-400/60 via-blue-400/40 to-violet-400/60 bg-clip-text text-transparent">
                      {step.step}
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>

                  <div className="absolute top-6 right-6 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 font-mono text-[10px] text-muted-foreground">
                    {i + 1}
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </section>

        {/* ═══════════════════════════════════════════════════════
            EXAMPLE QUERIES
            ═══════════════════════════════════════════════════════ */}
        <section className="w-full">
          <Reveal>
            <div className="mb-12 text-center">
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                <span className="h-px w-6 bg-gradient-to-r from-transparent to-violet-500/60" />
                Examples
                <span className="h-px w-6 bg-gradient-to-l from-transparent to-cyan-500/60" />
              </div>
              <h2 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
                Real queries,{" "}
                <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                  real answers
                </span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                A sample of what you can ask.
              </p>
            </div>
          </Reveal>

          <RevealStagger className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {EXAMPLE_QUERIES.map((ex) => (
              <RevealItem key={ex.question}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  <Card className="group h-full overflow-hidden border-border/60 bg-card/40 backdrop-blur transition-all hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                        &ldquo;{ex.question}&rdquo;
                      </CardTitle>
                    </CardHeader>
                    <div className="px-6 pb-6">
                      <pre className="relative overflow-x-auto rounded-md border border-border/60 bg-background/80 p-3 text-xs leading-relaxed">
                        <code className="text-foreground/90">{ex.sql}</code>
                      </pre>
                    </div>
                  </Card>
                </motion.div>
              </RevealItem>
            ))}
          </RevealStagger>

          <Reveal delay={0.1}>
            <div className="mt-10 text-center">
              <Button
                variant="outline"
                render={<Link href="/tools" />}
                className="group border-border/60 bg-background/40 backdrop-blur transition-all hover:border-violet-500/50 hover:bg-violet-500/5"
              >
                <span className="flex flex-row items-center gap-2 whitespace-nowrap">
                  Try your own
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Button>
            </div>
          </Reveal>
        </section>

        {/* ═══════════════════════════════════════════════════════
            FAQ
            ═══════════════════════════════════════════════════════ */}
        <section className="w-full">
          <Reveal>
            <div className="mb-12 text-center">
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                <span className="h-px w-6 bg-gradient-to-r from-transparent to-violet-500/60" />
                FAQ
                <span className="h-px w-6 bg-gradient-to-l from-transparent to-cyan-500/60" />
              </div>
              <h2 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
                Frequently{" "}
                <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                  asked
                </span>
              </h2>
            </div>
          </Reveal>

          <RevealStagger className="mx-auto max-w-3xl space-y-3">
            {FAQ.map((item) => (
              <RevealItem key={item.q}>
                <details className="group rounded-lg border border-border/60 bg-card/40 p-5 backdrop-blur transition-colors hover:border-violet-500/40 hover:bg-card/60">
                  <summary className="cursor-pointer list-none font-medium marker:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {item.q}
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-transform group-open:rotate-45 group-open:border-violet-500/60 group-open:text-violet-400">
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                </details>
              </RevealItem>
            ))}
          </RevealStagger>
        </section>

        {/* ═══════════════════════════════════════════════════════
            FINAL CTA
            ═══════════════════════════════════════════════════════ */}
        <Reveal>
          <section className="relative w-full overflow-hidden rounded-3xl border border-border/60 p-[1px]">
            <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-cyan-500/40 via-blue-500/30 to-violet-500/40" />

            <div className="relative rounded-3xl bg-background/95 p-8 text-center backdrop-blur md:p-14">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
              >
                <div className="absolute -top-24 left-1/2 h-64 w-[500px] -translate-x-1/2 rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-500/30 blur-[80px]" />
              </div>

              <div className="relative mx-auto max-w-2xl">
                <h2 className="text-balance font-display text-3xl font-semibold tracking-tight md:text-5xl">
                  Ready to write{" "}
                  <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                    better SQL
                  </span>
                  ?
                </h2>
                <p className="mx-auto mt-5 text-pretty text-muted-foreground">
                  No sign-up. No credit card. Just open the tools and ask.
                </p>
                <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    size="lg"
                    render={<Link href="/tools" />}
                    className="group relative overflow-hidden bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-7 text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30 hover:brightness-110"
                  >
                    <span className="relative z-10 flex flex-row items-center gap-2 whitespace-nowrap">
                      Open SQL Tools
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <span
                      aria-hidden
                      className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                    />
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    render={
                      <a
                        href="https://github.com/Sheharyar-Sarmad/Query-Mentor"
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                    className="border-border/60 bg-background/40 backdrop-blur transition-all hover:border-violet-500/50 hover:bg-violet-500/5"
                  >
                    <span className="flex flex-row items-center gap-2 whitespace-nowrap">
                      Star on GitHub
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </Reveal>
      </div>
    </div>
  );
}