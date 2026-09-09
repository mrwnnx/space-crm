"use client";

import { useState, useTransition } from "react";
import { rescheduleLeadAction } from "@/app/actions";

/**
 * Refaire l'échéancier après coup.
 *
 * L'écran montre en permanence ce qui est déjà encaissé et ce qui resterait à
 * devoir : c'est là que se rattrape une remise mal saisie, avant de valider.
 */
export function RescheduleDialog({
  leadId,
  paid,
  currency,
  currentTotal,
  onClose,
  onDone,
}: {
  leadId: string;
  paid: number;
  currency: string;
  currentTotal: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [plan, setPlan] = useState<"total" | "monthly">("monthly");
  const [amount, setAmount] = useState(String(currentTotal || ""));
  const [count, setCount] = useState("3");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const newTotal = Number(amount) || 0;
  const remaining = Math.round((newTotal - paid) * 100) / 100;
  const nb = plan === "monthly" ? Math.max(1, Number(count) || 1) : 1;
  const perInstalment = remaining > 0 ? Math.round((remaining / nb) * 100) / 100 : 0;
  const impossible = newTotal > 0 && remaining < 0;

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await rescheduleLeadAction(leadId, plan, newTotal, nb);
      if (res?.error) return setError(res.error);
      onDone();
    });
  }

  const FIELD =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-foreground">Modifier l&apos;offre</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Les échéances <strong>déjà payées ne bougent pas</strong>. Seul ce qui reste à
          devoir est recalculé.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Formule
            </label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as "total" | "monthly")}
              className={FIELD}
            >
              <option value="monthly">Facilité (plusieurs fois)</option>
              <option value="total">Comptant (une fois)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Nouveau total convenu ({currency})
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={FIELD}
            />
          </div>

          {plan === "monthly" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Mensualités restantes
              </label>
              <input
                type="number"
                min={1}
                max={24}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className={FIELD}
              />
            </div>
          )}
        </div>

        <div className="mt-4 space-y-1 rounded-lg border border-border bg-muted/30 p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Déjà encaissé</span>
            <span className="font-medium tabular-nums text-foreground">
              {paid.toLocaleString("fr-FR")} {currency}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Reste à devoir</span>
            <span
              className={`font-medium tabular-nums ${
                impossible ? "text-red-600" : "text-foreground"
              }`}
            >
              {remaining.toLocaleString("fr-FR")} {currency}
            </span>
          </div>
          {plan === "monthly" && remaining > 0 && (
            <div className="flex justify-between border-t border-border pt-1">
              <span className="text-muted-foreground">Soit</span>
              <span className="font-medium tabular-nums text-foreground">
                {nb} × {perInstalment.toLocaleString("fr-FR")} {currency}
              </span>
            </div>
          )}
        </div>

        {impossible && (
          <p className="mt-2 text-[11px] font-medium text-red-600">
            Ce total est inférieur à ce qu&apos;il a déjà versé.
          </p>
        )}
        {error && <p className="mt-2 text-[11px] font-medium text-red-600">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            onClick={save}
            disabled={isPending || impossible || newTotal <= 0}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "…" : "Enregistrer"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
