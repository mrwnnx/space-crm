"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateDealStatusAction } from "@/app/actions";
import { cn, statusColor, formatRelative } from "@/lib/utils";
import type { Deal, DealStatus, Organization } from "@/db/schema";

type StageWithDeals = DealStatus & {
  deals: (Deal & {
    organization: Organization | null;
  })[];
};

export function DealsKanban({ statuses }: { statuses: StageWithDeals[] }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDrop(dealId: string, statusId: string) {
    setDragOverStatus(null);
    setDraggingId(null);
    startTransition(() => updateDealStatusAction(dealId, statusId));
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
                const dealId = e.dataTransfer.getData("text/plain");
                if (dealId) handleDrop(dealId, status.id);
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
                </div>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                  {status.deals.length}
                </span>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {status.deals.map((deal) => (
                  <KanbanCard
                    key={deal.id}
                    deal={deal}
                    isDragging={draggingId === deal.id}
                    onDragStart={() => setDraggingId(deal.id)}
                    onDragEnd={() => setDraggingId(null)}
                  />
                ))}

                {status.deals.length === 0 && (
                  <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground/60">
                    Glisser un deal ici
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({
  deal,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  deal: Deal & { organization: Organization | null };
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <Link
      href={`/deals/${deal.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", deal.id);
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
      <p className="truncate text-sm font-medium text-foreground">
        {deal.organization?.name || "Deal sans org"}
      </p>

      {deal.dealValue && (
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          {Number(deal.dealValue).toLocaleString("fr-FR")} €
        </p>
      )}

      {deal.probability !== null && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Number(deal.probability || 0)}%` }}
          />
        </div>
      )}

      <p className="mt-2 text-[10px] text-muted-foreground/60">
        {formatRelative(deal.createdAt)}
      </p>
    </Link>
  );
}
