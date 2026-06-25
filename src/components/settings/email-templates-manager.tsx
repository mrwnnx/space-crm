"use client";

import { useState, useTransition } from "react";
import { createEmailTemplateAction, deleteEmailTemplateAction } from "@/app/actions";
import type { EmailTemplate } from "@/db/schema";

export function EmailTemplatesManager({
  templates,
}: {
  templates: EmailTemplate[];
}) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
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
          templates.map((tpl) => (
            <div
              key={tpl.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{tpl.name}</p>
                {tpl.subject && (
                  <p className="truncate text-xs text-muted-foreground">
                    Subject: {tpl.subject}
                  </p>
                )}
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/70">
                  {tpl.content}
                </p>
              </div>
              <button
                onClick={() => startTransition(() => deleteEmailTemplateAction(tpl.id))}
                className="ml-3 shrink-0 rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50"
              >
                Supprimer
              </button>
            </div>
          ))
        )}
      </div>

      {/* Create form */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground font-heading">
          Nouveau template
        </h3>
        <form onSubmit={create} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Nom *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Relance lead froid"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Sujet (variables: {`{{subject}}`})
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Suivi de votre demande"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Contenu * (variables: {`{{content}}`}, {`{{subject}}`})
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={6}
              placeholder="Bonjour,&#10;&#10;{{content}}&#10;&#10;Cordialement,"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
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
