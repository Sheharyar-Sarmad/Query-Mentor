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

const TOOLS = [
  {
    icon: Wand2,
    title: "English → SQL",
    description:
      "Describe what you want in plain English. Get production-quality SQL with clause-by-clause explanations.",
    accent: "text-indigo-400",
    href: "/tools",
  },
  {
    icon: BookOpen,
    title: "SQL → English",
    description:
      "Paste any query. Get a line-by-line breakdown with best practices and common pitfalls.",
    accent: "text-emerald-400",
    href: "/tools",
  },
  {
    icon: PlayCircle,
    title: "Simulate",
    description:
      "Preview what a query would return without touching a real database — including errors and fixes.",
    accent: "text-amber-400",
    href: "/tools",
  },
  {
    icon: MessageSquare,
    title: "Ask Anything",
    description:
      "General SQL questions, concept clarifications, small talk — streamed token by token.",
    accent: "text-sky-400",
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
    <div className="container mx-auto max-w-7xl px-4 space-y-24 pb-20 w-full overflow-hidden">
      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="pt-12 text-center w-full">
        <Reveal>
          <Badge
            variant="outline"
            className="mb-6 border-border bg-muted/40 text-muted-foreground"
          >
            <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Powered by RAG + Groq
          </Badge>
        </Reveal>

        <h1 className="mx-auto w-full max-w-4xl font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl flex flex-col items-center justify-center gap-2">
          <HeroText text="Your AI" delay={0.1} />
          <span className="text-indigo-400 inline-block">
            <HeroText text="SQL Mentor" delay={0.35} />
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="mx-auto mt-6 w-full max-w-2xl text-center text-lg text-muted-foreground md:text-xl"
        >
          Write, explain, and simulate SQL queries in seconds. Grounded in real
          documentation. No database required.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.5 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Button
            size="lg"
            render={<Link href="/tools" />}
            className="bg-accent hover:bg-accent/90 flex flex-row items-center justify-center whitespace-nowrap"
          >
            Open SQL Tools
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            render={<Link href="/tools#chat" />}
            className="flex flex-row items-center justify-center whitespace-nowrap"
          >
            Ask a question
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground"
        >
          {["No sign-up", "Free to use", "Open source"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              {t}
            </span>
          ))}
        </motion.div>
      </section>

      {/* ── STATS STRIP ─────────────────────────────────────── */}
      <Reveal>
        <section className="rounded-2xl border border-border bg-card/40 backdrop-blur w-full">
          <div className="grid grid-cols-2 divide-x divide-border md:grid-cols-4">
            {[
              { label: "Indexed chunks", value: 144 },
              { label: "API endpoints", value: 4 },
              { label: "Cache tiers", value: 3 },
              { label: "Databases needed", value: 0 },
            ].map((s) => (
              <div key={s.label} className="px-6 py-8 text-center">
                <div className="font-display text-3xl font-semibold">
                  <StatCounter value={s.value} />
                </div>
                <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ── FOUR TOOLS ──────────────────────────────────────── */}
      <section className="w-full">
        <Reveal>
          <div className="mb-10 text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Four tools, one interface
            </h2>
            <p className="mt-3 text-muted-foreground">
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
                <Link href={t.href} className="block h-full">
                  <motion.div
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="h-full"
                  >
                    <Card className="h-full border-border bg-card/40 backdrop-blur transition-colors hover:border-accent/50">
                      <CardHeader>
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background">
                          <Icon className={`h-4 w-4 ${t.accent}`} />
                        </div>
                        <CardTitle className="font-display text-lg">
                          {t.title}
                        </CardTitle>
                        <CardDescription className="pt-1 text-sm leading-relaxed">
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

      {/* ── FEATURES GRID ───────────────────────────────────── */}
      <section className="w-full">
        <Reveal>
          <div className="mb-10 text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Built for real SQL work
            </h2>
            <p className="mt-3 text-muted-foreground">
              Production-grade engineering behind a simple interface.
            </p>
          </div>
        </Reveal>

        <RevealStagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <RevealItem key={f.title}>
                <Card className="h-full border-border bg-card/40 backdrop-blur">
                  <CardHeader>
                    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background">
                      <Icon className="h-4 w-4 text-accent" />
                    </div>
                    <CardTitle className="text-base">{f.title}</CardTitle>
                    <CardDescription className="pt-1 text-sm leading-relaxed">
                      {f.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </RevealItem>
            );
          })}
        </RevealStagger>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section className="w-full">
        <Reveal>
          <div className="mb-10 text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              How it works
            </h2>
            <p className="mt-3 text-muted-foreground">
              Three steps, one grounded answer.
            </p>
          </div>
        </Reveal>

        <RevealStagger className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {HOW_IT_WORKS.map((step) => (
            <RevealItem key={step.step}>
              <div className="rounded-xl border border-border bg-card/40 p-6 backdrop-blur">
                <div className="font-display text-4xl font-semibold text-accent/40">
                  {step.step}
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </section>

      {/* ── EXAMPLE QUERIES ─────────────────────────────────── */}
      <section className="w-full">
        <Reveal>
          <div className="mb-10 text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Real queries, real answers
            </h2>
            <p className="mt-3 text-muted-foreground">
              A sample of what you can ask.
            </p>
          </div>
        </Reveal>

        <RevealStagger className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {EXAMPLE_QUERIES.map((ex) => (
            <RevealItem key={ex.question}>
              <Card className="h-full border-border bg-card/40 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    &ldquo;{ex.question}&rdquo;
                  </CardTitle>
                </CardHeader>
                <div className="px-6 pb-6">
                  <pre className="overflow-x-auto rounded-md border border-border bg-background/60 p-3 text-xs leading-relaxed">
                    <code>{ex.sql}</code>
                  </pre>
                </div>
              </Card>
            </RevealItem>
          ))}
        </RevealStagger>

        <Reveal delay={0.1}>
          <div className="mt-8 text-center">
            <Button
              variant="outline"
              render={<Link href="/tools" />}
              className="flex flex-row items-center justify-center whitespace-nowrap"
            >
              Try your own
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Reveal>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section className="w-full">
        <Reveal>
          <div className="mb-10 text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Frequently asked
            </h2>
          </div>
        </Reveal>

        <RevealStagger className="mx-auto max-w-3xl space-y-3">
          {FAQ.map((item) => (
            <RevealItem key={item.q}>
              <details className="group rounded-lg border border-border bg-card/40 p-5 backdrop-blur">
                <summary className="cursor-pointer list-none font-medium marker:hidden">
                  <span className="flex items-center justify-between">
                    {item.q}
                    <span className="text-muted-foreground transition-transform group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </details>
            </RevealItem>
          ))}
        </RevealStagger>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────── */}
      <Reveal>
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-accent/10 via-transparent to-sky-500/10 p-8 md:p-12 text-center backdrop-blur w-full">
          <div className="relative mx-auto max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl text-balance">
              Ready to write better SQL?
            </h2>
            <p className="mx-auto mt-4 text-muted-foreground text-pretty">
              No sign-up. No credit card. Just open the tools and ask.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                render={<Link href="/tools" />}
                className="bg-accent hover:bg-accent/90 flex flex-row items-center justify-center whitespace-nowrap"
              >
                Open SQL Tools
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                render={
                  <a
                    href="https://github.com/Sheharyar-Sarmad/ai-zero-to-hero"
                    target="_blank"
                    rel="noreferrer"
                  />
                }
                className="flex flex-row items-center justify-center whitespace-nowrap"
              >
                Star on GitHub
              </Button>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  );
}