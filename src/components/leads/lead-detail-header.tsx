"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { updateLeadStatusAction, deleteLeadAction } from "@/app/actions";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/db/schema";

type StatusColor = { dot: string; bg: string; text: string } | null;

export function LeadDetailHeader({
  leadId,
  fullName,
  statusId,
  statuses,
  converted,
  statusColor,
  statusName,
}: {
  leadId: string;
  fullName: string;
  statusId: string | null;
  statuses: LeadStatus[];
  converted: boolean;
  statusColor: StatusColor;
  statusName?: string;
}) {
  const router = useRouter();
  const [statusOpen, setStatusOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function changeStatus(newStatusId: string) {
    setStatusOpen(false);
    startTransition(() => updateLeadStatusAction(leadId, newStatusId));
  }

  function remove() {
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteLeadAction(leadId);
      // Un lead rattaché à un deal ou déjà reporté ne part pas : on montre
      // pourquoi au lieu de laisser croire que le clic n'a rien fait.
      if (!res.ok) {
        setDeleteError(res.message);
        setConfirmDelete(false);
        return;
      }
      router.push("/leads");
    });
  }

  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-5">
      <div className="flex items-center gap-3">
        <Link
          href="/leads"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          Leads
        </Link>
        <div className="h-4 w-px bg-border" />
        <h1 className="text-sm font-semibold text-foreground font-heading">
          {fullName}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Status dropdown */}
        <div className="relative">
          <button
            onClick={() => setStatusOpen(!statusOpen)}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted",
              statusColor && statusColor.bg,
              statusColor && statusColor.text
            )}
          >
            {statusColor && (
              <span className={cn("h-2 w-2 rounded-full", statusColor.dot)} />
            )}
            {statusName || "Statut"}
          </button>

          {statusOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setStatusOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-lg">
                {statuses.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => changeStatus(s.id)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted",
                      s.id === statusId && "bg-muted/50 font-medium"
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        statusColorClasses(s.color)
                      )}
                    />
                    {s.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* "Convert to Deal" (B2B) débranché. La vraie conversion = inscription (enrollLeadAction). */}
        {converted && (
          <span className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
            ✓ Converti
          </span>
        )}

        {/* Suppression définitive. Deux temps : le premier clic ne supprime
            rien, il demande. Un lead effacé ne se récupère pas. */}
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={remove}
              disabled={isPending}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? "…" : "Supprimer définitivement"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={isPending}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
          >
            Supprimer
          </button>
        )}
      </div>

      {deleteError && (
        <p className="absolute right-5 top-14 z-50 max-w-sm rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow-lg">
          {deleteError}
        </p>
      )}
    </header>
  );
}

function statusColorClasses(color: string): string {
  const map: Record<string, string> = {
    gray: "bg-gray-400",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    green: "bg-green-500",
    "dark-green": "bg-emerald-600",
    red: "bg-red-500",
    orange: "bg-orange-500",
    amber: "bg-amber-500",
  };
  return map[color] ?? "bg-gray-400";
}
