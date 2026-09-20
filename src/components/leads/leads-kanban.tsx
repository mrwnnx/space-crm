"use client";

import { useState, useEffect, useRef, useTransition, memo } from "react";
import Link from "next/link";
import { updateLeadStatusAction, reorderStagesAction } from "@/app/actions";
import { cn, statusColor, initials, formatRelative, actorInitials, actorLabel, isHumanActor } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Tick02Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { EnrollLeadDialog } from "@/components/leads/enroll-lead-dialog";
import { ColumnMenu, AddColumnButton } from "@/components/leads/kanban-column-menu";
import type {
  ColumnAutomation,
  TemplateOption,
} from "@/components/leads/column-automation-dialog";
import { timingLabel } from "@/lib/automation-delays";
import {
  FILTRES,
  TRIS,
  GROUPE_LABEL,
  comparer,
  passe,
  type TriId,
  type Groupe,
} from "@/lib/kanban-filters";
import { AutomationStatsBadge } from "@/components/leads/automation-stats-dialog";
import type { StageTagRule, TagOption } from "@/components/leads/column-tag-dialog";
import type { Lead, LeadStatus, LeadSource, Organization, Bootcamp } from "@/db/schema";

// raw_payload n'est pas chargé par getLeadsKanban (perf) → on l'omet du type.
type KanbanLead = Omit<Lead, "rawPayload">;

type StageWithLeads = LeadStatus & {
  leads: (KanbanLead & {
    source: LeadSource | null;
    organization: Organization | null;
    // « Non traité » : importé et jamais ouvert. Calculé côté serveur.
    isNew?: boolean;
    // Dernière personne intervenue sur ce lead (email), null si personne.
    lastActor?: string | null;
    // Lecture IA de ce que le lead a écrit lui-même.
    insight?: { summary: string; intent: string; objection: string | null } | null;
    // Déjà passé par une autre formation.
    returning?: { formations: string[]; alumni: boolean } | null;
    // A rempli brochure ET inscription.
    multiForm?: boolean;
    // Ce qu'il a fait de l'email reçu automatiquement.
    engaged?: { opened: boolean; clicked: boolean; video: boolean } | null;
    // Au moins un appel enregistré.
    called?: boolean;
  })[];
};

