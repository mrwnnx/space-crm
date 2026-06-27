# Academy CRM — Audit lecture seule (avant pivot formation-centric)

> Mode AUDIT. Aucun fichier modifié, aucune migration lancée, aucun code écrit.
> Source : `src/db/schema.ts`, `src/lib/queries.ts`, `src/app/actions.ts`, `src/proxy.ts`, `src/db/index.ts`, `src/app/api/webhook/whatsapp/route.ts`, `src/app/login/actions.ts`, `drizzle/`. État DB vérifié en live.

---

## 1. Schéma réel (`src/db/schema.ts`)

### 1.1 Enums Postgres définis

| Enum | Valeurs |
|------|---------|
| `task_priority` | `low`, `medium`, `high` |
| `task_status` | `backlog`, `todo`, `in_progress`, `done`, `canceled` |
| `call_status` | `initiated`, `ringing`, `in_progress`, `completed`, `failed`, `busy`, `no_answer`, `queued`, `canceled` |
| `call_type` | `incoming`, `outgoing` |
| `telephony_medium` | `manual`, `twilio`, `exotel` |
| `employee_size` | `1-10`, `11-50`, `51-200`, `201-500`, `501-1000`, `1000+` |
| `view_type` | `list`, `kanban`, `group_by` |
| `activity_type` | `email`, `whatsapp`, `sms`, `note`, `call`, `status_change`, `comment`, `task`, `webhook_in` |
| `activity_direction` | `inbound`, `outbound` |
| `reference_type` | `lead`, `deal`, `contact`, `organization` |
| `bootcamp_status` | `draft`, `open`, `in_progress`, `completed`, `cancelled` |
| `notification_type` | `lead_assigned`, `lead_status_change`, `deal_status_change`, `task_assigned`, `task_due`, `comment`, `mention` |

### 1.2 Tables (nom, PK, FK)

Colonnes au format `nom: typeDrizzle [NOT NULL?] [default]`. Toutes les PK sont `uuid default gen_random_uuid()`.

**`bootcamps`** (lignes 100-111)
- `id: uuid PK defaultRandom`
- `name: text NOT NULL`
- `slug: text NOT NULL UNIQUE`
- `description: text` (nullable)
- `startDate: date` (nullable) — colonne `start_date`
- `endDate: date` (nullable) — `end_date`
- `status: bootcamp_status NOT NULL default 'open'`
- `capacity: integer` (nullable)
- `createdAt: timestamp NOT NULL default now()` — `created_at`
- `updatedAt: timestamp NOT NULL default now()` — `updated_at`
- FK : aucune. Contrainte UNIQUE sur `slug`.

**`lead_statuses`** (lignes 115-122) — pipeline kanban des leads
- `id: uuid PK`
- `name: text NOT NULL`
- `color: text NOT NULL default 'gray'`
- `position: integer NOT NULL default 0`
- `isDefault: boolean NOT NULL default false` — `is_default`
- `bootcampId: uuid → bootcamps.id` — `bootcamp_id` (nullable en Drizzle, **NOT NULL en DB** après migration 0002)
- FK : `bootcamp_id → bootcamps.id`

**`deal_statuses`** (lignes 124-130) — pipeline kanban des deals
- `id, name, color, position, isDefault` (identique à `lead_statuses` mais sans `bootcampId`)
- FK : aucune. **Pas de lien avec `bootcamps`** — les deals ne sont pas scopés par formation.

**`lead_sources` / `industries` / `lost_reasons` / `territories`** (lignes 132-150) — listes de référence
- `id: uuid PK`, `name: text NOT NULL` — c'est tout. Aucune FK sortante.

**`organizations`** (lignes 154-167)
- `id: uuid PK`
- `name: text NOT NULL`
- `website, logo, address: text` (nullables)
- `noOfEmployees: employee_size` (nullable) — `no_of_employees`
- `annualRevenue: numeric` (nullable) — `annual_revenue`
- `industryId: uuid → industries.id` (nullable)
- `territoryId: uuid → territories.id` (nullable)
- `currency: text default 'EUR'`
- `createdAt, updatedAt: timestamp NOT NULL default now()`
- FK : `industry_id`, `territory_id`

