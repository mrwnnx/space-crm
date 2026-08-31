"use client";

import { useRef, useState, useTransition } from "react";
import {
  createEmailTemplateAction,
  updateEmailTemplateAction,
  deleteEmailTemplateAction,
} from "@/app/actions";
import type { EmailTemplate, EmailBranding } from "@/db/schema";
import { renderEmailTemplate } from "@/lib/messaging/markdown";
import { ImageUploadButton } from "@/components/settings/image-upload-button";
import { SendTestButton } from "@/components/settings/send-test-button";

// Valeurs d'exemple pour l'aperçu : voir « Sana » plutôt que « {{firstName}} »
// est la seule façon de juger si la phrase tombe juste.
const SAMPLE: Record<string, string> = {
  firstName: "Sana",
  lastName: "Amri",
  fullName: "Sana Amri",
  email: "sana.amri@gmail.com",
  formation: "Bootcamp september 2026",
  offre: "3× 500 TND",
  subject: "Objet du message",
  content: "Le message tapé dans la fiche du lead.",
};

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";
const LABEL = "mb-1 block text-xs font-medium text-muted-foreground";

export function EmailTemplatesManager({
  templates,
  branding,
  testEmail,
}: {
  templates: EmailTemplate[];
  branding: EmailBranding | null;
  /** Adresse du compte connecté : pré-remplie pour tester en un clic. */
  testEmail: string;
}) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    const formData = new FormData();
    formData.set("name", name);
    formData.set("subject", subject);
    formData.set("content", content);
    startTransition(async () => {
      await createEmailTemplateAction(formData);
      setName("");
      setSubject("");
      setContent("");
    });
  }

  return (
    <div className="space-y-6">
      {/* Existing templates */}
      <div className="space-y-2">
        {templates.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Aucun template. Créez-en un ci-dessous.
          </p>
        ) : (
          templates.map((tpl) =>
            editing === tpl.id ? (
              <TemplateEditor
                key={tpl.id}
                template={tpl}
                branding={branding}
                testEmail={testEmail}
                onClose={() => setEditing(null)}
              />
            ) : (
              <div
                key={tpl.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{tpl.name}</p>
                  {tpl.subject ? (
                    <p className="truncate text-xs text-muted-foreground">
                      Subject: {tpl.subject}
                    </p>
                  ) : (
                    // Un modèle sans objet ne peut pas servir d'automatisation :
                    // autant le voir ici plutôt qu'au moment où la règle est refusée.
                    <p className="text-xs text-amber-700">
                      Sans objet — inutilisable en automatisation
                    </p>
                  )}
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/70">
                    {tpl.content}
                  </p>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setEditing(tpl.id)}
                    className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => startTransition(() => deleteEmailTemplateAction(tpl.id))}
                    className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            )
          )
        )}
      </div>

      {/* Create form */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground font-heading">
          Nouveau template
        </h3>
        <form onSubmit={create} className="space-y-3">
          <div>
            <label className={LABEL}>Nom *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Relance lead froid"
              className={FIELD}
            />
          </div>
          <div>
            <label className={LABEL}>Sujet (variables: {`{{subject}}`})</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Suivi de votre demande"
              className={FIELD}
            />
          </div>
          <div>
            <label className={LABEL}>
              Contenu * (variables: {`{{content}}`}, {`{{subject}}`})
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={6}
              placeholder="Bonjour,&#10;&#10;{{content}}&#10;&#10;Cordialement,"
              className={`resize-none ${FIELD}`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Création..." : "Créer le template"}
            </button>
            {/* Tester AVANT d'enregistrer : le test porte sur ce qui est saisi. */}
            <SendTestButton subject={subject} content={content} defaultTo={testEmail} />
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Édition d'un modèle existant, en place. Les valeurs de départ viennent du
 * modèle : on modifie ce qui est là, on ne repart pas d'un formulaire vide.
 */
function TemplateEditor({
  template,
  branding,
  testEmail,
  onClose,
}: {
  template: EmailTemplate;
  branding: EmailBranding | null;
  testEmail: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [subject, setSubject] = useState(template.subject ?? "");
  const [content, setContent] = useState(template.content);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const areaRef = useRef<HTMLTextAreaElement>(null);

  /** Insère le Markdown de l'image LÀ où est le curseur, pas en fin de texte. */
  function insertImage(url: string) {
    const md = `![](${url})`;
    const el = areaRef.current;
    if (!el) {
      setContent((c) => `${c}\n\n${md}`);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? start;
    setContent(content.slice(0, start) + md + content.slice(end));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("name", name);
    formData.set("subject", subject);
    formData.set("content", content);
    startTransition(async () => {
      const res = await updateEmailTemplateAction(template.id, formData);
      if (res.ok) onClose();
      else setError(res.message);
    });
  }

  return (
    <form
      onSubmit={save}
      className="space-y-3 rounded-lg border border-ring/40 bg-card p-3 ring-1 ring-ring/20"
    >
      <div>
        <label className={LABEL}>Nom *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={FIELD}
        />
      </div>
      <div>
        <label className={LABEL}>Objet</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Obligatoire pour une automatisation"
          className={FIELD}
        />
      </div>
      <div>
        <label className={LABEL}>
          Contenu * — <code className="rounded bg-muted px-1">**gras**</code>,{" "}
          <code className="rounded bg-muted px-1">- liste</code>,{" "}
          <code className="rounded bg-muted px-1">[lien](url)</code>,{" "}
          <code className="rounded bg-muted px-1">## titre</code>,{" "}
          <code className="rounded bg-muted px-1">![image](url)</code>, bouton :{" "}
          <code className="rounded bg-muted px-1">[[Texte]](url)</code>
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <ImageUploadButton onUploaded={insertImage} />
              <span className="text-[10px] text-muted-foreground/70">
                le fichier est hébergé et son lien inséré au curseur
              </span>
            </div>
            <textarea
              ref={areaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={18}
              className={`font-mono text-xs resize-y ${FIELD}`}
            />
          </div>
          <div className="rounded-lg border border-border bg-white p-4">
            <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              Aperçu — variables remplacées par des exemples
            </p>
            <div
              className="overflow-y-auto"
              style={{ maxHeight: 380 }}
              // Contenu écrit par un membre de l'équipe, rendu par le MÊME
              // convertisseur que l'envoi : ce qu'on voit ici est ce qui part.
              dangerouslySetInnerHTML={{
                __html: renderEmailTemplate(content, SAMPLE, branding ?? undefined),
              }}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Enregistrement..." : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          Annuler
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      <div className="border-t border-border pt-3">
        <p className="mb-1.5 text-[10px] text-muted-foreground/70">
          Le test part avec l&apos;habillage réel et des valeurs d&apos;exemple
          ({`{{firstName}}`} → « Sana ») : tu reçois ce qu&apos;un lead recevrait.
        </p>
        <SendTestButton subject={subject} content={content} defaultTo={testEmail} />
      </div>
    </form>
  );
}
