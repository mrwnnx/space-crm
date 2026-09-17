"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createActivity, getDefaultLeadStatus, moveLeadToStage, updateLead } from "@/lib/queries";
import {
  countTemplateVariables,
  createWhatsAppTemplate,
  deleteWhatsAppTemplate,
  sendWhatsApp,
  sendWhatsAppMedia,
  sendWhatsAppReaction,
  sendWhatsAppTemplate,
} from "@/lib/messaging/whatsapp";
import { ENVOI_MAX_BYTES, ENVOI_MIME, libelleMedia, stockerMedia } from "@/lib/messaging/whatsapp-media";
import {
  applyWhatsAppReaction,
  createQuickReply,
  deleteQuickReply,
  markWhatsAppRead,
  recordWhatsAppMedia,
  recordWhatsAppSent,
} from "@/lib/whatsapp-inbox";
import { setAiReplyEnabled } from "@/lib/whatsapp-settings";

/**
 * Les actions de la page « WhatsApp ». Module à part de `actions.ts` — un
 * fichier `"use server"` n'exporte QUE des fonctions async, et celui-ci reste
 * lisible en entier.
 */

export async function markWhatsAppReadAction(leadId: string) {
  await requireUser();
  await markWhatsAppRead(leadId);
}

/** Texte libre — Meta le refuse hors fenêtre de 24 h, avec un message clair. `replyTo` cite un message. */
export async function replyWhatsAppAction(leadId: string, to: string, body: string, replyTo?: string | null) {
  await requireUser();
  const texte = body.trim();
  if (!texte) return { ok: false as const, error: "Message vide." };

  const r = await sendWhatsApp({ to, body: texte, replyTo: replyTo ?? undefined });
  if (!r.ok) return { ok: false as const, error: r.error ?? "Échec de l'envoi." };

  const activite = await createActivity({
    referenceType: "lead",
    referenceId: leadId,
    type: "whatsapp",
    direction: "outbound",
    subject: "WhatsApp envoyé",
    content: texte,
  });
  if (r.sid) await recordWhatsAppSent(r.sid, activite.id, replyTo);
  await updateLead(leadId, { lastContactedAt: new Date() });
  revalidatePath("/whatsapp");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true as const };
}

/**
 * Une photo, une vidéo ou un PDF, avec une légende facultative. Le fichier est
 * d'abord posé dans notre bucket (c'est notre copie, celle du fil), puis Meta
 * le récupère par son URL. Fenêtre de 24 h seulement, comme le texte.
 */
export async function sendWhatsAppMediaAction(formData: FormData) {
  await requireUser();
  const leadId = String(formData.get("leadId") ?? "");
  const to = String(formData.get("to") ?? "");
  const caption = String(formData.get("caption") ?? "").trim();
  const replyTo = String(formData.get("replyTo") ?? "") || null;
  const file = formData.get("file");
  if (!leadId || !to) return { ok: false as const, error: "Lead ou numéro manquant." };
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "Aucun fichier." };
  const kind = ENVOI_MIME[file.type];
  if (!kind) return { ok: false as const, error: "Formats acceptés : JPG, PNG, MP4, PDF, ou un vocal enregistré ici." };
  if (file.size > ENVOI_MAX_BYTES) {
    return { ok: false as const, error: `Fichier trop lourd (${(file.size / 1024 / 1024).toFixed(1)} Mo, maximum 4 Mo).` };
  }

  const stock = await stockerMedia(leadId, file, file.type, file.name);
  if (!stock.ok) return { ok: false as const, error: stock.error };

  const r = await sendWhatsAppMedia({
    to,
    kind,
    link: stock.media.url,
    caption: caption || undefined,
    filename: kind === "document" ? file.name : undefined,
    replyTo: replyTo ?? undefined,
  });
  if (!r.ok) return { ok: false as const, error: r.error };

  const activite = await createActivity({
    referenceType: "lead",
    referenceId: leadId,
    type: "whatsapp",
    direction: "outbound",
    subject: kind === "audio" ? "WhatsApp envoyé (vocal)" : "WhatsApp envoyé (pièce jointe)",
    content: kind !== "audio" && caption ? caption : libelleMedia(kind, file.name),
  });
  await recordWhatsAppSent(r.id, activite.id, replyTo);
  await recordWhatsAppMedia(activite.id, kind, stock.media, kind === "document" ? file.name : null);
  await updateLead(leadId, { lastContactedAt: new Date() });
  revalidatePath("/whatsapp");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true as const };
}