**`contacts`** (lignes 169-183)
- `id: uuid PK`
- `salutation, firstName, lastName, fullName NOT NULL, email, mobileNo, phone, gender, image: text`
- `organizationId: uuid → organizations.id` (nullable)
- `createdAt, updatedAt: timestamp NOT NULL default now()`
- FK : `organization_id`. **Aucune contrainte UNIQUE sur `email` ou `mobileNo`** (confirmé en DB — voir §8).

**`leads`** (lignes 187-210) — définition COMPLÈTE demandée
- `id: uuid PK defaultRandom`
- `salutation: text` (nullable)
- `firstName: text` (nullable) — `first_name`
- `lastName: text` (nullable) — `last_name`
- `fullName: text NOT NULL` — `full_name`
- `email: text` (nullable)
- `mobileNo: text` (nullable) — `mobile_no`
- `phone: text` (nullable)
- `website: text` (nullable)
- `image: text` (nullable)
- `jobTitle: text` (nullable) — `job_title`
- `organizationName: text` (nullable) — `organization_name` (texte libre, dupliqué avec la FK ci-dessous)
- `organizationId: uuid → organizations.id` (nullable) — `organization_id`
- `bootcampId: uuid → bootcamps.id` (nullable en Drizzle, **NOT NULL en DB**) — `bootcamp_id`
- `statusId: uuid → leadStatuses.id` (nullable) — `status_id`
- `sourceId: uuid → leadSources.id` (nullable) — `source_id`
- `industryId: uuid → industries.id` (nullable) — `industry_id`
- `owner: text` (nullable)
- `converted: boolean NOT NULL default false`
- `lastContactedAt: timestamp` (nullable) — `last_contacted_at`
- `createdAt: timestamp NOT NULL default now()`
- `updatedAt: timestamp NOT NULL default now()`
- FK : `organization_id`, `bootcamp_id`, `status_id`, `source_id`, `industry_id`. **Pas d'UNIQUE sur email/mobile.**

**`deals`** (lignes 214-243) — définition COMPLÈTE demandée
- `id: uuid PK`
- `leadId: uuid → leads.id` (nullable) — `lead_id`
- `organizationId: uuid → organizations.id` (nullable)
- `statusId: uuid → dealStatuses.id` (nullable)
- `sourceId: uuid → leadSources.id` (nullable)
- `industryId: uuid → industries.id` (nullable)
- `territoryId: uuid → territories.id` (nullable)
- `probability: numeric default '0'`
- `dealValue: numeric default '0'` — `deal_value`
- `expectedDealValue: numeric` (nullable) — `expected_deal_value`
- `annualRevenue: numeric` (nullable)
- `currency: text default 'EUR'`
- `exchangeRate: numeric default '1'` — `exchange_rate`
- `owner: text` (nullable)
- `nextStep: text` (nullable) — `next_step`
- `lostReasonId: uuid → lostReasons.id` (nullable) — `lost_reason_id`
- `lostNotes: text` (nullable) — `lost_notes`
- `expectedClosureDate: date` (nullable) — `expected_closure_date`
- `closedDate: date` (nullable) — `closed_date`
- `firstName, lastName, email, mobileNo, phone, jobTitle, website: text` (nullables) — **copie dénormalisée du lead**
- `createdAt, updatedAt: timestamp NOT NULL default now()`
- FK : `lead_id`, `organization_id`, `status_id`, `source_id`, `industry_id`, `territory_id`, `lost_reason_id`. **Aucun `bootcampId`.**

**`deal_contacts`** (lignes 245-254) — liaison N-N deal↔contact
- `id: uuid PK`
- `dealId: uuid NOT NULL → deals.id (onDelete cascade)`
- `contactId: uuid NOT NULL → contacts.id (onDelete cascade)`
- `isPrimary: boolean NOT NULL default false` — `is_primary`

**`products`** (lignes 258-266) : `id, name NOT NULL, description, image, price numeric default '0', currency default 'EUR', createdAt`.
**`deal_products`** (lignes 268-279) : `id, dealId NOT NULL cascade, productId NOT NULL cascade, qty default '1', rate default '0', amount default '0'`.

