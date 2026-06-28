import "server-only";
import { db, type DbExecutor } from "@/db";
import {
  leads,
  leadStatuses,
  leadSources,
  industries,
  organizations,
  activities,
  tasks,
  notes,
  deals,
  dealStatuses,
  dealContacts,
  dealProducts,
  products,
  contacts,
  territories,
  lostReasons,
  emailTemplates,
  comments,
  callLogs,
  notifications,
  viewSettings,
  bootcamps,
  tags,
  leadTags,
  paymentSchedules,
  formSources,
  noteTemplates,
  stageHistory,
} from "@/db/schema";import { eq, desc, asc, ilike, or, and, sql } from "drizzle-orm";

// ── Bootcamps (Formations) ─────────────────────────────

// Formation par défaut créée par la migration 0002. Les leads ne peuvent pas
// avoir bootcamp_id = NULL (NOT NULL), donc on y rattache les leads orphelins.
export const DEFAULT_BOOTCAMP_ID = "00000000-0000-0000-0000-000000000001";

export type BootcampWithLeadCount = typeof bootcamps.$inferSelect & {
  leadCount: number;
};

export async function getBootcamps(): Promise<BootcampWithLeadCount[]> {
  const all = await db.query.bootcamps.findMany({
    orderBy: [desc(bootcamps.createdAt)],
  });

  // Count leads per bootcamp
  const counts = await db
    .select({
      bootcampId: leads.bootcampId,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .groupBy(leads.bootcampId);

  const countMap = new Map(counts.map((c) => [c.bootcampId, c.count]));

  return all.map((b) => ({
    ...b,
    leadCount: countMap.get(b.id) ?? 0,
  }));
}

export async function getBootcampById(id: string) {
  return db.query.bootcamps.findFirst({
    where: eq(bootcamps.id, id),
  });
}

export async function getBootcampBySlug(slug: string) {
  return db.query.bootcamps.findFirst({
    where: eq(bootcamps.slug, slug),
  });
}

export async function createBootcamp(data: typeof bootcamps.$inferInsert) {
  const [bootcamp] = await db.insert(bootcamps).values(data).returning();
  // Clone le pipeline modèle pour cette nouvelle formation
  await cloneDefaultPipeline(bootcamp.id);
  // Sème les 2 stages système (Converti / Lost) si absents (Phase 1)
  await ensureSystemStages(bootcamp.id);
  return bootcamp;
}

export async function updateBootcamp(
  id: string,
  data: Partial<typeof bootcamps.$inferInsert>
) {
  const [bootcamp] = await db
    .update(bootcamps)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(bootcamps.id, id))
    .returning();
  return bootcamp;
}

export async function deleteBootcamp(id: string) {
  if (id === DEFAULT_BOOTCAMP_ID) {
    throw new Error("La formation par défaut ne peut pas être supprimée.");
  }
  // Réaffecte les leads à la formation par défaut + remet leur statut sur la
  // colonne par défaut du pipeline cible (les statuts du bootcamp supprimé
  // vont disparaître, il ne faut pas laisser de statusId dangling).
  const defaultStatus = await getDefaultLeadStatus(DEFAULT_BOOTCAMP_ID);
  await db
    .update(leads)
    .set({
      bootcampId: DEFAULT_BOOTCAMP_ID,
      statusId: defaultStatus?.id ?? null,
      updatedAt: new Date(),
    })
    .where(eq(leads.bootcampId, id));
  // Supprime les statuts liés à cette formation
  await db.delete(leadStatuses).where(eq(leadStatuses.bootcampId, id));
  // Supprime la formation
  await db.delete(bootcamps).where(eq(bootcamps.id, id));
}

// Pipeline modèle : EXACTEMENT 5 colonnes pour chaque nouvelle formation,
// dont les 2 colonnes SYSTÈME terminales (Inscrit=converted, Perdu=lost).
// ensureSystemStages (appelé ensuite par createBootcamp) devient alors un no-op.
const DEFAULT_PIPELINE_STAGES: {
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  kind: "normal" | "converted" | "lost";
  isSystem: boolean;
}[] = [
  { name: "Nouveau", color: "blue", position: 0, isDefault: true, kind: "normal", isSystem: false },
  { name: "Contacté", color: "yellow", position: 1, isDefault: false, kind: "normal", isSystem: false },
  { name: "Intéressé", color: "green", position: 2, isDefault: false, kind: "normal", isSystem: false },
  { name: "Inscrit", color: "purple", position: 3, isDefault: false, kind: "converted", isSystem: true },
  { name: "Perdu", color: "red", position: 4, isDefault: false, kind: "lost", isSystem: true },
];

export async function cloneDefaultPipeline(bootcampId: string) {
  await db.insert(leadStatuses).values(
    DEFAULT_PIPELINE_STAGES.map((stage) => ({
      ...stage,
      bootcampId,
    }))
  );
}

// ── Colonnes (stages) : CRUD pour la gestion dans le board ──

export async function getLeadStatusById(id: string) {
  return db.query.leadStatuses.findFirst({ where: eq(leadStatuses.id, id) });
}

export async function countLeadsByStatus(statusId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(eq(leads.statusId, statusId));
  return row?.count ?? 0;
}

export async function createStage(bootcampId: string, name: string) {
  const existing = await db.query.leadStatuses.findMany({
    where: eq(leadStatuses.bootcampId, bootcampId),
  });
  const maxPos = existing.reduce((m, s) => Math.max(m, s.position), -1);
  const [stage] = await db
    .insert(leadStatuses)
    .values({
      bootcampId,
      name,
      color: "gray",
      position: maxPos + 1,
      isDefault: false,
      isSystem: false,
      kind: "normal",
    })
    .returning();
  return stage;
}

export async function renameStage(statusId: string, name: string) {
  await db.update(leadStatuses).set({ name }).where(eq(leadStatuses.id, statusId));
}

export async function deleteStage(statusId: string) {
  await db.delete(leadStatuses).where(eq(leadStatuses.id, statusId));
}

// ── Lead Statuses (par bootcamp) ────────────────────────

export async function getLeadStatuses(bootcampId?: string) {
  return db.query.leadStatuses.findMany({
    where: bootcampId ? eq(leadStatuses.bootcampId, bootcampId) : undefined,
    orderBy: [asc(leadStatuses.position)],
  });
}

export async function getDefaultLeadStatus(bootcampId?: string) {
  return db.query.leadStatuses.findFirst({
    where: and(
      eq(leadStatuses.isDefault, true),
      bootcampId ? eq(leadStatuses.bootcampId, bootcampId) : sql`true`
    ),
  });
}

// ── Lead Sources / Industries ──────────────────────────

export async function getLeadSources() {
  return db.query.leadSources.findMany();
}

export async function getIndustries() {
  return db.query.industries.findMany();
}

// ── Leads: List ────────────────────────────────────────

export type LeadWithRelations = typeof leads.$inferSelect & {
  status: typeof leadStatuses.$inferSelect | null;
  source: typeof leadSources.$inferSelect | null;
  industry: typeof industries.$inferSelect | null;
  organization: typeof organizations.$inferSelect | null;
  bootcamp: typeof bootcamps.$inferSelect | null;
};

export async function getLeads(opts?: {
  search?: string;
  bootcampId?: string;
  statusId?: string;
  temperature?: "hot" | "cold";
  converted?: boolean;
}): Promise<LeadWithRelations[]> {
  const filters: ReturnType<typeof and>[] = [];

  if (opts?.search) {
    filters.push(
      or(
        ilike(leads.fullName, `%${opts.search}%`),
        ilike(leads.email, `%${opts.search}%`),
        ilike(leads.mobileNo, `%${opts.search}%`),
        ilike(leads.organizationName, `%${opts.search}%`)
      )
    );
  }
  if (opts?.bootcampId) filters.push(eq(leads.bootcampId, opts.bootcampId));
  if (opts?.statusId) filters.push(eq(leads.statusId, opts.statusId));
  if (opts?.temperature) filters.push(eq(leads.temperature, opts.temperature));
  if (opts?.converted !== undefined) filters.push(eq(leads.converted, opts.converted));

  return db.query.leads.findMany({
    where: filters.length > 0 ? and(...filters) : undefined,
    with: {
      status: true,
      source: true,
      industry: true,
      organization: true,
      bootcamp: true,
    },
    orderBy: [desc(leads.createdAt)],
  });
}

export async function getLeadsByStatus(statusId: string) {
  return db.query.leads.findMany({
    where: eq(leads.statusId, statusId),
    with: {
      status: true,
      source: true,
      organization: true,
      bootcamp: true,
    },
    orderBy: [desc(leads.createdAt)],
  });
}

// ── Leads: Kanban (grouped by status) ──────────────────

export async function getLeadsKanban(bootcampId?: string) {
  const statuses = await db.query.leadStatuses.findMany({
    where: bootcampId ? eq(leadStatuses.bootcampId, bootcampId) : undefined,
    orderBy: [asc(leadStatuses.position)],
    with: {
      leads: {
        // N'embarque PAS raw_payload (jsonb, inutile pour le board) — robustesse perf.
        columns: { rawPayload: false },
        orderBy: [desc(leads.createdAt)],
        with: {
          source: true,
          organization: true,
        },
      },
    },
  });
  return statuses;
}

// ── Leads: Detail ──────────────────────────────────────

export async function getLeadById(id: string) {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, id),
    with: {
      status: true,
      source: true,
      industry: true,
      organization: true,
      bootcamp: true,
      contact: true,
      formSource: true,
      deals: {
        orderBy: [desc(deals.createdAt)],
      },
    },
  });
  if (!lead) return null;

  const [leadActivities, leadTasks, leadNotes, leadComments] = await Promise.all([
    db.query.activities.findMany({
      where: and(
        eq(activities.referenceType, "lead"),
        eq(activities.referenceId, id)
      ),
      orderBy: [desc(activities.createdAt)],
    }),
    db.query.tasks.findMany({
      where: and(eq(tasks.referenceType, "lead"), eq(tasks.referenceId, id)),
      orderBy: [desc(tasks.createdAt)],
    }),
    db.query.notes.findMany({
      where: and(eq(notes.referenceType, "lead"), eq(notes.referenceId, id)),
      orderBy: [desc(notes.createdAt)],
    }),
    db.query.comments.findMany({
      where: and(eq(comments.referenceType, "lead"), eq(comments.referenceId, id)),
      orderBy: [desc(comments.createdAt)],
    }),
  ]);

  return {
    ...lead,
    activities: leadActivities,
    tasks: leadTasks,
    notes: leadNotes,
    comments: leadComments,
  };
}

