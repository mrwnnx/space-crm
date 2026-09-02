// Module NEUTRE (ni "server-only" ni "use client") : le rendu doit être
// identique côté serveur (envoi) et côté client (aperçu de l'éditeur).
import { Marked } from "marked";

/** Habillage commun, passé en paramètre — jamais lu depuis la base ici. */
export type Branding = {
  logoUrl?: string | null;
  logoWidth?: number | null;
  bannerBg?: string | null;
  bannerImageUrl?: string | null;
  bannerTagline?: string | null;
  logoAlt?: string | null;
  logoPosition?: string | null;
  headerDivider?: string | null;
  bodyBg?: string | null;
  titleColor?: string | null;
  textColor?: string | null;
  boldColor?: string | null;
  footnoteColor?: string | null;
  footerText?: string | null;
  accentColor?: string | null;
  primaryBtnText?: string | null;
  secondaryBtnBg?: string | null;
  secondaryBtnText?: string | null;
  secondaryBtnBorder?: string | null;
  buttonPosition?: string | null;
  senderEmail?: string | null;
  senderName?: string | null;
};

export const DEFAULT_ACCENT = "#1a1a1a";

/** Bouton principal d'un modèle, piloté par l'interrupteur de l'éditeur. */
export type MainButton = {
  enabled?: boolean | null;
  label?: string | null;
  url?: string | null;
  position?: string | null; // "top" | "bottom"
};

/**
 * Styles en ligne, balise par balise.
 *
 * Les clients de messagerie ignorent `<style>` et les feuilles externes : la
 * seule mise en forme qui survit à Gmail et Outlook est l'attribut `style` sur
 * chaque élément. D'où l'émission directe depuis le renderer.
 */
const FONT =
  "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/** Valeurs par défaut, alignées sur l'écran de configuration. */
const D = {
  bodyBg: "#ffffff",
  titleColor: "#212327",
  textColor: "#5b616f",
  boldColor: "#212327",
  footnoteColor: "#a4a8b2",
  headerDivider: "#e0e2ea",
  primaryBtnText: "#ffffff",
  secondaryBtnBg: "#ffffff",
  secondaryBtnText: "#3e64de",
  secondaryBtnBorder: "#3e64de",
};

/**
 * Fabrique la table de styles à partir de la configuration.
 *
 * Une table figée ne pouvait pas porter les couleurs choisies dans l'écran
 * « Design des emails » : chaque style est donc recalculé par envoi.
 */
function styles(b?: Branding) {
  const title = b?.titleColor || D.titleColor;
  const text = b?.textColor || D.textColor;
  const footnote = b?.footnoteColor || D.footnoteColor;
  return {
    p: `margin:0 0 16px;font-size:16px;line-height:1.6;color:${text}`,
    h1: `margin:0 0 14px;font-size:21px;font-weight:600;line-height:1.3;color:${title}`,
    h2: `margin:24px 0 12px;font-size:17px;font-weight:600;line-height:1.35;color:${title}`,
    h3: `margin:20px 0 10px;font-size:16px;font-weight:600;color:${title}`,
    list: `margin:0 0 16px;padding-left:20px;font-size:16px;line-height:1.6;color:${text}`,
    li: "margin-bottom:6px",
    hr: `border:0;border-top:1px solid ${b?.headerDivider || D.headerDivider};margin:24px 0`,
    blockquote: `margin:0 0 16px;padding:2px 0 2px 14px;border-left:3px solid ${b?.headerDivider || D.headerDivider};color:${footnote};font-size:16px;line-height:1.6`,
    code: "background:#f6f6f4;border-radius:4px;padding:2px 5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px",
    pre: "background:#f6f6f4;border-radius:8px;padding:12px 14px;overflow-x:auto;font-size:13px",
    img: "max-width:100%;height:auto;display:block;margin:0 0 16px;border-radius:8px",
    font: FONT,
    // Le pied de page reprend le même Markdown que le corps, en plus petit :
    // sans ça, un lien de désinscription y serait du texte mort.
    footerP: `margin:0 0 8px;font-size:12px;line-height:1.5;color:${footnote}`,
    footerList: `margin:0 0 8px;padding-left:18px;font-size:12px;line-height:1.5;color:${footnote}`,
    /** Gras : sa couleur est réglable à part, comme chez Tutor. */
    strong: `font-weight:600;color:${b?.boldColor || D.boldColor}`,
  };
}