/** Modèle approuvé — le seul envoi possible quand la fenêtre est fermée. */
export async function replyWhatsAppTemplateAction(
  leadId: string,
  to: string,
  template: { name: string; language: string; body: string | null },
  variables: string[]
) {
  await requireUser();
  const r = await sendWhatsAppTemplate({
    to,
    template: template.name,
    langue: template.language,
    variables,
  });
  if (!r.ok) return { ok: false as const, error: r.error };

  // Le fil montre le texte tel que la personne le lira, pas le nom du modèle.
  const rendu = (template.body ?? `[modèle ${template.name}]`).replace(
    /\{\{(\d+)\}\}/g,
    (_, n) => variables[Number(n) - 1] ?? ""
  );
  const activite = await createActivity({
    referenceType: "lead",
    referenceId: leadId,
    type: "whatsapp",
    direction: "outbound",
    subject: `WhatsApp envoyé (modèle ${template.name})`,
    content: rendu,
  });
  await recordWhatsAppSent(r.id, activite.id);
  await updateLead(leadId, { lastContactedAt: new Date() });
  revalidatePath("/whatsapp");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true as const };
}

/**
 * Donner une formation à un lead né sans (un message WhatsApp d'un inconnu).
 * Il entre dans la colonne par défaut de cette formation — et cette entrée
 * déclenche les automatisations de la colonne, comme pour tout autre chemin.
 */
export async function assignBootcampAction(leadId: string, bootcampId: string) {
  await requireUser();
  const statut = await getDefaultLeadStatus(bootcampId);
  if (!statut) return { ok: false as const, error: "Cette formation n'a pas de colonne par défaut." };

  await updateLead(leadId, { bootcampId });
  await moveLeadToStage(leadId, statut.id);
  const { runStatusAutomations } = await import("@/lib/automations");
  await runStatusAutomations(leadId, statut.id);

  revalidatePath("/whatsapp");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true as const };
}

/** Réagir à un message du fil par un emoji ("" pour retirer). Fenêtre de 24 h, comme le texte. */
export async function reactWhatsAppAction(leadId: string, to: string, wamid: string, emoji: string) {
  await requireUser();
  const r = await sendWhatsAppReaction({ to, messageId: wamid, emoji });
  if (!r.ok) return { ok: false as const, error: r.error };
  await applyWhatsAppReaction(wamid, emoji, "us");
  revalidatePath("/whatsapp");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true as const };
}

// ── Réponses rapides ──────────────────────────────────

export async function createQuickReplyAction(shortcut: string, text: string) {
  await requireUser();
  const s = shortcut.trim().toLowerCase().replace(/^\//, "");
  if (!/^[a-z0-9_-]{1,30}$/.test(s)) {
    return { ok: false as const, error: "Le raccourci : lettres, chiffres, - ou _ (ex. prix, horaires)." };
  }
  if (!text.trim()) return { ok: false as const, error: "Le texte est vide." };
  try {
    await createQuickReply(s, text.trim());
  } catch {
    return { ok: false as const, error: `« /${s} » existe déjà.` };
  }
  revalidatePath("/settings");
  revalidatePath("/whatsapp");
  return { ok: true as const };
}

export async function deleteQuickReplyAction(id: string) {
  await requireUser();
  await deleteQuickReply(id);
  revalidatePath("/settings");
  revalidatePath("/whatsapp");
  return { ok: true as const };
}

// ── Paramètres → WhatsApp ─────────────────────────────

export async function setAiReplyAction(enabled: boolean) {
  await requireUser();
  await setAiReplyEnabled(enabled);
  revalidatePath("/settings");
  return { ok: true as const };
}

const NOM_MODELE = /^[a-z0-9_]{1,512}$/;

/**
 * Soumettre un modèle à Meta depuis le CRM. Les règles de Meta, vérifiées ici
 * pour que l'erreur soit lisible plutôt qu'un code Graph :
 * nom en minuscules/chiffres/underscores, corps ≤ 1024 caractères, un exemple
 * par variable.
 */
export async function createTemplateAction(input: {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY";
  body: string;
  examples: string[];
}) {
  await requireUser();
  const name = input.name.trim().toLowerCase();
  const body = input.body.trim();
  if (!NOM_MODELE.test(name)) {
    return { ok: false as const, error: "Le nom : minuscules, chiffres et _ seulement (ex. relance_brochure)." };
  }
  if (!body) return { ok: false as const, error: "Le message est vide." };
  if (body.length > 1024) return { ok: false as const, error: "Le message dépasse 1024 caractères." };
  const n = countTemplateVariables(body);
  const examples = input.examples.slice(0, n).map((e) => e.trim());
  if (examples.length < n || examples.some((e) => !e)) {
    return { ok: false as const, error: `Donnez un exemple pour chacune des ${n} variables : Meta le demande.` };
  }

  const r = await createWhatsAppTemplate({ name, language: input.language, category: input.category, body, examples });
  if (!r.ok) return r;
  revalidatePath("/settings");
  return { ok: true as const, status: r.status };
}

export async function deleteTemplateAction(name: string) {
  await requireUser();
  const r = await deleteWhatsAppTemplate(name);
  if (!r.ok) return { ok: false as const, error: r.error ?? "Échec de la suppression." };
  revalidatePath("/settings");
  return { ok: true as const };
}
