"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import {
  updateDealStatusAction,
  markDealLostAction,
} from "@/app/actions";
import { cn } from "@/lib/utils";
import type { DealStatus, LostReason } from "@/db/schema";

export function DealDetailHeader({
  dealId,
  orgName,
  orgId,
  statusId,
  statuses,
  statusColor: sc,
  statusName,
  lostReasons,
  dealValue,
}: {
  dealId: string;
  orgName: string | null;
  orgId: string | null;
  statusId: string | null;
  statuses: DealStatus[];
  statusColor: { dot: string; bg: string; text: string } | null;
  statusName?: string;
  lostReasons: LostReason[];
  dealValue: string | null;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [lostNotes, setLostNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function changeStatus(newStatusId: string) {
    setStatusOpen(false);
    startTransition(() => updateDealStatusAction(dealId, newStatusId));
  }

  function markLost() {
    setLostOpen(false);
    startTransition(() => markDealLostAction(dealId, lostReason, lostNotes));
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-5">
      <div className="flex items-center gap-3">
        <Link
          href="/deals"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          Deals
        </Link>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-foreground font-heading">
            {orgName || "Deal sans org"}
          </h1>
          {dealValue && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {Number(dealValue).toLocaleString("fr-FR")} €
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Status dropdown */}
        <div className="relative">
          <button
            onClick={() => setStatusOpen(!statusOpen)}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted",
              sc && sc.bg,
              sc && sc.text
            )}
          >
            {sc && <span className={cn("h-2 w-2 rounded-full", sc.dot)} />}
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
                    <span className={cn("h-2 w-2 rounded-full", dotClass(s.color))} />
                    {s.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Mark as Lost */}
        <button
          onClick={() => setLostOpen(true)}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
        >
          Mark as Lost
        </button>
      </div>

      {/* Lost modal */}
      {lostOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setLostOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-sm font-semibold text-foreground font-heading">
              Marquer comme perdu
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Raison
                </label>
                <select
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                >
                  <option value="">—</option>
                  {lostReasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Notes
                </label>
                <textarea
                  value={lostNotes}
                  onChange={(e) => setLostNotes(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={markLost}
                  disabled={isPending}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? "..." : "Confirmer"}
                </button>
                <button
                  onClick={() => setLostOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function dotClass(color: string): string {
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
