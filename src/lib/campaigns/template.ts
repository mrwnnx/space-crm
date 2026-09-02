/**
 * Gabarit HTML d'email.
 *
 * Contraintes des clients mail, qui expliquent la forme du code ci-dessous :
 * - mise en page par <table>, parce qu'Outlook ignore flex et grid ;
 * - styles INLINE, parce que Gmail retire une partie du <style> ;
 * - largeur 600px, la valeur qui passe partout sans scroll horizontal ;
 * - pas d'image de fond, pas de webfont : silencieusement ignorées.
 *
 * Pas de "server-only" ici : fonction pure, testable isolément.
 */

export type CampaignTemplateInput = {
  /** HTML produit par l'éditeur (p, h2, ul, strong, em, a…) */
  content: string;
  /** URL complète de désinscription, propre à chaque destinataire */
  unsubscribeUrl: string;
  /** Nom affiché de l'expéditeur, repris dans le pied de page */
  senderName?: string;
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Applique des styles inline aux balises produites par l'éditeur.
 * Sans ça, un <h2> ou un <a> hérite des styles par défaut du client mail,
 * qui varient du simple au grotesque d'un client à l'autre.
 */
function inlineContentStyles(html: string): string {
  return html
    .replace(/<p>/g, '<p style="margin:0 0 16px;font-size:16px;line-height:1.6;">')
    .replace(
      /<h1>/g,
      '<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:600;">'
    )
    .replace(
      /<h2>/g,
      '<h2 style="margin:24px 0 12px;font-size:19px;line-height:1.3;font-weight:600;">'
    )
    .replace(
      /<h3>/g,
      '<h3 style="margin:20px 0 8px;font-size:16px;line-height:1.4;font-weight:600;">'
    )
    .replace(/<ul>/g, '<ul style="margin:0 0 16px;padding-left:22px;font-size:16px;">')
    .replace(/<ol>/g, '<ol style="margin:0 0 16px;padding-left:22px;font-size:16px;">')
    .replace(/<li>/g, '<li style="margin:0 0 6px;font-size:16px;line-height:1.6;">')
    .replace(/<a /g, '<a style="color:#1a56db;text-decoration:underline;" ')
    .replace(
      /<blockquote>/g,
      '<blockquote style="margin:0 0 16px;padding-left:14px;font-size:16px;line-height:1.6;border-left:3px solid #e5e7eb;color:#4b5563;">'
    );
}

export function renderCampaignHtml({
  content,
  unsubscribeUrl,
  senderName = "Space Academy",
}: CampaignTemplateInput): string {
  const body = inlineContentStyles(content || "<p></p>");
  const safeUrl = escapeHtml(unsubscribeUrl);

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<style>
  /* Sans ça, iOS et Android redimensionnent le texte tout seuls et l'email
     arrive en petit sur mobile. */
  body{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;text-size-adjust:100%;}
</style>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f4;">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:28px 32px 8px;">
      <p style="margin:0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#78716c;font-family:Helvetica,Arial,sans-serif;">${escapeHtml(senderName)}</p>
    </td></tr>
    <tr><td style="padding:8px 32px 28px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1c1917;">
${body}
    </td></tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
    <tr><td style="padding:20px 32px;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#78716c;">
      Vous recevez cet email parce que vous vous êtes inscrit à une formation ${escapeHtml(senderName)}.<br>
      <a href="${safeUrl}" style="color:#78716c;text-decoration:underline;">Se désabonner</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
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
