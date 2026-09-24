import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { Toaster } from "sonner";
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

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://query-mentor-seven.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "QueryMentor — Your AI SQL Mentor",
    template: "%s · QueryMentor",
  },
  description:
    "Write, explain, and simulate SQL queries in seconds. Powered by RAG and Groq.",
  applicationName: "QueryMentor",
  keywords: [
    "SQL",
    "AI SQL assistant",
    "text to SQL",
    "SQL to text",
    "SQL simulator",
    "RAG",
    "Groq",
    "Pinecone",
    "FastAPI",
    "QueryMentor",
  ],
  authors: [{ name: "Sheharyar Sarmad" }],
  creator: "Sheharyar Sarmad",
  publisher: "Sheharyar Sarmad",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "QueryMentor",
    title: "QueryMentor — Your AI SQL Mentor",
    description:
      "Write, explain, and simulate SQL queries in seconds. Powered by RAG and Groq.",
    images: [
      {
        url: "/meta_home_page.png",
        width: 1200,
        height: 630,
        alt: "QueryMentor — Your AI SQL Mentor",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QueryMentor — Your AI SQL Mentor",
    description:
      "Write, explain, and simulate SQL queries in seconds. Powered by RAG and Groq.",
    images: ["/meta_home_page.png"],
    creator: "@sheharyarsarmad",
  },
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const NAV = [
  { href: "/", label: "Home" },
  { href: "/tools", label: "SQL Tools" },
];

const SOCIALS = [
  {
    href: "https://github.com/Sheharyar-Sarmad/Query-Mentor",
    label: "GitHub",
    Icon: FaGithub,
  },
  {
    href: "https://www.linkedin.com/in/sheharyar-sarmad-9b7736289/",
    label: "LinkedIn",
    Icon: FaLinkedin,
  },
];

const FOOTER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/tools", label: "SQL Tools" },
  {
    href: "https://github.com/Sheharyar-Sarmad/Query-Mentor",
    label: "Source Code",
    external: true,
  },
  {
    href: "https://github.com/Sheharyar-Sarmad/Query-Mentor/issues",
    label: "Report Issue",
    external: true,
  },
  {
    href: "https://www.linkedin.com/in/sheharyar-sarmad-9b7736289/",
    label: "LinkedIn",
    external: true,
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
                <img
                  src="/logo.png"
                  alt="QueryMentor logo"
                  className="h-6 w-6 rounded"
                />
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
          <main className="relative mx-auto flex w-full max-w-screen-2xl flex-1 flex-col min-w-0 px-4 py-10 md:px-8">
            <MotionProviders>{children}</MotionProviders>
          </main>

          {/* Footer */}
          <footer className="relative border-t border-border">
            <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4 py-8 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
              {/* Left: brand + credit */}
              <div className="flex flex-col gap-2">
                <Link
                  href="/"
                  className="flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                  <img
                    src="/logo.png"
                    alt="QueryMentor logo"
                    className="h-5 w-5 rounded"
                  />
                  <span>
                    Query<span className="text-accent">Mentor</span>
                  </span>
                </Link>
                <span>Built by Sheharyar Sarmad</span>
                <span>RAG · Groq · Pinecone · FastAPI</span>
              </div>

              {/* Middle: quick links */}
              <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {FOOTER_LINKS.map((link) =>
                  link.external ? (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  )
                )}
              </nav>

              {/* Right: social icons */}
              <div className="flex items-center gap-2">
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
              </div>
            </div>
          </footer>

          <Toaster theme="dark" position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}