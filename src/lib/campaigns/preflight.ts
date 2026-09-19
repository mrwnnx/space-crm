/**
 * Contrôles avant envoi — l'idée reprise de Kit : montrer le problème PENDANT
 * l'écriture, pas le découvrir chez 509 destinataires.
 *
 * Module NEUTRE (ni "server-only" ni "use client") : le même contrôle sert à
 * l'écran d'édition et au garde-fou côté serveur. Deux implémentations
 * finiraient par diverger sans que rien ne le signale.
 */

export type Check = {
  id: string;
  /** error = bloque l'envoi · warning = à vérifier · tip = conseil pour arriver
   *  en Principale plutôt qu'en Promotions/spam (mesuré sur de vrais envois). */
  level: "error" | "warning" | "tip";
  message: string;
};

/** Objets trop génériques pour être partis exprès. */
const GENERIC_SUBJECTS = [
  "nouvelle campagne",
  "sans sujet",
  "test",
  "new campaign",
  "campagne",
  "brouillon",
];

export function checkCampaign(input: {
  subject: string;
  content: string;
}): Check[] {
  const out: Check[] = [];
  const subject = input.subject.trim();
  const content = input.content ?? "";

  // ── Objet ───────────────────────────────────────────
  if (!subject) {
    out.push({ id: "subject-empty", level: "error", message: "L'objet est vide." });
  } else if (GENERIC_SUBJECTS.includes(subject.toLowerCase())) {
    out.push({
      id: "subject-generic",
      level: "warning",
      message: `L'objet est resté « ${subject} ».`,
    });
  } else if (subject.length > 90) {
    out.push({
      id: "subject-long",
      level: "warning",
      message: `Objet de ${subject.length} caractères — il sera coupé dans la plupart des boîtes.`,
    });
  }

  // ── Contenu ─────────────────────────────────────────
  const text = content.replace(/<[^>]*>/g, "").trim();
  if (!text) {
    out.push({ id: "content-empty", level: "error", message: "Le contenu est vide." });
  }

  // ── Liens sans adresse ──────────────────────────────
  // Le cas vécu chez Kit : un <a> dont le href est vide part quand même, et
  // le destinataire clique dans le vide.
  const emptyHref = (content.match(/<a\b[^>]*href\s*=\s*(""|''|"#"|'#')/gi) ?? []).length;
  const noHref = (content.match(/<a\b(?![^>]*\bhref\b)[^>]*>/gi) ?? []).length;
  const broken = emptyHref + noHref;
  if (broken > 0) {
    out.push({
      id: "link-empty",
      level: "error",
      message: `${broken} lien${broken > 1 ? "s" : ""} ne pointe${broken > 1 ? "nt" : ""} vers aucune adresse.`,
    });
  }

  // ── Balises de personnalisation ─────────────────────
  // Une campagne ne substitue AUCUNE variable : tout {{…}} partirait tel quel.
  // C'est exactement l'accident du {{affiliate_url}} vu dans le compte Kit.
  const tags = [...new Set((content.match(/\{\{\s*[\w.-]+\s*\}\}/g) ?? []).map((t) => t.trim()))];
  if (tags.length > 0) {
    out.push({
      id: "merge-tag",
      level: "error",
      message:
        `${tags.join(", ")} partira${tags.length > 1 ? "ient" : ""} tel quel : ` +
        `une campagne ne remplace aucune variable.`,
    });
  }

  // ── Lien de désabonnement écrit à la main ───────────
  // Il est ajouté automatiquement, propre à chaque destinataire.
  if (/désabonn|desabonn|unsubscribe/i.test(text) && !/\{\{/.test(content)) {
    out.push({
      id: "unsubscribe-manual",
      level: "warning",
      message:
        "Vous mentionnez le désabonnement : le lien est déjà ajouté automatiquement en pied d'email.",
    });
  }

  // ── Conseils Principale / Promotions ────────────────
  // Tout ce qui suit vient de 14 envois réels vers une boîte Gmail le
  // 2026-09-18, une variable à la fois, puis de la campagne « Webinar 09/2026 »
  // du 19/09 (objet 🎉 + « Live webinar: », image en tête, deux lignes) partie
  // en Promotions. Ce ne sont pas des règles générales copiées d'un blog.
  out.push(...deliverabilityTips(subject, content, text));

  return out;
}

/** Le texte lu par un humain : sans images, sans balises, liens réduits à leur libellé. */
function readableText(content: string): string {
  return content
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images markdown
    .replace(/<img\b[^>]*>/gi, " ")
    .replace(/\[\[([^\]]*)\]\]\([^)]*\)/g, "$1") // boutons [[Texte]](url)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // liens [texte](url)
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^#+\s*/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const EMOJI = /\p{Extended_Pictographic}/u;
const ANNOUNCE_WORDS =
  /\b(webinar|webinaire|live|gratuit|free|offre|promo|promotion|urgent|dernière chance|exclusi[fv]e?|get started|register|join|inscris-toi vite)\b/i;

function deliverabilityTips(subject: string, content: string, strippedText: string): Check[] {
  const tips: Check[] = [];
  const text = readableText(content);
  const words = text ? text.split(" ").filter((w) => /[\p{L}\d]/u.test(w)).length : 0;
  const imageCount =
    (content.match(/!\[[^\]]*\]\([^)]*\)/g) ?? []).length + (content.match(/<img\b/gi) ?? []).length;
  const startsWithImage = /^\s*(!\[|<img\b|<p>\s*<img\b)/i.test(content);
  const linkCount =
    (content.match(/\]\(https?:\/\/[^)]+\)/g) ?? []).length +
    (content.match(/href\s*=\s*["']https?:/gi) ?? []).length;

  // ── Objet
  if (subject && EMOJI.test(subject)) {
    tips.push({
      id: "tip-subject-emoji",
      level: "tip",
      message:
        "Un emoji dans l'objet est un signal « pub » : les objets arrivés en Principale n'en avaient aucun. Garde l'emoji pour le corps, s'il en faut un.",
    });
  }
  if (subject && ANNOUNCE_WORDS.test(subject)) {
    tips.push({
      id: "tip-subject-announce",
      level: "tip",
      message:
        "L'objet sonne comme une annonce (« live », « webinar », « gratuit »…). Écris-le comme un message qu'on envoie à quelqu'un : « Dimanche 18h — on démarre en UX ensemble ? »",
    });
  }
  if (subject) {
    const letters = subject.replace(/[^\p{L}]/gu, "");
    const upper = letters.replace(/[^\p{Lu}]/gu, "").length;
    if ((letters.length >= 8 && upper / letters.length > 0.5) || /!{2,}/.test(subject)) {
      tips.push({
        id: "tip-subject-shout",
        level: "tip",
        message: "Majuscules ou « !! » dans l'objet : le filtre anti-spam les compte contre toi.",
      });
    }
    if (subject.length > 60 && subject.length <= 90) {
      tips.push({
        id: "tip-subject-mobile",
        level: "tip",
        message: `Objet de ${subject.length} caractères : coupé sur téléphone au-delà d'environ 60.`,
      });
    }
  }

  // ── Contenu
  if (/[\u0600-\u06FF]/.test(strippedText)) {
    tips.push({
      id: "tip-arabic",
      level: "tip",
      message:
        "En lettres arabes, Gmail range en Promotions quoi qu'on fasse (3 essais sur 3, même sans lien ni bouton). Le français passe en Principale.",
    });
  }
  if (startsWithImage) {
    tips.push({
      id: "tip-image-first",
      level: "tip",
      message:
        "L'email commence par une image : pour Gmail c'est un flyer, pas un message. Commence par une phrase à toi ; l'image, plus bas ou pas du tout.",
    });
  }
  if (words > 0 && words < 40) {
    tips.push({
      id: "tip-thin",
      level: "tip",
      message: `${words} mot${words > 1 ? "s" : ""} : c'est un flyer. Les emails arrivés en Principale avaient 4 à 5 phrases — dis pourquoi tu écris, à qui, et ce qui se passe ensuite.`,
    });
  }
  // « je » ou « j' » seulement : « mon appel », « ma place » existent aussi
  // dans un texte de marque — le sujet de la phrase, lui, ne ment pas.
  if (words >= 15 && !/\bj(e\b|['’])/i.test(text)) {
    tips.push({
      id: "tip-not-personal",
      level: "tip",
      message:
        "Pas de « je » dans le texte. Écrit à la première personne (« J'ai relu ton dossier ce matin… »), l'email est passé en Principale 3 fois sur 3 ; en voix de marque (« Ton programme est prêt… »), en Promotions 2 fois sur 2.",
    });
  }
  if (linkCount > 2) {
    tips.push({
      id: "tip-links",
      level: "tip",
      message: `${linkCount} liens : un seul bouton suffit — chaque lien en plus ressemble à une newsletter.`,
    });
  }
  if (imageCount >= 2) {
    tips.push({
      id: "tip-images",
      level: "tip",
      message: `${imageCount} images : plus il y en a, plus l'email ressemble à une pub. Une seule, en bas, ou aucune.`,
    });
  }
  if (/^#+\s*$/m.test(content)) {
    tips.push({
      id: "tip-empty-heading",
      level: "warning",
      message: "Un titre vide (« # ») : écris-le ou supprime la ligne.",
    });
  }
  if (/r[ée]pond(ez|s|re)[^.\n]{0,40}(e-?mail|ce message)/i.test(text)) {
    tips.push({
      id: "tip-reply-by-email",
      level: "warning",
      message:
        "Tu demandes de répondre par email. Règle de la maison : en Tunisie l'email se lit, il ne se répond pas — propose un appel ou WhatsApp.",
    });
  }

  return tips;
}

/** Un envoi est refusé tant qu'il reste une erreur ; les avertissements passent. */
export function hasBlockingError(checks: Check[]): boolean {
  return checks.some((c) => c.level === "error");
}
