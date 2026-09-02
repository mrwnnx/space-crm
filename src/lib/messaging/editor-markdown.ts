/**
 * Pont entre le Markdown stocké et l'éditeur visuel.
 *
 * Le format en base reste le **Markdown** : c'est lui qui part par email, et
 * c'est le même que les modèles. L'éditeur n'est qu'une façon de le manipuler.
 *
 * Sérialiseur écrit à la main plutôt qu'une dépendance type Turndown : on
 * contrôle le schéma, et surtout la syntaxe de bouton `[[Texte]](url)` qu'aucun
 * convertisseur générique ne connaît.
 *
 * Module NEUTRE : ni "server-only" ni "use client".
 */

import { Marked } from "marked";

/** Nœud de document ProseMirror, tel que rendu par `editor.getJSON()`. */
export type PmNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PmNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

/* ── Markdown → HTML d'édition ───────────────────────── */

/**
 * HTML **nu**, sans styles en ligne : l'éditeur applique les siens. Le rendu
 * final de l'email reste le travail de `markdownToEmailHtml`.
 */
export function markdownToEditorHtml(markdown: string): string {
  const marked = new Marked({ gfm: true, breaks: true });

  marked.use({
    extensions: [
      {
        name: "emailButton",
        level: "block",
        start(src: string) {
          return src.indexOf("[[");
        },
        tokenizer(src: string) {
          const m = /^\[\[([^\]\n]+)\]\]\(([^)\s]+)\)[ \t]*(?:\n|$)/.exec(src);
          if (!m) return undefined;
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
          const t = raw as unknown as { text: string; href: string; secondary?: boolean };
          return `<div data-email-button="${t.secondary ? "secondary" : "primary"}" data-href="${escapeAttr(t.href)}" data-label="${escapeAttr(t.text)}"></div>`;
        },
      },
    ],
  });

  return marked.parse(markdown ?? "", { async: false }) as string;
}

/* ── Document de l'éditeur → Markdown ────────────────── */

export function docToMarkdown(doc: PmNode | null | undefined): string {
  if (!doc?.content) return "";
  return doc.content
    .map((n) => blockToMarkdown(n))
    .filter((s) => s !== null)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function blockToMarkdown(node: PmNode, depth = 0): string | null {
  switch (node.type) {
    case "paragraph": {
      const t = inline(node.content);
      // Un paragraphe vide n'a pas à produire une ligne blanche de plus :
      // `join("\n\n")` en ajoute déjà une entre chaque bloc.
      return t.trim() === "" ? null : t;
    }
    case "heading": {
      const level = Math.min(Number(node.attrs?.level ?? 2), 3);
      return `${"#".repeat(level)} ${inline(node.content)}`;
    }
    case "bulletList":
    case "orderedList": {
      const ordered = node.type === "orderedList";
      return (node.content ?? [])
        .map((li, i) => {
          const inner = (li.content ?? [])
            .map((c) => blockToMarkdown(c, depth + 1))
            .filter(Boolean)
            .join("\n");
          const marker = ordered ? `${i + 1}.` : "-";
          return `${"  ".repeat(depth)}${marker} ${inner}`;
        })
        .join("\n");
    }
    case "blockquote":
      return (node.content ?? [])
        .map((c) => blockToMarkdown(c, depth))
        .filter(Boolean)
        .map((l) => `> ${l}`)
        .join("\n");
    case "horizontalRule":
      return "---";
    case "image":
      return `![${String(node.attrs?.alt ?? "")}](${String(node.attrs?.src ?? "")})`;
    case "emailButton": {
      const label = String(node.attrs?.label ?? "").trim();
      const href = String(node.attrs?.href ?? "").trim();
      if (!label || !href) return null;
      const suffix = node.attrs?.variant === "secondary" ? "|secondaire" : "";
      return `[[${label}${suffix}]](${href})`;
    }
    case "codeBlock":
      return "```\n" + (node.content ?? []).map((c) => c.text ?? "").join("") + "\n```";
    default:
      return node.content ? inline(node.content) : null;
  }
}

/** Texte et marques d'une ligne. */
function inline(content?: PmNode[]): string {
  if (!content) return "";
  return content
    .map((n) => {
      if (n.type === "hardBreak") return "\n";
      if (n.type === "image") {
        return `![${String(n.attrs?.alt ?? "")}](${String(n.attrs?.src ?? "")})`;
      }
      let text = n.text ?? "";
      if (!text) return "";
      // Ordre imposé : le lien enveloppe le gras, jamais l'inverse — `[**x**](u)`
      // est valide, `**[x](u)**` casse chez certains lecteurs Markdown.
      for (const mark of n.marks ?? []) {
        if (mark.type === "bold") text = `**${text}**`;
        else if (mark.type === "italic") text = `*${text}*`;
        else if (mark.type === "code") text = `\`${text}\``;
        else if (mark.type === "strike") text = `~~${text}~~`;
      }
      const link = (n.marks ?? []).find((m) => m.type === "link");
      if (link) text = `[${text}](${String(link.attrs?.href ?? "")})`;
      return text;
    })
    .join("");
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
