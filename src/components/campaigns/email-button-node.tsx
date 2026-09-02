"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";

/**
 * Le bouton d'email comme véritable élément du document.
 *
 * `atom` : on ne tape pas dedans, on l'édite par ses champs. C'est ce qui
 * permet de le sérialiser de façon fiable en `[[Texte]](url)` — un bouton
 * composé de texte libre finirait par produire du Markdown cassé.
 */
export const EmailButtonNode = Node.create({
  name: "emailButton",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      label: { default: "" },
      href: { default: "" },
      variant: { default: "primary" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-email-button]",
        getAttrs: (el) => ({
          variant: (el as HTMLElement).getAttribute("data-email-button") || "primary",
          href: (el as HTMLElement).getAttribute("data-href") || "",
          label: (el as HTMLElement).getAttribute("data-label") || "",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-email-button": "primary" }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmailButtonView);
  },
});

function EmailButtonView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const secondary = node.attrs.variant === "secondary";

  return (
    <NodeViewWrapper
      className={`my-3 rounded-lg border p-2.5 transition ${
        selected ? "border-ring bg-muted/40" : "border-dashed border-border"
      }`}
      contentEditable={false}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`inline-block rounded-lg px-4 py-2 text-sm font-semibold ${
            secondary
              ? "border border-foreground/60 text-foreground"
              : "bg-foreground text-background"
          }`}
        >
          {node.attrs.label || "Texte du bouton"}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {secondary ? "secondaire" : "principal"}
        </span>
        <button
          type="button"
          onClick={() => updateAttributes({ variant: secondary ? "primary" : "secondary" })}
          className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
        >
          Changer de style
        </button>
        <button
          type="button"
          onClick={() => deleteNode()}
          className="ml-auto rounded-md px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-red-600"
        >
          Retirer
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={node.attrs.label}
          onChange={(e) => updateAttributes({ label: e.target.value })}
          placeholder="Texte du bouton"
          className="min-w-[120px] flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
        />
        <input
          value={node.attrs.href}
          onChange={(e) => updateAttributes({ href: e.target.value })}
          placeholder="https://…"
          className="min-w-[150px] flex-[2] rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
        />
      </div>
    </NodeViewWrapper>
  );
}
