import "server-only";
import { listWhatsAppTemplates } from "@/lib/messaging/whatsapp";

// Garde-fou Meta, appliqué à TOUT envoi de modèle (fiche et automatisation) :
// un STOP arrête tout modèle ; un modèle MARKETING ne part qu'à une personne
// qui a coché la case de consentement et que Meta ne limite pas ; un
// UTILITAIRE (suite à sa demande : brochure, inscription, paiement) passe.
// Catégorie inconnue = marketing : dans le doute, on ne risque pas le numéro
// de l'école.

type Garde = { ok: true } | { ok: false; reason: string };

export type ContactConsent = {
  whatsappConsentAt: Date | null;
  whatsappUnsubscribedAt?: Date | null;
  whatsappMarketingLimitedUntil?: Date | null;
};

// Les modèles changent rarement : une lecture toutes les 5 min suffit, et
// évite un appel Meta par envoi d'automatisation.
let cache: { at: number; categories: Map<string, string> } | null = null;
const CACHE_MS = 5 * 60 * 1000;

async function categorieDuModele(nom: string, langue: string): Promise<string | null> {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    const modeles = await listWhatsAppTemplates();
    if (!modeles.length) return null; // API muette : on ne sait pas
    cache = {
      at: Date.now(),
      categories: new Map(modeles.map((t) => [`${t.name}|${t.language}`, t.category])),
    };
  }
  return cache.categories.get(`${nom}|${langue}`) ?? null;
}

const dateFr = (d: Date) => d.toLocaleDateString("fr-FR");

export async function whatsAppConsentCheck(
  contact: ContactConsent | null | undefined,
  template: string,
  langue: string
): Promise<Garde> {
  if (contact?.whatsappUnsubscribedAt) {
    return {
      ok: false,
      reason: `Cette personne a répondu STOP le ${dateFr(contact.whatsappUnsubscribedAt)} : plus aucun message automatique WhatsApp.`,
    };
  }
  const categorie = await categorieDuModele(template, langue);
  if (categorie === "UTILITY" || categorie === "AUTHENTICATION") return { ok: true };

  const limite = contact?.whatsappMarketingLimitedUntil;
  if (limite && limite.getTime() > Date.now()) {
    return {
      ok: false,
      reason: `Meta limite les messages marketing vers cette personne (trop de marketing non lu) : réessayer après le ${limite.toLocaleString("fr-FR")}.`,
    };
  }
  if (contact?.whatsappConsentAt) return { ok: true };
  if (categorie === null) {
    return {
      ok: false,
      reason: "Catégorie du modèle inconnue chez Meta : envoi refusé par prudence, sans consentement WhatsApp tracé.",
    };
  }
  return {
    ok: false,
    reason:
      "Modèle marketing : cette personne n'a pas coché la case de consentement WhatsApp. Seul un modèle utilitaire, lié à sa demande, peut partir.",
  };
}

// ── Mots-clés reçus : STOP / START ────────────────────────────────────
// Le message ENTIER doit être le mot-clé (ponctuation tolérée) : « je veux
// arrêter ma formation » n'est pas un STOP.
const STOP = /^(stop|ستوب|arr[êe]te[rz]?|arr[êe]t|d[ée]sabonne[rz]?|unsubscribe|حبس|وقف|بلاش)$/i;
const START = /^(start|reprendre|r[ée]abonne[rz]?)$/i;

export function motCleOptOut(texte: string | null | undefined): "stop" | "start" | null {
  const s = (texte ?? "").trim().replace(/[\s.!،,؟?]+$/u, "").toLowerCase();
  if (!s || s.length > 20) return null;
  if (STOP.test(s)) return "stop";
  if (START.test(s)) return "start";
  return null;
}

export const TEXTE_STOP =
  "C'est noté : vous ne recevrez plus nos messages automatiques sur WhatsApp. Pour les recevoir à nouveau, répondez START.";
export const TEXTE_START =
  "Merci ! Vous recevrez à nouveau nos messages sur WhatsApp. Répondez STOP à tout moment pour arrêter.";