// ── Leads: Mutations ───────────────────────────────────

export async function createLead(data: typeof leads.$inferInsert) {
  const [lead] = await db.insert(leads).values(data).returning();
  return lead;
}

export async function updateLead(
  id: string,
  data: Partial<typeof leads.$inferInsert>
) {
  const [lead] = await db
    .update(leads)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(leads.id, id))
    .returning();
  return lead;
}

export async function updateLeadStatus(leadId: string, statusId: string) {
  const [lead] = await db
    .update(leads)
    .set({ statusId, updatedAt: new Date() })
    .where(eq(leads.id, leadId))
    .returning();
  return lead;
}

export async function deleteLead(id: string) {
  await db.delete(leads).where(eq(leads.id, id));
}

// ── Activities ─────────────────────────────────────────

export async function createActivity(data: typeof activities.$inferInsert) {
  const [activity] = await db.insert(activities).values(data).returning();
  return activity;
}

export async function getActivitiesByReference(
  referenceType: "lead" | "deal" | "contact" | "organization",
  referenceId: string
) {
  return db.query.activities.findMany({
    where: and(
      eq(activities.referenceType, referenceType),
      eq(activities.referenceId, referenceId)
    ),
    orderBy: [desc(activities.createdAt)],
  });
}

// ── Stats ──────────────────────────────────────────────

