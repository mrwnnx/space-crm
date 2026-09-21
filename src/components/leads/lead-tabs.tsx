"use client";

import { useEffect, useState, useTransition } from "react";
import { useTeamProfiles } from "@/components/team-profiles";
import { useRouter } from "next/navigation";
import { refreshLeadInsightAction } from "@/app/actions";
import { cn } from "@/lib/utils";
import { AskAssistantButton } from "@/components/assistant/ask-assistant-button";
import type { Recommendation } from "@/lib/lead-recommendation";
import type { TimelineEvent } from "@/lib/queries";

/**
 * Trois lectures d'un même lead, dans la colonne principale de sa fiche.
 *
 * « Échanges » sert à AGIR (écrire, noter). « Score » à DÉCIDER quoi faire.
 * « Activité » à comprendre CE QUI S'EST PASSÉ. Les empiler sur une seule page
 * obligeait à faire défiler pour répondre à trois questions différentes.
 */

type Insight = {
  summary: string;
  intent: string;
  objection: string | null;
  recommendation: string | null;
  createdAt?: Date | string | null;
} | null;

const INTENT: Record<string, { label: string; cls: string }> = {
  serieux: { label: "Profil sérieux", cls: "bg-emerald-100 text-emerald-800" },
  curieux: { label: "Curieux", cls: "bg-amber-100 text-amber-800" },
  hors_cible: { label: "Hors cible", cls: "bg-red-100 text-red-800" },
  indetermine: { label: "Indéterminé", cls: "bg-muted text-muted-foreground" },
};

const TONE: Record<Recommendation["tone"], { label: string; cls: string; ring: string }> = {
  now: { label: "À appeler maintenant", cls: "text-emerald-800", ring: "border-emerald-300 bg-emerald-50" },
  soon: { label: "À traiter bientôt", cls: "text-sky-800", ring: "border-sky-300 bg-sky-50" },
  wait: { label: "Ne rien faire pour l'instant", cls: "text-amber-900", ring: "border-amber-300 bg-amber-50" },
  stop: { label: "Ne pas relancer", cls: "text-muted-foreground", ring: "border-border bg-muted/40" },
};

const KIND: Record<TimelineEvent["kind"], { dot: string; ring: string }> = {
  form: { dot: "bg-violet-500", ring: "ring-violet-100" },
  stage: { dot: "bg-slate-400", ring: "ring-slate-100" },
  call: { dot: "bg-sky-500", ring: "ring-sky-100" },
  email: { dot: "bg-indigo-400", ring: "ring-indigo-100" },
  whatsapp: { dot: "bg-green-500", ring: "ring-green-100" },
  engagement: { dot: "bg-emerald-500", ring: "ring-emerald-100" },
  payment: { dot: "bg-amber-500", ring: "ring-amber-100" },
  note: { dot: "bg-slate-300", ring: "ring-slate-100" },
};

