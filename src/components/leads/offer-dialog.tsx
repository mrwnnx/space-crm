"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLeadOfferAction } from "@/app/actions";

/**
 * « Changer l'offre » — sur n'importe quel lead, à tout moment.
 *
 * Deux champs, pas plus : un montant total, ou un nombre d'échéances et le
 * montant de chacune. C'est exactement ce qui se dit au téléphone quand on
 * négocie ; l'écran n'a pas à demander autre chose.
 *
 * Si le lead est déjà inscrit, l'échéancier est refait derrière — les échéances
 * déjà payées restent intactes et le reste se répartit sur ce qui est dû.
 */
export function OfferDialog({
  leadId,
  currency,
  current,
  enrolled,
  paid,
  onClose,
}: {
  leadId: string;
  currency: string;
  /** L'offre actuelle, pour pré-remplir plutôt que de faire retaper. */
  current: { plan: string | null; total: string | null; count: number | null; amount: string | null };
  /** Le lead a un échéancier : le changement touchera de l'argent réel. */
  enrolled?: boolean;
  paid?: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<"total" | "monthly">(
    current.plan === "total" ? "total" : "monthly"
  );
  const [total, setTotal] = useState(current.total ?? "");
  const [count, setCount] = useState(current.count ? String(current.count) : "3");
  const [amount, setAmount] = useState(current.amount ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nb = Math.max(1, Number(count) || 0);
  const perInstalment = Number(amount) || 0;
  const computed = plan === "total" ? Number(total) || 0 : nb * perInstalment;
  const dejaPaye = paid ?? 0;
  const tropBas = enrolled && computed > 0 && computed < dejaPaye;

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setLeadOfferAction(leadId, plan, Number(total) || 0, nb, perInstalment);
      if (res?.error) return setError(res.error);
      router.refresh();
      onClose();
    });
  }

  const FIELD =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";
  const LABEL = "mb-1 block text-xs font-medium text-muted-foreground";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-foreground">Changer l&apos;offre</h2>

        <div className="mt-4 space-y-3">
          {/* Deux boutons plutôt qu'un menu : le choix se voit d'un coup d'œil. */}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["total", "Comptant"],
                ["monthly", "Facilité"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setPlan(value)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  plan === value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {plan === "total" ? (
            <div>
              <label className={LABEL}>Montant total ({currency})</label>
              <input
                type="number"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                autoFocus
                placeholder="1300"
                className={FIELD}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL}>Nombre d&apos;échéances</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL}>Montant de chacune</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                  placeholder="500"
                  className={FIELD}
                />
              </div>
            </div>
          )}
        </div>

        {computed > 0 && (
          <p className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Total : </span>
            <strong className="tabular-nums text-foreground">
              {computed.toLocaleString("fr-FR")} {currency}
            </strong>
            {plan === "monthly" && (
              <span className="text-muted-foreground">
                {" "}
                ({nb} × {perInstalment.toLocaleString("fr-FR")})
              </span>
            )}
          </p>
        )}

        {enrolled && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Ce lead est inscrit : son échéancier sera refait.{" "}
            <strong className="text-foreground">
              Les {dejaPaye.toLocaleString("fr-FR")} {currency} déjà encaissés ne bougent
              pas
            </strong>{" "}
            — seul le reste est recalculé.
          </p>
        )}

        {tropBas && (
          <p className="mt-2 text-[11px] font-medium text-red-600">
            Ce total est inférieur à ce qu&apos;il a déjà versé.
          </p>
        )}
        {error && <p className="mt-2 text-[11px] font-medium text-red-600">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            onClick={save}
            disabled={isPending || computed <= 0 || !!tropBas}
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
