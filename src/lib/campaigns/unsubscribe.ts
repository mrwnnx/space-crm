import "server-only";
import { db } from "@/db";
import { campaignRecipients, contacts } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export type UnsubscribeTarget = {
  id: string;
  fullName: string;
  email: string | null;
  unsubscribedAt: Date | null;
};

export async function getContactByUnsubscribeToken(
  token: string
): Promise<UnsubscribeTarget | null> {
  if (!token) return null;
  const [row] = await db
    .select({
      id: contacts.id,
      fullName: contacts.fullName,
      email: contacts.email,
      unsubscribedAt: contacts.unsubscribedAt,
    })
    .from(contacts)
    .where(eq(contacts.unsubscribeToken, token))
    .limit(1);
  return row ?? null;
}

/** Idempotent : un second clic ne réécrit pas la date du premier. */
export async function unsubscribeByToken(
  token: string,
  campaignId?: string | null
): Promise<boolean> {
  if (!token) return false;
  const rows = await db
    .update(contacts)
    .set({ unsubscribedAt: new Date(), updatedAt: new Date() })
    .where(eq(contacts.unsubscribeToken, token))
    .returning({ id: contacts.id });

  if (rows.length === 0) return false;

  // Attribution à la campagne d'origine, quand elle est connue.
  if (campaignId) {
    await db
      .update(campaignRecipients)
      .set({ unsubscribedAt: new Date() })
      .where(
        and(
          eq(campaignRecipients.campaignId, campaignId),
          eq(campaignRecipients.contactId, rows[0].id),
          isNull(campaignRecipients.unsubscribedAt)
        )
      );
  }
  return true;
}

/** Réabonnement, depuis la même page — une erreur de clic doit être réparable. */
export async function resubscribeByToken(token: string): Promise<boolean> {
  if (!token) return false;
  const rows = await db
    .update(contacts)
    .set({ unsubscribedAt: null, updatedAt: new Date() })
    .where(eq(contacts.unsubscribeToken, token))
    .returning({ id: contacts.id });
  return rows.length > 0;
}
