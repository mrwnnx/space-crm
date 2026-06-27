# Academy CRM — Documentation projet

> CRM interne (mono-tenant) inspiré du modèle **Frappe CRM** : gestion des leads, pipeline de deals, contacts, organisations, et timeline d'activité unifiée (email / WhatsApp / SMS / appels / notes).

---

## 1. Vue d'ensemble

Academy CRM est une application web qui outille le cycle commercial complet : capter un **lead**, le qualifier dans un pipeline Kanban, le **convertir en deal**, et suivre toute la relation (personnes, sociétés, échanges) sur une **timeline unifiée**.

- **Tenant** : mono-tenant, usage équipe interne. Les données sont partagées entre tous les utilisateurs authentifiés (pas de cloisonnement par utilisateur).
- **Persona** : équipe commerciale / admissions qui gère un flux de prospects.

---

## 2. Stack technique

| Couche | Techno |
|--------|--------|
| Framework | Next.js 16 (App Router) + React 19 |
| Langage | TypeScript (`strict`) |
| Style | Tailwind CSS 4 + tokens shadcn (oklch) |
| ORM / DB | Drizzle ORM + PostgreSQL (Supabase) |
| Auth | Supabase Auth (`@supabase/ssr`, email/password) |
| Email | Resend |
| WhatsApp / SMS | Twilio |
| Icônes | Hugeicons |
| Import CSV | Papaparse |
| Drag & drop | HTML5 natif (pas de librairie) |

---

## 3. Architecture

### 3.1 Les 3 couches

```
Server Component / Client Component
        │  (lecture)        │  (mutation)
        ▼                   ▼
  lib/queries.ts  ◄──  app/actions.ts        ← "use server"
        │                   │
        └────────┬──────────┘
                 ▼
            db/index.ts  →  db/schema.ts  →  PostgreSQL (Supabase)
```

- **`src/app/actions.ts`** — toutes les mutations (server actions `"use server"`). Valide grossièrement les entrées, appelle les queries, journalise une `activity`, puis `revalidatePath()`. Utilise des `await import()` dynamiques pour garder le module léger.
- **`src/lib/queries.ts`** — Data Access Layer. Toutes les fonctions de lecture/écriture Drizzle. `import "server-only"`.
- **`src/db/schema.ts`** — schéma Drizzle : 21 tables, enums Postgres, relations.
- **`src/db/index.ts`** — client Drizzle (connexion postgres-js, `prepare: false` pour le pooler Supabase en mode transaction).

### 3.2 Arborescence

```
src/
  app/
    (dashboard)/              — zone authentifiée (layout + sidebar)
      leads/  deals/          — liste (table + kanban) + [id] détail
      contacts/ organizations/— liste + [id] détail
      tasks/                  — board kanban + liste
      notes/ call-logs/       — grilles / tables
      calendar/ dashboard/    — vue mois + KPIs
      data-import/ settings/  — import CSV + templates email
    api/
      notifications/route.ts  — GET notifications (cloche)
      webhook/whatsapp/route.ts — POST entrant Twilio WhatsApp
    login/                    — page + actions (login/signup)
    actions.ts               — server actions (mutations)
  db/        schema.ts, index.ts
  lib/
    queries.ts               — DAL
    messaging/               — email.ts (Resend), sms.ts, whatsapp.ts (Twilio)
    supabase/                — server.ts (SSR), client.ts (browser)
    utils.ts                 — cn(), statusColor(), initials(), formatDate(), formatRelative()
  components/
    leads/ deals/ contacts/ organizations/ tasks/ notes/
    activities/              — timeline + composers (email/whatsapp/call/comment)
    data-import/ notifications/ settings/
    sidebar, page-header, data-table, form, search-bar, view-toggle, saved-views-dropdown
  proxy.ts                   — middleware Next 16 (garde d'auth)
```

---

## 4. Modèle de données

### 4.1 Entités principales

| Table | Rôle |
|-------|------|
| `leads` | Prospect brut (nom, email, mobile, statut, source, industrie, `converted`, `owner`). |
| `deals` | Opportunité chiffrée (valeur, probabilité, devise, dates, raison de perte). Lié à un lead + une org. |
| `contacts` | Personnes (répertoire). Liées à une organisation. |
| `organizations` | Sociétés (taille, CA, secteur, territoire). |
| `products` / `deal_products` | Catalogue + lignes de produits d'un deal. |
| `deal_contacts` | Liaison N-N deal ↔ contacts (avec `isPrimary`). |

### 4.2 Activité & suivi

| Table | Rôle |
|-------|------|
| `activities` | **Timeline unifiée** : type (email/whatsapp/sms/note/call/status_change/comment/task/webhook_in), direction (inbound/outbound), rattachée à `referenceType` + `referenceId`. |
| `tasks` | Tâches (priorité, statut kanban, échéance, assignation), rattachables à toute entité. |
| `notes` | Notes libres, rattachables à toute entité. |
| `comments` | Commentaires. |
| `call_logs` | Journal d'appels (Twilio/manuel, durée, enregistrement). |

### 4.3 Configuration & méta

