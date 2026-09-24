import Link from "next/link";
import { ArrowLeft, Home, Search, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const QUICK_LINKS = [
  {
    icon: Home,
    title: "Home",
    description: "Back to the landing page",
    href: "/",
  },
  {
    icon: Terminal,
    title: "SQL Tools",
    description: "Open the SQL console, learn mode, and chat",
    href: "/tools",
  },
];

export default function NotFound() {
  return (
    <div className="container mx-auto flex min-h-[70vh] max-w-4xl flex-col items-center justify-center px-4 py-16 text-center">
      {/* ── BADGE ─────────────────────────────────────────── */}
      <Badge
        variant="outline"
        className="mb-6 border-border bg-muted/40 text-muted-foreground"
      >
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
        404 — Page not found
      </Badge>

      {/* ── BIG 404 ───────────────────────────────────────── */}
      <h1 className="font-display text-7xl font-semibold leading-none tracking-tight text-foreground md:text-9xl">
        4
        <span className="inline-block text-indigo-400">0</span>
        4
      </h1>

      <p className="mt-6 max-w-xl text-lg text-muted-foreground md:text-xl">
        We couldn&apos;t find the page you were looking for. It may have been
        moved, deleted, or never existed.
      </p>

      {/* ── PRIMARY ACTIONS ───────────────────────────────── */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Button
          size="lg"
          render={<Link href="/" />}
          className="bg-accent hover:bg-accent/90 flex flex-row items-center justify-center gap-2 whitespace-nowrap"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Button>
        <Button
          size="lg"
          variant="outline"
          render={<Link href="/tools" />}
          className="flex flex-row items-center justify-center gap-2 whitespace-nowrap"
        >
          <Terminal className="h-4 w-4" />
          Open SQL Tools
        </Button>
      </div>

      {/* ── QUICK LINKS ───────────────────────────────────── */}
      <div className="mt-14 w-full">
        <p className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">
          Or try one of these
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.title} href={link.href} className="block h-full">
                <Card className="h-full border-border bg-card/40 backdrop-blur transition-colors hover:border-accent/50">
                  <CardHeader className="text-left">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background">
                      <Icon className="h-4 w-4 text-accent" />
                    </div>
                    <CardTitle className="font-display text-base">
                      {link.title}
                    </CardTitle>
                    <CardDescription className="pt-1 text-sm leading-relaxed">
                      {link.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── HINT ──────────────────────────────────────────── */}
      <div className="mt-12 flex items-center gap-2 text-xs text-muted-foreground">
        <Search className="h-3.5 w-3.5" />
        <span>
          Looking for something specific? Check the{" "}
          <Link
            href="https://github.com/Sheharyar-Sarmad/Query-Mentor"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            source code
          </Link>{" "}
          or{" "}
          <Link
            href="https://github.com/Sheharyar-Sarmad/Query-Mentor/issues"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            open an issue
          </Link>
          .
        </span>
      </div>
    </div>
  );
}