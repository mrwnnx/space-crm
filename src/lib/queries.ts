import "server-only";
import { db } from "@/db";
import { leads, leadActivities, pipelineStages, cohorts } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";

// ── Pipeline Stages ────────────────────────────────────

export async function getStages() {
  return db.query.pipelineStages.findMany({
    orderBy: [pipelineStages.order],
  });
}

export async function getStagesWithLeads() {
  const stages = await db.query.pipelineStages.findMany({
    orderBy: [pipelineStages.order],
    with: {
      leads: {
        orderBy: [desc(leads.score)],
      },
    },
  });
  return stages;
}

// ── Leads ──────────────────────────────────────────────

export async function getLeadById(id: string) {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, id),
    with: {
      stage: true,
      cohortInterest: true,
      activities: {
        orderBy: [desc(leadActivities.createdAt)],
      },
    },
  });
  return lead;
}

export async function getLeadsByStage(stageId: string) {
  return db.query.leads.findMany({
    where: eq(leads.stageId, stageId),
    orderBy: [desc(leads.score)],
  });
}

export async function updateLeadStage(leadId: string, stageId: string) {
  await db
    .update(leads)
    .set({ stageId, updatedAt: new Date() })
    .where(eq(leads.id, leadId));
}

// ── Cohorts ────────────────────────────────────────────

export async function getCohorts() {
  return db.query.cohorts.findMany({
    orderBy: [desc(cohorts.startDate)],
  });
}

export async function getActiveCohort() {
  return db.query.cohorts.findFirst({
    where: eq(cohorts.status, "open"),
    orderBy: [cohorts.startDate],
  });
}

// ── Stats ──────────────────────────────────────────────

export async function getDashboardStats() {
  const totalLeads = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads);

  const contactedThisWeek = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      sql`${leads.lastContactedAt} > now() - interval '7 days'`
    );

  const hotLeads = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(sql`${leads.score} >= 50`);

  const openCohorts = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cohorts)
    .where(eq(cohorts.status, "open"));

  return {
    totalLeads: totalLeads[0]?.count ?? 0,
    contactedThisWeek: contactedThisWeek[0]?.count ?? 0,
    hotLeads: hotLeads[0]?.count ?? 0,
    openCohorts: openCohorts[0]?.count ?? 0,
  };
}

// ── Seed ───────────────────────────────────────────────

export const DEFAULT_STAGES = [
  { name: "Nouveau", slug: "nouveau", order: 0, color: "blue" },
  { name: "Contacté", slug: "contacte", order: 1, color: "amber" },
  { name: "Intéressé", slug: "interesse", order: 2, color: "purple" },
  { name: "Inscrit", slug: "inscrit", order: 3, color: "green" },
  { name: "Perdu", slug: "perdu", order: 4, color: "red" },
];

export async function seedDefaultStages() {
  const existing = await db.select().from(pipelineStages);
  if (existing.length > 0) return;
  await db.insert(pipelineStages).values(DEFAULT_STAGES);
}