export async function getLeadStats() {
  const total = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads);
  const converted = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(eq(leads.converted, true));
  const contactedThisWeek = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(sql`${leads.lastContactedAt} > now() - interval '7 days'`);

  return {
    total: total[0]?.count ?? 0,
    converted: converted[0]?.count ?? 0,
    contactedThisWeek: contactedThisWeek[0]?.count ?? 0,
  };
}

export async function getDealStats() {
  const total = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deals);
  const won = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deals)
    .where(sql`EXISTS (SELECT 1 FROM deal_statuses WHERE id = deals.status_id AND name = 'Won')`);

  const totalValue = await db
    .select({ sum: sql<number>`coalesce(sum(deal_value), 0)::numeric` })
    .from(deals);

  return {
    total: total[0]?.count ?? 0,
    won: won[0]?.count ?? 0,
    totalValue: totalValue[0]?.sum ?? 0,
  };
}

export async function getTaskStats() {
  const total = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks);
  const done = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(eq(tasks.status, "done"));
  const overdue = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(
      sql`${tasks.dueDate} < now()`,
      sql`${tasks.status} != 'done'`
    ));

  return {
    total: total[0]?.count ?? 0,
    done: done[0]?.count ?? 0,
    overdue: overdue[0]?.count ?? 0,
  };
}

// ── Territories ────────────────────────────────────────

export async function getTerritories() {
  return db.query.territories.findMany();
}

// ── Contacts ───────────────────────────────────────────

export type ContactWithRelations = typeof contacts.$inferSelect & {
  organization: typeof organizations.$inferSelect | null;
};

export async function getContacts(search?: string): Promise<ContactWithRelations[]> {
  return db.query.contacts.findMany({
    where: search
      ? or(
          ilike(contacts.fullName, `%${search}%`),
          ilike(contacts.email, `%${search}%`),
          ilike(contacts.mobileNo, `%${search}%`)
        )
      : undefined,
    with: { organization: true },
    orderBy: [desc(contacts.createdAt)],
  });
}

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
      with: {
        deal: {
          with: { status: true, organization: true },
        },
      },
    }),
  ]);

  return {
    ...contact,
    leads: contactLeads,
    deals: contactDealLinks.map((d) => d.deal),
  };
}

export async function createContact(data: typeof contacts.$inferInsert) {
  const [contact] = await db.insert(contacts).values(data).returning();
  return contact;
}

export async function updateContact(
  id: string,
  data: Partial<typeof contacts.$inferInsert>
) {
  const [contact] = await db
    .update(contacts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(contacts.id, id))
    .returning();
  return contact;
}

export async function deleteContact(id: string) {
  await db.delete(contacts).where(eq(contacts.id, id));
}

// ── Organizations ──────────────────────────────────────

export type OrganizationWithRelations = typeof organizations.$inferSelect & {
  industry: typeof industries.$inferSelect | null;
  territory: typeof territories.$inferSelect | null;
};

export async function getOrganizations(search?: string): Promise<OrganizationWithRelations[]> {
  return db.query.organizations.findMany({
    where: search
      ? or(
          ilike(organizations.name, `%${search}%`),
          ilike(organizations.website, `%${search}%`)
        )
      : undefined,
    with: { industry: true, territory: true },
    orderBy: [desc(organizations.createdAt)],
  });
}

export async function getOrganizationById(id: string) {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, id),
    with: { industry: true, territory: true },
  });
  if (!org) return null;

  const [orgContacts, orgLeads, orgDeals] = await Promise.all([
    db.query.contacts.findMany({
      where: eq(contacts.organizationId, id),
      orderBy: [desc(contacts.createdAt)],
    }),
    db.query.leads.findMany({
      where: eq(leads.organizationId, id),
      with: { status: true },
      orderBy: [desc(leads.createdAt)],
    }),
    db.query.deals.findMany({
      where: eq(deals.organizationId, id),
      with: { status: true },
      orderBy: [desc(deals.createdAt)],
    }),
  ]);

  return {
    ...org,
    contacts: orgContacts,
    leads: orgLeads,
    deals: orgDeals,
  };
}

export async function createOrganization(
  data: typeof organizations.$inferInsert
) {
  const [org] = await db.insert(organizations).values(data).returning();
  return org;
}

export async function updateOrganization(
  id: string,
  data: Partial<typeof organizations.$inferInsert>
) {
  const [org] = await db
    .update(organizations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(organizations.id, id))
    .returning();
  return org;
}

export async function deleteOrganization(id: string) {
  await db.delete(organizations).where(eq(organizations.id, id));
}

export async function getOrCreateOrganizationByName(name: string) {
  const existing = await db.query.organizations.findFirst({
    where: ilike(organizations.name, name),
  });
  if (existing) return existing;
  return createOrganization({ name });
}

// ── Deal Statuses ──────────────────────────────────────

export async function getDealStatuses() {
  return db.query.dealStatuses.findMany({
    orderBy: [asc(dealStatuses.position)],
  });
}

export async function getDefaultDealStatus() {
  return db.query.dealStatuses.findFirst({
    where: eq(dealStatuses.isDefault, true),
  });
}

// ── Lost Reasons ───────────────────────────────────────

export async function getLostReasons() {
  return db.query.lostReasons.findMany();
}

// ── Deals: List ────────────────────────────────────────

export type DealWithRelations = typeof deals.$inferSelect & {
  status: typeof dealStatuses.$inferSelect | null;
  organization: typeof organizations.$inferSelect | null;
  lead: typeof leads.$inferSelect | null;
  lostReason: typeof lostReasons.$inferSelect | null;
};

export async function getDeals(search?: string): Promise<DealWithRelations[]> {
  return db.query.deals.findMany({
    where: search
      ? or(
          ilike(deals.email, `%${search}%`),
          ilike(deals.mobileNo, `%${search}%`),
          ilike(deals.firstName, `%${search}%`),
          ilike(deals.lastName, `%${search}%`)
        )
      : undefined,
    with: {
      status: true,
      organization: true,
      lead: true,
      lostReason: true,
    },
    orderBy: [desc(deals.createdAt)],
  });
}

