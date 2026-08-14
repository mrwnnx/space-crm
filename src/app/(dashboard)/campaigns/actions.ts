"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createCampaign,
  deleteCampaign,
  getCampaignById,
  updateCampaign,
} from "@/lib/campaigns/queries";

// Actions colocalisées plutôt qu'ajoutées à src/app/actions.ts, qui dépasse
// déjà largement le millier de lignes. Les campagnes forment un sous-système
// à part : leur code reste ensemble.

export async function createCampaignAction(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false as const, error: "Le nom est obligatoire" };

  const campaign = await createCampaign({ name });
  revalidatePath("/campaigns");
  return { ok: true as const, id: campaign.id };
}

export async function renameCampaignAction(id: string, name: string) {
  await requireUser();
  const clean = name.trim();
  if (!clean) return { ok: false as const, error: "Le nom est obligatoire" };

  const existing = await getCampaignById(id);
  if (!existing) return { ok: false as const, error: "Campagne introuvable" };
  // Une campagne partie est un fait daté : on ne réécrit pas son nom après coup.
  if (existing.status !== "draft") {
    return { ok: false as const, error: "Campagne déjà envoyée" };
  }

  await updateCampaign(id, { name: clean });
  revalidatePath("/campaigns");
  return { ok: true as const };
}

export async function deleteCampaignAction(id: string) {
  await requireUser();
  const existing = await getCampaignById(id);
  if (!existing) return { ok: false as const, error: "Campagne introuvable" };
  // Supprimer une campagne envoyée effacerait la trace de ce qui est parti
  // chez de vraies personnes. Seuls les brouillons sont supprimables.
  if (existing.status !== "draft") {
    return { ok: false as const, error: "Une campagne envoyée ne se supprime pas" };
  }

  await deleteCampaign(id);
  revalidatePath("/campaigns");
  return { ok: true as const };
}

export async function saveCampaignContentAction(
  id: string,
  subject: string,
  content: string
) {
  await requireUser();
  const existing = await getCampaignById(id);
  if (!existing) return { ok: false as const, error: "Campagne introuvable" };
  if (existing.status !== "draft") {
    return { ok: false as const, error: "Campagne déjà envoyée" };
  }

  await updateCampaign(id, { subject: subject.trim() || null, content });
  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/campaigns");
  return { ok: true as const };
}

/**
 * Aperçu de la cible. Passe par resolveCampaignAudience — la MÊME fonction que
 * l'envoi utilisera : le compteur affiché ne peut donc pas diverger de ce qui
 * partira.
 */
export async function previewAudienceAction(tagIds: string[], emails: string[]) {
  await requireUser();
  const { resolveCampaignAudience } = await import("@/lib/campaigns/audience");
  const { stats, ignoredEmails } = await resolveCampaignAudience({ tagIds, emails });
  return { stats, ignoredEmails };
}

export async function saveCampaignTargetAction(
  id: string,
  tagIds: string[],
  emails: string[]
) {
  await requireUser();
  const existing = await getCampaignById(id);
  if (!existing) return { ok: false as const, error: "Campagne introuvable" };
  if (existing.status !== "draft") {
    return { ok: false as const, error: "Campagne déjà envoyée" };
  }

  await updateCampaign(id, { targetTagIds: tagIds, targetEmails: emails });
  revalidatePath(`/campaigns/${id}`);
  return { ok: true as const };
}

export async function sendCampaignAction(id: string) {
  await requireUser();
  const { sendCampaign } = await import("@/lib/campaigns/send");
  const r = await sendCampaign(id);
  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/campaigns");
  return r;
}

/**
 * Relance les seuls échecs. Les destinataires déjà servis restent "sent" :
 * personne ne reçoit l'email deux fois.
 */
export async function retryFailedAction(id: string) {
  await requireUser();
  const { resetFailedRecipients, reopenCampaignForRetry } = await import(
    "@/lib/campaigns/queries"
  );
  const reset = await resetFailedRecipients(id);
  if (reset === 0) {
    return { ok: false as const, sent: 0, failed: 0, remaining: 0, quotaReached: false, error: "Aucun échec à relancer" };
  }
  await reopenCampaignForRetry(id);
  const { sendCampaign } = await import("@/lib/campaigns/send");
  const r = await sendCampaign(id);
  revalidatePath(`/campaigns/${id}`);
  return r;
}
