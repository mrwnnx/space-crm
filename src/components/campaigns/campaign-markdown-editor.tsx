"use client";

import { useRef, useState, useTransition } from "react";
import { saveCampaignContentAction } from "@/app/(dashboard)/campaigns/actions";
import { ImageUploadButton } from "@/components/settings/image-upload-button";
import { CampaignPreflight } from "./campaign-preflight";
import { CampaignTestSend } from "./campaign-test-send";

/**
 * Éditeur de campagne — **Markdown**, le même format que les modèles d'email.
 *
 * Remplace l'éditeur visuel du 2026-09-02 : deux formats de contenu voulaient
 * dire deux façons d'écrire un bouton et deux rendus à garder d'accord. Le
 * Markdown laisse passer le HTML, donc les campagnes écrites avant continuent
 * de s'afficher.
 */
export function CampaignMarkdownEditor({
  campaignId,
  initialSubject,
  initialContent,
  readOnly,
  testEmail,
}: {
  campaignId: string;
  initialSubject: string;
  initialContent: string;
  readOnly: boolean;
  testEmail: string;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [content, setContent] = useState(initialContent);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);

  /** Insère au curseur — pas à la fin : on écrit un bouton là où on le veut. */
  function insertAtCursor(text: string) {
    const el = area.current;
    if (!el) {
      setContent((c) => c + text);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = content.slice(0, start) + text + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + text.length;
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await saveCampaignContentAction(campaignId, subject, content);
      if (r.ok) {
        setSaved("Enregistré");
        setTimeout(() => setSaved(null), 2500);
      } else setError(r.error);
    });
  }

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

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2 py-1.5">
          <Tool onClick={() => insertAtCursor("**texte**")}>Gras</Tool>
          <Tool onClick={() => insertAtCursor("## Titre\n\n")}>Titre</Tool>
          <Tool onClick={() => insertAtCursor("\n- premier point\n- second point\n\n")}>
            Liste
          </Tool>
          <Tool onClick={() => insertAtCursor("[texte du lien](https://)")}>Lien</Tool>
          <ImageUploadButton onUploaded={(url) => insertAtCursor(`\n\n![](${url})\n\n`)} />
        </div>
      )}

      <textarea
        ref={area}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        readOnly={readOnly}
        rows={14}
        placeholder={"Bonjour,\n\nÉcris ton message ici.\n\n**Gras**, [un lien](https://…), et une image via le bouton au-dessus."}
        className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-[13px] leading-relaxed outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />

      {!readOnly && <ButtonInserter onInsert={insertAtCursor} />}

      {/* Les contrôles tournent pendant l'écriture, jamais au moment du clic. */}
      {!readOnly && <CampaignPreflight subject={subject} content={content} />}

      {!readOnly && (
        <CampaignTestSend
          campaignId={campaignId}
          subject={subject}
          content={content}
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

function Tool({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

/** Bouton d'appel à l'action, inséré au curseur. Même syntaxe que les modèles. */
function ButtonInserter({ onInsert }: { onInsert: (text: string) => void }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const ready = label.trim() !== "" && /^https?:\/\//i.test(url.trim());

  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <p className="mb-2 text-[11px] text-muted-foreground">
        Un bouton, placé là où est votre curseur.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[110px] flex-1">
          <span className="mb-1 block text-[10px] text-muted-foreground">Texte</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Voir le programme"
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-ring"
          />
        </label>
        <label className="min-w-[150px] flex-1">
          <span className="mb-1 block text-[10px] text-muted-foreground">Lien</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-ring"
          />
        </label>
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            onInsert(`\n\n[[${label.trim()}]](${url.trim()})\n\n`);
            setLabel("");
            setUrl("");
          }}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-40"
        >
          Insérer ici
        </button>
      </div>
    </div>
  );
}
