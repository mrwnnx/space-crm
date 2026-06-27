"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markEcheancePaidAction, markEcheanceUnpaidAction } from "@/app/actions";
import { cn, formatDate } from "@/lib/utils";

type Echeance = {
  id: string;
  dueDate: string | null;
  amount: string | null;
  isPaid: boolean;
  paidAt: Date | null;
};

type Summary = {
  total: number;
  paidCount: number;
  count: number;
  status: "paid" | "on_track" | "overdue";
};

const statusConfig: Record<
  string,
  { label: string; style: string }
> = {
  paid: {
    label: "Soldé",
    style: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  on_track: {
    label: "À jour",
    style: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  overdue: {
    label: "En retard",
    style: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  },
};

export function PaymentBlock({
  leadId,
  items,
  summary,
  currency,
}: {
  leadId: string;
  items: Echeance[];
  summary: Summary;
  currency?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle(echeanceId: string, currentlyPaid: boolean) {
    startTransition(async () => {
      if (currentlyPaid) {
        await markEcheanceUnpaidAction(echeanceId);
      } else {
        await markEcheancePaidAction(echeanceId);
      }
      router.refresh();
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="border-t border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Paiement
        </p>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-medium",
            statusConfig[summary.status]?.style
          )}
        >
          {statusConfig[summary.status]?.label}
        </span>
      </div>

      <p className="mb-2 text-[11px] text-muted-foreground">
        {summary.paidCount} / {summary.count} payées
        {summary.total > 0 && ` · total ${summary.total.toLocaleString("fr-FR")} ${currency ?? "TND"}`}
      </p>

      <div className="space-y-1">
        {items.map((ech) => {
          const due = ech.dueDate ? new Date(ech.dueDate) : null;
          const overdue = !ech.isPaid && due && due < today;

          return (
            <div
              key={ech.id}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                overdue ? "bg-red-500/5" : "hover:bg-muted/40"
              )}
            >
              <input
                type="checkbox"
                checked={ech.isPaid}
                disabled={isPending}
                onChange={() => toggle(ech.id, ech.isPaid)}
                className="h-3.5 w-3.5 shrink-0 rounded border-border accent-primary"
              />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className={cn("text-xs", overdue && "font-medium text-red-500")}>
                  {ech.dueDate ? formatDate(ech.dueDate) : "—"}
                </span>
                <span className="text-xs font-medium text-foreground">
                  {ech.amount ? `${Number(ech.amount).toLocaleString("fr-FR")} ${currency ?? "TND"}` : "—"}
                </span>
              </div>
              {ech.paidAt && (
                <span className="shrink-0 text-[10px] text-emerald-600 dark:text-emerald-400">
                  payée
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
