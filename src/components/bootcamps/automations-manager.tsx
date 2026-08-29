"use client";

import { useState, useTransition } from "react";
import {
  createAutomationAction,
  setAutomationActiveAction,
  deleteAutomationAction,
} from "@/app/actions";
import type { AutomationRow } from "@/lib/queries";

type Stage = { id: string; name: string; kind: string };
type Template = { id: string; name: string; subject: string | null };

const VARIABLES = ["firstName", "lastName", "fullName", "email", "formation", "offre"];

export function AutomationsManager({
  bootcampId,
  automations,
  stages,
  templates,
}: {
  bootcampId: string;
  automations: AutomationRow[];
  stages: Stage[];
  templates: Template[];
}) {
  const [open, setOpen] = useState(false);
  const [statusId, setStatusId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function create(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createAutomationAction(bootcampId, statusId, templateId);
      setFeedback(res);
      if (res.ok) {
        setStatusId("");
        setTemplateId("");
        setOpen(false);
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Automatisations</p>
          <p className="text-[10px] text-muted-foreground">
            Quand un lead entre dans une colonne, il reçoit un modèle d&apos;email.
            Déclenché par le kanban, l&apos;inscription <strong>et l&apos;import du site</strong>.
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
        >
          {open ? "Fermer" : "+ Ajouter"}
        </button>
      </div>

      {automations.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {automations.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-md border border-border px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-foreground">
                  <strong>{a.statusName ?? "colonne supprimée"}</strong> → {a.templateName}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {a.sent} envoyé{a.sent > 1 ? "s" : ""}
                  {a.skipped > 0 && ` · ${a.skipped} ignoré${a.skipped > 1 ? "s" : ""}`}
                  {a.failed > 0 && (
                    <span className="text-red-600"> · {a.failed} en échec</span>
                  )}
                  {!a.templateHasSubject && (
                    <span className="text-amber-700"> · modèle sans objet, rien ne partira</span>
                  )}
                </p>
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-1">
                <button
                  onClick={() =>
                    startTransition(() =>
                      setAutomationActiveAction(a.id, !a.active, bootcampId)
                    )
                  }
                  className={
                    a.active
                      ? "rounded-md bg-green-50 px-2 py-1 text-[10px] font-medium text-green-700"
                      : "rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground"
                  }
                >
                  {a.active ? "Active" : "En pause"}
                </button>
                <button
                  onClick={() =>
                    startTransition(() => deleteAutomationAction(a.id, bootcampId))
                  }
                  className="rounded-md px-2 py-1 text-[10px] text-red-500 hover:bg-red-50"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <form onSubmit={create} className="mt-3 space-y-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[140px]">
              <span className="mb-1 block text-[10px] font-medium text-muted-foreground">
                Quand un lead entre dans
              </span>
              <select
                value={statusId}
                onChange={(e) => setStatusId(e.target.value)}
                required
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="">— colonne —</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1 min-w-[140px]">
              <span className="mb-1 block text-[10px] font-medium text-muted-foreground">
                il reçoit le modèle
              </span>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                required
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="">— modèle d&apos;email —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.subject?.trim() ? "" : " (sans objet)"}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "…" : "Créer"}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/70">
            Variables utilisables dans l&apos;objet et le corps du modèle :{" "}
            {VARIABLES.map((v) => (
              <code key={v} className="mr-1 rounded bg-muted px-1">{`{{${v}}}`}</code>
            ))}
          </p>
        </form>
      )}

      {feedback && (
        <p
          className={
            feedback.ok
              ? "mt-2 text-[11px] text-green-600"
              : "mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800"
          }
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
