"use client";

import { useState, useEffect, useTransition, memo } from "react";
import Link from "next/link";
import { updateLeadStatusAction, reorderStagesAction } from "@/app/actions";
import { cn, statusColor, initials, formatRelative } from "@/lib/utils";
import { EnrollLeadDialog } from "@/components/leads/enroll-lead-dialog";
import { ColumnMenu, AddColumnButton } from "@/components/leads/kanban-column-menu";
import type { Lead, LeadStatus, LeadSource, Organization, Bootcamp } from "@/db/schema";

type StageWithLeads = LeadStatus & {
  leads: (Lead & {
    source: LeadSource | null;
    organization: Organization | null;
  })[];
};

export function LeadsKanban({
  statuses,
  bootcamp,
}: {
  statuses: StageWithLeads[];
  bootcamp?: Bootcamp;
}) {
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Popup d'inscription : lead en cours d'inscription + colonne cible
  const [enrollLead, setEnrollLead] = useState<Lead | null>(null);
  // Colonne en cours de déplacement (réorganisation de l'ordre)
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);

  // Copie locale OPTIMISTE : le drop met à jour l'UI immédiatement ; le serveur
  // suit (revalidatePath → nouvelles props → resync via l'effet ci-dessous).
  const [localStatuses, setLocalStatuses] = useState(statuses);
  useEffect(() => {
    setLocalStatuses(statuses);
  }, [statuses]);

  // Index rapide statusId → status (pour connaître le kind de la colonne cible)
  const statusMap = new Map(localStatuses.map((s) => [s.id, s]));

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
        | (Lead & { source: LeadSource | null; organization: Organization | null })
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

  return (
    <div className="flex h-full overflow-x-auto p-4">
      <div className="flex h-full gap-3">
        {localStatuses.map((status) => {
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
                    <span className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">
                      système
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                    {status.leads.length}
                  </span>
                  {bootcamp && (
                    <ColumnMenu
                      bootcampId={bootcamp.id}
                      statusId={status.id}
                      name={status.name}
                      kind={status.kind}
                    />
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {status.leads.map((lead) => (
                  <KanbanCard key={lead.id} lead={lead} />
                ))}

                {status.leads.length === 0 && (
                  <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground/60">
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

const KanbanCard = memo(function KanbanCard({
  lead,
}: {
  lead: Lead & {
    source: LeadSource | null;
    organization: Organization | null;
  };
}) {
  // État de drag LOCAL : seule la carte tirée se re-render (board fluide).
  const [dragging, setDragging] = useState(false);
  return (
    <Link
      href={`/leads/${lead.id}`}
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
        "block rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        dragging && "opacity-40"
      )}
    >
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
        </div>
      </div>

      {(lead.email || lead.mobileNo) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lead.email && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {lead.email}
            </span>
          )}
          {lead.mobileNo && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {lead.mobileNo}
            </span>
          )}
        </div>
      )}

      {lead.organization?.name && (
        <p className="mt-2 truncate text-[10px] text-muted-foreground/70">
          {lead.organization.name}
        </p>
      )}

      <p className="mt-2 text-[10px] text-muted-foreground/60">
        {formatRelative(lead.createdAt)}
      </p>
    </Link>
  );
});
