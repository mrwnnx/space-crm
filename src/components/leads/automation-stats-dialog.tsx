"use client";

import { useEffect, useState } from "react";
import {
  getColumnAutomationRunsAction,
  getColumnAutomationStatsAction,
} from "@/app/actions";

/**
 * Ce que l'automatisation a PRODUIT — séparé de l'écran qui la règle.
 *
 * Deux questions différentes : « qu'est-ce que cette colonne envoie ? » se
 * répond dans le formulaire, « qu'est-ce que ça a donné ? » ici. Les mélanger
 * obligeait à ouvrir le formulaire d'édition pour lire un chiffre.
 */

type Stats = {
  envoyes: number;
  delivres: number;
  ouverts: number;
  ouvertures: number;
  cliques: number;
  clics: number;
  ignores: number;
  echecs: number;
  liens: { url: string; clics: number }[];
};

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

/** « https://youtu.be/94yEQ6QP55g » → « youtu.be/94yEQ6QP55g ». */
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function AutomationStatsDialog({
  automationId,
  columnName,
  templateName,
  onClose,
}: {
  automationId: string;
  columnName: string;
  templateName: string;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);

  useEffect(() => {
    let alive = true;
    getColumnAutomationStatsAction(automationId)
      .then((r) => alive && setStats(r as Stats))
      .catch(() => alive && setStats(null));
    getColumnAutomationRunsAction(automationId)
      .then((r) => alive && setRuns(r as Run[]))
      .catch(() => alive && setRuns([]));
    return () => {
      alive = false;
    };
  }, [automationId]);

  const pct =
    stats && stats.envoyes > 0 ? Math.round((stats.cliques / stats.envoyes) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              Résultats — «&nbsp;{columnName}&nbsp;»
            </h2>
            <p className="truncate text-[11px] text-muted-foreground">{templateName}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Fermer
          </button>
        </div>

        {stats === null ? (
          <p className="text-xs text-muted-foreground">Chargement…</p>
        ) : stats.envoyes === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucun email parti pour l&apos;instant. Les chiffres apparaîtront dès le
            premier lead qui entre dans cette colonne.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              <Stat label="Envoyés" value={stats.envoyes} />
              <Stat label="Délivrés" value={stats.delivres} />
              <Stat
                label="Ouverts"
                value={stats.ouverts}
                hint={
                  stats.ouvertures > stats.ouverts ? `${stats.ouvertures} ouvertures` : undefined
                }
                dim
              />
              <Stat label="Ont cliqué" value={stats.cliques} hint={`${pct} %`} />
            </div>

            {/* Dit franchement pourquoi le chiffre d'ouverture est grisé. */}
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              Les ouvertures sont gonflées : Apple et Gmail préchargent l&apos;image de
              suivi, ce qui compte des ouvertures que personne n&apos;a faites. Le clic,
              lui, ne ment pas.
            </p>

            {stats.liens.length > 0 && (
              <div className="mt-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Quel lien a marché
                </p>
                <ul className="space-y-1">
                  {stats.liens.map((l) => (
                    <li
                      key={l.url}
                      className="flex items-baseline justify-between gap-3 text-[11px]"
                    >
                      <span className="min-w-0 truncate text-muted-foreground" title={l.url}>
                        {shortUrl(l.url)}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums text-foreground">
                        {l.clics}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(stats.ignores > 0 || stats.echecs > 0) && (
              <p className="mt-2 text-[10px] text-muted-foreground">
                {stats.ignores > 0 && `${stats.ignores} ignoré${stats.ignores > 1 ? "s" : ""}`}
                {stats.ignores > 0 && stats.echecs > 0 && " · "}
                {stats.echecs > 0 && `${stats.echecs} échec${stats.echecs > 1 ? "s" : ""}`}
                {" — détail ci-dessous."}
              </p>
            )}
          </>
        )}

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
      </div>
    </div>
  );
}

/** Une tuile de résultat. `dim` grise un chiffre sur lequel on ne décide rien. */
function Stat({
  label,
  value,
  hint,
  dim,
}: {
  label: string;
  value: number;
  hint?: string;
  dim?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`text-base font-semibold tabular-nums ${
          dim ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Le badge « auto » de l'en-tête de colonne, devenu cliquable.
 *
 * Pas d'icône en plus : l'en-tête d'une colonne est déjà chargé (nom, badge,
 * compteur, menu). Le repère qui dit « cette colonne envoie » est aussi celui
 * qui ouvre « ce que ça a donné » — un seul objet, deux informations.
 */
export function AutomationStatsBadge({
  automationId,
  columnName,
  templateName,
  delay,
}: {
  automationId: string;
  columnName: string;
  templateName: string;
  delay: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`Envoie « ${templateName} » — ${delay}. Cliquer pour voir les résultats.`}
        className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-medium text-primary transition-colors hover:bg-primary/20"
      >
        auto
      </button>
      {open && (
        <AutomationStatsDialog
          automationId={automationId}
          columnName={columnName}
          templateName={templateName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