export async function getDealsKanban() {
  const statuses = await db.query.dealStatuses.findMany({
    orderBy: [asc(dealStatuses.position)],
    with: {
      deals: {
        orderBy: [desc(deals.createdAt)],
        with: {
          organization: true,
        },
      },
    },
  });
  return statuses;
}

// ── Deals: Detail ──────────────────────────────────────

export async function getDealById(id: string) {
  const deal = await db.query.deals.findFirst({
    where: eq(deals.id, id),
    with: {
      status: true,
      organization: true,
      lead: true,
      source: true,
      industry: true,
      territory: true,
      lostReason: true,
      dealProducts: {
        with: { product: true },
      },
    },
  });
  if (!deal) return null;

  const [dealContactLinks, dealActivities, dealTasks, dealComments] = await Promise.all([
    db.query.dealContacts.findMany({
      where: eq(dealContacts.dealId, id),
      with: { contact: { with: { organization: true } } },
    }),
    db.query.activities.findMany({
      where: and(
        eq(activities.referenceType, "deal"),
        eq(activities.referenceId, id)
      ),
      orderBy: [desc(activities.createdAt)],
    }),
    db.query.tasks.findMany({
      where: and(eq(tasks.referenceType, "deal"), eq(tasks.referenceId, id)),
      orderBy: [desc(tasks.createdAt)],
    }),
    db.query.comments.findMany({
      where: and(eq(comments.referenceType, "deal"), eq(comments.referenceId, id)),
      orderBy: [desc(comments.createdAt)],
    }),
  ]);

  return {
    ...deal,
    contacts: dealContactLinks.map((d) => d.contact),
    activities: dealActivities,
    tasks: dealTasks,
    comments: dealComments,
  };
}

export async function createDeal(data: typeof deals.$inferInsert) {
  const [deal] = await db.insert(deals).values(data).returning();
  return deal;
}

export async function updateDeal(
  id: string,
  data: Partial<typeof deals.$inferInsert>
) {
  const [deal] = await db
    .update(deals)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(deals.id, id))
    .returning();
  return deal;
}

export async function updateDealStatus(dealId: string, statusId: string) {
  const [deal] = await db
    .update(deals)
    .set({ statusId, updatedAt: new Date() })
    .where(eq(deals.id, dealId))
    .returning();
  return deal;
}

export async function deleteDeal(id: string) {
  await db.delete(deals).where(eq(deals.id, id));
}

// ── Products ───────────────────────────────────────────

export async function getProducts() {
  return db.query.products.findMany({
    orderBy: [desc(products.createdAt)],
  });
}

export async function createProduct(data: typeof products.$inferInsert) {
  const [product] = await db.insert(products).values(data).returning();
  return product;
}

// ── Notes ──────────────────────────────────────────────

export async function getNotes() {
  return db.query.notes.findMany({
    orderBy: [desc(notes.createdAt)],
  });
}

export async function getNotesByReference(
  referenceType: "lead" | "deal" | "contact" | "organization",
  referenceId: string
) {
  return db.query.notes.findMany({
    where: and(
      eq(notes.referenceType, referenceType),
      eq(notes.referenceId, referenceId)
    ),
    orderBy: [desc(notes.createdAt)],
  });
}

export async function createNote(data: typeof notes.$inferInsert) {
  const [note] = await db.insert(notes).values(data).returning();
  return note;
}

export async function updateNote(id: string, data: Partial<typeof notes.$inferInsert>) {
  const [note] = await db
    .update(notes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(notes.id, id))
    .returning();
  return note;
}

export async function deleteNote(id: string) {
  await db.delete(notes).where(eq(notes.id, id));
}

// ── Tasks ──────────────────────────────────────────────

export async function getTasks() {
  return db.query.tasks.findMany({
    orderBy: [desc(tasks.createdAt)],
  });
}

export async function getTasksByStatus() {
  const statuses = ["backlog", "todo", "in_progress", "done", "canceled"] as const;
  const result = await Promise.all(
    statuses.map(async (status) => ({
      status,
      tasks: await db.query.tasks.findMany({
        where: eq(tasks.status, status),
        orderBy: [desc(tasks.createdAt)],
      }),
    }))
  );
  return result;
}

export async function getTasksByReference(
  referenceType: "lead" | "deal" | "contact" | "organization",
  referenceId: string
) {
  return db.query.tasks.findMany({
    where: and(
      eq(tasks.referenceType, referenceType),
      eq(tasks.referenceId, referenceId)
    ),
    orderBy: [desc(tasks.createdAt)],
  });
}

export async function createTask(data: typeof tasks.$inferInsert) {
  const [task] = await db.insert(tasks).values(data).returning();
  return task;
}