function buildMarked(
  branding: Branding | undefined,
  variant: "body" | "footer" = "body"
) {
  const S = styles(branding);
  const accent = branding?.accentColor || DEFAULT_ACCENT;
  const pStyle = variant === "footer" ? S.footerP : S.p;
  const listStyle = variant === "footer" ? S.footerList : S.list;
  const marked = new Marked({
    gfm: true,
    breaks: true, // un retour à la ligne simple = <br>, ce qu'attend quelqu'un qui écrit un email
  });

  marked.use({
    extensions: [
      {
        // Syntaxe bouton : [[Texte du bouton]](https://url)
        // Niveau BLOC : un bouton est une table, elle ne peut pas vivre dans un <p>.
        name: "emailButton",
        level: "block",
        start(src: string) {
          return src.indexOf("[[");
        },
        tokenizer(src: string) {
          const m = /^\[\[([^\]\n]+)\]\]\(([^)\s]+)\)[ \t]*(?:\n|$)/.exec(src);
          if (!m) return undefined;
          // « Texte|secondaire » demande le bouton de repli (contour).
          const [label, kind] = m[1].split("|").map((x) => x.trim());
          return {
            type: "emailButton",
            raw: m[0],
            text: label,
            href: m[2].trim(),
            secondary: (kind ?? "").toLowerCase().startsWith("second"),
          };
        },
        renderer(raw) {
          const token = raw as unknown as {
            text: string;
            href: string;
            secondary?: boolean;
          };
          // Table + bgcolor, PAS un simple <a> stylé : Outlook ignore le padding
          // sur une balise <a>, le bouton y apparaîtrait comme du texte souligné.
          const bg = token.secondary
            ? branding?.secondaryBtnBg || D.secondaryBtnBg
            : accent;
          const fg = token.secondary
            ? branding?.secondaryBtnText || D.secondaryBtnText
            : branding?.primaryBtnText || D.primaryBtnText;
          // Le contour du bouton secondaire est porté par le <td> : une bordure
          // sur le <a> saute chez Outlook.
          const border = token.secondary
            ? `border:1px solid ${branding?.secondaryBtnBorder || D.secondaryBtnBorder};`
            : "";
          const align = branding?.buttonPosition === "center"
            ? "center"
            : branding?.buttonPosition === "right"
              ? "right"
              : "left";
          return `<table role="presentation" align="${align}" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px${align === "center" ? ";margin-left:auto;margin-right:auto" : align === "right" ? ";margin-left:auto" : ""}"><tr><td bgcolor="${bg}" style="${border}border-radius:8px"><a href="${token.href}" style="display:inline-block;padding:13px 26px;${FONT};font-size:15px;font-weight:600;color:${fg};text-decoration:none;border-radius:8px">${token.text}</a></td></tr></table>\n`;
        },
      },
    ],
    renderer: {
      paragraph({ tokens }) {
        return `<p style="${pStyle}">${this.parser.parseInline(tokens)}</p>\n`;
      },
      heading({ tokens, depth }) {
        const style = depth === 1 ? S.h1 : depth === 2 ? S.h2 : S.h3;
        const tag = `h${Math.min(depth, 3)}`;
        return `<${tag} style="${style}">${this.parser.parseInline(tokens)}</${tag}>\n`;
      },
      list(token) {
        const tag = token.ordered ? "ol" : "ul";
        const items = token.items
          .map((i) => `<li style="${S.li}">${this.parser.parseInline(i.tokens)}</li>`)
          .join("\n");
        return `<${tag} style="${listStyle}">\n${items}\n</${tag}>\n`;
      },
      link({ href, tokens }) {
        return `<a href="${href}" style="color:${accent};text-decoration:underline">${this.parser.parseInline(tokens)}</a>`;
      },
      image({ href, text }) {
        return `<img src="${href}" alt="${text ?? ""}" style="${S.img}">`;
      },
      hr() {
        return `<hr style="${S.hr}">\n`;
      },
      blockquote({ tokens }) {
        return `<blockquote style="${S.blockquote}">${this.parser.parse(tokens)}</blockquote>\n`;
      },
      strong({ tokens }) {
        return `<strong style="${S.strong}">${this.parser.parseInline(tokens)}</strong>`;
      },
      codespan({ text }) {
        return `<code style="${S.code}">${text}</code>`;
      },
      code({ text }) {
        return `<pre style="${S.pre}"><code>${text}</code></pre>\n`;
      },
    },
  });

  return marked;
}