export function LeadsKanban({
  statuses,
  bootcamp,
  automations = [],
  emailTemplates = [],
  stageTags = [],
  tags = [],
  formSources = [],
}: {
  statuses: StageWithLeads[];
  bootcamp?: Bootcamp;
  // Règles « entrée dans la colonne » de cette formation (0 ou 1 par colonne).
  automations?: ColumnAutomation[];
  emailTemplates?: TemplateOption[];
  // Règles « les entrants reçoivent ce tag » (0 ou 1 par colonne).
  stageTags?: StageTagRule[];
  tags?: TagOption[];
  /** Les formulaires de cette formation : une pastille par formulaire. */
  formSources?: { id: string; name: string }[];
}) {
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Popup d'inscription : lead en cours d'inscription + colonne cible
  const [enrollLead, setEnrollLead] = useState<KanbanLead | null>(null);
  // Colonne en cours de déplacement (réorganisation de l'ordre)
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  // Recherche dans la pipeline. Locale : les leads de la formation sont déjà
  // tous chargés, filtrer à l'affichage évite un aller-retour serveur à chaque
  // frappe (la page tire 10 requêtes).
  const [search, setSearch] = useState("");
  // Filtres et tri : tout est déjà chargé, donc tout se fait à l'affichage.
  const [actifs, setActifs] = useState<Set<string>>(new Set());
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [tri, setTri] = useState<TriId>("recent");
  const [ouvert, setOuvert] = useState(false);

  function basculer(id: string) {
    setActifs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Copie locale OPTIMISTE : le drop met à jour l'UI immédiatement ; le serveur
  // suit (revalidatePath → nouvelles props → resync via l'effet ci-dessous).
  const [localStatuses, setLocalStatuses] = useState(statuses);
  useEffect(() => {
    setLocalStatuses(statuses);
  }, [statuses]);

  // Index rapide statusId → status (pour connaître le kind de la colonne cible)
  const statusMap = new Map(localStatuses.map((s) => [s.id, s]));

  // Pendant un glisser, le tableau défile tout seul quand la carte approche
  // d'un bord : sans ça, les dernières colonnes sont hors de portée dès que la
  // pipeline dépasse l'écran (demande Marwen, 2026-09-20). Drag & drop natif :
  // la seule information fiable est la position du curseur sur `dragover`.
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollVitesse = useRef(0);
  const scrollAnim = useRef<number | null>(null);
  function autoScroll(e: React.DragEvent) {
    const el = scrollRef.current;
    if (!el) return;
    const BORD = 90; // px : la zone qui déclenche
    const { left, right } = el.getBoundingClientRect();
    let v = 0;
    if (e.clientX > right - BORD) v = Math.ceil((e.clientX - (right - BORD)) / 6); // plus près = plus vite
    else if (e.clientX < left + BORD) v = -Math.ceil((left + BORD - e.clientX) / 6);
    scrollVitesse.current = v;
    if (v !== 0 && scrollAnim.current === null) {
      const tick = () => {
        const s = scrollRef.current;
        if (!s || scrollVitesse.current === 0) {
          scrollAnim.current = null;
          return;
        }
        s.scrollLeft += scrollVitesse.current;
        scrollAnim.current = requestAnimationFrame(tick);
      };
      scrollAnim.current = requestAnimationFrame(tick);
    }
  }
  const stopAutoScroll = () => {
    scrollVitesse.current = 0;
  };

  // Index statusId → règle d'automatisation (au plus une par colonne).
  // Plusieurs règles par colonne (séquence) : on regroupe.
  const automationMap = new Map<string, ColumnAutomation[]>();
  for (const a of automations) {
    automationMap.set(a.statusId, [...(automationMap.get(a.statusId) ?? []), a]);
  }
  const tagRuleMap = new Map(stageTags.map((r) => [r.statusId, r]));

  // Réordonne : déplace la colonne `draggedId` à la place de `targetId`.
  function reorderColumns(draggedId: string, targetId: string) {
    if (!bootcamp || draggedId === targetId) return;
    const bcId = bootcamp.id;
    const ids = localStatuses.map((s) => s.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    // Optimiste : réordonne la copie locale tout de suite.
    setLocalStatuses((prev) => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
    ids.splice(from, 1);
    ids.splice(to, 0, draggedId);
    startTransition(() => {
      void reorderStagesAction(bcId, ids);
    });
  }

  function handleDrop(leadId: string, statusId: string) {
    setDragOverStatus(null);

    const targetStatus = statusMap.get(statusId);

    // Drop sur une colonne kind='converted' → ouvre la popup, NE déplace pas.
    if (targetStatus?.kind === "converted") {
      const lead = localStatuses
        .flatMap((s) => s.leads)
        .find((l) => l.id === leadId);
      if (lead) {
        setEnrollLead(lead);
      }
      return;
    }

    // Optimiste : déplace la carte tout de suite, puis persiste.
    setLocalStatuses((prev) => {
      let moved:
        | (KanbanLead & { source: LeadSource | null; organization: Organization | null })
        | null = null;
      const without = prev.map((s) => {
        const found = s.leads.find((l) => l.id === leadId);
        if (found) moved = found;
        return { ...s, leads: s.leads.filter((l) => l.id !== leadId) };
      });
      if (!moved) return prev;
      return without.map((s) =>
        s.id === statusId ? { ...s, leads: [moved!, ...s.leads] } : s
      );
    });
    startTransition(() => updateLeadStatusAction(leadId, statusId));
  }

  // Filtre d'AFFICHAGE seulement : `localStatuses` reste complet, sinon un drop
  // pendant une recherche ferait disparaître les cartes masquées.
  const q = search.trim().toLowerCase();
  const filtreActif = actifs.size > 0 || !!sourceId;
  const visibleStatuses = localStatuses.map((s) => ({
    ...s,
    leads: s.leads
      .filter(
        (l) =>
          (!q ||
            l.fullName.toLowerCase().includes(q) ||
            (l.email ?? "").toLowerCase().includes(q)) &&
          passe(l, actifs, sourceId)
      )
      .slice()
      .sort(comparer(tri)),
  }));

  // Les compteurs se lisent sur TOUS les leads, pas sur ceux qui restent :
  // une pastille qui affiche « 0 » parce qu'un autre filtre est actif ne dit
  // plus rien de la base.
  const tousLesLeads = localStatuses.flatMap((s) => s.leads);
  const compte = (test: (l: (typeof tousLesLeads)[number]) => boolean) =>
    tousLesLeads.filter(test).length;
  const totalVisible = visibleStatuses.reduce((n, s) => n + s.leads.length, 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3">
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5">
          <HugeiconsIcon
            icon={Search01Icon}
            size={15}
            className="text-muted-foreground"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un nom, un email…"
            className="w-56 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              title="Effacer"
            >
              ✕
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOuvert((v) => !v)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            filtreActif
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          Filtrer
          {filtreActif && (
            <span className="ml-1.5 tabular-nums">{actifs.size + (sourceId ? 1 : 0)}</span>
          )}
        </button>

        <select
          value={tri}
          onChange={(e) => setTri(e.target.value as TriId)}
          title="Trier les cartes dans chaque colonne"
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground outline-none focus:border-ring"
        >
          {TRIS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        {filtreActif && (
          <>
            <span className="text-xs tabular-nums text-muted-foreground">
              {totalVisible} lead{totalVisible > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={() => {
                setActifs(new Set());
                setSourceId(null);
              }}
              className="text-xs text-muted-foreground underline transition-colors hover:text-foreground"
            >
              Tout effacer
            </button>
          </>
        )}
      </div>

      {ouvert && (
        <div className="mx-4 mt-2 space-y-3 rounded-xl border border-border bg-card p-3">
          {formSources.length > 1 && (
            <div>
              <p className="mb-1.5 font-mono text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                Formulaire d&apos;origine
              </p>
              <div className="flex flex-wrap gap-1.5">
                {formSources.map((f) => {
                  const n = compte((l) => l.formSourceId === f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSourceId(sourceId === f.id ? null : f.id)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[13px] transition-colors",
                        sourceId === f.id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {f.name}
                      <span className="ml-1.5 tabular-nums opacity-60">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(["demande", "fait", "traitement"] as Groupe[]).map((groupe) => (
            <div key={groupe}>
              <p className="mb-1.5 font-mono text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                {GROUPE_LABEL[groupe]}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {FILTRES.filter((f) => f.groupe === groupe).map((f) => {
                  const n = compte(f.test);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => basculer(f.id)}
                      disabled={n === 0 && !actifs.has(f.id)}
                      title={n === 0 ? "Aucun lead ne correspond" : undefined}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[13px] transition-colors",
                        actifs.has(f.id)
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted",
                        n === 0 && !actifs.has(f.id) && "opacity-40"
                      )}
                    >
                      {f.label}
                      <span className="ml-1.5 tabular-nums opacity-60">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex flex-1 overflow-x-auto p-4"
        onDragOver={autoScroll}
        onDragLeave={stopAutoScroll}
        onDrop={stopAutoScroll}
        onDragEnd={stopAutoScroll}
      >
      <div className="flex h-full gap-3">
        {visibleStatuses.map((status) => {
          const sc = statusColor(status.color);
          return (
            <div
              key={status.id}
              onDragOver={(e) => {
                e.preventDefault();
                // Guard : ne re-render que si la colonne survolée change (drag fluide).
                if (dragOverStatus !== status.id) setDragOverStatus(status.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStatus(null);
                // Drag d'une COLONNE (réorganisation) → priorité, type distinct.
                const columnId = e.dataTransfer.getData("application/column");
                if (columnId) {
                  reorderColumns(columnId, status.id);
                  setDraggingColumnId(null);
                  return;
                }
                // Sinon : drag d'un lead (carte).
                const leadId = e.dataTransfer.getData("text/plain");
                if (leadId) handleDrop(leadId, status.id);
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-lg bg-muted/30 transition-colors",
                dragOverStatus === status.id && "bg-primary/5 ring-2 ring-primary/20",
                draggingColumnId === status.id && "opacity-50",
                isPending && "opacity-70"
              )}
            >
              <div className="flex items-center justify-between px-3 py-2.5">
                <div
                  draggable={!!bootcamp}
                  onDragStart={(e) => {
                    if (!bootcamp) return;
                    e.dataTransfer.setData("application/column", status.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingColumnId(status.id);
                  }}
                  onDragEnd={() => setDraggingColumnId(null)}
                  className={cn(
                    "flex items-center gap-2",
                    bootcamp && "cursor-grab active:cursor-grabbing"
                  )}
                  title={bootcamp ? "Glisser pour réorganiser" : undefined}
                >
                  <span className={cn("h-2 w-2 rounded-full", sc.dot)} />
                  <h2 className="text-sm font-semibold text-foreground">
                    {status.name}
                  </h2>
                  {status.isSystem && (
                    <span className="rounded bg-muted px-1 py-0.5 text-[11px] text-muted-foreground">
                      système
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {/* Une colonne qui envoie un email le DIT : sans ce repère,
                      la règle n'existe que dans la tête de celui qui l'a créée. */}
                  {(automationMap.get(status.id) ?? [])
                    .filter((a) => a.active)
                    .map((a) => (
                      <AutomationStatsBadge
                        key={a.id}
                        automationId={a.id}
                        columnName={status.name}
                        templateName={a.templateName ?? a.whatsappTemplate ?? "—"}
                        delay={timingLabel(a)}
                      />
                    ))}
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                    {status.leads.length}
                  </span>
                  {bootcamp && (
                    <ColumnMenu
                      bootcampId={bootcamp.id}
                      statusId={status.id}
                      name={status.name}
                      kind={status.kind}
                      automations={automationMap.get(status.id) ?? []}
                      templates={emailTemplates}
                      tagRule={tagRuleMap.get(status.id) ?? null}
                      tags={tags}
                    />
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {status.leads.map((lead) => (
                  <KanbanCard key={lead.id} lead={lead} bootcampId={bootcamp?.id} />
                ))}

                {status.leads.length === 0 && !q && (
                  <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground/70">
                    Glisser un lead ici
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {bootcamp && (
          <div className="self-start">
            <AddColumnButton bootcampId={bootcamp.id} />
          </div>
        )}
      </div>
      </div>

      {/* Popup d'inscription (drag vers colonne converted) */}
      {enrollLead && bootcamp && (
        <EnrollLeadDialog
          lead={enrollLead}
          bootcamp={bootcamp}
          onClose={() => setEnrollLead(null)}
        />
      )}
    </div>
  );
}

// Intention lue par l'IA dans ce que le lead a écrit.
const INTENT_LABEL: Record<string, string> = {
  serieux: "sérieux",
  curieux: "curieux",
  hors_cible: "hors cible",
  indetermine: "à qualifier",
};
const INTENT_STYLE: Record<string, string> = {
  serieux: "bg-green-100 text-green-800",
  curieux: "bg-amber-100 text-amber-800",
  hors_cible: "bg-gray-100 text-muted-foreground",
  indetermine: "bg-gray-100 text-muted-foreground",
};

const KanbanCard = memo(function KanbanCard({
  lead,
  bootcampId,
}: {
  bootcampId?: string;
  lead: KanbanLead & {
    source: LeadSource | null;
    organization: Organization | null;
    isNew?: boolean;
    lastActor?: string | null;
    insight?: { summary: string; intent: string; objection: string | null } | null;
    returning?: { formations: string[]; alumni: boolean } | null;
    multiForm?: boolean;
    engaged?: { opened: boolean; clicked: boolean; video: boolean } | null;
  };
}) {
  // État de drag LOCAL : seule la carte tirée se re-render (board fluide).
  const [dragging, setDragging] = useState(false);
  return (
    <Link
      // `?from=` dit à la fiche d'où l'on vient : son « retour » ramène ici,
      // dans la pipeline de la formation, et pas dans la liste des leads.
      href={bootcampId ? `/leads/${lead.id}?from=${bootcampId}` : `/leads/${lead.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", lead.id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onClick={(e) => {
        if (dragging) e.preventDefault();
      }}
      className={cn(
        "relative block rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        // Lead importé jamais ouvert : liseré + fond ambré. S'éteint à la
        // première ouverture de la fiche, pas au bout d'un délai.
        lead.isNew
          ? "border-amber-300 bg-amber-50/60 ring-1 ring-amber-200"
          : "border-border",
        dragging && "opacity-40"
      )}
    >
      {lead.isNew && (
        <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
          Non traité
        </span>
      )}
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          {initials(lead.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {lead.fullName}
          </p>
          {lead.jobTitle && (
            <p className="truncate text-xs text-muted-foreground">
              {lead.jobTitle}
            </p>
          )}
          {lead.multiForm && (
            // Le plus fort des signaux : a téléchargé le programme PUIS rempli
            // l'inscription en connaissant le prix.
            <span
              title="A téléchargé la brochure puis rempli le formulaire d'inscription"
              className="mt-1 mr-1 inline-block rounded-full bg-orange-100 px-1.5 py-0.5 text-[11px] font-semibold text-orange-800"
            >
              🔥 Brochure + inscription
            </span>
          )}
          {lead.engaged?.clicked && (
            // Un clic est un acte volontaire, contrairement à une ouverture
            // que le client mail déclenche tout seul.
            <span
              title={
                lead.engaged.video
                  ? "A cliqué sur la vidéo dans l'email reçu"
                  : "A cliqué sur un lien de l'email reçu"
              }
              className="mt-1 mr-1 inline-block rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800"
            >
              {lead.engaged.video ? "▶ A vu la vidéo" : "↗ A cliqué"}
            </span>
          )}
          {lead.returning && (
            // Déjà inscrit ailleurs = ancien élève, signal commercial fort ;
            // simplement déjà passé = intérêt répété sans conversion.
            <span
              title={`Déjà présent sur : ${lead.returning.formations.join(", ")}`}
              className={cn(
                "mt-1 inline-block rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                lead.returning.alumni
                  ? "bg-violet-100 text-violet-800"
                  : "bg-sky-100 text-sky-800"
              )}
            >
              {lead.returning.alumni ? "★ Ancien inscrit" : "↺ Déjà venu"}
            </span>
          )}
        </div>
      </div>

      {lead.insight && (
        <div className="mt-2">
          <span
            className={cn(
              "inline-block rounded-full px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
              INTENT_STYLE[lead.insight.intent] ?? INTENT_STYLE.indetermine
            )}
          >
            {INTENT_LABEL[lead.insight.intent] ?? lead.insight.intent}
          </span>
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
            {lead.insight.summary}
          </p>
          {lead.insight.objection && (
            <p className="mt-0.5 text-[12px] text-amber-700">
              Frein : {lead.insight.objection}
            </p>
          )}
        </div>
      )}

      {(lead.email || lead.mobileNo) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lead.email && <CopyChip value={lead.email} />}
          {lead.mobileNo && <CopyChip value={lead.mobileNo} />}
        </div>
      )}

      {lead.organization?.name && (
        <p className="mt-2 truncate text-[12px] text-muted-foreground/70">
          {lead.organization.name}
        </p>
      )}

      <div className="mt-2 flex items-center gap-1.5">
        <p className="text-[12px] text-muted-foreground/70">
          {formatRelative(lead.createdAt)}
        </p>
        {isHumanActor(lead.lastActor) && (
          <span
            className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground/70"
            title={`Dernière intervention : ${lead.lastActor}`}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
              {actorInitials(lead.lastActor)}
            </span>
            {actorLabel(lead.lastActor)}
          </span>
        )}
      </div>
    </Link>
  );
});

/**
 * Coordonnée copiable. Le composant vit DANS le <Link> de la carte : sans
 * preventDefault + stopPropagation, un clic ouvrirait la fiche au lieu de copier.
 */
function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // clipboard indisponible (HTTP non sécurisé, permission refusée) :
      // repli sur une sélection manuelle plutôt qu'un échec muet.
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(ta);
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      type="button"
      onClick={copy}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      title={copied ? "Copié" : `Copier ${value}`}
      className={cn(
        "group/copy inline-flex max-w-full items-center gap-1 rounded px-1.5 py-1 text-xs transition-colors",
        copied
          ? "bg-green-100 text-green-700"
          : "bg-muted text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
      )}
    >
      <span className="truncate">{value}</span>
      <HugeiconsIcon
        icon={copied ? Tick02Icon : Copy01Icon}
        size={12}
        className={cn(
          "shrink-0 transition-opacity",
          copied ? "opacity-100" : "opacity-0 group-hover/copy:opacity-100"
        )}
      />
    </button>
  );
}
