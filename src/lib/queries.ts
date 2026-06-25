import "server-only";
import { db } from "@/db";
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
} from "@/db/schema";
import { eq, desc, asc, ilike, or, and, sql } from "drizzle-orm";

// ── Lead Statuses ──────────────────────────────────────

export async function getLeadStatuses() {
  return db.query.leadStatuses.findMany({
    orderBy: [asc(leadStatuses.position)],
  });
}

export async function getDefaultLeadStatus() {
  return db.query.leadStatuses.findFirst({
    where: eq(leadStatuses.isDefault, true),
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
};

export async function getLeads(): Promise<LeadWithRelations[]> {
  return db.query.leads.findMany({
    with: {
      status: true,
      source: true,
      industry: true,
      organization: true,
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
    },
    orderBy: [desc(leads.createdAt)],
  });
}

// ── Leads: Kanban (grouped by status) ──────────────────

export async function getLeadsKanban() {
  const statuses = await db.query.leadStatuses.findMany({
    orderBy: [asc(leadStatuses.position)],
    with: {
      leads: {
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
      deals: {
        orderBy: [desc(deals.createdAt)],
      },
    },
  });
  if (!lead) return null;

  const [leadActivities, leadTasks, leadNotes] = await Promise.all([
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
  ]);

  return {
    ...lead,
    activities: leadActivities,
    tasks: leadTasks,
    notes: leadNotes,
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

  return {
    total: total[0]?.count ?? 0,
    converted: converted[0]?.count ?? 0,
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

export async function getContacts(): Promise<ContactWithRelations[]> {
  return db.query.contacts.findMany({
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

  const [contactLeads, contactDealLinks] = await Promise.all([
    db.query.leads.findMany({
      where: or(
        ilike(leads.email, contact.email || "___"),
        ilike(leads.mobileNo, contact.mobileNo || "___")
      ),
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

export async function getOrganizations(): Promise<OrganizationWithRelations[]> {
  return db.query.organizations.findMany({
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

export async function getDeals(): Promise<DealWithRelations[]> {
  return db.query.deals.findMany({
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

  const [dealContactLinks, dealActivities] = await Promise.all([
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
  ]);

  return {
    ...deal,
    contacts: dealContactLinks.map((d) => d.contact),
    activities: dealActivities,
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
