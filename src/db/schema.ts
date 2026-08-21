import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
  boolean,
  pgEnum,
  jsonb,
  numeric,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums ──────────────────────────────────────────────

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "backlog",
  "todo",
  "in_progress",
  "done",
  "canceled",
]);

export const callStatusEnum = pgEnum("call_status", [
  "initiated",
  "ringing",
  "in_progress",
  "completed",
  "failed",
  "busy",
  "no_answer",
  "queued",
  "canceled",
]);

export const callTypeEnum = pgEnum("call_type", ["incoming", "outgoing"]);

export const telephonyMediumEnum = pgEnum("telephony_medium", [
  "manual",
  "twilio",
  "exotel",
]);

export const employeeSizeEnum = pgEnum("employee_size", [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1000+",
]);

export const viewTypeEnum = pgEnum("view_type", [
  "list",
  "kanban",
  "group_by",
]);

export const activityTypeEnum = pgEnum("activity_type", [
  "email",
  "whatsapp",
  "sms",
  "note",
  "call",
  "status_change",
  "comment",
  "task",
  "webhook_in",
]);

export const activityDirectionEnum = pgEnum("activity_direction", [
  "inbound",
  "outbound",
]);

export const referenceTypeEnum = pgEnum("reference_type", [
  "lead",
  "deal",
  "contact",
  "organization",
]);

export const bootcampStatusEnum = pgEnum("bootcamp_status", [
  "draft", // brouillon
  "open", // capte les leads (formation à venir)
  "in_progress", // formation commencée (jour J passé)
  "completed", // terminée
  "cancelled", // annulée
]);

// ── Enums pivot formation-centric (Phase 1) ────────────

export const stageKindEnum = pgEnum("stage_kind", ["normal", "converted", "lost"]);

export const temperatureEnum = pgEnum("temperature", ["hot", "cold"]);

export const paymentPlanEnum = pgEnum("payment_plan", ["total", "monthly"]);

// ── Bootcamps (Formations) ─────────────────────────────

export const bootcamps = pgTable("bootcamps", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // "bootcamp-dev-janv-2026" (URL webhook)
  description: text("description"),
  startDate: date("start_date"), // ⭐ le plus important
  endDate: date("end_date"),
  status: bootcampStatusEnum("status").notNull().default("open"),
  capacity: integer("capacity"), // nb de places
  // Offre de prix (B1 : "Converti" = inscrit + 1er paiement encaissé)
  priceTotal: numeric("price_total"), // prix total payé en une fois
  currency: text("currency").notNull().default("TND"),
  monthlyCount: integer("monthly_count"), // nb de mensualités (plan mensuel)
  monthlyAmount: numeric("monthly_amount"), // montant d'une mensualité
  // NULL = active. Archiver range la formation sans rien détruire, et coupe
  // l'import de ses formulaires (cf. getActiveElementorSources).
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Config / Meta ──────────────────────────────────────

export const leadStatuses = pgTable("lead_statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull().default("gray"),
  position: integer("position").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  bootcampId: uuid("bootcamp_id").references(() => bootcamps.id), // pipeline par formation
  // Colonnes système (Phase 1) — 2 stages système par bootcamp : "Converti" + "Lost"
  isSystem: boolean("is_system").notNull().default(false),
  kind: stageKindEnum("kind").notNull().default("normal"),
});
// TODO (backfill kind) — après migration, aucun stage existant ne matche ILIKE '%converti%'
// (les stages s'appellent "Converted" EN / "Inscrit" FR). Résultat backfill :
//   - bc 00000000-0000-0000-0000-000000000001 ("Formation par défaut") : "Lost"→lost ✓, "Converted"→normal (restera normal, à nettoyer)
//   - bc e8211853-4846-462f-84b7-49e8e42696e6 : "Perdu"→lost ✓, aucun converted
// → Les 2 bootcamps manquent d'un stage kind='converted'. Action : appeler
//   ensureSystemStages(<bootcampId>) pour semer "Converti"/"Lost", ou renommer "Converted"/"Inscrit".

export const dealStatuses = pgTable("deal_statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull().default("gray"),
  position: integer("position").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
});