/** « 09/09/2026 · 02:51 » — à la minute, c'est ce que Marwen a demandé. */
function stamp(at: Date | string): string {
  return new Date(at).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * À l'ouverture d'une fiche, l'IA relit le dossier si quelque chose a changé
 * (gratuit sinon, borné à une fois par heure). Rendu : la carte se met à jour
 * toute seule, un petit « relecture… » pendant ce temps.
 */
function useInsightRefresh(leadId: string) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [, start] = useTransition();
  const relire = (force = false) => {
    setEnCours(true);
    start(async () => {
      try {
        const r = await refreshLeadInsightAction(leadId, force);
        if (r.outcome === "analysé") router.refresh();
      } finally {
        setEnCours(false);
      }
    });
  };
  useEffect(() => {
    relire(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);
  return { enCours, relire };
}

export function LeadTabs({
  leadId,
  overview,
  history,
  exchanges,
  insight,
  recommendation,
  timeline,
}: {
  leadId: string;
  /** L'onglet Aperçu, calculé par la page. */
  overview: React.ReactNode;
  /** Historiques (appels, campagnes) posés au-dessus de la chronologie. */
  history?: React.ReactNode;
  exchanges: React.ReactNode;
  insight: Insight;
  recommendation: Recommendation;
  timeline: TimelineEvent[];
}) {
  // Aperçu d'abord : on ouvre une fiche pour savoir où on en est, pas pour écrire.
  const [tab, setTab] = useState<"overview" | "exchanges" | "score" | "activity">("overview");
  const tone = TONE[recommendation.tone];
  const { enCours, relire } = useInsightRefresh(leadId);
  const { resolve } = useTeamProfiles();

  return (
    <div className="flex flex-col lg:flex-1 lg:overflow-hidden">
      <div className="flex shrink-0 gap-1 border-b border-border px-4 pt-3">
        {(
          [
            ["overview", "Aperçu"],
            ["exchanges", "Actions"],
            ["score", "Score"],
            ["activity", "Activité"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "rounded-t-lg px-3 py-2 text-xs font-medium transition-colors",
              tab === key
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
            {key === "activity" && timeline.length > 0 && (
              <span className="ml-1.5 text-[12px] text-muted-foreground">{timeline.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && overview}

      {tab === "exchanges" && exchanges}

      {tab === "score" && (
        <div className="space-y-4 p-4 lg:flex-1 lg:overflow-y-auto">
          <div className={cn("rounded-xl border p-4", tone.ring)}>
            <p className={cn("text-[12px] font-semibold uppercase tracking-wide", tone.cls)}>
              {tone.label}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{recommendation.action}</p>
            {recommendation.because.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {recommendation.because.map((b) => (
                  <li
                    key={b}
                    className="rounded-full bg-background/70 px-2 py-0.5 text-[12px] text-muted-foreground"
                  >
                    {b}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[12px] text-muted-foreground">
              Déduit de ses actes — ne dépend d&apos;aucune IA.
            </p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] text-muted-foreground">
              {enCours
                ? "Relecture du dossier par l'IA…"
                : insight?.createdAt
                  ? `Lecture IA du ${new Date(insight.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} — relue à chaque changement`
                  : "Pas encore de lecture IA"}
            </p>
            <button
              type="button"
              disabled={enCours}
              onClick={() => relire(true)}
              className="text-[12px] font-medium text-primary underline disabled:opacity-50"
            >
              Relire maintenant
            </button>
          </div>

          {/* La lecture IA ci-dessous est un instantané, parfois ancien. Ce
              bouton en demande une fraîche, qui lit tout le fil à l'instant. */}
          <AskAssistantButton
            question="Analyse ce lead : où il en est, ce qui le bloque, et ce que je dis au téléphone."
            label="Demander une analyse à l'assistant"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          />

          {insight ? (
            <div className="rounded-xl border border-border p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Lecture IA
                </p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[12px] font-semibold",
                    INTENT[insight.intent]?.cls ?? "bg-muted text-muted-foreground"
                  )}
                >
                  {INTENT[insight.intent]?.label ?? insight.intent}
                </span>
              </div>
              <p className="text-sm text-foreground">{insight.summary}</p>
              {insight.objection && (
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Frein :</span> {insight.objection}
                </p>
              )}
              {insight.recommendation ? (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Recommandation de l&apos;IA
                  </p>
                  <p className="mt-1 text-sm text-foreground">{insight.recommendation}</p>
                </div>
              ) : (
                <p className="mt-3 border-t border-border pt-3 text-[13px] text-muted-foreground">
                  Cette analyse est antérieure à la recommandation IA. Elle apparaîtra à la
                  prochaine relecture de ce lead.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-4">
              <p className="text-xs text-muted-foreground">
                Aucune lecture IA pour ce lead. Elle se lance depuis le menu de la formation,
                sur les leads qui ont écrit quelque chose.
              </p>
            </div>
          )}
        </div>
      )}

      {tab === "activity" && (
        <div className="lg:flex-1 lg:overflow-y-auto">
          {history}
          <div className="p-4">
          {timeline.length === 0 ? (
            <p className="text-xs text-muted-foreground">Rien encore.</p>
          ) : (
            <ol className="space-y-0">
              {timeline.map((e, i) => {
                const k = KIND[e.kind];
                return (
                  <li key={`${e.kind}-${i}`} className="flex gap-3">
                    {/* Le trait vertical relie les moments : c'est ce qui en
                        fait une chronologie et pas une liste. */}
                    <div className="flex flex-col items-center">
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full ring-4", k.dot, k.ring)} />
                      {i < timeline.length - 1 && <span className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="min-w-0 flex-1 pb-4">
                      <p className="text-xs font-medium text-foreground">{e.label}</p>
                      {e.detail && (
                        <p className="truncate text-[13px] text-muted-foreground" title={e.detail}>
                          {e.detail}
                        </p>
                      )}
                      <p className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">
                        {stamp(e.at)}
                        {e.actor ? ` · ${resolve(e.actor).name}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
