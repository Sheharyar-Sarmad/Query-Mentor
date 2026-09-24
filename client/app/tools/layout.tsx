import type { Metadata } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://query-mentor-seven.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "SQL Tools",
  description:
    "Write, simulate, and understand SQL — all in one place. Console, learn mode, and AI chat powered by RAG + Groq.",
  keywords: [
    "SQL tools",
    "SQL console",
    "SQL simulator",
    "text to SQL",
    "SQL to text",
    "AI SQL",
    "QueryMentor",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/tools",
    siteName: "QueryMentor",
    title: "SQL Tools · QueryMentor",
    description:
      "Write, simulate, and understand SQL — all in one place.",
    images: [
      {
        url: "/meta_tool_page.png",
        width: 1200,
        height: 630,
        alt: "QueryMentor SQL Tools — Console, Learn, and Chat",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SQL Tools · QueryMentor",
    description: "Write, simulate, and understand SQL — all in one place.",
    images: ["/meta_tool_page.png"],
    creator: "@sheharyarsarmad",
  },
  alternates: {
    canonical: "/tools",
  },
};

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}