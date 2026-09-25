import "server-only";

/**
 * WhatsApp par l'API Cloud de Meta — en direct, sans intermédiaire.
 *
 * Remplace Twilio, écarté par Marwen : Twilio ne fait que revendre cet accès,
 * Meta se paie à la conversation sans marge, et le code se réduit à un appel
 * HTTP au lieu d'un SDK.
 *
 * ⚠️ LA RÈGLE QUI COMMANDE TOUT — la fenêtre de 24 heures.
 * Hors d'une fenêtre ouverte par un message DU CLIENT, on ne peut envoyer que
 * des **modèles approuvés par Meta**. Le texte libre n'est permis que pendant
 * les 24 h qui suivent sa dernière réponse. Une automatisation est par
 * définition hors fenêtre : elle passe donc toujours par un modèle.
 */

const API = "https://graph.facebook.com/v21.0";

export type WhatsAppResult = { ok: true; id: string } | { ok: false; error: string };

function config() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return null;
  return { token, phoneId };
}

/** Le numéro tel que Meta l'attend : chiffres seuls, indicatif compris. */
/**
 * Un numéro que Meta peut joindre : indicatif compris, 10 à 15 chiffres, sans
 * 0 de tête (« 0660… » est un numéro local sans indicatif). Sert à écarter
 * AVANT l'envoi ce qui échouerait (#131009 : 52516, 015510248460 le 25/09).
 */
export function numeroJoignable(brut: string | null | undefined): boolean {
  if (!brut) return false;
  const n = normaliser(brut);
  // Un mobile tunisien (5…) avec des chiffres en trop se lirait comme un
  // numéro d'Amérique latine (57 = Colombie) : douteux, à faire corriger.
  if (n.startsWith("5") && n.length <= 11) return false;
  return n.length >= 10 && n.length <= 15 && !n.startsWith("0");
}

function normaliser(brut: string): string {
  // Chiffres arabes (٠١٢…) ou persans (۰۱۲…) saisis au téléphone : ce sont
  // des chiffres comme les autres (« ٥٧٩٩٩٣٣٣٧٨٩ » vu le 25/09).
  const latins = brut.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (c) => String((c.charCodeAt(0) & 0xf) % 10));
  const chiffres = latins.replace(/\D/g, "");
  // Un numéro tunisien saisi sans indicatif — cas courant dans le CRM, où les
  // leads arrivent en « 25 726 708 ». Sans le 216, Meta ne livre rien.
  if (chiffres.length === 8) return `216${chiffres}`;
  // Un numéro étranger saisi avec le préfixe « 00 » (0033…, 00965…) : Meta
  // attend l'indicatif seul et refusait l'envoi (#131009, 4 échecs le 25/09).
  if (chiffres.startsWith("00")) return chiffres.slice(2);
  return chiffres;
}

// ── Mode d'envoi ──────────────────────────────────────────────────────
// `dry_run` : rien ne part, le corps exact est journalisé. `allowlist` : seuls
// les numéros de WHATSAPP_TEST_ALLOWLIST reçoivent, les autres sont traités en
// dry_run. `live` : tout part. Sans variable : live en production (ne jamais
// couper la prod en silence), dry_run partout ailleurs — le dev local écrit
// dans la base de PROD et ne doit pas pouvoir écrire à un vrai lead.
export type SendMode = "dry_run" | "allowlist" | "live";

export function sendMode(): SendMode {
  const m = process.env.WHATSAPP_SEND_MODE;
  if (m === "dry_run" || m === "allowlist" || m === "live") return m;
  return process.env.NODE_ENV === "production" ? "live" : "dry_run";
}

export function allowlist(): string[] {
  return (process.env.WHATSAPP_TEST_ALLOWLIST ?? "")
    .split(/[,\s]+/)
    .map((n) => n.replace(/\D/g, ""))
    .filter((n) => n.length >= 8)
    .map((n) => (n.length === 8 ? `216${n}` : n));
}