| Table | Rôle |
|-------|------|
| `lead_statuses` / `deal_statuses` | Colonnes du Kanban (nom, couleur, position, `isDefault`). |
| `lead_sources` / `industries` / `territories` / `lost_reasons` | Listes de référence. |
| `email_templates` | Modèles d'email (variables `{{var}}`). |
| `view_settings` | Vues personnalisées sauvegardées (filtres, colonnes, kanban). |

### 4.4 Polymorphisme

Les tables transverses (`activities`, `tasks`, `notes`, `comments`, `call_logs`) utilisent un couple **`referenceType` (enum: lead/deal/contact/organization) + `referenceId` (uuid)** plutôt que des FK dédiées. Souple, mais sans contrainte d'intégrité référentielle sur ce lien.

---

## 5. Flux métier clés

### 5.1 Conversion Lead → Deal (`convertToDealAction`)

C'est le flux central. À partir d'un lead :

1. Si `organizationName` renseigné → **`getOrCreateOrganizationByName`** (déduplication par nom, `ilike`).
2. **Crée un contact** à partir des champs du lead.
3. Marque le lead `converted = true` et le lie à l'org.
4. **Crée le deal** (statut par défaut, données copiées depuis le lead).
5. Journalise une `activity` de type `status_change` sur le lead.
6. `revalidatePath` sur leads, deals, contacts, organizations.

### 5.2 Timeline & messagerie

- Chaque interaction (note, email, WhatsApp, SMS, appel, changement de statut) crée une `activity` rattachée à l'entité.
- Les **composers** (`components/activities/`) envoient via `lib/messaging/` :
  - `email.ts` → Resend + `renderTemplate()` (substitution `{{variable}}`).
  - `whatsapp.ts` / `sms.ts` → Twilio.
  - Chaque fonction retourne `{ ok, error?, id?/sid? }` et dégrade gracieusement si les secrets ne sont pas configurés.

### 5.3 Webhook WhatsApp entrant (`api/webhook/whatsapp`)

- Reçoit un POST `form-data` de Twilio (`From`, `Body`, `MessageSid`, `ProfileName`…).
- Cherche le lead correspondant par **les 8 derniers chiffres** du numéro (`ilike '%last8%'`).
- Crée une `activity` inbound + met à jour `lastContactedAt`.

### 5.4 Import CSV (`data-import`)

- Parsing client avec Papaparse, mapping colonnes → champs.
- `bulkImportLeadsAction` / `bulkImportContactsAction` : insertion ligne par ligne, **liste de champs figée côté serveur** (pas de mass-assignment), retourne `{ created, errors, total }`.

---

## 6. Authentification

- **Supabase Auth** (email/password).
- **`src/proxy.ts`** (middleware Next 16) : vérifie la session via `supabase.auth.getUser()` sur chaque requête (sauf assets statiques). Redirige vers `/login` si non authentifié, et vers `/leads` si déjà connecté sur `/login`.
- Clients Supabase : `lib/supabase/server.ts` (SSR, cookies) et `lib/supabase/client.ts` (browser).

---

## 7. Configuration (env)

Fichier `.env.local` (voir `.env.example`) :

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

---

## 8. Commandes

| Commande | Effet |
|----------|-------|
| `npm run dev` | Serveur de dev |
| `npm run build` | Build production |
| `npx tsc --noEmit` | Typecheck (vérif fiable du projet) |
| `npm run lint` | ESLint |
| `npx drizzle-kit generate` | Générer une migration depuis le schéma |
| `node apply-migration.mjs drizzle/XXXX.sql` | Appliquer une migration |

---

## 9. Conventions de code

- **Mutations = server actions** dans `app/actions.ts` ; **lectures = fonctions** dans `lib/queries.ts`.
- Après chaque mutation : `revalidatePath()` des routes impactées.
- **Whitelist de champs** sur les updates partiels (`update*FieldAction`) et l'import — protection anti mass-assignment.
- `import "server-only"` sur `db` et `queries`.
- Interactif client : `useTransition` pour les mutations optimistes ; Kanban en drag & drop HTML5 natif.
- Next 16 : `params` **et** `searchParams` sont des `Promise` (à `await`). Le middleware s'appelle `proxy.ts`.

---

## 10. État & limites connues

> Projet en construction active (≈13 phases). MVP fonctionnel, **pas encore durci pour la production avec données réelles.**

Points ouverts identifiés (voir audit qualité) :

- **Autorisation** : seul `proxy.ts` garde les routes ; les server actions / routes API / DAL ne revérifient pas l'utilisateur. Pas de scoping par `owner` (mono-tenant assumé).
- **Webhook WhatsApp** : pas de validation de signature Twilio ; et actuellement capté par le proxy (à exclure pour être joignable).
- **Validation** : `zod` présent mais inutilisé ; peu de validation de format.
- **Gestion d'erreur** : peu de `try/catch` hors couche messaging ; feedback UI limité.
- **Index DB** : manquants sur les colonnes de filtrage fréquentes (`activities`, `tasks`, `*.statusId`…).

---

*Documentation générée à partir d'une lecture du code source (schéma, DAL, actions, auth, messaging, webhook).*
