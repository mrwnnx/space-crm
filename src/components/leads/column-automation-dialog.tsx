"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  saveColumnAutomationAction,
  deleteColumnAutomationAction,
  getColumnAutomationRunsAction,
} from "@/app/actions";
import { AUTOMATION_DELAYS } from "@/lib/automation-delays";

/** Règle d'une colonne, telle que la page la charge. */
export type ColumnAutomation = {
  id: string;
  statusId: string;
  emailTemplateId: string;
  delayMinutes: number;
  active: boolean;
  templateName: string;
  templateSubject: string | null;
};

export type TemplateOption = { id: string; name: string; subject: string | null };

type Run = {
  id: string;
  status: string;
  reason: string | null;
  scheduledAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
  leadName: string | null;
  leadEmail: string | null;
};

const RUN_LABEL: Record<string, { text: string; cls: string }> = {
  sent: { text: "Envoyé", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  pending: { text: "En attente", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  skipped: { text: "Ignoré", cls: "bg-muted text-muted-foreground" },
  cancelled: { text: "Annulé", cls: "bg-muted text-muted-foreground" },
  failed: { text: "Échec", cls: "bg-red-500/10 text-red-600 dark:text-red-400" },
};

export function ColumnAutomationDialog({
  bootcampId,
  statusId,
  columnName,
  automation,
  templates,
  onClose,
}: {
  bootcampId: string;
  statusId: string;
  columnName: string;
  automation: ColumnAutomation | null;
  templates: TemplateOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(automation?.emailTemplateId ?? "");
  const [delay, setDelay] = useState(automation?.delayMinutes ?? 0);
  const [active, setActive] = useState(automation?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [isPending, startTransition] = useTransition();

  // Journal : chargé à l'ouverture, seulement si la règle existe déjà.
  useEffect(() => {
    if (!automation) return;
    let alive = true;
    getColumnAutomationRunsAction(automation.id)
      .then((r) => alive && setRuns(r as Run[]))
      .catch(() => alive && setRuns([]));
    return () => {
      alive = false;
    };
  }, [automation]);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveColumnAutomationAction(
        bootcampId,
        statusId,
        templateId,
        delay,
        active
      );
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function remove() {
    if (!automation) return;
    startTransition(async () => {
      await deleteColumnAutomationAction(bootcampId, automation.id);
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl"
      >
        <h2 className="mb-1 font-heading text-sm font-semibold text-foreground">
          Automatiser « {columnName} »
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Chaque lead qui entre dans cette colonne reçoit cet email — <strong>une seule
          fois</strong>, quel que soit le chemin&nbsp;: glisser-déposer, inscription, ou
          import du site.
        </p>

        <label className="mb-1 block text-xs font-medium text-foreground">
          Modèle d&apos;email
        </label>
        {templates.length === 0 ? (
          <p className="mb-3 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Aucun modèle d&apos;email.{" "}
            <Link href="/settings?tab=emails" className="text-primary underline">
              En créer un
            </Link>
            .
          </p>
        ) : (
          <>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="mb-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Choisir un modèle…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id} disabled={!t.subject?.trim()}>
                  {t.name}
                  {!t.subject?.trim() ? " — sans objet, inutilisable" : ""}
                </option>
              ))}
            </select>
            <p className="mb-3 text-[11px] text-muted-foreground">
              <Link href="/settings?tab=emails" className="text-primary underline">
                Créer ou modifier un modèle
              </Link>
            </p>
          </>
        )}

        <label className="mb-1 block text-xs font-medium text-foreground">
          Quand l&apos;envoyer
        </label>
        <select
          value={delay}
          onChange={(e) => setDelay(Number(e.target.value))}
          className="mb-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        >
          {AUTOMATION_DELAYS.map((d) => (
            <option key={d.minutes} value={d.minutes}>
              {d.label}
            </option>
          ))}
        </select>
        <p className="mb-3 text-[11px] text-muted-foreground">
          {delay === 0
            ? "Part au moment où le lead entre dans la colonne."
            : "Précision au quart d'heure : la file part toutes les ~15 min. L'email est annulé si le lead a quitté la colonne entre-temps."}
        </p>

        <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Règle active
        </label>

        {error && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            disabled={isPending || !templateId}
            onClick={save}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            Enregistrer
          </button>
          {automation && (
            <button
              disabled={isPending}
              onClick={remove}
              className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-600 hover:bg-red-500/5 disabled:opacity-50 dark:text-red-400"
            >
              Supprimer
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Fermer
          </button>
        </div>

        {automation && (
          <div className="mt-5 border-t border-border pt-4">
            <h3 className="mb-2 text-xs font-semibold text-foreground">
              Journal des 20 derniers passages
            </h3>
            {runs === null ? (
              <p className="text-xs text-muted-foreground">Chargement…</p>
            ) : runs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Rien encore. Le journal montrera aussi ce qui a été ignoré et pourquoi.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {runs.map((r) => {
                  const label = RUN_LABEL[r.status] ?? {
                    text: r.status,
                    cls: "bg-muted text-muted-foreground",
                  };
                  const at = r.sentAt ?? r.scheduledAt ?? r.createdAt;
                  return (
                    <li key={r.id} className="flex items-start gap-2 text-[11px]">
                      <span className={`shrink-0 rounded px-1.5 py-0.5 ${label.cls}`}>
                        {label.text}
                      </span>
                      <span className="min-w-0 flex-1 text-muted-foreground">
                        <span className="text-foreground">
                          {r.leadName || r.leadEmail || "Lead"}
                        </span>
                        {r.reason ? ` — ${r.reason}` : ""}
                        <span className="ml-1 opacity-70">
                          {new Date(at).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
