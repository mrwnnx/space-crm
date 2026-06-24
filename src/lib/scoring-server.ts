import "server-only";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import { calculateScore } from "@/lib/scoring";

// ── Recompute & persist ────────────────────────────────

export async function recomputeLeadScore(leadId: string) {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
    with: { activities: true },
  });
  if (!lead) return;

  const score = calculateScore(lead, lead.activities);
  await db
    .update(leads)
    .set({ score, updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  return score;
}

// ── Find re-engagement candidates ──────────────────────
// Leads not contacted in 30+ days, not in "Perdu" stage

export async function getStaleLeads(daysSinceContact = 30) {
  return db
    .select()
    .from(leads)
    .where(
      and(
        sql`${leads.lastContactedAt} < now() - interval '${sql.raw(String(daysSinceContact))} days'`,
        sql`${leads.stageId} IS NOT NULL`
      )
    )
    .orderBy(desc(leads.score));
}
