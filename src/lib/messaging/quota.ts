import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { campaignRecipients, automationRuns } from "@/db/schema";

/** Plafond quotidien du plan gratuit Resend — il vaut pour TOUT le compte. */
export const DAILY_LIMIT = 100;

/**
 * Emails déjà partis aujourd'hui, campagnes ET automatisations confondues.
 *
 * Le plafond Resend est celui du compte, pas celui d'une fonctionnalité :
 * ne compter que les campagnes laissait les automatisations passer par-dessus
 * sans être décomptées, et le refus n'apparaissait qu'après coup, à l'envoi.
 */
export async function sentToday(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [c] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(campaignRecipients)
    .where(and(eq(campaignRecipients.status, "sent"), gte(campaignRecipients.sentAt, start)));

  const [a] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(automationRuns)
    .where(and(eq(automationRuns.status, "sent"), gte(automationRuns.sentAt, start)));

  return (c?.n ?? 0) + (a?.n ?? 0);
}