**`tasks`** (lignes 283-297) — définition COMPLÈTE demandée
- `id: uuid PK`
- `title: text NOT NULL`
- `priority: task_priority NOT NULL default 'medium'`
- `status: task_status NOT NULL default 'todo'`
- `assignedTo: text` (nullable) — `assigned_to`
- `startDate: date` (nullable) — `start_date`
- `dueDate: timestamp` (nullable) — `due_date`
- `description: text` (nullable)
- `referenceType: reference_type` (nullable) — **polymorphique**
- `referenceId: uuid` (nullable) — `reference_id`
- `createdBy: text` (nullable) — `created_by`
- `createdAt, updatedAt: timestamp NOT NULL default now()`
- FK : **aucune FK sur `referenceId`** (lien polymorphique sans contrainte).

**`notes`** (lignes 301-310) — définition COMPLÈTE demandée
- `id: uuid PK`
- `title: text` (nullable)
- `content: text NOT NULL`
- `referenceType: reference_type` (nullable)
- `referenceId: uuid` (nullable)
- `createdBy: text` (nullable)
- `createdAt, updatedAt: timestamp NOT NULL default now()`
- FK : aucune sur `referenceId`.

**`call_logs`** (lignes 314-333) — définition COMPLÈTE demandée
- `id: uuid PK`
- `fromNumber, toNumber: text` (nullables)
- `status: call_status NOT NULL default 'initiated'`
- `type: call_type NOT NULL default 'outgoing'`
- `telephonyMedium: telephony_medium NOT NULL default 'manual'`
- `startTime, endTime: timestamp` (nullables)
- `duration: integer default 0`
- `recordingUrl: text` (nullable)
- `callerId, receiverId: text` (nullables)
- `noteId: uuid → notes.id` (nullable) — `note_id`
- `referenceType: reference_type` (nullable)
- `referenceId: uuid` (nullable)
- `createdAt: timestamp NOT NULL default now()`
- FK : `note_id → notes.id` + aucune sur `referenceId`.

**`comments`** (lignes 337-344)
- `id: uuid PK`, `content: text NOT NULL`, `referenceType: reference_type`, `referenceId: uuid`, `createdBy: text`, `createdAt: timestamp NOT NULL default now()`. Aucune FK sur `referenceId`.

**`activities`** (lignes 348-360) — timeline unifiée, définition COMPLÈTE demandée
- `id: uuid PK`
- `referenceType: reference_type` (nullable)
- `referenceId: uuid` (nullable)
- `type: activity_type NOT NULL`
- `direction: activity_direction NOT NULL default 'outbound'`
- `subject: text` (nullable)
- `content: text` (nullable)
- `createdBy: text` (nullable) — `created_by`
- `createdAt: timestamp NOT NULL default now()`
- FK : aucune sur `referenceId`. **Pas de colonne `oldValue`/`newValue`** — voir §3.

**`email_templates`** (lignes 364-371) : `id, name NOT NULL, subject, content NOT NULL, createdAt, updatedAt`.
**`view_settings`** (lignes 375-397) : `id, label NOT NULL, routeName NOT NULL, doctype NOT NULL, type viewType default 'list', columns jsonb, filters jsonb, orderBy jsonb, groupByField, columnField, kanbanColumns jsonb, kanbanFields jsonb, titleField, userId, public NOT NULL default false, pinned NOT NULL default false, isDefault NOT NULL default false, isStandard NOT NULL default false, icon, createdAt, updatedAt`.
**`notifications`** (lignes 411-420) : `id, type notification_type NOT NULL, message NOT NULL, referenceType, referenceId, userId, read NOT NULL default false, createdAt`.

### 1.3 Comptes de lignes réels en DB (vérifié live)
```
leads: 3 | contacts: 2 | deals: 2 | organizations: 2
activities: 17 | tasks: 1 | notes: 0 | comments: 0 | call_logs: 0
bootcamps: 2 | lead_statuses: 11 | deal_statuses: 6
email_templates: 0 | notifications: 5 | products/deal_products/deal_contacts: 0
```
Données réelles minimales (test), pas de seed.

---

## 2. Relations Drizzle (lignes 424-560)

Relations déclarées (toutes avec `fields`/`references` explicites) :

