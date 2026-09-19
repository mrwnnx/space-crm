"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createActivity, getDefaultLeadStatus, getLeadById, moveLeadToStage, updateContact as updateContactQuery, updateLead } from "@/lib/queries";
import { categorieDuModele, whatsAppConsentCheck } from "@/lib/whatsapp-consent";
import {
  countTemplateVariables,
  createWhatsAppTemplate,
  deleteWhatsAppTemplate,
  sendWhatsApp,
  sendWhatsAppMedia,
  sendWhatsAppReaction,
  sendWhatsAppTemplate,
  updateWhatsAppProfile,
  uploadWhatsAppProfilePicture,
} from "@/lib/messaging/whatsapp";
import { WHATSAPP_VERTICALS } from "@/lib/messaging/whatsapp-verticals";
import { ENVOI_MAX_BYTES, ENVOI_MIME, libelleMedia, stockerMedia } from "@/lib/messaging/whatsapp-media";
import {
  applyWhatsAppReaction,
  createQuickReply,
  deleteQuickReply,
  markWhatsAppRead,
  markWhatsAppUnread,
  recordWhatsAppMedia,
  recordWhatsAppSent,
  setWhatsAppArchived,
} from "@/lib/whatsapp-inbox";
import { saveAutoReplies, setAiReplyEnabled, type AutoRepliesInput } from "@/lib/whatsapp-settings";

/**
 * Les actions de la page « WhatsApp ». Module à part de `actions.ts` — un
 * fichier `"use server"` n'exporte QUE des fonctions async, et celui-ci reste
 * lisible en entier.
 */

export async function markWhatsAppReadAction(leadId: string) {
  await requireUser();
  await markWhatsAppRead(leadId);
}

export async function markWhatsAppUnreadAction(leadId: string) {
  await requireUser();
  await markWhatsAppUnread(leadId);
  revalidatePath("/whatsapp");
}

export async function setWhatsAppArchivedAction(leadId: string, archived: boolean) {
  await requireUser();
  await setWhatsAppArchived(leadId, archived);
  revalidatePath("/whatsapp");
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
  // Règle Meta : pas de marketing sans consentement tracé.
  const lead = await getLeadById(leadId);
  const garde = await whatsAppConsentCheck(lead?.contact, template.name, template.language);
  if (!garde.ok) return { ok: false as const, error: garde.reason };

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
  await recordWhatsAppSent(r.id, activite.id, null, template.name);
  await updateLead(leadId, { lastContactedAt: new Date() });
  // Un marketing envoyé à la main compte aussi dans « 1 par 24 h ».
  const categorie = await categorieDuModele(template.name, template.language);
  if (lead?.contactId && categorie !== "UTILITY" && categorie !== "AUTHENTICATION") {
    await updateContactQuery(lead.contactId, { whatsappMarketingLastAt: new Date() });
  }
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

export async function saveAutoRepliesAction(input: AutoRepliesInput) {
  await requireUser();
  const h = (n: number) => Math.min(23, Math.max(0, Math.floor(n)));
  const jours = [...new Set(input.awayDays.map(Number).filter((d) => d >= 1 && d <= 7))];
  if (input.welcomeEnabled && !input.welcomeText.trim()) {
    return { ok: false as const, error: "Le message de bienvenue est vide." };
  }
  if (input.awayEnabled && !input.awayText.trim()) {
    return { ok: false as const, error: "Le message d'absence est vide." };
  }
  if (input.awayEnabled && h(input.awayStart) >= h(input.awayEnd)) {
    return { ok: false as const, error: "L'heure de fin doit être après l'heure de début." };
  }
  await saveAutoReplies({
    ...input,
    welcomeText: input.welcomeText.trim(),
    awayText: input.awayText.trim(),
    awayStart: h(input.awayStart),
    awayEnd: h(input.awayEnd),
    awayDays: jours,
  });
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
  buttons?: string[];
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

  const buttons = (input.buttons ?? []).map((b) => b.trim()).filter(Boolean);
  if (buttons.length > 3) return { ok: false as const, error: "Trois boutons maximum." };
  if (buttons.some((b) => b.length > 25)) return { ok: false as const, error: "Un bouton : 25 caractères maximum." };
  const r = await createWhatsAppTemplate({ name, language: input.language, category: input.category, body, examples, buttons });
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

// ── Le profil de l'entreprise ─────────────────────────

const PHOTO_MIME = new Set(["image/jpeg", "image/png"]);
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Enregistrer le profil WhatsApp — écrit chez Meta, l'écran relit ensuite ce que Meta a gardé. */
export async function updateProfileAction(formData: FormData) {
  await requireUser();
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const about = str("about");
  const description = str("description");
  const address = str("address");
  const email = str("email");
  const websites = [str("website1"), str("website2")].filter(Boolean);
  const vertical = str("vertical");

  if (about.length > 139) return { ok: false as const, error: "« À propos » : 139 caractères maximum." };
  if (description.length > 512) return { ok: false as const, error: "La description : 512 caractères maximum." };
  if (address.length > 256) return { ok: false as const, error: "L'adresse : 256 caractères maximum." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, error: "L'email n'est pas valide." };
  for (const w of websites) {
    if (!/^https?:\/\/\S+$/.test(w)) return { ok: false as const, error: `Le site « ${w} » doit commencer par http:// ou https://.` };
  }
  if (!WHATSAPP_VERTICALS.some((v) => v.code === vertical)) return { ok: false as const, error: "Secteur inconnu." };

  let profilePictureHandle: string | undefined;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!PHOTO_MIME.has(photo.type)) return { ok: false as const, error: "La photo : JPG ou PNG." };
    if (photo.size > PHOTO_MAX_BYTES) return { ok: false as const, error: "La photo dépasse 5 Mo." };
    const up = await uploadWhatsAppProfilePicture(await photo.arrayBuffer(), photo.type);
    if (!up.ok) return up;
    profilePictureHandle = up.handle;
  }

  const r = await updateWhatsAppProfile({ about, description, address, email, websites, vertical, profilePictureHandle });
  if (!r.ok) return r;
  revalidatePath("/settings");
  return { ok: true as const };
}

/** Ce qu'un bouton de modèle déclenche (Paramètres → WhatsApp → Modèles). Tout vide = l'action est retirée. */
export async function saveButtonActionAction(input: {
  template: string;
  buttonText: string;
  tagId: string | null;
  replyText: string | null;
  callSlot: string | null;
  optOut: boolean;
}) {
  await requireUser();
  if (!/^[a-z0-9_]+$/.test(input.template) || !input.buttonText.trim()) return { ok: false as const, error: "Bouton inconnu." };
  if (input.callSlot && !["now", "evening", "tomorrow"].includes(input.callSlot)) return { ok: false as const, error: "Créneau inconnu." };
  const { saveButtonAction } = await import("@/lib/whatsapp-button-actions");
  await saveButtonAction({ ...input, buttonText: input.buttonText.trim() });
  revalidatePath("/settings");
  return { ok: true as const };
}