/**
 * Un numéro de test (l'équipe) : notre règle de confort — 1 marketing par
 * 24 h — ne s'applique pas, pour enchaîner les tests. Les règles Meta
 * (consentement, STOP) restent.
 */
export function estNumeroDeTest(to: string | null | undefined): boolean {
  const n = String(to ?? "").replace(/\D/g, "");
  return allowlist().includes(n.length === 8 ? `216${n}` : n);
}

/** Un identifiant de message qui n'existe pas chez Meta : la bulle le dira. */
export const DRY_RUN_PREFIX = "dryrun-";

function retenu(corps: Record<string, unknown>): WhatsAppResult {
  console.info(`[whatsapp ${sendMode()}] retenu, non envoyé :`, JSON.stringify(corps));
  return { ok: true, id: `${DRY_RUN_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
}

async function envoyer(corps: Record<string, unknown>): Promise<WhatsAppResult> {
  const c = config();
  if (!c) return { ok: false, error: "WhatsApp non configuré (WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID absent)." };

  const mode = sendMode();
  if (mode === "dry_run") return retenu(corps);
  if (mode === "allowlist" && !allowlist().includes(String(corps.to ?? ""))) return retenu(corps);

  try {
    const res = await fetch(`${API}/${c.phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...corps }),
    });
    const json = (await res.json().catch(() => null)) as
      | { messages?: { id: string }[]; error?: { message?: string; code?: number } }
      | null;

    if (!res.ok) {
      const msg = json?.error?.message ?? `HTTP ${res.status}`;
      // Le code 131047 est LE message qu'il faut traduire : « hors fenêtre de
      // 24 h ». Brut, il n'apprend rien ; expliqué, il dit quoi faire.
      if (json?.error?.code === 131047) {
        return {
          ok: false,
          error:
            "Cette personne n'a pas écrit depuis plus de 24 h : Meta n'accepte plus de texte libre. Il faut passer par un modèle approuvé.",
        };
      }
      return { ok: false, error: msg };
    }
    const id = json?.messages?.[0]?.id;
    return id ? { ok: true, id } : { ok: false, error: "Réponse sans identifiant de message." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur WhatsApp" };
  }
}

/**
 * Texte libre — **uniquement dans la fenêtre de 24 h**.
 * C'est ce qu'utilise le composeur 1-à-1 d'une fiche lead : une réponse à
 * quelqu'un qui vient d'écrire.
 */
export async function sendWhatsApp({
  to,
  body,
  replyTo,
}: {
  to: string;
  body: string;
  replyTo?: string; // wamid du message cité — le lead le voit en citation
}): Promise<{ ok: boolean; error?: string; sid?: string }> {
  const r = await envoyer({
    to: normaliser(to),
    type: "text",
    text: { preview_url: true, body },
    ...(replyTo ? { context: { message_id: replyTo } } : {}),
  });
  return r.ok ? { ok: true, sid: r.id } : { ok: false, error: r.error };
}

/** Réagir à un message (le sien ou le nôtre) par un emoji ; "" retire la réaction. */
export async function sendWhatsAppReaction({
  to,
  messageId,
  emoji,
}: {
  to: string;
  messageId: string;
  emoji: string;
}): Promise<WhatsAppResult> {
  return envoyer({
    to: normaliser(to),
    type: "reaction",
    reaction: { message_id: messageId, emoji },
  });
}

/**
 * Une pièce jointe — photo, vidéo, PDF, vocal — par son URL publique, que Meta
 * va chercher lui-même. Même règle que le texte : fenêtre de 24 h seulement.
 * `filename` n'est lu que pour un document (c'est le nom que le lead verra) ;
 * un audio n'a pas de légende.
 */