| Relation | Type | Champs |
|----------|------|--------|
| `bootcamps → leadStatuses` | many | — |
| `bootcamps → leads` | many | — |
| `leadStatuses → bootcamp` | one | `leadStatuses.bootcampId → bootcamps.id` |
| `leadStatuses → leads` | many | — |
| `dealStatuses → deals` | many | — |
| `leadSources → leads / deals` | many | — |
| `industries → leads / deals / organizations` | many | — |
| `territories → organizations / deals` | many | — |
| `lostReasons → deals` | many | — |
| `organizations → industry / territory` | one | `industryId`, `territoryId` |
| `organizations → contacts / leads / deals` | many | — |
| `contacts → organization` | one | `contacts.organizationId → organizations.id` |
| `contacts → dealContacts` | many | — |
| `leads → bootcamp / status / source / industry / organization` | one | resp. |
| `leads → deals` | many | — |
| `deals → lead / organization / status / source / industry / territory / lostReason` | one | resp. |
| `deals → dealContacts / dealProducts` | many | — |
| `dealContacts → deal / contact` | one | resp. (cascade) |
| `dealProducts → deal / product` | one | resp. (cascade) |

**FK en base SANS relation Drizzle correspondante :**
- `callLogs.noteId → notes.id` : FK déclarée dans la table (schema.ts:329) mais **aucune relation Drizzle** `callLogsRelations` n'existe. → pas de `with: { note: true }` possible.
- **Aucune relation Drizzle pour `activities`, `tasks`, `notes`, `comments`, `notifications`** — logique car leur rattachement est polymorphique (pas de FK). Mais conséquence : impossible de faire `db.query.activities.findMany({ with: { lead: true } })`.
- Inverse : aucune relation déclarée sans FK sous-jacente.

---

## 3. Polymorphisme (`referenceType` / `referenceId`)

**Enum `reference_type` (exact) : `lead`, `deal`, `contact`, `organization`.** (schema.ts:83-88)

**Tables polymorphiques** (toutes avec `referenceType: reference_type` nullable + `referenceId: uuid` nullable, **sans FK**) :
- `activities` (lignes 350-351)
- `tasks` (lignes 292-293)
- `notes` (lignes 305-306)
- `comments` (lignes 340-341)
- `call_logs` (lignes 330-331) — a aussi `noteId` qui, lui, est une vraie FK
- `notifications` (lignes 415-416)

Aucune contrainte d'intégrité référentielle sur ces liens : un `referenceId` peut pointer vers une entité supprimée (dangling).

### `status_change` et l'analytics de délai — **CRITIQUE**

Le type `status_change` **existe bien** dans `activity_type` (schema.ts:72). Il est loggé dans deux actions :

1. `updateLeadStatusAction` (actions.ts:142-168) — changement de statut kanban d'un lead :
   ```ts
   await createActivity({
     referenceType: "lead",
     referenceId: leadId,
     type: "status_change",
     direction: "outbound",
     subject: "Statut modifié",
     content: `Nouveau statut: ${lead?.statusId ?? statusId}`,
   });
   ```
2. `convertToDealAction` (actions.ts:237-244) — conversion lead→deal :
   ```ts
   subject: "Converti en Deal",
   content: `Contact ${contact.fullName} créé + Deal créé${...}`,
   ```