export async function updateTask(id: string, data: Partial<typeof tasks.$inferInsert>) {
  const [task] = await db
    .update(tasks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();
  return task;
}

export async function updateTaskStatus(taskId: string, status: string) {
  const [task] = await db
    .update(tasks)
    .set({ status: status as never, updatedAt: new Date() })
    .where(eq(tasks.id, taskId))
    .returning();
  return task;
}

export async function deleteTask(id: string) {
  await db.delete(tasks).where(eq(tasks.id, id));
}

// ── Email Templates ────────────────────────────────────

export async function getEmailTemplates() {
  return db.query.emailTemplates.findMany({
    orderBy: [desc(emailTemplates.createdAt)],
  });
}

export async function getEmailTemplateById(id: string) {
  return db.query.emailTemplates.findFirst({
    where: eq(emailTemplates.id, id),
  });
}

export async function createEmailTemplate(data: typeof emailTemplates.$inferInsert) {
  const [tpl] = await db.insert(emailTemplates).values(data).returning();
  return tpl;
}

export async function updateEmailTemplate(id: string, data: Partial<typeof emailTemplates.$inferInsert>) {
  const [tpl] = await db
    .update(emailTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(emailTemplates.id, id))
    .returning();
  return tpl;
}

export async function deleteEmailTemplate(id: string) {
  await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
}

// ── Comments ───────────────────────────────────────────

export async function getCommentsByReference(
  referenceType: "lead" | "deal" | "contact" | "organization",
  referenceId: string
) {
  return db.query.comments.findMany({
    where: and(
      eq(comments.referenceType, referenceType),
      eq(comments.referenceId, referenceId)
    ),
    orderBy: [desc(comments.createdAt)],
  });
}

export async function createComment(data: typeof comments.$inferInsert) {
  const [comment] = await db.insert(comments).values(data).returning();
  return comment;
}

// ── Call Logs ──────────────────────────────────────────

export async function getCallLogs() {
  return db.query.callLogs.findMany({
    orderBy: [desc(callLogs.createdAt)],
  });
}

export async function getCallLogsByReference(
  referenceType: "lead" | "deal" | "contact" | "organization",
  referenceId: string
) {
  return db.query.callLogs.findMany({
    where: and(
      eq(callLogs.referenceType, referenceType),
      eq(callLogs.referenceId, referenceId)
    ),
    orderBy: [desc(callLogs.createdAt)],
  });
}

export async function createCallLog(data: typeof callLogs.$inferInsert) {
  const [log] = await db.insert(callLogs).values(data).returning();
  return log;
}

// ── Notifications ──────────────────────────────────────

export async function getNotifications(userId?: string) {
  return db.query.notifications.findMany({
    where: userId ? eq(notifications.userId, userId) : undefined,
    orderBy: [desc(notifications.createdAt)],
  });
}

export async function getUnreadNotificationCount(userId?: string) {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.read, false),
        userId ? eq(notifications.userId, userId) : sql`true`
      )
    );
  return result[0]?.count ?? 0;
}

export async function createNotification(data: typeof notifications.$inferInsert) {
  const [notif] = await db.insert(notifications).values(data).returning();
  return notif;
}

export async function markNotificationRead(id: string) {
  await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(userId?: string) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.read, false),
        userId ? eq(notifications.userId, userId) : sql`true`
      )
    );
}

// ── View Settings (saved views) ────────────────────────

export async function getViewSettings(routeName: string) {
  return db.query.viewSettings.findMany({
    where: eq(viewSettings.routeName, routeName),
    orderBy: [asc(viewSettings.label)],
  });
}

export async function createViewSetting(data: typeof viewSettings.$inferInsert) {
  const [view] = await db.insert(viewSettings).values(data).returning();
  return view;
}

export async function deleteViewSetting(id: string) {
  await db.delete(viewSettings).where(eq(viewSettings.id, id));
}

export async function setDefaultView(id: string, routeName: string) {
  await db.update(viewSettings).set({ isDefault: false }).where(eq(viewSettings.routeName, routeName));
  await db.update(viewSettings).set({ isDefault: true }).where(eq(viewSettings.id, id));
}

// ═══════════════════════════════════════════════════════════════
//  Pivot formation-centric — DAL Phase 1
// ═══════════════════════════════════════════════════════════════

// ── Bootcamps : helpers ────────────────────────────────

// "A démarré ?" est dérivé de startDate (pas stocké).
export function hasStarted(bootcamp: { startDate: string | null }): boolean {
  if (!bootcamp.startDate) return false;
  const start = new Date(bootcamp.startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return start <= today;
}

// Sème les 2 stages système par bootcamp (promote-or-create, idempotent).
// - converted : cherche kind='converted' ; sinon un stage dont le name matche
//   ILIKE l'un de 'inscrit','converti','converted','enrolled','admis' → PROMEUT
//   (kind='converted', isSystem=true). Sinon seulement → crée "Converti".
// - lost : même logique avec 'perdu','lost','abandonné','refusé'.
// N'insère jamais un 2e stage du même kind.
const CONVERTED_NAME_PATTERNS = ["inscrit", "converti", "converted", "enrolled", "admis"];
const LOST_NAME_PATTERNS = ["perdu", "lost", "abandonné", "refusé"];

function matchesAny(name: string, patterns: string[]): boolean {
  const lower = name.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

export async function ensureSystemStages(bootcampId: string) {
  const stages = await db.query.leadStatuses.findMany({
    where: eq(leadStatuses.bootcampId, bootcampId),
  });
  const maxPos = stages.reduce((m, s) => Math.max(m, s.position), -1);
  const updates: Promise<void>[] = [];
  const toInsert: { name: string; color: string; position: number; isDefault: boolean; isSystem: boolean; kind: "converted" | "lost"; bootcampId: string }[] = [];

  // --- converted ---
  if (!stages.some((s) => s.kind === "converted")) {
    const candidate = stages.find((s) => matchesAny(s.name, CONVERTED_NAME_PATTERNS));
    if (candidate) {
      // PROMOTE : on garde le name existant, on marque juste kind+isSystem.
      updates.push(
        (async () => {
          await db.update(leadStatuses).set({ kind: "converted", isSystem: true }).where(eq(leadStatuses.id, candidate.id));
        })()
      );
    } else {
      toInsert.push({ name: "Converti", color: "purple", position: maxPos + 1, isDefault: false, isSystem: true, kind: "converted", bootcampId });
    }
  }

  // --- lost ---
  if (!stages.some((s) => s.kind === "lost")) {
    const candidate = stages.find((s) => matchesAny(s.name, LOST_NAME_PATTERNS));
    if (candidate) {
      updates.push(
        (async () => {
          await db.update(leadStatuses).set({ kind: "lost", isSystem: true }).where(eq(leadStatuses.id, candidate.id));
        })()
      );
    } else {
      toInsert.push({ name: "Lost", color: "red", position: maxPos + (toInsert.length > 0 ? 2 : 1), isDefault: false, isSystem: true, kind: "lost", bootcampId });
    }
  }

  if (updates.length > 0) await Promise.all(updates);
  if (toInsert.length > 0) await db.insert(leadStatuses).values(toInsert);
}

// Copie les stages normaux (kind='normal') d'un bootcamp vers un autre, position incluse.
export async function cloneStagesFromBootcamp(srcId: string, dstId: string) {
  const srcStages = await db.query.leadStatuses.findMany({
    where: and(eq(leadStatuses.bootcampId, srcId), eq(leadStatuses.kind, "normal")),
    orderBy: [asc(leadStatuses.position)],
  });
  if (srcStages.length === 0) return;
  await db.insert(leadStatuses).values(
    srcStages.map((s) => ({
      name: s.name,
      color: s.color,
      position: s.position,
      isDefault: s.isDefault,
      isSystem: false,
      kind: "normal" as const,
      bootcampId: dstId,
    }))
  );
}

// Réordonne les stages d'un bootcamp selon l'ordre des ids fourni.
export async function reorderStages(bootcampId: string, orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, idx) =>
      db.update(leadStatuses).set({ position: idx }).where(eq(leadStatuses.id, id))
    )
  );
}