export async function sendWhatsAppMedia({
  to,
  kind,
  link,
  caption,
  filename,
  replyTo,
}: {
  to: string;
  kind: "image" | "video" | "document" | "audio";
  link: string;
  caption?: string;
  filename?: string;
  replyTo?: string;
}): Promise<WhatsAppResult> {
  return envoyer({
    to: normaliser(to),
    type: kind,
    [kind]: {
      link,
      ...(caption && kind !== "audio" ? { caption } : {}),
      ...(kind === "document" && filename ? { filename } : {}),
    },
    ...(replyTo ? { context: { message_id: replyTo } } : {}),
  });
}

/**
 * Modèle approuvé — le seul envoi possible hors fenêtre, donc **le seul
 * utilisable par une automatisation**.
 *
 * `variables` remplit les `{{1}}`, `{{2}}`… du corps, dans l'ordre. Meta ne
 * connaît pas les noms : c'est la position qui compte.
 */
export async function sendWhatsAppTemplate({
  to,
  template,
  langue = "fr",
  variables = [],
  leadId,
  formationId,
}: {
  to: string;
  template: string;
  langue?: string;
  variables?: string[];
  /** Pour un bouton de formulaire : ce qu'on sait déjà de la personne. */
  leadId?: string | null;
  /** Pour un bouton de formulaire : la session où elle arrivera (sinon, la formation active). */
  formationId?: string | null;
}): Promise<WhatsAppResult> {
  const components: Record<string, unknown>[] = [];
  if (variables.length) {
    components.push({ type: "body", parameters: variables.map((v) => ({ type: "text", text: v })) });
  }
  const boutons = await boutonsDynamiques(template);
  // Un bouton « Copier le code » exige son code à CHAQUE envoi, sinon Meta
  // refuse (#131008 Required parameter is missing). Le code est celui
  // déclaré avec le modèle : un seul endroit où le changer.
  for (const b of boutons.codes) {
    components.push({
      type: "button",
      sub_type: "copy_code",
      index: String(b.index),
      parameters: [{ type: "coupon_code", coupon_code: b.code }],
    });
  }
  // Un bouton de formulaire (Flow) : le seul formulaire du compte est
  // « نحب نسجل », qui n'affiche que ce qui manque à cette personne.
  if (boutons.formulaires.length) {
    const { donneesFlowInscription } = await import("@/lib/whatsapp-flow");
    const f = await donneesFlowInscription(leadId, formationId);
    for (const index of boutons.formulaires) {
      components.push({
        type: "button",
        sub_type: "flow",
        index: String(index),
        parameters: [{ type: "action", action: { flow_token: f.token, flow_action_data: f.data } }],
      });
    }
  }
  return envoyer({
    to: normaliser(to),
    type: "template",
    template: {
      name: template,
      language: { code: langue },
      ...(components.length ? { components } : {}),
    },
  });
}

// Par nom de modèle, le temps de vie de l'instance : une vague de 200 envois
// ne relit pas 200 fois la définition chez Meta.
type BoutonsDynamiques = { codes: { index: number; code: string }[]; formulaires: number[] };
const codesParModele = new Map<string, BoutonsDynamiques>();

async function boutonsDynamiques(template: string): Promise<BoutonsDynamiques> {
  const connu = codesParModele.get(template);
  if (connu) return connu;
  const aucun = { codes: [], formulaires: [] };
  const c = wabaConfig();
  if (!c) return aucun;
  try {
    const res = await fetch(
      `${API}/${c.waba}/message_templates?name=${encodeURIComponent(template)}&fields=name,components`,
      { headers: { Authorization: `Bearer ${c.token}` }, cache: "no-store" }
    );
    const json = (await res.json().catch(() => null)) as {
      data?: { name: string; components?: { type: string; buttons?: { type: string; example?: string[] | string }[] }[] }[];
    } | null;
    if (!res.ok || !json?.data) return aucun; // pas de mémoire : on réessaiera au prochain envoi
    const boutons = json.data.find((t) => t.name === template)?.components?.find((x) => x.type === "BUTTONS")?.buttons ?? [];
    const codes = boutons
      .map((b, index) => ({ index, b }))
      .filter(({ b }) => b.type === "COPY_CODE")
      .map(({ index, b }) => ({ index, code: String(Array.isArray(b.example) ? b.example[0] : b.example ?? "") }))
      .filter((x) => x.code);
    const formulaires = boutons.map((b, index) => ({ index, b })).filter(({ b }) => b.type === "FLOW").map(({ index }) => index);
    const r = { codes, formulaires };
    codesParModele.set(template, r);
    return r;
  } catch {
    return aucun;
  }
}

