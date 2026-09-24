# QueryMentor — Client

Next.js frontend for QueryMentor, an AI-powered SQL assistant.

[![Live](https://img.shields.io/badge/demo-live-22d3ee?style=flat-square)](https://query-mentor-seven.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16.3.5-000000?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)

---

## 📦 Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16.3.5 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| UI Primitives | Base UI + Shadcn-style components |
| Animation | Framer Motion, GSAP |
| Code Editor | CodeMirror (`@uiw/react-codemirror`) |
| 3D | React Three Fiber + Drei |
| Utilities | next-themes, Sonner, Axios |
| Icons | Lucide React, React Icons |
| Package Manager | pnpm >= 9.15.0 |
| Runtime | Node.js >= 22.13.0 |

---

## 🚀 Setup

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.local.example .env.local
# fill in values — see Environment Variables below

# Run dev server
pnpm dev

# Production build
pnpm build
pnpm start

# Lint
pnpm lint
```

Dev server runs at `http://localhost:3000`.

---

## 📁 Structure

```text
client/
├── app/
│   ├── layout.tsx          # Root layout + OG metadata
│   ├── page.tsx            # Home page
│   ├── not-found.tsx       # Custom 404
│   ├── globals.css
│   └── tools/
│       ├── layout.tsx      # Tools metadata
│       └── page.tsx        # Tabs: Console / Learn / Chat
├── components/
│   ├── animations/         # HeroText, Reveal, StatCounter
│   ├── sql-tools/          # Console, Learn, Chat tabs
│   └── ui/                 # Base UI primitives
├── lib/
│   ├── api.ts              # Axios + SSE streaming
│   └── types.ts
└── public/
    ├── logo.png
    ├── meta_home_page.png
    └── meta_tool_page.png
```

---

## ⚙️ Environment Variables

`.env.local`:

| Variable | Example | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` | Backend API base URL |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Public site URL (used in metadata) |

---

## ☁️ Deployment (Vercel)

1. Import the repo into Vercel.
2. Set the **Root Directory** to `client`.
3. Under **Build & Development Settings**, clear the **Output Directory** field (leave it blank) so Vercel uses the Next.js default rather than a stale monorepo value.
4. Add `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_URL` in **Environment Variables**, pointing at the deployed backend URL.
5. Deploy. Subsequent pushes to the default branch redeploy automatically.

---

## 🔗 Links

| Resource | URL |
|---|---|
| Live Site | https://query-mentor-seven.vercel.app |
| Monorepo | https://github.com/Sheharyar-Sarmad/Query-Mentor |
| Issues | https://github.com/Sheharyar-Sarmad/Query-Mentor/issues |
| ai-zero-to-hero | https://github.com/Sheharyar-Sarmad/ai-zero-to-hero |
| Author | https://github.com/Sheharyar-Sarmad |
| LinkedIn | https://www.linkedin.com/in/sheharyar-sarmad-9b7736289/ |