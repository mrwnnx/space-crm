/**
 * Rendu d'une campagne.
 *
 * Ce fichier ne dessine plus rien : il délègue au gabarit unique de
 * `messaging/markdown.ts`, celui qui habille TOUS les emails du CRM.
 *
 * Pas de "server-only" ici : fonctions pures, testables isolément.
 */
import {
  markdownToEmailHtml,
  wrapWithBranding,
  asEmailDocument,
  type Branding,
} from "@/lib/messaging/markdown";

export type CampaignTemplateInput = {
  /** Markdown, comme partout ailleurs. Le HTML des anciennes campagnes passe. */
  content: string;
  /** URL complète de désinscription, propre à chaque destinataire */
  unsubscribeUrl: string;
  /** Nom affiché de l'expéditeur, repris dans le pied de page */
  senderName?: string;
  /** Habillage commun. Absent = email nu, sans bannière ni pied de page. */
  branding?: Branding | null;
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Rendu d'une campagne — délègue au **gabarit unique** de `markdown.ts`.
 *
 * Avant le 2026-09-02 ce fichier avait son propre HTML : les campagnes ne
 * portaient ni logo, ni bannière, ni pied de page commun, et ne ressemblaient
 * à aucun autre email du CRM. Deux moteurs = deux apparences, sans que rien
 * ne le signale.
 *
 * Le contenu est du **Markdown** comme partout ailleurs. Il laisse passer le
 * HTML, donc les campagnes écrites avant dans l'éditeur visuel continuent de
 * s'afficher correctement.
 */
export function renderCampaignHtml({
  content,
  unsubscribeUrl,
  senderName = "Space Academy",
  branding,
}: CampaignTemplateInput): string {
  const safeUrl = escapeHtml(unsubscribeUrl);

  // Le désabonnement n'existe que pour un vrai destinataire : il s'ajoute au
  // pied de page commun au lieu d'y être enfermé.
  const unsubscribe = `<p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#9ca3af">Vous recevez cet email parce que vous vous êtes inscrit à une formation ${escapeHtml(senderName)}.<br><a href="${safeUrl}" style="color:#9ca3af;text-decoration:underline">Se désabonner</a></p>`;

  // Document COMPLET, pas un fragment : c'est ce qui part par email, et c'est
  // aussi ce que l'aperçu doit recevoir — un `srcDoc` sans <body> ne s'affiche
  // pas du tout. `asEmailDocument` est idempotente, l'envoi ne double rien.
  return asEmailDocument(
    wrapWithBranding(
      markdownToEmailHtml(content || "", branding ?? undefined),
      branding ?? undefined,
      { footerExtra: unsubscribe }
    )
  );
}

/** Repli texte : certains clients l'affichent, et les filtres anti-spam pénalisent son absence. */
export function renderCampaignText(content: string, unsubscribeUrl: string): string {
  const plain = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|li|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return `${plain}\n\n---\nSe désabonner : ${unsubscribeUrl}`;
}