// ── Leads : contact (personne) + transitions ───────────

// Déduplication par lower(trim(email)) puis lower(trim(mobileNo)).
// Corrige le gap de normalisation de getOrCreateOrganizationByName (pas de trim/lower).
export async function getOrCreateContactForLead(input: {
  email: string | null;
  mobileNo: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  whatsapp?: string | null;
  age?: number | null;
}) {
  // 1) par email normalisé → match sûr, réutilise
  if (input.email && input.email.trim()) {
    const norm = input.email.trim().toLowerCase();
    const found = await db.query.contacts.findFirst({
      where: sql`lower(trim(coalesce(${contacts.email}, ''))) = ${norm}`,
    });
    if (found) return found;
  }
  // 2) par mobile : ne fusionne pas automatiquement deux humains (fix P2).
  //    Si un contact existe déjà avec ce mobile ET le même fullName → réutilise (re-soumission).
  //    Sinon → crée un nouveau contact flagué possibleDuplicate pour révision manuelle.
  if (input.mobileNo && input.mobileNo.trim()) {
    const norm = input.mobileNo.trim().toLowerCase();
    const existingWithMobile = await db.query.contacts.findFirst({
      where: sql`lower(trim(coalesce(${contacts.mobileNo}, ''))) = ${norm}`,
    });
    if (existingWithMobile && input.fullName.trim().toLowerCase() === existingWithMobile.fullName.trim().toLowerCase()) {
      return existingWithMobile;
    }
    return createContact({
      firstName: input.firstName?.trim() || null,
      lastName: input.lastName?.trim() || null,
      fullName: input.fullName.trim(),
      email: input.email?.trim() || null,
      mobileNo: input.mobileNo?.trim() || null,
      whatsapp: input.whatsapp?.trim() || null,
      age: input.age ?? null,
      possibleDuplicate: !!existingWithMobile,
    });
  }
  // 3) ni email ni mobile → création simple
  return createContact({
    firstName: input.firstName?.trim() || null,
    lastName: input.lastName?.trim() || null,
    fullName: input.fullName.trim(),
    email: input.email?.trim() || null,
    mobileNo: input.mobileNo?.trim() || null,
    whatsapp: input.whatsapp?.trim() || null,
    age: input.age ?? null,
  });
}

// Lecture légère du statusId courant (pour capturer le fromStatusId avant une transition).
export async function getLeadStatusId(leadId: string): Promise<string | null> {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
    columns: { statusId: true },
  });
  return lead?.statusId ?? null;
}

// Renvoie le stage kind='converted' d'un bootcamp (unique par construction P1).
// Utilisé par enrollLeadAction pour savoir où poser un lead inscrit.
export async function getConvertedStageForBootcamp(bootcampId: string) {
  return db.query.leadStatuses.findFirst({
    where: and(eq(leadStatuses.bootcampId, bootcampId), eq(leadStatuses.kind, "converted")),
  });
}

// ── Form Sources (formulaires Elementor par bootcamp) ──

export async function getFormSourcesByBootcamp(bootcampId: string) {
  return db.query.formSources.findMany({
    where: eq(formSources.bootcampId, bootcampId),
    orderBy: [asc(formSources.createdAt)],
  });
}

export async function createFormSource(data: typeof formSources.$inferInsert) {
  const [fs] = await db.insert(formSources).values(data).returning();
  return fs;
}

export async function updateFormSource(
  id: string,
  data: Partial<typeof formSources.$inferInsert>
) {
  const [fs] = await db
    .update(formSources)
    .set(data)
    .where(eq(formSources.id, id))
    .returning();
  return fs;
}

// ── Désignation du kind d'une colonne (unicité par bootcamp) ──
// Au plus UNE colonne 'converted' et UNE 'lost' par bootcamp : on rétrograde
// d'abord toute colonne du même kind (y compris la cible si elle l'était déjà),
// puis on promeut la cible. Idempotent. Ne touche AUCUN lead (option A).
export async function setStageKind(
  bootcampId: string,
  statusId: string,
  kind: "normal" | "converted" | "lost"
) {
  if (kind !== "normal") {
    await db
      .update(leadStatuses)
      .set({ kind: "normal", isSystem: false })
      .where(and(eq(leadStatuses.bootcampId, bootcampId), eq(leadStatuses.kind, kind)));
  }
  await db
    .update(leadStatuses)
    .set({ kind, isSystem: kind !== "normal" })
    .where(and(eq(leadStatuses.id, statusId), eq(leadStatuses.bootcampId, bootcampId)));
}

// Déplace un lead vers un stage : update statusId + stageEnteredAt ET insère stage_history.
// exec = db par défaut ; passer un tx Drizzle pour exécuter dans une transaction.
export async function moveLeadToStage(
  leadId: string,
  statusId: string,
  exec: DbExecutor = db
) {
  const current = await exec.query.leads.findFirst({
    where: eq(leads.id, leadId),
    columns: { statusId: true },
  });
  await exec
    .update(leads)
    .set({ statusId, stageEnteredAt: new Date(), updatedAt: new Date() })
    .where(eq(leads.id, leadId));
  await exec.insert(stageHistory).values({
    leadId,
    fromStatusId: current?.statusId ?? null,
    toStatusId: statusId,
  });
  return exec.query.leads.findFirst({ where: eq(leads.id, leadId) });
}

