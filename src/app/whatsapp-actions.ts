"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createActivity, getBootcampById, getDefaultLeadStatus, getLeadById, moveLeadToStage, updateContact as updateContactQuery, updateLead } from "@/lib/queries";
import { categorieDuModele, whatsAppConsentCheck } from "@/lib/whatsapp-consent";
import {
  countTemplateVariables,
  createWhatsAppTemplate,
  deleteWhatsAppTemplate,
  editWhatsAppTemplateBody,
  listWhatsAppTemplates,
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
  variables: string[],
  // Modèle avec le formulaire « نحب نسجل » : la session d'arrivée choisie.
  formationId?: string | null
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
    leadId,
    formationId,
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
  const refus = verifierCorps(body);
  if (refus) return { ok: false as const, error: refus };
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

/**
 * Les modèles approuvés, pour la liste déroulante d'une règle de colonne, et
 * les valeurs d'exemple qui remplissent l'aperçu : un prénom fictif, mais la
 * VRAIE formation (nom, date de début, offre) — c'est ce que le lead lira.
 * Chargés à la demande : l'appel Meta prend ~0,5 s, on ne le paie pas à
 * chaque ouverture du kanban.
 */
export async function listApprovedTemplatesAction(bootcampId: string) {
  await requireUser();
  const [modeles, bootcamp] = await Promise.all([listWhatsAppTemplates(), getBootcampById(bootcampId)]);
  const { buildVariables } = await import("@/lib/automations");
  const leadExemple = {
    firstName: "Ahmed",
    lastName: "Ben Ali",
    fullName: "Ahmed Ben Ali",
    email: "ahmed@exemple.tn",
    // Le plan mensuel quand la formation en a un : c'est l'offre la plus lue.
    intendedPlan: bootcamp?.monthlyCount && bootcamp?.monthlyAmount ? "monthly" : "total",
    bootcamp: bootcamp ?? null,
  };
  return {
    modeles: modeles
      .filter((t) => t.status === "APPROVED")
      .map((t) => ({
        name: t.name,
        language: t.language,
        category: t.category,
        variables: t.variables,
        buttons: t.buttons,
        body: t.body,
        formulaire: t.formulaire,
      })),
    ...(await formationsDArrivee(bootcampId)),
    // La date se lit dans la langue du modèle (« 28 septembre » / « 28 سبتمبر »).
    exemples: { fr: buildVariables(leadExemple), ar: buildVariables(leadExemple, true) },
  };
}

/**
 * Ce qu'il faut à la fiche d'un lead pour lui écrire sur WhatsApp : la fenêtre
 * de 24 h, les modèles approuvés, SES valeurs (prénom, formation, date, offre)
 * pour préremplir les variables, et le mapping d'une règle qui utilise déjà le
 * modèle — la même logique que l'automatisation, appliquée à la main.
 */
export async function whatsAppComposerDataAction(leadId: string) {
  await requireUser();
  const lead = await getLeadById(leadId);
  if (!lead) return { ok: false as const, error: "Lead introuvable" };
  const { db } = await import("@/db");
  const { activities, automations } = await import("@/db/schema");
  const { and, eq, desc, isNotNull } = await import("drizzle-orm");
  const { buildVariables } = await import("@/lib/automations");
  const { fenetreOuverte } = await import("@/lib/whatsapp-inbox");

  const [dernier, modeles, regles] = await Promise.all([
    db.query.activities.findFirst({
      where: and(eq(activities.referenceId, leadId), eq(activities.type, "whatsapp"), eq(activities.direction, "inbound")),
      orderBy: [desc(activities.createdAt)],
      columns: { createdAt: true },
    }),
    listWhatsAppTemplates(),
    db.query.automations.findMany({
      where: and(eq(automations.channel, "whatsapp"), isNotNull(automations.whatsappTemplate)),
      columns: { whatsappTemplate: true, whatsappVariables: true, bootcampId: true },
    }),
  ]);

  const valeurs = { fr: buildVariables(lead), ar: buildVariables(lead, true) };
  // Le mapping d'une règle : d'abord celle de la formation du lead, sinon n'importe laquelle.
  const mappings: Record<string, string[]> = {};
  for (const r of regles.sort((a, b) => Number(b.bootcampId === lead.bootcampId) - Number(a.bootcampId === lead.bootcampId))) {
    if (r.whatsappTemplate && !mappings[r.whatsappTemplate]) mappings[r.whatsappTemplate] = (r.whatsappVariables as string[]) ?? [];
  }
  return {
    ok: true as const,
    ouverte: fenetreOuverte(dernier?.createdAt ?? null),
    dernierEntrant: dernier?.createdAt?.toISOString() ?? null,
    modeles: modeles
      .filter((t) => t.status === "APPROVED")
      .map((t) => ({ name: t.name, language: t.language, category: t.category, variables: t.variables, buttons: t.buttons, body: t.body, formulaire: t.formulaire })),
    valeurs,
    mappings,
    ...(await formationsDArrivee(lead.bootcampId)),
  };
}

/**
 * Pour un modèle avec le formulaire « نحب نسجل » : les sessions où l'on peut
 * faire arriver les inscrits (ouvertes, hors celle du lead), et celle proposée
 * par défaut — la formation qui reçoit les formulaires du site.
 */
async function formationsDArrivee(
  sauf: string | null
): Promise<{ formations: { id: string; name: string }[]; formationParDefaut: string | null }> {
  const { getOpenBootcamps } = await import("@/lib/queries");
  const { formationActive } = await import("@/lib/whatsapp-flow");
  const [ouvertes, active] = await Promise.all([getOpenBootcamps(sauf ?? undefined), formationActive()]);
  return {
    formations: ouvertes.map((b) => ({ id: b.id, name: b.name })),
    formationParDefaut: active && active.id !== sauf ? active.id : (ouvertes[0]?.id ?? null),
  };
}

// ── Envoi en masse par colonne ────────────────────────

export async function apercuBlastAction(
  statusId: string,
  modele: { template: string; language: string; variables: string[] },
  capPolicy: "reporter" | "exclure"
) {
  await requireUser();
  const { apercuBlast } = await import("@/lib/whatsapp-blast");
  const a = await apercuBlast(statusId, modele, capPolicy);
  return { ...a, premierReport: a.premierReport?.toISOString() ?? null };
}

export async function lancerBlastAction(input: {
  bootcampId: string;
  statusId: string;
  template: string;
  language: string;
  variables: string[];
  capPolicy: "reporter" | "exclure";
  targetBootcampId?: string | null;
}) {
  const user = await requireUser();
  const { creerBlast } = await import("@/lib/whatsapp-blast");
  const r = await creerBlast({ ...input, createdBy: user.email ?? null });
  if (r.ok) revalidatePath(`/bootcamps/${input.bootcampId}`);
  return r;
}

/** Remet en file ceux qui n'ont rien reçu d'une vague (voir relancerEchecs). */
export async function relancerEchecsAction(blastId: string, bootcampId: string) {
  await requireUser();
  const { relancerEchecs } = await import("@/lib/whatsapp-blast");
  const n = await relancerEchecs(blastId);
  revalidatePath(`/bootcamps/${bootcampId}/envois`);
  return { ok: true as const, n };
}

/** L'historique des envois d'une colonne, montré dans la fenêtre d'envoi. */
export async function historiqueColonneAction(bootcampId: string, statusId: string) {
  await requireUser();
  const { listerBlasts } = await import("@/lib/whatsapp-blast");
  const vagues = await listerBlasts(bootcampId, statusId);
  return vagues.slice(0, 5).map((v) => ({ ...v, createdAt: v.createdAt.toISOString(), finishedAt: v.finishedAt?.toISOString() ?? null }));
}

export async function etatBlastAction(blastId: string) {
  await requireUser();
  const { etatBlast } = await import("@/lib/whatsapp-blast");
  return etatBlast(blastId);
}

export async function arreterBlastAction(blastId: string) {
  await requireUser();
  const { changerEtatBlast } = await import("@/lib/whatsapp-blast");
  await changerEtatBlast(blastId, "paused");
  return { ok: true as const };
}

/**
 * Ce que Meta refuse à coup sûr, dit en clair avant l'envoi plutôt qu'en
 * code d'erreur après. Chaque règle a coûté un aller-retour avec Meta.
 */
function verifierCorps(body: string): string | null {
  if (body.length > 1024) return "Le message dépasse 1024 caractères.";
  if (/[ھیک]/.test(body)) return "Le message contient des lettres persanes (ی ک ھ) : Meta les refuse. Remplacez-les par ي ك ه.";
  if (/\t| {5}/.test(body)) return "Pas de tabulation ni de suite de 5 espaces : Meta refuse.";
  if (/^\s*\{\{\d+\}\}/.test(body)) return "Le message ne peut pas COMMENCER par une variable : ajoutez un mot avant.";
  if (/\{\{\d+\}\}\s*$/.test(body)) return "Le message ne peut pas FINIR par une variable : ajoutez un mot ou un emoji après.";
  const nums = [...new Set([...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
  if (nums.some((v, i) => v !== i + 1)) return "Les variables doivent se suivre : {{1}}, {{2}}, {{3}}… sans trou.";
  return null;
}

/**
 * Modifier le texte d'un modèle existant. Si le nombre de variables change,
 * les règles qui l'envoient partiraient avec le mauvais nombre (échec chez
 * Meta, vécu le 25/09) : on les liste et on demande confirmation d'abord.
 */
export async function editTemplateAction(input: {
  name: string;
  body: string;
  examples: string[];
  confirme?: boolean;
}): Promise<
  | { ok: true; status: string }
  | { ok: false; error: string }
  | { ok: false; aConfirmer: { formation: string; colonne: string; variables: number }[]; variables: number }
> {
  await requireUser();
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Le message est vide." };
  const refus = verifierCorps(body);
  if (refus) return { ok: false, error: refus };
  const n = countTemplateVariables(body);
  const examples = input.examples.slice(0, n).map((e) => e.trim());
  if (examples.length < n || examples.some((e) => !e)) {
    return { ok: false, error: `Donnez un exemple pour chacune des ${n} variables : Meta le demande.` };
  }

  if (!input.confirme) {
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    const regles = await db.execute<{ formation: string; colonne: string; variables: number }>(sql`
      select b.name as formation, s.name as colonne, jsonb_array_length(a.whatsapp_variables)::int as variables
      from automations a
      join bootcamps b on b.id = a.bootcamp_id
      join lead_statuses s on s.id = a.status_id
      where a.whatsapp_template = ${input.name}
        and jsonb_array_length(a.whatsapp_variables) <> ${n}
      order by b.name`);
    if (regles.length > 0) return { ok: false, aConfirmer: [...regles], variables: n };
  }

  const r = await editWhatsAppTemplateBody(input.name, body, examples);
  if (!r.ok) return r;
  revalidatePath("/settings");
  return { ok: true, status: r.status };
}

/** « Améliorer avec l'IA » : verdict, catégorie probable, problèmes, version corrigée. */
export async function reviewTemplateAction(input: {
  name: string;
  category: string;
  language: string;
  body: string;
  buttons: string[];
}) {
  await requireUser();
  if (!input.body.trim()) return { ok: false as const, error: "Écrivez d'abord un message." };
  const { reviewWhatsAppTemplate } = await import("@/lib/ai/template-review");
  return reviewWhatsAppTemplate({ ...input, body: input.body.trim() });
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
