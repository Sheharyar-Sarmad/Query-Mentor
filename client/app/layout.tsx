import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { Toaster } from "sonner";
import { Sparkles } from "lucide-react";
import { FaGithub, FaLinkedin } from "react-icons/fa";

import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThreeBackground } from "@/components/three-bg";
import { MotionProviders } from "@/components/motion-providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "QueryMentor — Your AI SQL Mentor",
  description:
    "Write, explain, and simulate SQL queries in seconds. Powered by RAG and Groq.",
};

const NAV = [
  { href: "/", label: "Home" },
  { href: "/tools", label: "SQL Tools" },
];

const SOCIALS = [
  {
    href: "https://github.com/Sheharyar-Sarmad/ai-zero-to-hero",
    label: "GitHub",
    Icon: FaGithub,
  },
  {
    href: "https://www.linkedin.com/in/sheharyar-sarmad-9b7736289/",
    label: "LinkedIn",
    Icon: FaLinkedin,
  },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground overflow-x-hidden">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ThreeBackground />

          {/* Header — full width, padded */}
          <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
            <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between px-4 md:px-8">
              <Link
                href="/"
                className="flex items-center gap-2 text-lg font-semibold tracking-tight"
              >
                <Sparkles className="h-4 w-4 text-accent" />
                <span>
                  Query<span className="text-accent">Mentor</span>
                </span>
              </Link>

              <nav className="flex items-center gap-1 text-sm">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}

                <div className="ml-2 flex items-center gap-1 border-l border-border pl-2">
                  {SOCIALS.map(({ href, label, Icon }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={label}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  ))}
                  <ThemeToggle />
                </div>
              </nav>
            </div>
          </header>

          {/* Main — full width, wider padding */}
          {/* Added min-w-0 and flex-col to prevent flexbox horizontal overflow */}
          <main className="relative mx-auto flex w-full max-w-screen-2xl flex-1 flex-col min-w-0 px-4 py-10 md:px-8">
            <MotionProviders>{children}</MotionProviders>
          </main>

          {/* Footer */}
          <footer className="relative border-t border-border">
            <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-4 py-6 text-xs text-muted-foreground md:px-8">
              <span>Built by Sheharyar Sarmad</span>
              <span>RAG · Groq · Pinecone · FastAPI</span>
            </div>
          </footer>

          <Toaster theme="dark" position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}