import "server-only";
import { db } from "@/db";
import { campaignRecipients, campaigns, contacts } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

export type CampaignRow = {
  id: string;
  name: string;
  subject: string | null;
  internalNote: string | null;
  status: string;
  scheduledAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
  /** destinataires réellement matérialisés (0 tant que rien n'est parti) */
  recipientCount: number;
  sentCount: number;
  bouncedCount: number;
  failedCount: number;
  openedCount: number;
  clickedCount: number;
};

export async function getCampaigns(filters?: {
  q?: string;
  status?: string;
}): Promise<CampaignRow[]> {
  const conds = [];

  // Recherche sur le nom ET le sujet : on cherche plus souvent ce que le
  // destinataire a vu que le nom interne tapé trois semaines plus tôt.
  if (filters?.q?.trim()) {
    const like = `%${filters.q.trim().toLowerCase()}%`;
    conds.push(
      sql`(lower(${campaigns.name}) like ${like} or lower(coalesce(${campaigns.subject}, '')) like ${like})`
    );
  }

  if (filters?.status) {
    conds.push(eq(campaigns.status, filters.status));
  } else {
    // Les archivées sont rangées : elles ne réapparaissent que si on les demande.
    conds.push(sql`${campaigns.status} <> 'archived'`);
  }

  return db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      subject: campaigns.subject,
      internalNote: campaigns.internalNote,
      status: campaigns.status,
      scheduledAt: campaigns.scheduledAt,
      sentAt: campaigns.sentAt,
      createdAt: campaigns.createdAt,
      recipientCount: sql<number>`count(${campaignRecipients.id})::int`,
      sentCount: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'sent')::int`,
      bouncedCount: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'bounced')::int`,
      failedCount: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'failed')::int`,
      openedCount: sql<number>`count(*) filter (where ${campaignRecipients.openedAt} is not null)::int`,
      clickedCount: sql<number>`count(*) filter (where ${campaignRecipients.clickedAt} is not null)::int`,
    })
    .from(campaigns)
    .leftJoin(campaignRecipients, eq(campaignRecipients.campaignId, campaigns.id))
    .where(and(...conds))
    .groupBy(campaigns.id)
    .orderBy(desc(campaigns.createdAt));
}

/** Compte par statut, pour afficher les effectifs dans le filtre. */
export async function getCampaignStatusCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: campaigns.status, n: sql<number>`count(*)::int` })
    .from(campaigns)
    .groupBy(campaigns.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
}

export async function getCampaignById(id: string) {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return row ?? null;
}

export async function createCampaign(data: { name: string; subject?: string | null }) {
  const [row] = await db
    .insert(campaigns)
    .values({ name: data.name, subject: data.subject ?? null })
    .returning();
  return row;
}

/** Whitelist stricte : rien d'autre que ces champs ne peut être écrit ici. */
export async function updateCampaign(
  id: string,
  data: Partial<{
    name: string;
    subject: string | null;
    content: string;
    targetTagIds: string[];
    targetEmails: string[];
    internalNote: string | null;
    scheduledAt: Date | null;
  }>
) {
  const [row] = await db
    .update(campaigns)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(campaigns.id, id))
    .returning();
  return row;
}

export async function deleteCampaign(id: string) {
  await db.delete(campaigns).where(eq(campaigns.id, id));
}

export type RecipientRow = {
  id: string;
  email: string;
  fullName: string | null;
  status: string;
  error: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  openedAt: Date | null;
  openCount: number;
  clickedAt: Date | null;
  clickCount: number;
  unsubscribedAt: Date | null;
};

export async function getCampaignRecipients(campaignId: string): Promise<RecipientRow[]> {
  return db
    .select({
      id: campaignRecipients.id,
      email: campaignRecipients.email,
      fullName: contacts.fullName,
      status: campaignRecipients.status,
      error: campaignRecipients.error,
      sentAt: campaignRecipients.sentAt,
      deliveredAt: campaignRecipients.deliveredAt,
      openedAt: campaignRecipients.openedAt,
      openCount: campaignRecipients.openCount,
      clickedAt: campaignRecipients.clickedAt,
      clickCount: campaignRecipients.clickCount,
      unsubscribedAt: campaignRecipients.unsubscribedAt,
    })
    .from(campaignRecipients)
    .leftJoin(contacts, eq(contacts.id, campaignRecipients.contactId))
    .where(eq(campaignRecipients.campaignId, campaignId))
    .orderBy(campaignRecipients.email);
}

/** Remet les échecs en attente pour qu'une relance les reprenne. */
export async function resetFailedRecipients(campaignId: string): Promise<number> {
  const rows = await db
    .update(campaignRecipients)
    .set({ status: "pending", error: null })
    .where(
      and(
        eq(campaignRecipients.campaignId, campaignId),
        eq(campaignRecipients.status, "failed")
      )
    )
    .returning({ id: campaignRecipients.id });
  return rows.length;
}

/**
 * Rouvre une campagne close pour une relance d'échecs. Sans ça, sendCampaign
 * refuserait le statut "sent" et la relance ne partirait jamais.
 */
export async function reopenCampaignForRetry(id: string) {
  await db
    .update(campaigns)
    .set({ status: "sending", sentAt: null, updatedAt: new Date() })
    .where(eq(campaigns.id, id));
}

/** Statuts d'une campagne. `status` est une colonne texte : rien à migrer. */
export const CAMPAIGN_STATUSES = [
  "draft",      // brouillon
  "scheduled",  // programmée, pas encore partie
  "sending",    // envoi en cours (ou interrompu, reprenable)
  "paused",     // suspendue par l'utilisateur — ne repart pas seule
  "sent",       // terminée
  "failed",     // échec technique
  "cancelled",  // abandonnée : ne partira jamais, trace conservée
  "archived",   // rangée : masquée de la liste par défaut
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** Un envoi ne peut PLUS repartir depuis ces états. */
export const TERMINAL_STATUSES: CampaignStatus[] = ["sent", "cancelled", "archived"];

export async function setCampaignStatus(id: string, status: CampaignStatus) {
  const [row] = await db
    .update(campaigns)
    .set({ status, updatedAt: new Date() })
    .where(eq(campaigns.id, id))
    .returning();
  return row;
}

/** Lecture minimale du statut — appelée entre chaque lot d'envoi. */
export async function getCampaignStatus(id: string): Promise<string | null> {
  const [row] = await db
    .select({ status: campaigns.status })
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1);
  return row?.status ?? null;
}
