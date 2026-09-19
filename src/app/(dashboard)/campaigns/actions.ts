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
export async function previewAudienceAction(
  tagIds: string[],
  emails: string[],
  excludeTagIds: string[] = [],
  requirePhone = false
) {
  await requireUser();
  const { resolveCampaignAudience } = await import("@/lib/campaigns/audience");
  const { stats, ignoredEmails } = await resolveCampaignAudience({
    tagIds,
    excludeTagIds,
    requirePhone,
    emails,
  });
  return { stats, ignoredEmails };
}

export async function saveCampaignTargetAction(
  id: string,
  tagIds: string[],
  emails: string[],
  excludeTagIds: string[] = [],
  requirePhone = false
) {
  await requireUser();
  const existing = await getCampaignById(id);
  if (!existing) return { ok: false as const, error: "Campagne introuvable" };
  if (existing.status !== "draft") {
    return { ok: false as const, error: "Campagne déjà envoyée" };
  }

  // Un tag ne peut pas être à la fois ciblé et exclu : l'écran l'empêche, la
  // base le garantit.
  const exclude = excludeTagIds.filter((t) => !tagIds.includes(t));
  await updateCampaign(id, {
    targetTagIds: tagIds,
    excludeTagIds: exclude,
    requirePhone,
    targetEmails: emails,
  });
  revalidatePath(`/campaigns/${id}`);
  return { ok: true as const };
}

/**
 * Envoi d'un test de la campagne à UNE adresse, sans toucher aux destinataires.
 *
 * Le rendu passe par `renderCampaignHtml` — le MÊME que l'envoi réel : un test
 * qui emprunterait un autre chemin ne prouverait rien. Le lien de
 * désabonnement est inactif ici, il n'existe que pour un vrai destinataire.
 *
 * Les contrôles bloquants s'appliquent : tester un email qu'on ne pourra pas
 * envoyer n'a pas d'intérêt, et c'est l'occasion de les rappeler.
 */
