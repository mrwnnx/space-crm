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
function normaliser(brut: string): string {
  const chiffres = brut.replace(/\D/g, "");
  // Un numéro tunisien saisi sans indicatif — cas courant dans le CRM, où les
  // leads arrivent en « 25 726 708 ». Sans le 216, Meta ne livre rien.
  if (chiffres.length === 8) return `216${chiffres}`;
  return chiffres;
}

async function envoyer(corps: Record<string, unknown>): Promise<WhatsAppResult> {
  const c = config();
  if (!c) return { ok: false, error: "WhatsApp non configuré (WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID absent)." };

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
}: {
  to: string;
  body: string;
}): Promise<{ ok: boolean; error?: string; sid?: string }> {
  const r = await envoyer({
    to: normaliser(to),
    type: "text",
    text: { preview_url: true, body },
  });
  return r.ok ? { ok: true, sid: r.id } : { ok: false, error: r.error };
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
}: {
  to: string;
  template: string;
  langue?: string;
  variables?: string[];
}): Promise<WhatsAppResult> {
  return envoyer({
    to: normaliser(to),
    type: "template",
    template: {
      name: template,
      language: { code: langue },
      ...(variables.length
        ? {
            components: [
              {
                type: "body",
                parameters: variables.map((v) => ({ type: "text", text: v })),
              },
            ],
          }
        : {}),
    },
  });
}

/** Le numéro configuré répond-il ? Sert à prouver la connexion sans rien envoyer. */
export async function checkWhatsApp(): Promise<
  { ok: true; numero: string; nom: string | null; qualite: string | null } | { ok: false; error: string }
> {
  const c = config();
  if (!c) return { ok: false, error: "WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID absent de l'environnement." };
  try {
    const res = await fetch(
      `${API}/${c.phoneId}?fields=display_phone_number,verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${c.token}` } }
    );
    const json = (await res.json().catch(() => null)) as Record<string, string> & {
      error?: { message?: string };
    };
    if (!res.ok) return { ok: false, error: json?.error?.message ?? `HTTP ${res.status}` };
    return {
      ok: true,
      numero: json.display_phone_number ?? "?",
      nom: json.verified_name ?? null,
      qualite: json.quality_rating ?? null,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}
