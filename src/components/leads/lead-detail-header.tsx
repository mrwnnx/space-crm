"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { updateLeadStatusAction } from "@/app/actions";
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
  const [statusOpen, setStatusOpen] = useState(false);
  const [, startTransition] = useTransition();

  function changeStatus(newStatusId: string) {
    setStatusOpen(false);
    startTransition(() => updateLeadStatusAction(leadId, newStatusId));
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-5">
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
      </div>
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