**Ce qui est stocké :** `subject` (texte libre) + `content` (texte libre). **AUCUNE colonne `oldValue` / `newValue` / `previousStatusId` / `newStatusId`.** Le nouveau statut est inséré dans `content` sous forme de string `"Nouveau statut: <uuid>"` (l'UUID du statut, pas même son nom). L'ancien statut **n'est pas du tout conservé**.

**Conséquence pour ton analytics de délai :** pour calculer un temps écoulé entre deux statuts, tu dois aujourd'hui parser le texte `content` (fragile, format non garanti) et croiser avec l'`createdAt` des activités `status_change` ordonnées. Il manque : l'identifiant explicite du statut avant/après. Recommandé en §9.

---

## 4. Conversion actuelle (`convertToDealAction`)

**Signature** (actions.ts:190) : `export async function convertToDealAction(leadId: string)`

**Étapes exactes :**
1. `getLeadById(leadId)` — si null, return.
2. Si `lead.organizationName` renseigné → `getOrCreateOrganizationByName(lead.organizationName)` → `organizationId`. Si `lead.industryId` existe → `updateOrganizationQuery(org.id, { industryId })`.
3. `createContactQuery({ firstName, lastName, fullName, email, mobileNo, phone, organizationId })` — **crée un contact systématiquement, sans dédup** (voir §7).
4. `updateLeadQuery(leadId, { converted: true, organizationId })` — marque le lead converti et le lie à l'org.
5. `getDefaultDealStatus()` → `createDealQuery({ leadId, organizationId, statusId, firstName, lastName, email, mobileNo, phone, website, sourceId, industryId })` — **copie dénormalisée des champs du lead dans le deal**.
6. `createActivity({ referenceType:"lead", referenceId:leadId, type:"status_change", subject:"Converti en Deal", content:... })`.
7. `revalidatePath` sur `/leads/${leadId}`, `/leads`, `/deals`, `/deals/${deal.id}`, `/contacts`, `/organizations`.

**`getOrCreateOrganizationByName`** (queries.ts:540-546) — implémentation exacte :
```ts
export async function getOrCreateOrganizationByName(name: string) {
  const existing = await db.query.organizations.findFirst({
    where: ilike(organizations.name, name),
  });
  if (existing) return existing;
  return createOrganization({ name });
}
```
Pattern de déduplication : `ilike` (insensible à la casse) sur `name`, sinon création. **Réutilisable pour les contacts** mais attention : `ilike` sans normalisation (pas de trim/lower) — "Acme" et " acme " ne matcheront pas. Et aucune contrainte UNIQUE en base pour garantir l'unicité en cas de concurrence.

---

## 5. Conventions DAL / actions

### Fonction de lecture type — `getContactById` (queries.ts:410-442)
```ts
export async function getContactById(id: string) {
  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.id, id),
    with: { organization: true },
  });
  if (!contact) return null;

  const leadConditions = [];
  if (contact.email) leadConditions.push(ilike(leads.email, contact.email));
  if (contact.mobileNo) leadConditions.push(ilike(leads.mobileNo, contact.mobileNo));

  const [contactLeads, contactDealLinks] = await Promise.all([
    db.query.leads.findMany({
      where: leadConditions.length > 0 ? or(...leadConditions) : undefined,
      with: { status: true },
      orderBy: [desc(leads.createdAt)],
    }),
    db.query.dealContacts.findMany({
      where: eq(dealContacts.contactId, id),
      with: { deal: { with: { status: true, organization: true } } },
    }),
  ]);

  return { ...contact, leads: contactLeads, deals: contactDealLinks.map((d) => d.deal) };
}
```
Pattern : `db.query.X.findFirst/findMany` (relational API) + `eq`/`ilike`/`or` + `with: {...}` pour les relations + `orderBy`. Pas de try/catch.

### `update*FieldAction` type avec whitelist — `updateContactFieldAction` (actions.ts:275-292)
```ts
export async function updateContactFieldAction(
  contactId: string,
  field: string,
  value: string
) {
  const allowed = ["fullName", "firstName", "lastName", "email", "mobileNo", "phone"];
  if (!allowed.includes(field)) return;
  await updateContactQuery(contactId, { [field]: value || null });
  revalidatePath(`/contacts/${contactId}`);
}
```
Pattern : whitelist `allowed[]` → garde `if (!allowed.includes(field)) return` → mutation via query → `revalidatePath`. Pas de `useActionState`, retour void. Même structure pour `updateLeadFieldAction` (allowed: `fullName, firstName, lastName, email, mobileNo, phone, jobTitle, website, organizationName`).

### `db` — `src/db/index.ts` (complet, 11 lignes)
```ts
import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { prepare: false, max: 10 });
export const db = drizzle(client, { schema });
```
- `postgres-js`, `prepare: false` (requis pour le pooler Supabase en mode transaction), `max: 10`.
- Le schéma complet est passé à `drizzle()` → active l'API relationnelle `db.query.*`.

### `import "server-only"` confirmé sur :
- `src/db/index.ts:1` ✅
- `src/lib/queries.ts:1` ✅
- Non présent sur `src/app/actions.ts` (normal : les server actions ont `"use server"`, qui implique déjà un contexte serveur).

---

## 6. Auth / sécurité actuelle

### `src/proxy.ts` (complet, 57 lignes) — middleware Next 16
- `PUBLIC_ROUTES = ["/login"]` (ligne 4).
- **Exclusion webhook** : `if (pathname.startsWith("/api/webhook")) return response;` (ligne 10) — les webhooks bypassent l'auth.
- Pour tout le reste : `supabase.auth.getUser()` → si pas d'user et route non publique → redirect `/login`. Si user sur `/login` → redirect `/leads`.
- Matcher (ligne 54) : tout sauf assets statiques (`_next/static`, images, css, js, favicon).

### Les server actions / routes API revérifient-elles l'utilisateur ? **NON.**
Aucune des ~40 server actions de `src/app/actions.ts` ne vérifie l'identité. Exemple concret — `deleteLeadAction` (actions.ts:170) :
```ts
export async function deleteLeadAction(leadId: string) {
  await deleteLeadQuery(leadId);
  revalidatePath("/leads");
}
```
Aucun `getUser()`, aucun `requireUser()`, pas de scoping par `owner`. La route API `api/notifications/route.ts` GET ne vérifie pas non plus. Tout repose sur le proxy.

### Webhook `api/webhook/whatsapp` (route.ts:7-82)
- **Valide la signature Twilio** : `twilio.validateRequest(authToken, signature, request.url, params)` (lignes 11-27) — uniquement si `TWILIO_AUTH_TOKEN` est défini (graceful degradation si absent : accepte tout).
- **Hors périmètre proxy** : oui, exclu par `pathname.startsWith("/api/webhook")` (proxy.ts:10) → joignable sans session.

---

## 7. Contacts : créés quand ? Y a-t-il une dédup ?

**Les contacts sont créés à TROIS endroits, et la conversion est le seul chemin automatique :**

1. **`convertToDealAction`** (actions.ts:205) — crée un contact à partir du lead, **SANS dédup**. Si on convertit deux leads avec le même email, on crée deux contacts identiques.
2. **`createContactAction`** (actions.ts:256) — bouton "Nouveau contact" manuel, via formulaire. Pas de dédup.
3. **`bulkImportContactsAction`** (actions.ts:727) — import CSV. Insertion ligne par ligne, pas de dédup.

**Aucune fonction `getOrCreateContactByEmail` / `findContactByEmail` / dédup n'existe.** La seule trace de rapprochement contacts↔leads est dans `getContactById` (queries.ts:417-419) : il récupère les leads dont l'email/mobile `ilike` correspond à ceux du contact — mais c'est de la **lecture** (affichage), pas une dédup à l'écriture.

**Conclusion :** aujourd'hui un contact est créé à la conversion ET ailleurs (manuel, import), sans aucune déduplication par email/mobile. C'est un point central pour ton pivot (lead = 1 personne × 1 formation) — tu vas avoir besoin d'une dédup.

---

## 8. Migrations

- **Localisation** : `drizzle/` — **3 fichiers SQL** :
  - `0000_curious_firestar.sql` (schéma initial)
  - `0001_dear_human_fly.sql`
  - `0002_demonic_thunderbolt_ross.sql` (bootcamps — **appliqué ce matin**)
  - `drizzle/meta/` : 3 snapshots JSON + `_journal.json`.
- **Commande d'application réelle** : `node apply-migration.mjs drizzle/XXXX.sql` (script custom, pas `drizzle-kit migrate`).
- **`apply-migration.mjs`** (47 lignes, déjà lu) : lit `.env.local`/`.env` pour `DATABASE_URL`, charge le `.sql`, split sur `--> statement-breakpoint`, exécute chaque statement via `postgres.unsafe()`, s'arrête au premier échec. **Pas de table de tracking des migrations** — aucun guard anti-double-application (re-exécuter 0002 aujourd'hui aurait échoué sur le `CREATE TABLE` déjà existant, mais les `UPDATE` idempotents auraient pu repasser).
- **Seed** : **AUCUN**. Pas de fichier seed, pas de script d'insertion. Les données sont réelles mais minimales (3 leads, 2 contacts, 2 deals, 2 orgs, 17 activités, 2 bootcamps, 11 lead_statuses) — visiblement des tests manuels.
- **DB** : Supabase Postgres pooler, 24 tables (dont `leads_old_space_crm` et `messages` et `users` héritées d'un état antérieur, non référencées par le schéma Drizzle actuel).

### Contraintes UNIQUE en DB (vérifié live)
```
bootcamps (slug)         [bootcamps_slug_unique]
leads_old_space_crm (email) [leads_email_unique]   ← table héritée, pas dans le schéma actuel
users (email)            [users_email_unique]       ← table Supabase Auth
```
**Ni `contacts.email`, ni `contacts.mobileNo`, ni `leads.email` n'ont de contrainte UNIQUE.**

---

## 9. Drapeaux rouges pour le pivot formation-centric

### 9.1 Risques bloquants pour une migration additive (ajout de `formationId`)

- **`leads.bootcampId` est DÉJÀ `NOT NULL` en DB** (après 0002). Tu ne peux pas le supprimer/additionner sans gérer les valeurs existantes. Le pivot devra soit réutiliser `bootcampId` (renommage logique en `formationId`), soit faire une migration de données.
- **Aucune colonne `NOT NULL` sans default sur `leads`/`contacts`** qui bloquerait un `ALTER TABLE ADD COLUMN`. Les colonnes obligatoires (`fullName`, `converted`, `createdAt`, `updatedAt`) ont toutes un default ou sont `NOT NULL` avec valeur fournie à l'insert. **OK pour ajout additif.**
- **Aucune contrainte UNIQUE sur `contacts.email` / `contacts.mobileNo`** : tu peux ajouter `formationId` sans conflit, MAIS ça signifie aussi que tu n'as aucun filet contre les doublons de contacts — or ton modèle "1 personne × 1 formation" implique probablement une unicité `(contact, formation)`. À créer ex nihilo.

### 9.2 Couplage profond `deals`/`organizations` dans l'UI

- **`deals` est profondément intégré** : pages `/deals` + `/deals/[id]`, kanban deals, composants `deals-list`, `deals-kanban`, `deal-detail-header`, `deal-side-panel`, `deal-activities`. La conversion lead→deal est le flux central (`convertToDealAction`). **Toucher à `deals` cassera au minimum 7 composants + la page détail + l'action de conversion.**
- **`organizations` est pareillement intégré** : pages `/organizations` + `/organizations/[id]`, `new-organization-button`, et surtout **`getContactById`** (queries.ts:410) et **`getOrganizationById`** font des jointures `with: { organization: true }` partout. Les `leads` et `contacts` référencent `organizationId` en FK. `convertToDealAction` crée systématiquement une org via `getOrCreateOrganizationByName`.
- **La conversion crée un deal ET un contact ET une org à chaque fois** — c'est un flux B2B à 3 entités. Le pivot vers "lead = personne × formation" devra soit court-circuiter ce flux, soit le redéfinir.

### 9.3 Risques pour l'ajout de `formationId` sur `leads`

- **Déjà fait** (`bootcampId`), donc l'ajout n'est pas le problème — le problème est le **sens métier**. Aujourd'hui `bootcampId` relie un lead à un bootcamp qui a son PROPRE pipeline (`lead_statuses.bootcampId`). Ton pivot "lead = 1 personne × 1 formation" colle exactement à ce modèle existant. **Le travail de fond est déjà amorcé.**
- **Risque de double identité** : un lead a déjà `email`/`mobileNo` (la personne) ET `bootcampId` (la formation). Si tu veux qu'un même individu puisse être lead dans 2 formations, le `leads.email` n'est plus unique métier — c'est le couple `(email, bootcampId)` qui l'est. Aucune contrainte ne l'exprime aujourd'hui. À créer.
- **`activities`/`tasks`/`notes` polymorphiques sans FK** : ajouter une notion de formation sur ces tables passera par une nouvelle colonne nullable (pas de FK) — cohérent avec l'existant mais zéro garantie d'intégrité.

### 9.4 Risque analytics (le `status_change` incomplet)

- Pour calculer un **délai entre statuts** (ton objectif déclaré), les `activities` de type `status_change` ne stockent **que le nouveau statut** dans `content` en texte libre. Pas d'`oldStatusId`/`newStatusId`, pas de timestamp explicite de l'état précédent. Tu devras soit enrichir le schéma `activities` (colonnes `metadata jsonb` ou `oldValue`/`newValue`), soit reconstruire l'historique par ordre chronologique sur les `status_change` d'un même `referenceId`. **C'est le point le plus coûteux du pivot pour l'analytics.**

### 9.5 Risques sécurité déjà ouverts (hérités, pas liés au pivot mais à ne pas oublier)

- Aucune authz hors proxy : ajouter `formationId` ne change rien au fait que toute server action est ouverte. Si tu scopes par formation, il faudra un `requireUser()` + vérification d'appartenance, sinon le scoping est cosmétique.
- `signup()` ouvert — tout nouveau pivot devra décider si l'accès reste libre.
