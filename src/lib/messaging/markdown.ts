// Module NEUTRE (ni "server-only" ni "use client") : le rendu doit être
// identique côté serveur (envoi) et côté client (aperçu de l'éditeur).
import { Marked } from "marked";

/**
 * Styles en ligne, balise par balise.
 *
 * Les clients de messagerie ignorent `<style>` et les feuilles externes : la
 * seule mise en forme qui survit à Gmail, Outlook et consorts est l'attribut
 * `style` sur chaque élément. D'où l'émission directe depuis le renderer
 * plutôt qu'un post-traitement du HTML.
 */
const S = {
  p: "margin:0 0 16px;font-size:15px;line-height:1.6;color:#1a1a1a",
  h1: "margin:0 0 14px;font-size:21px;font-weight:600;line-height:1.3;color:#111",
  h2: "margin:24px 0 12px;font-size:17px;font-weight:600;line-height:1.35;color:#111",
  h3: "margin:20px 0 10px;font-size:15px;font-weight:600;color:#111",
  ul: "margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.6;color:#1a1a1a",
  li: "margin-bottom:6px",
  a: "color:#1a1a1a;text-decoration:underline",
  hr: "border:0;border-top:1px solid #e5e5e5;margin:24px 0",
  blockquote:
    "margin:0 0 16px;padding:2px 0 2px 14px;border-left:3px solid #e5e5e5;color:#6b7280;font-size:15px;line-height:1.6",
  code: "background:#f6f6f4;border-radius:4px;padding:2px 5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px",
  pre: "background:#f6f6f4;border-radius:8px;padding:12px 14px;overflow-x:auto;font-size:13px",
  wrapper:
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto",
};

const marked = new Marked({
  gfm: true,
  breaks: true, // un retour à la ligne simple = <br>, ce qu'attend quelqu'un qui écrit un email
});

marked.use({
  renderer: {
    paragraph({ tokens }) {
      return `<p style="${S.p}">${this.parser.parseInline(tokens)}</p>\n`;
    },
    heading({ tokens, depth }) {
      const style = depth === 1 ? S.h1 : depth === 2 ? S.h2 : S.h3;
      const tag = `h${Math.min(depth, 3)}`;
      return `<${tag} style="${style}">${this.parser.parseInline(tokens)}</${tag}>\n`;
    },
    list(token) {
      const tag = token.ordered ? "ol" : "ul";
      const items = token.items
        .map((item) => `<li style="${S.li}">${this.parser.parseInline(item.tokens)}</li>`)
        .join("\n");
      return `<${tag} style="${S.ul}">\n${items}\n</${tag}>\n`;
    },
    link({ href, title, tokens }) {
      const t = title ? ` title="${title}"` : "";
      return `<a href="${href}"${t} style="${S.a}">${this.parser.parseInline(tokens)}</a>`;
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

/** Markdown (ou HTML brut, qui passe tel quel) → HTML d'email prêt à envoyer. */
export function markdownToEmailHtml(source: string): string {
  const body = marked.parse(source ?? "", { async: false }) as string;
  return `<div style="${S.wrapper}">\n${body}</div>`;
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
 * à la ligne convertis en `<br>` (le champ `{{content}}` du composeur 1-à-1
 * est du texte libre multiligne).
 */
export function fillVariables(html: string, variables: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    key in variables ? escapeHtml(variables[key] ?? "").replace(/\n/g, "<br>") : ""
  );
}

/** Chaîne complète : modèle Markdown + variables → HTML d'email. */
export function renderEmailTemplate(
  source: string,
  variables: Record<string, string>
): string {
  return fillVariables(markdownToEmailHtml(source), variables);
}
