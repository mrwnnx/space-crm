"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { enrollLeadAction } from "@/app/actions";
import type { Bootcamp, Lead } from "@/db/schema";

type EnrollResult = { ok: true; paymentStatus: string } | { error: string };

export function EnrollLeadDialog({
  lead,
  bootcamp,
  onClose,
}: {
  lead: Omit<Lead, "rawPayload">; // getLeadsKanban ne charge pas raw_payload
  bootcamp: Bootcamp;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasTotal = !!bootcamp.priceTotal;
  const hasMonthly = !!bootcamp.monthlyCount && !!bootcamp.monthlyAmount;
  const availablePlans = [
    ...(hasTotal ? [{ value: "total" as const, label: `Total — ${bootcamp.priceTotal} ${bootcamp.currency}` }]: []),
    ...(hasMonthly ? [{ value: "monthly" as const, label: `Mensuel — ${bootcamp.monthlyCount}× ${bootcamp.monthlyAmount} ${bootcamp.currency}` }]: []),
  ];

  const [plan, setPlan] = useState<"total" | "monthly">(() => {
    // Pré-remplir avec intendedPlan du lead si celui-ci existe dans les plans dispo
    if (lead.intendedPlan && availablePlans.some((p) => p.value === lead.intendedPlan)) {
      return lead.intendedPlan;
    }
    return availablePlans.length === 1 ? availablePlans[0].value : (availablePlans[0]?.value ?? "total");
  });
  const [firstPaymentReceived, setFirstPaymentReceived] = useState(true);

  // Montants pre-remplis au tarif de la formation : le cas courant reste un
  // clic. Ils sont modifiables parce qu'un prix se negocie.
  const [totalAmount, setTotalAmount] = useState(bootcamp.priceTotal ?? "");
  const [monthlyAmount, setMonthlyAmount] = useState(bootcamp.monthlyAmount ?? "");
  const [monthlyCount, setMonthlyCount] = useState(String(bootcamp.monthlyCount ?? 3));

  const num = (v: string) => Number(String(v).replace(",", "."));
  const negotiatedTotal =
    plan === "total" ? num(totalAmount) : num(monthlyAmount) * Number(monthlyCount);
  const listPrice =
    plan === "total"
      ? num(bootcamp.priceTotal ?? "0")
      : num(bootcamp.monthlyAmount ?? "0") * Number(bootcamp.monthlyCount ?? 0);
  const gap = Number.isFinite(negotiatedTotal) && listPrice > 0 ? negotiatedTotal - listPrice : 0;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = (await enrollLeadAction(lead.id, {
        plan,
        firstPaymentReceived,
        totalAmount: plan === "total" ? totalAmount : undefined,
        monthlyAmount: plan === "monthly" ? monthlyAmount : undefined,
        monthlyCount: plan === "monthly" ? Number(monthlyCount) : undefined,
      })) as EnrollResult;
      if ("error" in result) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-sm font-semibold text-foreground font-heading">
          Inscrire {lead.fullName}
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">{bootcamp.name}</p>

        {availablePlans.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
              Aucune offre de prix configurée sur cette formation. Configurez le prix
              (Total ou Mensuel) avant d&apos;inscrire un lead.
            </div>
            <div className="flex justify-end">
              <Link
                href={`/bootcamps/${bootcamp.id}`}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                onClick={onClose}
              >
                Configurer la formation
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Choix du plan */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Plan de paiement
              </label>
              <div className="space-y-1.5">
                {availablePlans.map((p) => (
                  <label
                    key={p.value}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={p.value}
                      checked={plan === p.value}
                      onChange={() => setPlan(p.value)}
                      disabled={availablePlans.length === 1}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-foreground">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Montants réels — négociés ou non */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Montant réellement convenu
              </p>
              {plan === "total" ? (
                <label className="block">
                  <span className="mb-1 block text-[10px] text-muted-foreground">
                    Montant total ({bootcamp.currency})
                  </span>
                  <input
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    inputMode="decimal"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  />
                </label>
              ) : (
                <div className="flex items-end gap-2">
                  <label className="w-24">
                    <span className="mb-1 block text-[10px] text-muted-foreground">
                      Mensualités
                    </span>
                    <input
                      value={monthlyCount}
                      onChange={(e) => setMonthlyCount(e.target.value)}
                      type="number"
                      min={1}
                      max={24}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                    />
                  </label>
                  <span className="pb-2.5 text-sm text-muted-foreground">×</span>
                  <label className="flex-1">
                    <span className="mb-1 block text-[10px] text-muted-foreground">
                      Montant par mois ({bootcamp.currency})
                    </span>
                    <input
                      value={monthlyAmount}
                      onChange={(e) => setMonthlyAmount(e.target.value)}
                      inputMode="decimal"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                    />
                  </label>
                </div>
              )}

              <p className="mt-2 text-xs text-foreground">
                Total :{" "}
                <strong>
                  {Number.isFinite(negotiatedTotal)
                    ? negotiatedTotal.toLocaleString("fr-FR")
                    : "—"}{" "}
                  {bootcamp.currency}
                </strong>
                {gap !== 0 && Number.isFinite(gap) && (
                  <span className={gap < 0 ? "text-amber-700" : "text-green-700"}>
                    {" "}
                    ({gap < 0 ? "remise" : "supplément"} de{" "}
                    {Math.abs(gap).toLocaleString("fr-FR")} {bootcamp.currency})
                  </span>
                )}
              </p>
            </div>

            {/* 1er paiement encaissé */}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={firstPaymentReceived}
                onChange={(e) => setFirstPaymentReceived(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-sm text-foreground">
                1er paiement encaissé
              </span>
            </label>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Boutons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Inscription..." : "Confirmer l'inscription"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
