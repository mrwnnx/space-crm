import "server-only";
import { db } from "@/db";
import { campaignRecipients, contacts } from "@/db/schema";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

export type UnsubscribeTarget = {
  id: string;
  fullName: string;
  email: string | null;
  unsubscribedAt: Date | null;
  unsubscribeReason: string | null;
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
      unsubscribeReason: contacts.unsubscribeReason,
    })
    .from(contacts)
    .where(eq(contacts.unsubscribeToken, token))
    .limit(1);
  return row ?? null;
}

/**
 * Idempotent : un second clic ne réécrit pas la date du premier.
 * `reason` ne sert qu'au clic Gmail (« one_click ») : depuis la page, la raison
 * arrive APRÈS, par saveUnsubscribeReason — le désabonnement n'attend jamais.
 */
export async function unsubscribeByToken(
  token: string,
  campaignId?: string | null,
  reason?: string | null
): Promise<boolean> {
  if (!token) return false;
  const rows = await db
    .update(contacts)
    .set({
      unsubscribedAt: new Date(),
      updatedAt: new Date(),
      ...(reason ? { unsubscribeReason: reason, unsubscribeNote: null } : {}),
    })
    .where(eq(contacts.unsubscribeToken, token))
    .returning({ id: contacts.id });

  if (rows.length === 0) return false;

  // Attribution à la campagne d'origine, quand elle est connue.
  if (campaignId) {
    await db
      .update(campaignRecipients)
      .set({ unsubscribedAt: new Date(), ...(reason ? { unsubscribeReason: reason } : {}) })
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

/**
 * La raison, donnée après coup. Une seule par désabonnement : le premier clic
 * gagne, un second (rechargement, double clic) ne réécrit rien.
 */
export async function saveUnsubscribeReason(
  token: string,
  reason: string,
  note: string | null,
  campaignId?: string | null
): Promise<boolean> {
  if (!token) return false;
  const rows = await db
    .update(contacts)
    .set({ unsubscribeReason: reason, unsubscribeNote: note, updatedAt: new Date() })
    .where(
      and(
        eq(contacts.unsubscribeToken, token),
        isNotNull(contacts.unsubscribedAt),
        isNull(contacts.unsubscribeReason)
      )
    )
    .returning({ id: contacts.id });
  if (rows.length === 0) return false;
  if (campaignId) {
    await db
      .update(campaignRecipients)
      .set({ unsubscribeReason: reason, unsubscribeNote: note })
      .where(
        and(
          eq(campaignRecipients.campaignId, campaignId),
          eq(campaignRecipients.contactId, rows[0].id),
          isNotNull(campaignRecipients.unsubscribedAt),
          isNull(campaignRecipients.unsubscribeReason)
        )
      );
  }
  return true;
}

/** Réabonnement, depuis la même page — une erreur de clic doit être réparable. */
export async function resubscribeByToken(token: string): Promise<boolean> {
  if (!token) return false;
  // La raison part avec le désabonnement : un contact abonné n'a pas de raison
  // d'être parti. Celle attribuée à la campagne reste, c'est de l'historique.
  const rows = await db
    .update(contacts)
    .set({ unsubscribedAt: null, unsubscribeReason: null, unsubscribeNote: null, updatedAt: new Date() })
    .where(eq(contacts.unsubscribeToken, token))
    .returning({ id: contacts.id });
  return rows.length > 0;
}