export async function setTemperature(leadId: string, temperature: "hot" | "cold") {
  await db
    .update(leads)
    .set({ temperature, updatedAt: new Date() })
    .where(eq(leads.id, leadId));
}

// ── Tags ───────────────────────────────────────────────

export async function getTags() {
  return db.query.tags.findMany({ orderBy: [asc(tags.name)] });
}

export async function createTag(data: typeof tags.$inferInsert) {
  const [tag] = await db.insert(tags).values(data).returning();
  return tag;
}

export async function attachTagToLead(leadId: string, tagId: string) {
  await db.insert(leadTags).values({ leadId, tagId }).onConflictDoNothing();
}

export async function detachTagFromLead(leadId: string, tagId: string) {
  await db.delete(leadTags).where(and(eq(leadTags.leadId, leadId), eq(leadTags.tagId, tagId)));
}

// ── Payment Schedules ──────────────────────────────────

// Génère les échéances depuis l'offre prix du bootcamp du lead.
// 'total' → 1 échéance (amount=priceTotal) ; 'monthly' → monthlyCount échéances (amount=monthlyAmount).
// exec = db par défaut ; passer un tx Drizzle pour exécuter dans une transaction.
export async function generateScheduleForLead(
  leadId: string,
  plan: "total" | "monthly",
  exec: DbExecutor = db
) {
  const lead = await exec.query.leads.findFirst({
    where: eq(leads.id, leadId),
    with: { bootcamp: true },
  });
  if (!lead?.bootcamp) return [];
  const b = lead.bootcamp;

  if (plan === "total") {
    if (!b.priceTotal) return [];
    const today = new Date();
    await exec.insert(paymentSchedules).values({
      leadId,
      plan: "total",
      amount: b.priceTotal,
      dueDate: today.toISOString().slice(0, 10), // dû le jour J (inscription)
    });
  } else {
    if (!b.monthlyCount || !b.monthlyAmount) return [];
    const rows: { leadId: string; plan: "monthly"; amount: string; dueDate: string }[] = [];
    const base = new Date();
    for (let i = 0; i < b.monthlyCount; i++) {
      // Échéance 1 (i=0) = acompte, dû le jour de l'inscription.
      // Échéances 2..N (i=1..N-1) = 1er du mois, à partir du mois suivant l'inscription.
      const d = i === 0
        ? base
        : new Date(base.getFullYear(), base.getMonth() + i + 1, 1);
      rows.push({ leadId, plan: "monthly", amount: b.monthlyAmount, dueDate: d.toISOString().slice(0, 10) });
    }
    await exec.insert(paymentSchedules).values(rows);
  }
  return exec.query.paymentSchedules.findMany({
    where: eq(paymentSchedules.leadId, leadId),
    orderBy: [asc(paymentSchedules.createdAt)],
  });
}

// Marque une échéance précise comme payée.
// exec = db par défaut ; passer un tx Drizzle pour exécuter dans une transaction.
export async function markEcheancePaid(id: string, exec: DbExecutor = db) {
  await exec
    .update(paymentSchedules)
    .set({ isPaid: true, paidAt: new Date() })
    .where(eq(paymentSchedules.id, id));
}

// Marque la PREMIÈRE échéance d'un lead comme payée (utilisé par enrollLeadAction).
// exec = db par défaut ; passer un tx Drizzle pour exécuter dans une transaction.
export async function markFirstEcheancePaid(leadId: string, exec: DbExecutor = db) {
  const schedules = await exec.query.paymentSchedules.findMany({
    where: eq(paymentSchedules.leadId, leadId),
    orderBy: [asc(paymentSchedules.createdAt)],
  });
  if (schedules.length === 0) return;
  await exec
    .update(paymentSchedules)
    .set({ isPaid: true, paidAt: new Date() })
    .where(eq(paymentSchedules.id, schedules[0].id));
}

// Retourne l'échéancier d'un lead ordonné par dueDate + résumé.
export async function getScheduleForLead(leadId: string) {
  const rows = await db.query.paymentSchedules.findMany({
    where: eq(paymentSchedules.leadId, leadId),
    orderBy: [asc(paymentSchedules.dueDate), asc(paymentSchedules.createdAt)],
  });
  const count = rows.length;
  const paidCount = rows.filter((r) => r.isPaid).length;
  const total = rows.reduce((acc, r) => acc + (r.amount ? Number(r.amount) : 0), 0);
  const status = await paymentStatus(leadId);
  return { items: rows, summary: { total, paidCount, count, status } };
}

// Marque une échéance comme non payée (correction).
export async function markEcheanceUnpaid(id: string, exec: DbExecutor = db) {
  await exec
    .update(paymentSchedules)
    .set({ isPaid: false, paidAt: null })
    .where(eq(paymentSchedules.id, id));
}

// 'paid' = toutes réglées ; 'on_track' = des non-réglées mais aucune en retard ; 'overdue' = au moins une en retard.
export async function paymentStatus(leadId: string): Promise<"paid" | "on_track" | "overdue"> {
  const rows = await db.query.paymentSchedules.findMany({
    where: eq(paymentSchedules.leadId, leadId),
  });
  if (rows.length === 0) return "on_track";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allPaid = rows.every((r) => r.isPaid);
  if (allPaid) return "paid";
  const hasOverdue = rows.some(
    (r) => !r.isPaid && r.dueDate != null && new Date(r.dueDate) < today
  );
  return hasOverdue ? "overdue" : "on_track";
}

// ── Analytics (Phase 3c) ──────────────────────────────

function timeSince(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 1) return "< 1 jour";
  if (days === 1) return "1 jour";
  return `${days} jours`;
}

function formatDuration(days: number): string {
  if (days < 1) return "< 1 jour";
  const d = Math.round(days * 10) / 10;
  return `${d} j`;
}

