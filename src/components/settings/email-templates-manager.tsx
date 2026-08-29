"use client";

import { useState, useTransition } from "react";
import {
  createEmailTemplateAction,
  updateEmailTemplateAction,
  deleteEmailTemplateAction,
} from "@/app/actions";
import type { EmailTemplate } from "@/db/schema";

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";
const LABEL = "mb-1 block text-xs font-medium text-muted-foreground";

export function EmailTemplatesManager({
  templates,
}: {
  templates: EmailTemplate[];
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
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Création..." : "Créer le template"}
          </button>
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
  onClose,
}: {
  template: EmailTemplate;
  onClose: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [subject, setSubject] = useState(template.subject ?? "");
  const [content, setContent] = useState(template.content);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
        <label className={LABEL}>Contenu *</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={14}
          className={`font-mono text-xs resize-y ${FIELD}`}
        />
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
    </form>
  );
}
