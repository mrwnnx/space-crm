# Academy CRM

CRM pour Space Academy — gestion des leads, pipeline Kanban, cohorts mensuelles, lead scoring, et séquences de relance automatisées.

## Stack
- Next.js 16 (App Router) + React 19
- Tailwind CSS 4
- Drizzle ORM + PostgreSQL (Supabase)
- HTML5 drag & drop natif (pas de librairie DnD)

## Commands
- `npm run dev` — dev server
- `npm run build` — production build
- `npx tsc --noEmit` — typecheck
- `npm run lint` — eslint
- `npx drizzle-kit push` — push schema to DB
- `npx drizzle-kit generate` — generate migration

## Next.js 16 notes
- `params` in pages/route handlers is a **Promise** — must await it
- Use `refresh()` from `next/cache` (not `router.refresh()`)
- Read `node_modules/next/dist/docs/` before changing framework patterns

## Architecture
```
src/
  app/
    (dashboard)/        — authenticated area with sidebar
      pipeline/         — Kanban board
      leads/[id]/       — lead detail + activity timeline
      cohorts/          — cohort management
      sequences/        — automated re-engagement
    api/webhook/elementor/  — Elementor form webhook receiver
    actions.ts          — server actions (mutations)
  db/
    schema.ts           — Drizzle schema (all tables)
    index.ts            — DB client
  lib/
    queries.ts          — DB query functions
    scoring.ts          — lead scoring logic
    utils.ts            — cn(), formatDate(), etc.
  components/
    kanban/             — Kanban board (drag & drop)
    leads/              — lead actions + activity feed
    cohorts/            — cohort list + create form
```

## Elementor webhook
Configure in Elementor Pro → Forms → Actions After Submit → Webhook:
```
URL: https://your-domain.com/api/webhook/elementor?secret=YOUR_SECRET
```
The webhook auto-maps common field names (name, email, phone, whatsapp, message).
