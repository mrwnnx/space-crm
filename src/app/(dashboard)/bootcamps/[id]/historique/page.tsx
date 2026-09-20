import Link from "next/link";
import { notFound } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { getPipelineHistory, getHistoryActorCounts, getBootcampById } from "@/lib/queries";
import type { HistoryEvent, HistoryKind } from "@/lib/queries";
import { ACTOR_EMAILS, actorName } from "@/lib/actors";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Ce qui a été fait sur la pipeline de CETTE formation, et par qui.
 *
 * L'auteur était déjà enregistré partout — huit tables le portent — mais il
 * n'était lisible que fiche par fiche. Cet écran est la vue d'ensemble qui
 * manquait.
 *
 * Il vit SOUS la formation, et pas dans le menu principal : une pipeline est
 * une formation ici. Un historique de toutes les formations mélangées
 * répondrait à une question que personne ne pose.
 *
 * ⚠️ Le filtre par défaut est « Les gens », pas « Tout ». Sur 951 événements,
 * 613 viennent de l'import et des automatisations : ouvrir sur le fil complet
 * noierait les 130 actions humaines, qui sont précisément la question posée.
 */

const PAGE = 60;

const KIND_LABEL: Record<HistoryKind, string> = {
  stage: "a déplacé",
  call: "a appelé",
  email: "a envoyé un email",
  arrival: "est arrivé",
  note: "a noté",
  comment: "a commenté",
  task: "a créé une tâche",
  payment: "a encaissé",
};

const KIND_DOT: Record<HistoryKind, string> = {
  stage: "bg-slate-400",
  call: "bg-sky-500",
  email: "bg-indigo-400",
  arrival: "bg-violet-500",
  note: "bg-slate-300",
  comment: "bg-slate-300",
  task: "bg-teal-500",
  payment: "bg-amber-500",
};

const CALL_LABEL: Record<string, string> = {
  completed: "appel abouti",
  no_answer: "sans réponse",
  busy: "occupé",
  failed: "échoué",
  initiated: "lancé",
};

const METHOD_LABEL: Record<string, string> = {
  especes: "espèces",
  virement: "virement",
  cheque: "chèque",
};

/** Les groupes proposés dans la barre de filtres, et les adresses derrière. */
const GROUPS = [
  { key: "gens", label: "Les gens", emails: [...ACTOR_EMAILS.marwen, ...ACTOR_EMAILS.fatma, "assistant"] },
  { key: "marwen", label: "Marwen", emails: ACTOR_EMAILS.marwen },
  { key: "fatma", label: "Fatma", emails: ACTOR_EMAILS.fatma },
  { key: "auto", label: "Automatique", emails: ["webhook", "automation"] },
  { key: "tout", label: "Tout", emails: [] as string[] },
] as const;

const KINDS = [
  { key: "", label: "Toutes les actions" },
  { key: "call", label: "Appels" },
  { key: "stage", label: "Déplacements" },
  { key: "email", label: "Emails" },
  { key: "payment", label: "Paiements" },
  { key: "task", label: "Tâches" },
  { key: "comment", label: "Commentaires" },
] as const;

const PERIODS = [
  { key: "7", label: "7 jours" },
  { key: "30", label: "30 jours" },
  // Clé explicite et non chaîne vide : une valeur vide disparaît de l'URL, et
  // la page retombait alors sur « 30 jours » sans que rien ne le signale.
  { key: "tout", label: "Depuis le début" },
] as const;

