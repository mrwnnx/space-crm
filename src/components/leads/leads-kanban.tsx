"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateLeadStatusAction } from "@/app/actions";
import { cn, statusColor, initials, formatRelative } from "@/lib/utils";
import { EnrollLeadDialog } from "@/components/leads/enroll-lead-dialog";
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Popup d'inscription : lead en cours d'inscription + colonne cible
  const [enrollLead, setEnrollLead] = useState<Lead | null>(null);

  // Index rapide statusId → status (pour connaître le kind de la colonne cible)
  const statusMap = new Map(statuses.map((s) => [s.id, s]));

  function handleDrop(leadId: string, statusId: string) {
    setDragOverStatus(null);
    setDraggingId(null);

    const targetStatus = statusMap.get(statusId);

    // Drop sur une colonne kind='converted' → ouvre la popup, NE déplace pas.
    if (targetStatus?.kind === "converted") {
      // Board par bootcamp → popup d'inscription
      const lead = statuses
        .flatMap((s) => s.leads)
        .find((l) => l.id === leadId);
      if (lead) {
        setEnrollLead(lead);
      }
      return;
    }

    // Drop sur toute autre colonne → comportement actuel
    startTransition(() => updateLeadStatusAction(leadId, statusId));
  }

  return (
    <div className="flex h-full overflow-x-auto p-4">
      <div className="flex h-full gap-3">
        {statuses.map((status) => {
          const sc = statusColor(status.color);
          return (
            <div
              key={status.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStatus(status.id);
              }}
              onDragLeave={() => setDragOverStatus(null)}
              onDrop={(e) => {
                e.preventDefault();
                const leadId = e.dataTransfer.getData("text/plain");
                if (leadId) handleDrop(leadId, status.id);
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-lg bg-muted/30 transition-colors",
                dragOverStatus === status.id && "bg-primary/5 ring-2 ring-primary/20",
                isPending && "opacity-70"
              )}
            >
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
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
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                  {status.leads.length}
                </span>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {status.leads.map((lead) => (
                  <KanbanCard
                    key={lead.id}
                    lead={lead}
                    isDragging={draggingId === lead.id}
                    onDragStart={() => setDraggingId(lead.id)}
                    onDragEnd={() => setDraggingId(null)}
                  />
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

function KanbanCard({
  lead,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  lead: Lead & {
    source: LeadSource | null;
    organization: Organization | null;
  };
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <Link
      href={`/leads/${lead.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", lead.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        if (isDragging) e.preventDefault();
      }}
      className={cn(
        "block rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        isDragging && "opacity-40"
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
}
