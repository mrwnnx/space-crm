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
  level: "error" | "warning";
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

  return out;
}

/** Un envoi est refusé tant qu'il reste une erreur ; les avertissements passent. */
export function hasBlockingError(checks: Check[]): boolean {
  return checks.some((c) => c.level === "error");
}