export type WhatsAppTemplate = {
  id: string;
  name: string;
  language: string;
  status: string; // APPROVED | PENDING | REJECTED…
  category: string;
  body: string | null; // le texte, avec ses {{1}}, {{2}}…
  variables: number; // combien de {{n}} le corps attend
  buttons: string[]; // les réponses rapides, s'il y en a
  autresBoutons: string[]; // « Copier le code », liens, appels : affichés, pas modifiables ici
  formulaire: boolean; // un bouton de formulaire (Flow) : il faut choisir la formation d'arrivée
  rejectedReason: string | null; // Meta dit pourquoi, quand il refuse
};

function wabaConfig() {
  const token = process.env.WHATSAPP_TOKEN;
  const waba = process.env.WHATSAPP_WABA_ID;
  if (!token || !waba) return null;
  return { token, waba };
}

/**
 * Les modèles du compte WhatsApp (le WABA, pas le numéro) — c'est ce qu'on peut
 * envoyer hors fenêtre de 24 h. Demande `WHATSAPP_WABA_ID` ; sans lui, liste
 * vide plutôt qu'une erreur : la page reste utilisable pour le texte libre.
 */
export async function listWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
  const c = wabaConfig();
  if (!c) return [];
  try {
    const res = await fetch(
      `${API}/${c.waba}/message_templates?fields=id,name,language,status,category,components,rejected_reason&limit=100`,
      { headers: { Authorization: `Bearer ${c.token}` }, cache: "no-store" }
    );
    const json = (await res.json().catch(() => null)) as {
      data?: {
        id: string;
        name: string;
        language: string;
        status: string;
        category: string;
        rejected_reason?: string;
        components?: {
          type: string;
          text?: string;
          buttons?: { type: string; text: string; url?: string; phone_number?: string; example?: string[] | string }[];
        }[];
      }[];
    } | null;
    if (!res.ok || !json?.data) return [];
    return json.data.map((t) => {
      const body = t.components?.find((c) => c.type === "BODY")?.text ?? null;
      const tous = t.components?.find((c) => c.type === "BUTTONS")?.buttons ?? [];
      const buttons = tous.filter((b) => b.type === "QUICK_REPLY").map((b) => b.text);
      const autresBoutons = tous
        .filter((b) => b.type !== "QUICK_REPLY")
        .map((b) =>
          b.type === "COPY_CODE"
            ? `Copier le code : ${Array.isArray(b.example) ? b.example[0] : b.example ?? ""}`
            : b.type === "URL"
              ? `${b.text} → ${b.url ?? ""}`
              : b.type === "PHONE_NUMBER"
                ? `${b.text} → ${b.phone_number ?? ""}`
                : `${b.text} (${b.type.toLowerCase()})`
        );
      return {
        id: t.id,
        name: t.name,
        language: t.language,
        status: t.status,
        category: t.category,
        body,
        variables: countTemplateVariables(body),
        buttons,
        autresBoutons,
        formulaire: tous.some((b) => b.type === "FLOW"),
        // Meta rend "NONE" quand il n'y a rien à dire.
        rejectedReason: t.rejected_reason && t.rejected_reason !== "NONE" ? t.rejected_reason : null,
      };
    });
  } catch {
    return [];
  }
}