export const leadSources = pgTable("lead_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
});

export const industries = pgTable("industries", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
});

export const lostReasons = pgTable("lost_reasons", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
});

export const territories = pgTable("territories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
});

// ── Organizations & Contacts ───────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  website: text("website"),
  logo: text("logo"),
  noOfEmployees: employeeSizeEnum("no_of_employees"),
  annualRevenue: numeric("annual_revenue"),
  industryId: uuid("industry_id").references(() => industries.id),
  territoryId: uuid("territory_id").references(() => territories.id),
  currency: text("currency").default("EUR"),
  address: text("address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  salutation: text("salutation"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  fullName: text("full_name").notNull(),
  email: text("email"),
  mobileNo: text("mobile_no"),
  phone: text("phone"),
  whatsapp: text("whatsapp"), // numéro WhatsApp de la personne (suit le contact d'une formation à l'autre)
  age: integer("age"), // âge de la personne
  gender: text("gender"),
  image: text("image"),
  organizationId: uuid("organization_id").references(() => organizations.id),
  // Fix dédup P2 : un contact créé via match mobile seul (pas email) est flagué
  // pour révision manuelle — on ne fusionne jamais deux humains à tort.
  possibleDuplicate: boolean("possible_duplicate").notNull().default(false),
  // Désabonnement global aux campagnes. Les échanges 1-à-1 depuis la fiche
  // lead restent possibles : ce sont des réponses, pas du marketing.
  unsubscribedAt: timestamp("unsubscribed_at"),
  unsubscribeToken: text("unsubscribe_token")
    .notNull()
    .$defaultFn(() => crypto.randomUUID()),
  // Rebond DUR uniquement (adresse inexistante). Une boîte pleine ou une
  // absence temporaire n'entre pas ici : on ne bannit pas quelqu'un en congé.
  bouncedAt: timestamp("bounced_at"),
  bounceReason: text("bounce_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Leads ──────────────────────────────────────────────

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  salutation: text("salutation"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  fullName: text("full_name").notNull(),
  email: text("email"),
  mobileNo: text("mobile_no"),
  phone: text("phone"),
  website: text("website"),
  image: text("image"),
  jobTitle: text("job_title"),
  organizationName: text("organization_name"),
  organizationId: uuid("organization_id").references(() => organizations.id),
  bootcampId: uuid("bootcamp_id").references(() => bootcamps.id), // formation de rattachement
  contactId: uuid("contact_id").references(() => contacts.id), // la personne (dédupliquée) — wiring Phase 2
  statusId: uuid("status_id").references(() => leadStatuses.id),
  sourceId: uuid("source_id").references(() => leadSources.id),
  industryId: uuid("industry_id").references(() => industries.id),
  owner: text("owner"),
  converted: boolean("converted").notNull().default(false),
  lastContactedAt: timestamp("last_contacted_at"),
  // État pipeline (Phase 1)
  temperature: temperatureEnum("temperature").notNull().default("cold"),
  stageEnteredAt: timestamp("stage_entered_at").notNull().defaultNow(), // alimente l'alerte de stagnation
  // NULL = jamais ouvert par un humain. Posé à la 1ʳᵉ ouverture de la fiche.
  seenAt: timestamp("seen_at"),
  convertedAt: timestamp("converted_at"), // date de conversion (B1)
  rawPayload: jsonb("raw_payload"), // infos brutes du formulaire d'entrée
  formSourceId: uuid("form_source_id").references(() => formSources.id), // d'où vient le lead
  intendedPlan: paymentPlanEnum("intended_plan"), // plan envisagé (noté pendant le pipeline, avant inscription)
  promoCode: text("promo_code"), // code promo de l'inscription (info du lead, pas de la personne)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // L'utilisateur a tranché sur l'alerte de doublon d'adresse pour ce lead.
  duplicateDismissedAt: timestamp("duplicate_dismissed_at"),
});

// ── Deals ──────────────────────────────────────────────

export const deals = pgTable("deals", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id").references(() => leads.id),
  organizationId: uuid("organization_id").references(() => organizations.id),
  statusId: uuid("status_id").references(() => dealStatuses.id),
  sourceId: uuid("source_id").references(() => leadSources.id),
  industryId: uuid("industry_id").references(() => industries.id),
  territoryId: uuid("territory_id").references(() => territories.id),
  probability: numeric("probability").default("0"),
  dealValue: numeric("deal_value").default("0"),
  expectedDealValue: numeric("expected_deal_value"),
  annualRevenue: numeric("annual_revenue"),
  currency: text("currency").default("EUR"),
  exchangeRate: numeric("exchange_rate").default("1"),
  owner: text("owner"),
  nextStep: text("next_step"),
  lostReasonId: uuid("lost_reason_id").references(() => lostReasons.id),
  lostNotes: text("lost_notes"),
  expectedClosureDate: date("expected_closure_date"),
  closedDate: date("closed_date"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  mobileNo: text("mobile_no"),
  phone: text("phone"),
  jobTitle: text("job_title"),
  website: text("website"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const dealContacts = pgTable("deal_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").notNull().default(false),
});

// ── Products ───────────────────────────────────────────

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  image: text("image"),
  price: numeric("price").default("0"),
  currency: text("currency").default("EUR"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const dealProducts = pgTable("deal_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  qty: numeric("qty").default("1"),
  rate: numeric("rate").default("0"),
  amount: numeric("amount").default("0"),
});

// ── Tasks ──────────────────────────────────────────────

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  status: taskStatusEnum("status").notNull().default("todo"),
  assignedTo: text("assigned_to"),
  startDate: date("start_date"),
  dueDate: timestamp("due_date"),
  description: text("description"),
  referenceType: referenceTypeEnum("reference_type"),
  referenceId: uuid("reference_id"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Notes ──────────────────────────────────────────────

export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title"),
  content: text("content").notNull(),
  referenceType: referenceTypeEnum("reference_type"),
  referenceId: uuid("reference_id"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Call Logs ──────────────────────────────────────────

export const callLogs = pgTable("call_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromNumber: text("from_number"),
  toNumber: text("to_number"),
  status: callStatusEnum("status").notNull().default("initiated"),
  type: callTypeEnum("type").notNull().default("outgoing"),
  telephonyMedium: telephonyMediumEnum("telephony_medium")
    .notNull()
    .default("manual"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  duration: integer("duration").default(0),
  recordingUrl: text("recording_url"),
  callerId: text("caller_id"),
  receiverId: text("receiver_id"),
  noteId: uuid("note_id").references(() => notes.id),
  referenceType: referenceTypeEnum("reference_type"),
  referenceId: uuid("reference_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Comments ───────────────────────────────────────────

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  content: text("content").notNull(),
  referenceType: referenceTypeEnum("reference_type"),
  referenceId: uuid("reference_id"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Activities (unified timeline) ──────────────────────

export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  referenceType: referenceTypeEnum("reference_type"),
  referenceId: uuid("reference_id"),
  type: activityTypeEnum("type").notNull(),
  direction: activityDirectionEnum("direction")
    .notNull()
    .default("outbound"),
  subject: text("subject"),
  content: text("content"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Email Templates ────────────────────────────────────

export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  subject: text("subject"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── View Settings (custom views) ───────────────────────

export const viewSettings = pgTable("view_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  routeName: text("route_name").notNull(),
  doctype: text("doctype").notNull(),
  type: viewTypeEnum("type").notNull().default("list"),
  columns: jsonb("columns"),
  filters: jsonb("filters"),
  orderBy: jsonb("order_by"),
  groupByField: text("group_by_field"),
  columnField: text("column_field"),
  kanbanColumns: jsonb("kanban_columns"),
  kanbanFields: jsonb("kanban_fields"),
  titleField: text("title_field"),
  userId: text("user_id"),
  public: boolean("public").notNull().default(false),
  pinned: boolean("pinned").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  isStandard: boolean("is_standard").notNull().default(false),
  icon: text("icon"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Notifications ──────────────────────────────────────

export const notificationTypeEnum = pgEnum("notification_type", [
  "lead_assigned",
  "lead_status_change",
  "deal_status_change",
  "task_assigned",
  "task_due",
  "comment",
  "mention",
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: notificationTypeEnum("type").notNull(),
  message: text("message").notNull(),
  referenceType: referenceTypeEnum("reference_type"),
  referenceId: uuid("reference_id"),
  userId: text("user_id"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Tags (Phase 1) ─────────────────────────────────────

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("gray"),
});

export const leadTags = pgTable(
  "lead_tags",
  {
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.leadId, t.tagId] })]
);

// ── Payment Schedules (Phase 1) ────────────────────────

export const paymentSchedules = pgTable("payment_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  plan: paymentPlanEnum("plan").notNull(),
  dueDate: date("due_date"),
  amount: numeric("amount"),
  isPaid: boolean("is_paid").notNull().default(false),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Form Sources (Phase 1) ─────────────────────────────
// Source d'entrée typée par bootcamp (DISTINCT de lead_sources qui reste la liste de réf.)
export const formSources = pgTable("form_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  bootcampId: uuid("bootcamp_id").references(() => bootcamps.id),
  name: text("name").notNull(),
  targetStatusId: uuid("target_status_id").references(() => leadStatuses.id),
  temperature: temperatureEnum("temperature").default("cold"),
  defaultTagIds: jsonb("default_tag_ids").default([]),
  webhookToken: text("webhook_token").notNull().unique(),
  // Lien Elementor (pull par API). Un formulaire n'alimente qu'UNE formation :
  // index unique partiel sur (elementor_form_id) WHERE active — migration 0009.
  elementorFormId: text("elementor_form_id"), // "<postId>_<elementId>", ex. "8826_4851b85"
  lastSubmissionId: integer("last_submission_id"), // curseur : dernière soumission importée
  active: boolean("active").notNull().default(true),
  fieldMapping: jsonb("field_mapping").notNull().default({}), // { "<champ Elementor>": "<colonne lead whitelistée>" }
  // Dernier payload brut reçu (diagnostic mapping) — écrit par le webhook à chaque POST.
  lastPayload: jsonb("last_payload"),
  lastReceivedAt: timestamp("last_received_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Note Templates (Phase 1) ───────────────────────────

export const noteTemplates = pgTable("note_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  text: text("text").notNull(),
  position: integer("position").notNull().default(0),
});

// ── Allowed Emails (pré-déploiement) ────────────────────
// Liste blanche des emails autorisés à créer un compte.
// Seul un email présent ici peut passer signup().
export const allowedEmails = pgTable("allowed_emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Connexion WordPress (thespace.academy) ─────────────
// Credentials du site WP dont on aspire les soumissions Elementor.
// Table à ligne unique : `id` est un booléen contraint à true (pas de 2e ligne possible).
// ⚠️ appPassword est stocké en clair et n'est JAMAIS renvoyé au client (cf. getWpConnectionPublic).
export const wpConnection = pgTable("wp_connection", {
  id: boolean("id").primaryKey().default(true),
  siteUrl: text("site_url").notNull(),
  username: text("username").notNull(),
  appPassword: text("app_password").notNull(),
  lastTestedAt: timestamp("last_tested_at"),
  lastTestOk: boolean("last_test_ok"),
  lastTestMessage: text("last_test_message"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Stage History (Phase 1) ────────────────────────────
// Capture structurée des transitions de statut (l'activity status_change restait en texte libre)
export const stageHistory = pgTable("stage_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  fromStatusId: uuid("from_status_id"),
  toStatusId: uuid("to_status_id"),
  changedBy: text("changed_by"),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
});

// ── Campagnes email ────────────────────────────────────

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  subject: text("subject"),
  content: text("content").notNull().default(""),
  // draft | scheduled | sending | sent | failed
  status: text("status").notNull().default("draft"),
  targetTagIds: jsonb("target_tag_ids").notNull().default([]),
  targetEmails: jsonb("target_emails").notNull().default([]),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Une ligne par destinataire : c'est ce qui permet de reprendre un envoi
// interrompu sans réexpédier, d'étaler au-delà du quota quotidien, et de
// savoir qui a réellement reçu quoi. L'index unique (campaign_id, lower(email))
// porte la garantie anti-doublon côté base, pas côté applicatif.
export const campaignRecipients = pgTable("campaign_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  // SET NULL : supprimer un contact n'efface pas la trace de l'envoi.
  contactId: uuid("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  email: text("email").notNull(),
  // pending | sent | failed | skipped
  status: text("status").notNull().default("pending"),
  resendId: text("resend_id"),
  error: text("error"),
  sentAt: timestamp("sent_at"),
  // Délivrance réellement constatée par Resend, à distinguer de
  // « aucun rebond signalé » : un email peut disparaître en silence.
  deliveredAt: timestamp("delivered_at"),
  // Première réaction + nombre de fois : une seule des deux perdrait de
  // l'information (quand a-t-il ouvert / à quel point est-il engagé).
  openedAt: timestamp("opened_at"),
  openCount: integer("open_count").notNull().default(0),
  clickedAt: timestamp("clicked_at"),
  clickCount: integer("click_count").notNull().default(0),
  // Désinscription DÉCLENCHÉE PAR cette campagne. `contacts.unsubscribed_at`
  // dit que la personne est désabonnée ; ceci dit d'où ça vient.
  unsubscribedAt: timestamp("unsubscribed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Relations ──────────────────────────────────────────

export const bootcampsRelations = relations(bootcamps, ({ many }) => ({
  leadStatuses: many(leadStatuses),
  leads: many(leads),
  formSources: many(formSources),
}));

export const leadStatusesRelations = relations(leadStatuses, ({ one, many }) => ({
  bootcamp: one(bootcamps, {
    fields: [leadStatuses.bootcampId],
    references: [bootcamps.id],
  }),
  leads: many(leads),
  formSources: many(formSources), // via targetStatusId
}));

export const dealStatusesRelations = relations(dealStatuses, ({ many }) => ({
  deals: many(deals),
}));

export const leadSourcesRelations = relations(leadSources, ({ many }) => ({
  leads: many(leads),
  deals: many(deals),
}));

export const industriesRelations = relations(industries, ({ many }) => ({
  leads: many(leads),
  deals: many(deals),
  organizations: many(organizations),
}));

export const territoriesRelations = relations(territories, ({ many }) => ({
  organizations: many(organizations),
  deals: many(deals),
}));

export const lostReasonsRelations = relations(lostReasons, ({ many }) => ({
  deals: many(deals),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  industry: one(industries, {
    fields: [organizations.industryId],
    references: [industries.id],
  }),
  territory: one(territories, {
    fields: [organizations.territoryId],
    references: [territories.id],
  }),
  contacts: many(contacts),
  leads: many(leads),
  deals: many(deals),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [contacts.organizationId],
    references: [organizations.id],
  }),
  dealContacts: many(dealContacts),
  leads: many(leads), // via leads.contactId (Phase 1)
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  bootcamp: one(bootcamps, {
    fields: [leads.bootcampId],
    references: [bootcamps.id],
  }),
  contact: one(contacts, {
    fields: [leads.contactId],
    references: [contacts.id],
  }),
  status: one(leadStatuses, {
    fields: [leads.statusId],
    references: [leadStatuses.id],
  }),
  source: one(leadSources, {
    fields: [leads.sourceId],
    references: [leadSources.id],
  }),
  industry: one(industries, {
    fields: [leads.industryId],
    references: [industries.id],
  }),
  organization: one(organizations, {
    fields: [leads.organizationId],
    references: [organizations.id],
  }),
  formSource: one(formSources, {
    fields: [leads.formSourceId],
    references: [formSources.id],
  }),
  deals: many(deals),
  leadTags: many(leadTags),
  paymentSchedules: many(paymentSchedules),
  stageHistory: many(stageHistory),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  lead: one(leads, {
    fields: [deals.leadId],
    references: [leads.id],
  }),
  organization: one(organizations, {
    fields: [deals.organizationId],
    references: [organizations.id],
  }),
  status: one(dealStatuses, {
    fields: [deals.statusId],
    references: [dealStatuses.id],
  }),
  source: one(leadSources, {
    fields: [deals.sourceId],
    references: [leadSources.id],
  }),
  industry: one(industries, {
    fields: [deals.industryId],
    references: [industries.id],
  }),
  territory: one(territories, {
    fields: [deals.territoryId],
    references: [territories.id],
  }),
  lostReason: one(lostReasons, {
    fields: [deals.lostReasonId],
    references: [lostReasons.id],
  }),
  dealContacts: many(dealContacts),
  dealProducts: many(dealProducts),
}));

export const dealContactsRelations = relations(dealContacts, ({ one }) => ({
  deal: one(deals, {
    fields: [dealContacts.dealId],
    references: [deals.id],
  }),
  contact: one(contacts, {
    fields: [dealContacts.contactId],
    references: [contacts.id],
  }),
}));

export const dealProductsRelations = relations(dealProducts, ({ one }) => ({
  deal: one(deals, {
    fields: [dealProducts.dealId],
    references: [deals.id],
  }),
  product: one(products, {
    fields: [dealProducts.productId],
    references: [products.id],
  }),
}));

// ── Relations pivot formation-centric (Phase 1) ────────

export const tagsRelations = relations(tags, ({ many }) => ({
  leadTags: many(leadTags),
}));

export const leadTagsRelations = relations(leadTags, ({ one }) => ({
  lead: one(leads, {
    fields: [leadTags.leadId],
    references: [leads.id],
  }),
  tag: one(tags, {
    fields: [leadTags.tagId],
    references: [tags.id],
  }),
}));

export const paymentSchedulesRelations = relations(paymentSchedules, ({ one }) => ({
  lead: one(leads, {
    fields: [paymentSchedules.leadId],
    references: [leads.id],
  }),
}));

export const formSourcesRelations = relations(formSources, ({ one, many }) => ({
  bootcamp: one(bootcamps, {
    fields: [formSources.bootcampId],
    references: [bootcamps.id],
  }),
  targetStatus: one(leadStatuses, {
    fields: [formSources.targetStatusId],
    references: [leadStatuses.id],
  }),
  leads: many(leads),
}));

export const stageHistoryRelations = relations(stageHistory, ({ one }) => ({
  lead: one(leads, {
    fields: [stageHistory.leadId],
    references: [leads.id],
  }),
}));

// ── Types ──────────────────────────────────────────────

export type Bootcamp = typeof bootcamps.$inferSelect;
export type NewBootcamp = typeof bootcamps.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Deal = typeof deals.$inferSelect;
export type NewDeal = typeof deals.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type CallLog = typeof callLogs.$inferSelect;
export type NewCallLog = typeof callLogs.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;
export type ViewSetting = typeof viewSettings.$inferSelect;
export type NewViewSetting = typeof viewSettings.$inferInsert;
export type LeadStatus = typeof leadStatuses.$inferSelect;
export type DealStatus = typeof dealStatuses.$inferSelect;
export type LeadSource = typeof leadSources.$inferSelect;
export type Industry = typeof industries.$inferSelect;
export type LostReason = typeof lostReasons.$inferSelect;
export type Territory = typeof territories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
// Types pivot formation-centric (Phase 1)
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type LeadTag = typeof leadTags.$inferSelect;
export type PaymentSchedule = typeof paymentSchedules.$inferSelect;
export type NewPaymentSchedule = typeof paymentSchedules.$inferInsert;
export type FormSource = typeof formSources.$inferSelect;
export type NewFormSource = typeof formSources.$inferInsert;
export type NoteTemplate = typeof noteTemplates.$inferSelect;
export type NewNoteTemplate = typeof noteTemplates.$inferInsert;
export type StageHistory = typeof stageHistory.$inferSelect;
export type NewStageHistory = typeof stageHistory.$inferInsert;
export type AllowedEmail = typeof allowedEmails.$inferSelect;
export type NewAllowedEmail = typeof allowedEmails.$inferInsert;
export type WpConnection = typeof wpConnection.$inferSelect;
export type NewWpConnection = typeof wpConnection.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type NewCampaignRecipient = typeof campaignRecipients.$inferInsert;