function stamp(at: Date): string {
  return new Date(at).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Ce qui s'est passé, en une ligne — le détail change selon le type. */
function detailOf(e: HistoryEvent): string | null {
  switch (e.kind) {
    case "stage":
      return e.a ? `${e.a} → ${e.b ?? "?"}` : `placé dans « ${e.b ?? "?"} »`;
    case "call": {
      const min = e.num ? Math.round(e.num / 60) : 0;
      const etat = CALL_LABEL[e.a ?? ""] ?? e.a;
      return min > 0 ? `${etat} · ${min} min` : etat;
    }
    case "payment": {
      const bits = [
        e.num ? `${e.num.toLocaleString("fr-FR")} TND` : null,
        e.a ? METHOD_LABEL[e.a] ?? e.a : null,
        e.b ? "justificatif" : "sans justificatif",
      ].filter(Boolean);
      return bits.join(" · ");
    }
    case "task":
      return e.b ? `${e.a ?? "—"} → ${actorName(e.b)}` : e.a;
    default:
      return e.a;
  }
}

export default async function HistoriquePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ qui?: string; quoi?: string; jours?: string; p?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const bootcamp = await getBootcampById(id);
  if (!bootcamp) notFound();
  const qui = GROUPS.find((g) => g.key === sp.qui) ?? GROUPS[0];
  const quoi = KINDS.find((k) => k.key === (sp.quoi ?? "")) ?? KINDS[0];
  const jours = PERIODS.find((p) => p.key === (sp.jours ?? "30")) ?? PERIODS[1];
  const sinceDays = jours.key === "tout" ? undefined : Number(jours.key);
  const page = Math.max(Number(sp.p) || 0, 0);

  const [events, counts] = await Promise.all([
    getPipelineHistory({
      actors: qui.emails.length ? [...qui.emails] : undefined,
      kinds: quoi.key ? [quoi.key as HistoryKind] : undefined,
      bootcampId: id,
      sinceDays,
      limit: PAGE,
      offset: page * PAGE,
    }),
    getHistoryActorCounts(sinceDays, id),
  ]);

  /** Le lien d'un filtre garde les autres — sinon chaque clic repart de zéro. */
  const base = `/bootcamps/${id}/historique`;
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const all = { qui: sp.qui, quoi: sp.quoi, jours: sp.jours, ...patch };
    for (const [k, v] of Object.entries(all)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };

  const countFor = (emails: readonly string[]) =>
    emails.length
      ? counts.filter((c) => emails.includes(c.actor ?? "")).reduce((s, c) => s + c.n, 0)
      : counts.reduce((s, c) => s + c.n, 0);

  const CHIP =
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap";
  const ON = "border-primary bg-primary/10 text-foreground";
  const OFF = "border-border text-muted-foreground hover:bg-muted";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 sm:px-5">
        <Link
          href={`/bootcamps/${id}`}
          title="Retour à la formation"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-heading text-sm font-semibold text-foreground">Historique</h1>
          <p className="truncate text-xs text-muted-foreground">{bootcamp.name}</p>
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex flex-wrap gap-1.5">
          {GROUPS.map((g) => (
            <Link key={g.key} href={href({ qui: g.key === "gens" ? undefined : g.key, p: undefined })}
                  className={cn(CHIP, g.key === qui.key ? ON : OFF)}>
              {g.label}
              <span className="ml-1.5 tabular-nums opacity-60">{countFor(g.emails)}</span>
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <Link key={k.key} href={href({ quoi: k.key || undefined, p: undefined })}
                  className={cn(CHIP, k.key === quoi.key ? ON : OFF)}>
              {k.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODS.map((p) => (
            <Link key={p.key} href={href({ jours: p.key, p: undefined })}
                  className={cn(CHIP, p.key === jours.key ? ON : OFF)}>
              {p.label}
            </Link>
          ))}

        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Rien à afficher avec ces filtres.
          </p>
        ) : (
          <ol className="space-y-0">
            {events.map((e, i) => {
              const detail = detailOf(e);
              return (
                <li key={`${e.kind}-${i}-${new Date(e.at).getTime()}`} className="flex gap-3">
                  {/* Le trait vertical fait la chronologie ; sans lui c'est une
                      liste, et on perd la lecture « puis, puis, puis ». */}
                  <div className="flex flex-col items-center">
                    <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", KIND_DOT[e.kind])} />
                    {i < events.length - 1 && <span className="w-px flex-1 bg-border" />}
                  </div>

                  <div className="min-w-0 flex-1 pb-4">
                    <p className="text-sm leading-snug">
                      <span className="font-medium text-foreground">{actorName(e.actor)}</span>{" "}
                      <span className="text-muted-foreground">{KIND_LABEL[e.kind]}</span>{" "}
                      {e.leadId ? (
                        <Link href={`/leads/${e.leadId}`}
                              className="font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground">
                          {e.leadName ?? "un lead"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">un lead supprimé</span>
                      )}
                    </p>
                    {detail && (
                      <p className="truncate text-xs text-muted-foreground" title={detail}>
                        {detail}
                      </p>
                    )}
                    <p className="mt-0.5 text-[13px] tabular-nums text-muted-foreground">
                      {stamp(e.at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex items-center justify-between pt-2">
          {page > 0 ? (
            <Link href={href({ p: page > 1 ? String(page - 1) : undefined })}
                  className="text-xs text-muted-foreground underline hover:text-foreground">
              ← Plus récent
            </Link>
          ) : <span />}
          {events.length === PAGE && (
            <Link href={href({ p: String(page + 1) })}
                  className="text-xs text-muted-foreground underline hover:text-foreground">
              Plus ancien →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
