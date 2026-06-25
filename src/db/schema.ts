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

// ── Config / Meta ──────────────────────────────────────

export const leadStatuses = pgTable("lead_statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull().default("gray"),
  position: integer("position").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
});

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
  gender: text("gender"),
  image: text("image"),
  organizationId: uuid("organization_id").references(() => organizations.id),
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
  statusId: uuid("status_id").references(() => leadStatuses.id),
  sourceId: uuid("source_id").references(() => leadSources.id),
  industryId: uuid("industry_id").references(() => industries.id),
  owner: text("owner"),
  converted: boolean("converted").notNull().default(false),
  lastContactedAt: timestamp("last_contacted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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

// ── Relations ──────────────────────────────────────────

export const leadStatusesRelations = relations(leadStatuses, ({ many }) => ({
  leads: many(leads),
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
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
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
  deals: many(deals),
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

// ── Types ──────────────────────────────────────────────

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
