// Module NEUTRE (ni "server-only" ni "use client") : le rendu doit être
// identique côté serveur (envoi) et côté client (aperçu de l'éditeur).
import { Marked } from "marked";

/** Habillage commun, passé en paramètre — jamais lu depuis la base ici. */
export type Branding = {
  logoUrl?: string | null;
  logoWidth?: number | null;
  footerText?: string | null;
  accentColor?: string | null;
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
const S = {
  p: "margin:0 0 16px;font-size:16px;line-height:1.6;color:#1a1a1a",
  h1: "margin:0 0 14px;font-size:21px;font-weight:600;line-height:1.3;color:#111",
  h2: "margin:24px 0 12px;font-size:17px;font-weight:600;line-height:1.35;color:#111",
  h3: "margin:20px 0 10px;font-size:16px;font-weight:600;color:#111",
  list: "margin:0 0 16px;padding-left:20px;font-size:16px;line-height:1.6;color:#1a1a1a",
  li: "margin-bottom:6px",
  hr: "border:0;border-top:1px solid #e5e5e5;margin:24px 0",
  blockquote:
    "margin:0 0 16px;padding:2px 0 2px 14px;border-left:3px solid #e5e5e5;color:#6b7280;font-size:16px;line-height:1.6",
  code: "background:#f6f6f4;border-radius:4px;padding:2px 5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px",
  pre: "background:#f6f6f4;border-radius:8px;padding:12px 14px;overflow-x:auto;font-size:13px",
  img: "max-width:100%;height:auto;display:block;margin:0 0 16px;border-radius:8px",
  font: "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
  // Le pied de page reprend le même Markdown que le corps, en plus petit et
  // en gris : sans ça, un lien de désinscription y serait du texte mort.
  footerP: "margin:0 0 8px;font-size:12px;line-height:1.5;color:#9ca3af",
  footerList: "margin:0 0 8px;padding-left:18px;font-size:12px;line-height:1.5;color:#9ca3af",
};

function buildMarked(accent: string, variant: "body" | "footer" = "body") {
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
          return { type: "emailButton", raw: m[0], text: m[1].trim(), href: m[2].trim() };
        },
        renderer(raw) {
          const token = raw as unknown as { text: string; href: string };
          // Table + bgcolor, PAS un simple <a> stylé : Outlook ignore le padding
          // sur une balise <a>, le bouton y apparaîtrait comme du texte souligné.
          return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px"><tr><td bgcolor="${accent}" style="border-radius:8px"><a href="${token.href}" style="display:inline-block;padding:13px 26px;${S.font};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${token.text}</a></td></tr></table>\n`;
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
  const accent = branding?.accentColor || DEFAULT_ACCENT;
  return buildMarked(accent, variant).parse(source ?? "", { async: false }) as string;
}

/** Enveloppe commune : en-tête (logo) + corps + pied de page. */
export function wrapWithBranding(body: string, branding?: Branding): string {
  const logo =
    branding?.logoUrl
      ? `<div style="margin:0 0 28px"><img src="${branding.logoUrl}" alt="" width="${branding.logoWidth || 150}" style="width:${branding.logoWidth || 150}px;max-width:100%;height:auto;display:block;border:0"></div>`
      : "";

  const footer = branding?.footerText
    ? `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5">${markdownToEmailHtml(branding.footerText, branding, "footer")}</div>`
    : "";

  return `<div style="${S.font};font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto;padding:8px">\n${logo}${body}${footer}</div>`;
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
