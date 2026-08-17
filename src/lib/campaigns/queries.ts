import "server-only";
import { db } from "@/db";
import { campaignRecipients, campaigns } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

export type CampaignRow = {
  id: string;
  name: string;
  subject: string | null;
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

export async function getCampaigns(): Promise<CampaignRow[]> {
  return db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      subject: campaigns.subject,
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
    .groupBy(campaigns.id)
    .orderBy(desc(campaigns.createdAt));
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
  status: string;
  error: string | null;
  sentAt: Date | null;
};

export async function getCampaignRecipients(campaignId: string): Promise<RecipientRow[]> {
  return db
    .select({
      id: campaignRecipients.id,
      email: campaignRecipients.email,
      status: campaignRecipients.status,
      error: campaignRecipients.error,
      sentAt: campaignRecipients.sentAt,
    })
    .from(campaignRecipients)
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
