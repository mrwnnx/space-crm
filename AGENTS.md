# Academy CRM

CRM — gestion des leads, deals, contacts, organizations, notes, tasks, call logs, activities, email templates, custom views, notifications, data import, dashboard, calendar.

## Stack
- Next.js 16 (App Router) + React 19
- Tailwind CSS 4 + shadcn tokens (oklch)
- Drizzle ORM + PostgreSQL (Supabase)
- Supabase Auth (@supabase/ssr)
- Resend (email) + Twilio (WhatsApp/SMS)
- HTML5 drag & drop natif (pas de librairie DnD)
- Hugeicons (@hugeicons/react + @hugeicons/core-free-icons)
- Papaparse (CSV import)

## Commands
- `npm run dev` — dev server
- `npm run build` — production build
- `npx tsc --noEmit` — typecheck
- `npm run lint` — eslint
- `npx drizzle-kit generate` — generate migration
- `node apply-migration.mjs drizzle/XXXX.sql` — apply migration

## Next.js 16 notes
- `params` in pages/route handlers is a **Promise** — must await it
- `searchParams` is also a **Promise** — must await it
- Use `refresh()` from `next/cache` (not `router.refresh()`)
- Middleware is now **Proxy** (`src/proxy.ts`, not `middleware.ts`)
- Read `node_modules/next/dist/docs/` before changing framework patterns

## Architecture
```
src/
  app/
    (dashboard)/        — authenticated area with sidebar
      leads/            — leads list (table + kanban) + [id] detail (All-in-One)
      deals/            — deals list (table + kanban) + [id] detail
      contacts/         — contacts list + [id] detail
      organizations/    — organizations list + [id] detail
      notes/            — notes grid
      tasks/            — tasks board (kanban) + list
      call-logs/        — call logs table
      calendar/         — month grid + agenda
      dashboard/        — KPIs + recent leads + overdue tasks
      data-import/      — CSV import (leads/contacts)
      settings/         — email templates + provider status
    api/
      notifications/    — GET notifications for bell icon
    login/              — auth page + actions
    actions.ts          — server actions (all mutations)
    proxy.ts            — auth guard (Supabase session check)
  db/
    schema.ts           — Drizzle schema (21 tables)
    index.ts            — DB client
  lib/
    queries.ts          — DB query functions (all entities)
    messaging/          — email (Resend) + whatsapp + sms (Twilio)
    supabase/           — SSR + browser clients
    utils.ts            — cn(), statusColor(), initials(), formatDate()
  components/
    activities/         — ActivityPanel + EmailComposer + WhatsAppComposer + CallLogger + CommentBox + Timeline
    leads/              — list + kanban + detail header + side panel + new button
    deals/              — list + kanban + detail header + side panel
    contacts/           — new contact button
    organizations/      — new org button
    tasks/              — board + linked tasks + new button
    notes/              — new note button
    data-import/        — CSV importer
    notifications/      — notification bell
    settings/           — email templates manager
    sidebar.tsx         — navigation
    page-header.tsx     — reusable header
    data-table.tsx      — reusable table
    form.tsx            — form primitives (NewEntityButton, Input, Select, etc.)
    search-bar.tsx      — debounced search
    view-toggle.tsx     — list/kanban toggle
    saved-views-dropdown.tsx — custom saved views
```

## Auth
- Supabase Auth (email/password)
- `src/proxy.ts` guards all routes except `/login`
- Session via @supabase/ssr cookies
- Server client: `src/lib/supabase/server.ts`
- Browser client: `src/lib/supabase/client.ts`

## Env variables (.env.local)
```
DATABASE_URL=postgres://postgres.<ref>:<pass>@aws-*.pooler.supabase.com:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
RESEND_API_KEY=...
EMAIL_FROM="CRM <noreply@...>"
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+...
TWILIO_SMS_FROM=+...
```