/** Markdown (ou HTML brut, qui passe tel quel) → corps HTML, sans l'habillage. */
export function markdownToEmailHtml(
  source: string,
  branding?: Branding,
  variant: "body" | "footer" = "body"
): string {
  return buildMarked(branding, variant).parse(source ?? "", { async: false }) as string;
}

/** Enveloppe commune : en-tête (logo) + corps + pied de page. */
/**
 * Le gabarit unique : **bannière — corps — pied de page**.
 *
 * Tout ce qui sort du CRM passe par ici : modèles, envois 1-à-1, digest,
 * campagnes. Un second moteur produirait deux apparences différentes — c'était
 * exactement le cas des campagnes avant le 2026-09-02.
 *
 * Bâti en `<table>` et non en `<div>` : Outlook ignore `max-width` sur un div
 * et laisserait l'email s'étaler sur toute la fenêtre.
 *
 * `options.footerExtra` : le lien de désabonnement des campagnes, qui n'existe
 * que pour un vrai destinataire et n'a rien à faire dans l'habillage commun.
 */
export function wrapWithBranding(
  body: string,
  branding?: Branding,
  options?: { footerExtra?: string }
): string {
  const banner = renderBanner(branding);

  const footerParts: string[] = [];
  if (branding?.footerText) {
    footerParts.push(markdownToEmailHtml(branding.footerText, branding, "footer"));
  }
  if (options?.footerExtra) footerParts.push(options.footerExtra);

  const footer = footerParts.length
    ? `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5">${footerParts.join("")}</div>`
    : "";

  const bodyBg = branding?.bodyBg || D.bodyBg;
  const text = branding?.textColor || D.textColor;
  // Filet sous la bannière : il ne se dessine que s'il y a une bannière.
  const divider = banner
    ? `border-top:1px solid ${branding?.headerDivider || D.headerDivider};`
    : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${bodyBg}">
<tr><td align="center" style="padding:0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:${bodyBg}">
${banner}<tr><td style="${FONT};${divider}font-size:16px;line-height:1.6;color:${text};padding:28px 20px">
${body}${footer}</td></tr>
</table>
</td></tr>
</table>`;
}

/**
 * Bannière du haut. Trois cas, dans cet ordre de priorité :
 * une image large REMPLACE le logo ; sinon le logo sur le fond choisi ;
 * sinon rien du tout.
 */
function renderBanner(branding?: Branding): string {
  const bg = branding?.bannerBg?.trim() || "#ffffff";
  const tagline = branding?.bannerTagline?.trim();

  if (branding?.bannerImageUrl) {
    return `<tr><td bgcolor="${escapeHtml(bg)}" style="background-color:${escapeHtml(bg)};padding:0;line-height:0">
<img src="${escapeHtml(branding.bannerImageUrl)}" alt="" width="600" style="width:100%;max-width:600px;height:auto;display:block;border:0">
</td></tr>
`;
  }

  if (!branding?.logoUrl && !tagline) return "";

  const width = branding?.logoWidth || 150;
  const pos = branding?.logoPosition === "center"
    ? "center"
    : branding?.logoPosition === "right"
      ? "right"
      : "left";
  const margin = pos === "center" ? "0 auto" : pos === "right" ? "0 0 0 auto" : "0";
  const logo = branding?.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.logoAlt || "")}" width="${width}" style="width:${width}px;max-width:100%;height:auto;display:block;border:0;margin:${margin}">`
    : "";
  // Le texte se lit sur clair comme sur sombre : on choisit sa couleur d'après
  // la luminosité du fond, sinon une bannière noire donne du gris sur noir.
  const line = tagline
    ? `<p style="${FONT};margin:${logo ? "12px" : "0"} 0 0;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:${isDark(bg) ? "#e8e8e8" : branding?.footnoteColor || D.footnoteColor};text-align:${pos}">${escapeHtml(tagline)}</p>`
    : "";

  return `<tr><td bgcolor="${escapeHtml(bg)}" style="background-color:${escapeHtml(bg)};padding:28px 20px;text-align:${pos}">
${logo}${line}
</td></tr>
`;
}