/** Combien de {{n}} un corps de modèle attend — c'est le plus grand numéro, pas le nombre d'occurrences. */
export function countTemplateVariables(body: string | null): number {
  const nums = [...(body ?? "").matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 0;
}

/**
 * Soumettre un modèle à Meta. Il part en PENDING ; l'approbation prend de
 * quelques minutes à 48 h, et Meta peut requalifier la catégorie.
 *
 * `examples` : une valeur d'exemple par variable — Meta les EXIGE dès qu'il y
 * a un {{n}}, c'est avec ça que ses relecteurs jugent le message.
 */
export async function createWhatsAppTemplate(input: {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY";
  body: string;
  examples: string[];
  buttons?: string[]; // réponses rapides : un tap = un message du lead, la fenêtre de 24 h s'ouvre
}): Promise<{ ok: true; id: string; status: string } | { ok: false; error: string }> {
  const c = wabaConfig();
  if (!c) return { ok: false, error: "WHATSAPP_TOKEN ou WHATSAPP_WABA_ID absent de l'environnement." };

  const n = countTemplateVariables(input.body);
  const body: Record<string, unknown> = { type: "BODY", text: input.body };
  if (n > 0) body.example = { body_text: [input.examples.slice(0, n)] };
  const components: Record<string, unknown>[] = [body];
  const buttons = (input.buttons ?? []).map((b) => b.trim()).filter(Boolean).slice(0, 3);
  if (buttons.length > 0) {
    components.push({ type: "BUTTONS", buttons: buttons.map((text) => ({ type: "QUICK_REPLY", text })) });
  }

  try {
    const res = await fetch(`${API}/${c.waba}/message_templates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        language: input.language,
        category: input.category,
        components,
      }),
    });
    const json = (await res.json().catch(() => null)) as
      | { id?: string; status?: string; error?: { message?: string; error_user_msg?: string } }
      | null;
    if (!res.ok || !json?.id) {
      // `error_user_msg` est la phrase lisible ; `message` le code technique.
      return { ok: false, error: json?.error?.error_user_msg ?? json?.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, id: json.id, status: json.status ?? "PENDING" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur WhatsApp" };
  }
}

/**
 * Modifier le TEXTE d'un modèle existant. Seul le corps change : en-tête,
 * pied et boutons sont renvoyés tels que Meta les a. Le modèle repasse en
 * relecture ; Meta limite les modifications d'un modèle approuvé (une par
 * 24 h, dix par mois) et n'en change jamais la catégorie.
 */
export async function editWhatsAppTemplateBody(
  name: string,
  body: string,
  examples: string[]
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const c = wabaConfig();
  if (!c) return { ok: false, error: "WHATSAPP_TOKEN ou WHATSAPP_WABA_ID absent de l'environnement." };
  try {
    const lu = await fetch(
      `${API}/${c.waba}/message_templates?name=${encodeURIComponent(name)}&fields=id,name,components`,
      { headers: { Authorization: `Bearer ${c.token}` }, cache: "no-store" }
    );
    const j = (await lu.json().catch(() => null)) as {
      data?: { id: string; name: string; components?: Record<string, unknown>[] }[];
    } | null;
    const t = j?.data?.find((x) => x.name === name);
    if (!t) return { ok: false, error: "Modèle introuvable chez Meta." };

    const n = countTemplateVariables(body);
    const corps: Record<string, unknown> = { type: "BODY", text: body };
    if (n > 0) corps.example = { body_text: [examples.slice(0, n)] };
    const components = (t.components ?? []).map((x) => (x.type === "BODY" ? corps : x));

    const res = await fetch(`${API}/${t.id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ components }),
    });
    const r = (await res.json().catch(() => null)) as
      | { success?: boolean; error?: { message?: string; error_user_msg?: string } }
      | null;
    if (!res.ok || !r?.success) {
      return { ok: false, error: r?.error?.error_user_msg ?? r?.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, status: "PENDING" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur WhatsApp" };
  }
}

// Les corps des modèles, gardés 10 min : le journal d'une vague de 200 envois
// ne relit pas 200 fois la liste chez Meta.
let corpsModeles: { at: number; corps: Map<string, string> } | null = null;

/**
 * Le texte d'un modèle tel que la personne l'a lu, variables remplies. Sert au
 * fil de la conversation — « Variables : Ahmed · … » n'apprenait rien à
 * l'assistant WhatsApp (il ignorait le code promo que la campagne annonçait).
 */
export async function texteDuModele(template: string, valeurs: string[]): Promise<string | null> {
  if (!corpsModeles || Date.now() - corpsModeles.at > 10 * 60_000) {
    const liste = await listWhatsAppTemplates();
    corpsModeles = { at: Date.now(), corps: new Map(liste.filter((t) => t.body).map((t) => [t.name, t.body!])) };
  }
  const corps = corpsModeles.corps.get(template);
  return corps ? corps.replace(/\{\{(\d+)\}\}/g, (_, n) => valeurs[Number(n) - 1] ?? "") : null;
}

/** Retirer un modèle (toutes ses langues) — un nom refusé reste pris tant qu'on ne l'efface pas. */
export async function deleteWhatsAppTemplate(name: string): Promise<{ ok: boolean; error?: string }> {
  const c = wabaConfig();
  if (!c) return { ok: false, error: "WHATSAPP_TOKEN ou WHATSAPP_WABA_ID absent de l'environnement." };
  try {
    const res = await fetch(`${API}/${c.waba}/message_templates?name=${encodeURIComponent(name)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${c.token}` },
    });
    const json = (await res.json().catch(() => null)) as { success?: boolean; error?: { message?: string } } | null;
    if (!res.ok || !json?.success) return { ok: false, error: json?.error?.message ?? `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur WhatsApp" };
  }
}

export type WhatsAppNumber = {
  numero: string;
  nom: string | null;
  qualite: string | null; // GREEN | YELLOW | RED | UNKNOWN
  statut: string | null; // CONNECTED…
  plateforme: string | null; // CLOUD_API attendu
  nomVerifie: string | null; // APPROVED…
  debit: string | null; // STANDARD…
};

/** Tout ce que Meta sait du numéro configuré — pour l'écran Paramètres. */
// ── Le profil de l'entreprise (photo, description, adresse, sites) ──────────

export type WhatsAppProfile = {
  about: string;
  address: string;
  description: string;
  email: string;
  websites: string[];
  vertical: string;
  profilePictureUrl: string | null;
};

/** Le profil tel que WhatsApp le sert aux contacts — pas ce qu'on a tapé, ce que Meta a gardé. */
export async function getWhatsAppProfile(): Promise<{ ok: true; profil: WhatsAppProfile } | { ok: false; error: string }> {
  const c = config();
  if (!c) return { ok: false, error: "WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID absent de l'environnement." };
  try {
    const res = await fetch(
      `${API}/${c.phoneId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`,
      { headers: { Authorization: `Bearer ${c.token}` }, cache: "no-store" }
    );
    const json = (await res.json().catch(() => null)) as
      | { data?: Array<Record<string, string | string[] | undefined>>; error?: { message?: string } }
      | null;
    const d = json?.data?.[0];
    if (!res.ok || !d) return { ok: false, error: json?.error?.message ?? `HTTP ${res.status}` };
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    return {
      ok: true,
      profil: {
        about: str(d.about),
        address: str(d.address),
        description: str(d.description),
        email: str(d.email),
        websites: Array.isArray(d.websites) ? d.websites.filter((w): w is string => typeof w === "string") : [],
        vertical: str(d.vertical) || "OTHER",
        profilePictureUrl: str(d.profile_picture_url) || null,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur WhatsApp" };
  }
}

/**
 * Écrire le profil. Meta refuse un champ vide dans certains cas (`about`) : on n'envoie que ce qui est rempli,
 * sauf `websites` qui accepte une liste vide pour effacer.
 */
export async function updateWhatsAppProfile(input: {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  websites?: string[];
  vertical?: string;
  profilePictureHandle?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = config();
  if (!c) return { ok: false, error: "WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID absent de l'environnement." };
  const body: Record<string, unknown> = { messaging_product: "whatsapp" };
  if (input.about?.trim()) body.about = input.about.trim();
  if (input.address !== undefined) body.address = input.address.trim();
  if (input.description !== undefined) body.description = input.description.trim();
  if (input.email !== undefined) body.email = input.email.trim();
  if (input.websites) body.websites = input.websites.map((w) => w.trim()).filter(Boolean).slice(0, 2);
  if (input.vertical) body.vertical = input.vertical;
  if (input.profilePictureHandle) body.profile_picture_handle = input.profilePictureHandle;
  try {
    const res = await fetch(`${API}/${c.phoneId}/whatsapp_business_profile`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as
      | { success?: boolean; error?: { message?: string; error_user_msg?: string } }
      | null;
    if (!res.ok || !json?.success) {
      return { ok: false, error: json?.error?.error_user_msg ?? json?.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur WhatsApp" };
  }
}

/**
 * La photo de profil passe par l'API d'upload « resumable » de Meta, en deux temps : ouvrir une session
 * sur l'app du jeton, y pousser les octets. Le `h` rendu est le « handle » que le profil attend.
 */
export async function uploadWhatsAppProfilePicture(
  bytes: ArrayBuffer,
  mime: string
): Promise<{ ok: true; handle: string } | { ok: false; error: string }> {
  const c = config();
  if (!c) return { ok: false, error: "WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID absent de l'environnement." };
  const auth = { Authorization: `Bearer ${c.token}` };
  try {
    // L'app à laquelle le jeton appartient — c'est elle qui héberge la session d'upload.
    const app = (await fetch(`${API}/app?fields=id`, { headers: auth }).then((r) => r.json())) as { id?: string };
    if (!app.id) return { ok: false, error: "Impossible d'identifier l'app Meta du jeton." };
    const session = (await fetch(
      `${API}/${app.id}/uploads?file_length=${bytes.byteLength}&file_type=${encodeURIComponent(mime)}`,
      { method: "POST", headers: auth }
    ).then((r) => r.json())) as { id?: string; error?: { message?: string } };
    if (!session.id) return { ok: false, error: session.error?.message ?? "Session d'upload refusée." };
    const up = (await fetch(`${API}/${session.id}`, {
      method: "POST",
      headers: { ...auth, file_offset: "0", "Content-Type": "application/octet-stream" },
      body: new Blob([bytes]),
    }).then((r) => r.json())) as { h?: string; error?: { message?: string } };
    if (!up.h) return { ok: false, error: up.error?.message ?? "Upload refusé." };
    return { ok: true, handle: up.h };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur WhatsApp" };
  }
}

export async function getWhatsAppNumber(): Promise<{ ok: true; numero: WhatsAppNumber } | { ok: false; error: string }> {
  const c = config();
  if (!c) return { ok: false, error: "WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID absent de l'environnement." };
  try {
    const res = await fetch(
      `${API}/${c.phoneId}?fields=display_phone_number,verified_name,quality_rating,status,platform_type,name_status,throughput`,
      { headers: { Authorization: `Bearer ${c.token}` }, cache: "no-store" }
    );
    const json = (await res.json().catch(() => null)) as
      | (Record<string, string | undefined> & { throughput?: { level?: string }; error?: { message?: string } })
      | null;
    if (!res.ok || !json) return { ok: false, error: json?.error?.message ?? `HTTP ${res.status}` };
    return {
      ok: true,
      numero: {
        numero: json.display_phone_number ?? "?",
        nom: json.verified_name ?? null,
        qualite: json.quality_rating ?? null,
        statut: json.status ?? null,
        plateforme: json.platform_type ?? null,
        nomVerifie: json.name_status ?? null,
        debit: json.throughput?.level ?? null,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}
