"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { useState, useTransition } from "react";
import { saveCampaignContentAction } from "@/app/(dashboard)/campaigns/actions";
import { ImageUploadButton } from "@/components/settings/image-upload-button";
import {
  markdownToEditorHtml,
  docToMarkdown,
  type PmNode,
} from "@/lib/messaging/editor-markdown";
import { EmailButtonNode } from "./email-button-node";
import { CampaignPreflight } from "./campaign-preflight";
import { CampaignTestSend } from "./campaign-test-send";

/**
 * Éditeur visuel — on écrit **dans** l'email.
 *
 * Le format en base reste le Markdown : l'éditeur le lit à l'ouverture et le
 * réécrit à chaque frappe. C'est ce qui permet d'avoir l'écriture visuelle sans
 * introduire un second format de contenu, l'écueil de l'ancien éditeur Tiptap
 * qui stockait du HTML.
 *
 * La zone d'édition porte les couleurs réelles de l'habillage : la bannière est
 * affichée au-dessus et le pied de page en dessous, pour écrire dans le cadre
 * plutôt qu'à côté.
 */
export function CampaignVisualEditor({
  campaignId,
  initialSubject,
  initialContent,
  readOnly,
  testEmail,
  frame,
}: {
  campaignId: string;
  initialSubject: string;
  initialContent: string;
  readOnly: boolean;
  testEmail: string;
  /** Décor de l'email autour de la zone d'écriture. */
  frame: {
    bannerHtml: string;
    footerHtml: string;
    bodyBg: string;
    textColor: string;
    titleColor: string;
    accent: string;
  };
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [markdown, setMarkdown] = useState(initialContent);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false }),
      EmailButtonNode,
    ],
    content: markdownToEditorHtml(initialContent),
    editable: !readOnly,
    // Obligatoire en App Router : sans ça, Tiptap rend côté serveur et
    // déclenche une erreur d'hydratation.
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setMarkdown(docToMarkdown(editor.getJSON() as PmNode));
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[320px]",
      },
    },
  });

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await saveCampaignContentAction(campaignId, subject, markdown);
      if (r.ok) {
        setSaved("Enregistré");
        setTimeout(() => setSaved(null), 2500);
      } else setError(r.error);
    });
  }

  function addButton(variant: "primary" | "secondary") {
    editor
      ?.chain()
      .focus()
      .insertContent({ type: "emailButton", attrs: { label: "", href: "", variant } })
      .run();
  }

  const btn = (active: boolean) =>
    `rounded-md px-2 py-1 text-xs font-medium transition ${
      active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          Sujet de l&apos;email
        </label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          readOnly={readOnly}
          placeholder="Ce que le destinataire voit dans sa boîte"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {!readOnly && editor && (
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/30 px-2 py-1.5">
          <button onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))}>
            <strong>G</strong>
          </button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))}>
            <em>I</em>
          </button>
          <Sep />
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btn(editor.isActive("heading", { level: 1 }))}>
            Titre
          </button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))}>
            Sous-titre
          </button>
          <Sep />
          <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>
            Liste
          </button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>
            1. Liste
          </button>
          <Sep />
          <button
            onClick={() => {
              const previous = editor.getAttributes("link").href as string | undefined;
              const url = window.prompt("Adresse du lien", previous ?? "https://");
              if (url === null) return;
              if (url === "") editor.chain().focus().unsetLink().run();
              else editor.chain().focus().setLink({ href: url }).run();
            }}
            className={btn(editor.isActive("link"))}
          >
            Lien
          </button>
          <ImageUploadButton
            onUploaded={(url) => editor.chain().focus().setImage({ src: url }).run()}
          />
          <Sep />
          <button onClick={() => addButton("primary")} className={btn(false)}>
            + Bouton
          </button>
          <button onClick={() => addButton("secondary")} className={btn(false)}>
            + Bouton secondaire
          </button>
        </div>
      )}

      {/* On écrit DANS l'email : bannière au-dessus, pied de page en dessous,
          et les couleurs réelles de l'habillage sur la zone d'écriture. */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div
          className="mx-auto w-full"
          style={{ background: frame.bodyBg }}
        >
          {frame.bannerHtml && (
            <div
              className="pointer-events-none select-none"
              dangerouslySetInnerHTML={{ __html: frame.bannerHtml }}
            />
          )}
          <div
            className="email-canvas px-5 py-6"
            style={
              {
                color: frame.textColor,
                "--email-title": frame.titleColor,
                "--email-accent": frame.accent,
              } as React.CSSProperties
            }
          >
            <EditorContent editor={editor} />
          </div>
          {frame.footerHtml && (
            <div
              className="pointer-events-none select-none border-t border-black/10 px-5 py-4"
              dangerouslySetInnerHTML={{ __html: frame.footerHtml }}
            />
          )}
        </div>
      </div>

      {!readOnly && <CampaignPreflight subject={subject} content={markdown} />}

      {!readOnly && (
        <CampaignTestSend
          campaignId={campaignId}
          subject={subject}
          content={markdown}
          defaultTo={testEmail}
        />
      )}

      {!readOnly && (
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
          {saved && <span className="text-xs text-green-600">{saved}</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}
    </div>
  );
}

function Sep() {
  return <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />;
}