const STALL_DAYS = 7;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function conversionStats(bootcampId?: string) {
  const filter = bootcampId ? eq(leads.bootcampId, bootcampId) : undefined;

  const allLeads = await db.query.leads.findMany({
    where: filter,
    columns: { converted: true, convertedAt: true, createdAt: true, stageEnteredAt: true },
    with: { status: { columns: { kind: true } } },
  });

  const totalLeads = allLeads.length;
  const convertedLeads = allLeads.filter((l) => l.converted && l.convertedAt);
  const convertedCount = convertedLeads.length;
  const conversionRate = totalLeads > 0 ? convertedCount / totalLeads : 0;

  const durations = convertedLeads
    .map((l) => {
      const diff = l.convertedAt!.getTime() - l.createdAt.getTime();
      return diff / (1000 * 60 * 60 * 24);
    })
    .filter((d) => d >= 0);

  const avgDaysToConvert = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : null;
  const medianDaysToConvert = durations.length > 0 ? median(durations) : null;

  // Contrepoids : leads ouverts (non convertis, non perdus)
  const now = Date.now();
  const openLeads = allLeads.filter((l) => {
    if (l.converted) return false;
    return l.status?.kind !== "lost";
  });
  const openCount = openLeads.length;

  const lostLeads = allLeads.filter((l) => l.status?.kind === "lost" && !l.converted);
  const lostCount = lostLeads.length;

  const ages = openLeads.map((l) => (now - l.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const avgAgeOpenLeads = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : null;

  const stalledCount = openLeads.filter((l) => {
    const ref = l.stageEnteredAt ?? l.createdAt;
    return (now - ref.getTime()) / (1000 * 60 * 60 * 24) > STALL_DAYS;
  }).length;

  return { totalLeads, convertedCount, conversionRate, avgDaysToConvert, medianDaysToConvert, openCount, lostCount, avgAgeOpenLeads, stalledCount };
}

export async function funnelByStage(bootcampId?: string) {
  if (bootcampId) {
    const statuses = await db.query.leadStatuses.findMany({
      where: eq(leadStatuses.bootcampId, bootcampId),
      orderBy: [asc(leadStatuses.position)],
      with: {
        leads: { columns: { id: true } },
      },
    });

    // Current count par stage (toujours exact — reflet du statut courant)
    const stages = statuses.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      position: s.position,
      currentCount: s.leads.length,
    }));

    // Cumulés : nombre de leads ayant ATTEINT ce stage (via stage_history si dispo,
    // sinon best-effort basé sur le stage courant)
    const stageIds = statuses.map((s) => s.id);
    let reachedMap = new Map<string, number>();

    if (stageIds.length > 0) {
      const rows = await db.execute<{ to_status_id: string; cnt: number }>(
        sql`SELECT to_status_id, COUNT(DISTINCT lead_id) as cnt
            FROM stage_history
            WHERE to_status_id IN (${sql.join(stageIds.map((id) => sql`${id}`), sql`, `)})
            GROUP BY to_status_id`
      );
      for (const r of rows) {
        reachedMap.set(r.to_status_id, Number(r.cnt));
      }
    }

    const stagesWithReached = stages.map((s) => ({
      ...s,
      reachedCount: reachedMap.get(s.id) ?? s.currentCount,
    }));

    return { type: "by_stage" as const, stages: stagesWithReached };
  }

  // Global : agrège par kind
  const allStatuses = await db.query.leadStatuses.findMany({
    with: { leads: { columns: { id: true } } },
  });
  const byKind = { new: 0, in_progress: 0, converted: 0, lost: 0 };
  for (const s of allStatuses) {
    if (s.kind === "converted") byKind.converted += s.leads.length;
    else if (s.kind === "lost") byKind.lost += s.leads.length;
    else if (s.kind === "normal" && s.position <= 1) byKind.new += s.leads.length;
    else byKind.in_progress += s.leads.length;
  }

  return { type: "by_kind" as const, ...byKind };
}

export async function conversionBySource(bootcampId?: string) {
  const filter = bootcampId ? eq(leads.bootcampId, bootcampId) : undefined;

  const rows = await db.query.leads.findMany({
    where: filter,
    columns: { converted: true, convertedAt: true },
    with: { source: true, formSource: true },
  });

  // Grouper par formSource (si dispo) sinon lead_source, sinon "Sans source"
  const groups = new Map<string, { total: number; converted: number }>();
  for (const lead of rows) {
    const key = lead.formSource?.name || lead.source?.name || "Sans source";
    const g = groups.get(key) || { total: 0, converted: 0 };
    g.total++;
    if (lead.converted) g.converted++;
    groups.set(key, g);
  }

  return Array.from(groups.entries())
    .map(([source, { total, converted }]) => ({
      source,
      total,
      converted,
      rate: total > 0 ? converted / total : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export async function conversionByTemperature(bootcampId?: string) {
  const filter = bootcampId ? eq(leads.bootcampId, bootcampId) : undefined;

  const rows = await db.query.leads.findMany({
    where: filter,
    columns: { temperature: true, converted: true, convertedAt: true },
  });

  const hot = { total: 0, converted: 0 };
  const cold = { total: 0, converted: 0 };

  for (const lead of rows) {
    if (lead.temperature === "hot") {
      hot.total++;
      if (lead.converted) hot.converted++;
    } else {
      cold.total++;
      if (lead.converted) cold.converted++;
    }
  }

  return {
    hot: { ...hot, rate: hot.total > 0 ? hot.converted / hot.total : 0 },
    cold: { ...cold, rate: cold.total > 0 ? cold.converted / cold.total : 0 },
  };
}

// ── Note Templates ─────────────────────────────────────

// Capture structurée d'une transition de statut.
// exec = db par défaut ; passer un tx Drizzle pour exécuter dans une transaction.
export async function recordStageChange(
  leadId: string,
  fromStatusId: string | null,
  toStatusId: string | null,
  changedBy?: string | null,
  exec: DbExecutor = db
) {
  const [row] = await exec
    .insert(stageHistory)
    .values({ leadId, fromStatusId, toStatusId, changedBy: changedBy ?? null })
    .returning();
  return row;
}
