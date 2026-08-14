"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect, useState, useTransition } from "react";
import { saveCampaignContentAction } from "@/app/(dashboard)/campaigns/actions";

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-xs font-medium transition ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function CampaignEditor({
  campaignId,
  initialSubject,
  initialContent,
  readOnly,
}: {
  campaignId: string;
  initialSubject: string;
  initialContent: string;
  readOnly: boolean;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false }),
    ],
    content: initialContent || "<p></p>",
    editable: !readOnly,
    // Obligatoire en App Router : sans ça, Tiptap rend côté serveur et
    // déclenche une erreur d'hydratation.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose-sm min-h-[240px] max-w-none px-4 py-3 outline-none [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:font-semibold [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline",
      },
    },
  });

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(null), 2500);
      return () => clearTimeout(t);
    }
  }, [saved]);

  function save() {
    if (!editor) return;
    setError(null);
    startTransition(async () => {
      const r = await saveCampaignContentAction(
        campaignId,
        subject,
        editor.getHTML()
      );
      if (r.ok) setSaved("Enregistré");
      else setError(r.error);
    });
  }

  function addLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Adresse du lien", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Sujet de l&apos;email
        </label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          readOnly={readOnly}
          placeholder="Ce que le destinataire voit dans sa boîte"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 read-only:bg-muted"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        {!readOnly && editor && (
          <div className="flex flex-wrap gap-1 border-b border-border bg-muted/40 px-2 py-1.5">
            <ToolbarButton
              title="Gras"
              active={editor.isActive("bold")}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <strong>B</strong>
            </ToolbarButton>
            <ToolbarButton
              title="Italique"
              active={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <em>I</em>
            </ToolbarButton>
            <ToolbarButton
              title="Titre"
              active={editor.isActive("heading", { level: 2 })}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              Titre
            </ToolbarButton>
            <ToolbarButton
              title="Sous-titre"
              active={editor.isActive("heading", { level: 3 })}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
            >
              Sous-titre
            </ToolbarButton>
            <ToolbarButton
              title="Liste à puces"
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              Liste
            </ToolbarButton>
            <ToolbarButton
              title="Liste numérotée"
              active={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              1. Liste
            </ToolbarButton>
            <ToolbarButton
              title="Lien"
              active={editor.isActive("link")}
              onClick={addLink}
            >
              Lien
            </ToolbarButton>
          </div>
        )}
        <EditorContent editor={editor} />
      </div>

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