/** Luminance perçue : au-delà de 0,6 le fond est clair. */
function isDark(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.6;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Substitue les `{{variables}}` APRÈS la conversion Markdown.
 *
 * Dans l'autre sens, un prénom contenant `*` deviendrait de l'italique et un
 * `<` casserait le message : les valeurs sont donc échappées, et leurs retours
 * à la ligne convertis en `<br>`.
 */
export function fillVariables(html: string, variables: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    key in variables ? escapeHtml(variables[key] ?? "").replace(/\n/g, "<br>") : ""
  );
}

/**
 * Ajoute le bouton principal au Markdown, en haut ou en bas.
 *
 * Il devient une ligne `[[Texte]](url)` comme les autres : un seul chemin de
 * rendu, donc l'interrupteur et l'insertion au curseur produisent exactement
 * le même bouton.
 */
export function composeSource(source: string, button?: MainButton): string {
  if (!button?.enabled || !button.label?.trim() || !button.url?.trim()) return source;
  const line = `[[${button.label.trim()}]](${button.url.trim()})`;
  return button.position === "top" ? `${line}\n\n${source}` : `${source}\n\n${line}\n`;
}

/** Chaîne complète : modèle Markdown + bouton + habillage + variables → email prêt. */
export function renderEmailTemplate(
  source: string,
  variables: Record<string, string>,
  branding?: Branding,
  button?: MainButton
): string {
  const body = markdownToEmailHtml(composeSource(source, button), branding);
  return fillVariables(wrapWithBranding(body, branding), variables);
}

/**
 * Enveloppe HTML complète, appliquée AU MOMENT DE L'ENVOI.
 *
 * ⚠️ Sans `<meta viewport>`, un client mobile rend l'email à la largeur d'un
 * écran d'ordinateur puis dézoome : le texte arrive minuscule. `wrapWithBranding`
 * ne peut pas la porter — sa sortie est aussi injectée dans les aperçus de
 * l'écran de réglages via `dangerouslySetInnerHTML`, où des balises `<html>`
 * seraient invalides. D'où cette fonction séparée, posée au seul endroit qui
 * part vraiment : `sendEmail`.
 *
 * `text-size-adjust` empêche iOS et Android de redimensionner le texte d'eux-mêmes.
 * Idempotente : un HTML déjà complet ressort intact.
 */
export function asEmailDocument(inner: string): string {
  if (/^\s*<(!doctype|html)\b/i.test(inner)) return inner;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<style>
  body{margin:0;padding:0;background:#ffffff;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;text-size-adjust:100%;}
  img{border:0;outline:none;text-decoration:none;}
</style>
</head>
<body>
${inner}
</body>
</html>`;
}