export async function sendCampaignTestAction(
  id: string,
  to: string,
  subject: string,
  content: string
): Promise<{ ok: boolean; message: string }> {
  await requireUser();

  const address = to.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return { ok: false, message: "Adresse email invalide." };
  }

  const { checkCampaign, hasBlockingError } = await import("@/lib/campaigns/preflight");
  const checks = checkCampaign({ subject, content });
  if (hasBlockingError(checks)) {
    return {
      ok: false,
      message: checks.filter((c) => c.level === "error").map((c) => c.message).join(" "),
    };
  }

  const { sendEmail } = await import("@/lib/messaging/email");
  const { renderCampaignHtml } = await import("@/lib/campaigns/template");
  const { getEmailBranding } = await import("@/lib/queries");
  const branding = await getEmailBranding();

  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/unsubscribe/apercu`;
  const res = await sendEmail({
    to: address,
    subject: `[TEST] ${subject}`,
    html: renderCampaignHtml({ content, unsubscribeUrl: url, branding }),
  });

  if (!res.ok) {
    return { ok: false, message: res.error ?? "L'envoi du test a échoué." };
  }
  return { ok: true, message: `Test envoyé à ${address}.` };
}

export async function saveCampaignNoteAction(id: string, note: string) {
  await requireUser();
  const existing = await getCampaignById(id);
  if (!existing) return { ok: false as const, error: "Campagne introuvable" };
  await updateCampaign(id, { internalNote: note.trim() || null });
  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/campaigns");
  return { ok: true as const };
}

/**
 * Programme l'envoi à une date et heure. Mêmes garde-fous que l'envoi
 * immédiat : ce qui ne peut pas partir maintenant ne doit pas pouvoir partir
 * plus tard sans qu'on le voie. Le départ réel est fait par le cron
 * `/api/cron/campaigns`, à ~15 min près (cadence du workflow GitHub).
 */
export async function scheduleCampaignAction(
  id: string,
  atIso: string
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  const existing = await getCampaignById(id);
  if (!existing) return { ok: false, error: "Campagne introuvable" };
  if (existing.status !== "draft") {
    return { ok: false, error: "Seul un brouillon peut être programmé." };
  }

  const at = new Date(atIso);
  if (Number.isNaN(at.getTime())) return { ok: false, error: "Date invalide." };
  if (at.getTime() < Date.now() + 60_000) {
    return { ok: false, error: "La date doit être dans le futur." };
  }

  const { checkCampaign, hasBlockingError } = await import("@/lib/campaigns/preflight");
  const checks = checkCampaign({
    subject: existing.subject ?? "",
    content: existing.content ?? "",
  });
  if (hasBlockingError(checks)) {
    return {
      ok: false,
      error: checks.filter((c) => c.level === "error").map((c) => c.message).join(" "),
    };
  }

  const { resolveCampaignAudience } = await import("@/lib/campaigns/audience");
  const { stats } = await resolveCampaignAudience({
    tagIds: (existing.targetTagIds as string[]) ?? [],
    excludeTagIds: (existing.excludeTagIds as string[]) ?? [],
    requirePhone: existing.requirePhone,
    emails: (existing.targetEmails as string[]) ?? [],
  });
  if (stats.total === 0) return { ok: false, error: "Aucun destinataire." };

  const { scheduleCampaign } = await import("@/lib/campaigns/queries");
  await scheduleCampaign(id, at);
  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/campaigns");
  return { ok: true };
}

export async function sendCampaignAction(id: string) {
  await requireUser();

  // Les contrôles tournent AUSSI ici, pas seulement à l'écran : l'action est
  // appelable sans passer par l'interface, et c'est le dernier point où l'on
  // peut encore empêcher un {{…}} de partir chez 500 personnes.
  const existing = await getCampaignById(id);
  if (!existing) return { ok: false, sent: 0, failed: 0, remaining: 0, quotaReached: false, error: "Campagne introuvable" };
  const { checkCampaign, hasBlockingError } = await import("@/lib/campaigns/preflight");
  const checks = checkCampaign({
    subject: existing.subject ?? "",
    content: existing.content ?? "",
  });
  if (hasBlockingError(checks)) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      remaining: 0,
      quotaReached: false,
      error: checks.filter((c) => c.level === "error").map((c) => c.message).join(" "),
    };
  }

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

/**
 * Changement de statut piloté par l'utilisateur.
 *
 * Les transitions sont contrôlées : une campagne envoyée ne peut pas
 * redevenir un brouillon, et une annulée ne repart jamais.
 */
export async function setCampaignStatusAction(
  id: string,
  next: "paused" | "sending" | "cancelled" | "archived" | "draft"
) {
  await requireUser();
  const existing = await getCampaignById(id);
  if (!existing) return { ok: false as const, error: "Campagne introuvable" };

  const from = existing.status;
  const allowed: Record<string, string[]> = {
    // suspendre : depuis une programmée ou un envoi en cours
    paused: ["scheduled", "sending"],
    // reprendre : renvoie dans l'état d'envoi
    sending: ["paused"],
    // annuler : tant que ce n'est pas parti en entier
    cancelled: ["draft", "scheduled", "sending", "paused", "failed"],
    // archiver : une fois l'histoire terminée
    archived: ["sent", "cancelled", "failed", "draft"],
    // désarchiver ; ou reprendre une programmée pour changer la date ou le texte
    draft: ["archived", "scheduled"],
  };

  if (!allowed[next]?.includes(from)) {
    return { ok: false as const, error: `Transition impossible depuis « ${from} »` };
  }

  const { setCampaignStatus, unscheduleCampaign } = await import("@/lib/campaigns/queries");
  // Quitter « programmée » efface la date : un brouillon daté mentirait.
  if (from === "scheduled" && next === "draft") await unscheduleCampaign(id);
  else await setCampaignStatus(id, next);
  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/campaigns");
  return { ok: true as const };
}
