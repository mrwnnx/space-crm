"use client";

import { useTransition } from "react";
import { updateCohortStatus } from "@/app/actions";
import { cn, formatDate } from "@/lib/utils";
import type { Cohort } from "@/db/schema";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  upcoming: { label: "À venir", color: "text-blue-700", bg: "bg-blue-50" },
  open: { label: "Ouverte", color: "text-green-700", bg: "bg-green-50" },
  full: { label: "Complète", color: "text-amber-700", bg: "bg-amber-50" },
  closed: { label: "Fermée", color: "text-slate-700", bg: "bg-slate-100" },
  completed: { label: "Terminée", color: "text-purple-700", bg: "bg-purple-50" },
};

const STATUS_ORDER = ["upcoming", "open", "full", "closed", "completed"];

export function CohortList({ cohorts }: { cohorts: Cohort[] }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      {cohorts.map((cohort) => {
        const config = STATUS_CONFIG[cohort.status] ?? STATUS_CONFIG.upcoming;
        return (
          <div
            key={cohort.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{cohort.name}</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatDate(cohort.startDate)}
                  {cohort.endDate && ` → ${formatDate(cohort.endDate)}`}
                  {cohort.capacity && ` · ${cohort.capacity} places`}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  config.bg,
                  config.color
                )}
              >
                {config.label}
              </span>
            </div>

            <div className="mt-3 flex gap-1">
              {STATUS_ORDER.map((status) => {
                const s = STATUS_CONFIG[status];
                return (
                  <button
                    key={status}
                    disabled={isPending || cohort.status === status}
                    onClick={() =>
                      startTransition(() =>
                        updateCohortStatus(cohort.id, status)
                      )
                    }
                    className={cn(
                      "rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                      cohort.status === status
                        ? cn(s.bg, s.color, "ring-1 ring-current")
                        : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {cohorts.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
          <p className="text-sm text-slate-400">
            Aucune cohort pour le moment.
            <br />
            Créez votre première cohort à droite.
          </p>
        </div>
      )}
    </div>
  );
}
