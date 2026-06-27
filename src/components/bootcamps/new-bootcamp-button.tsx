"use client";

import { useTransition, useState } from "react";
import { createBootcampAction } from "@/app/actions";
import { NewEntityButton, FormField, Input, SubmitButtons } from "@/components/form";

export function NewBootcampButton() {
  const [isPending, startTransition] = useTransition();
  const [currency, setCurrency] = useState("TND");
  const [priceTotal, setPriceTotal] = useState("");
  const [monthlyCount, setMonthlyCount] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [showWarning, setShowWarning] = useState(false);

  const hasTotal = priceTotal.trim() !== "";
  const hasMonthly = monthlyCount.trim() !== "" && monthlyAmount.trim() !== "";
  const hasAtLeastOne = hasTotal || hasMonthly;
  const facilitéTotal = hasMonthly
    ? Number(monthlyCount) * Number(monthlyAmount)
    : null;

  function handleSubmit(formData: FormData) {
    // Warning si aucun mode de paiement configuré — on ne bloque pas la création
    if (!hasAtLeastOne) {
      setShowWarning(true);
      // On laisse l'utilisateur décider : s'il re-clique, on soumet quand même
      // (une formation peut exister sans prix le temps de le définir)
    }
    startTransition(async () => {
      await createBootcampAction(formData);
    });
  }

  return (
    <NewEntityButton label="Nouvelle formation" title="Créer une formation">
      {(close) => (
        <form action={handleSubmit}>
          <div className="space-y-3">
            <FormField label="Nom *">
              <Input name="name" placeholder="Bootcamp Dev — Janvier 2026" required />
            </FormField>
            <FormField label="Slug (URL)">
              <Input name="slug" placeholder="bootcamp-dev-janv-2026" />
            </FormField>
            <FormField label="Date de début">
              <Input name="startDate" type="date" />
            </FormField>
            <FormField label="Date de fin">
              <Input name="endDate" type="date" />
            </FormField>
            <FormField label="Places">
              <Input name="capacity" type="number" placeholder="30" />
            </FormField>

            {/* Section Offre & paiement */}
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Offre &amp; paiement
              </p>

              <FormField label="Devise">
                <select
                  name="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                >
                  <option value="TND">TND</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </FormField>

              <FormField label="Paiement comptant (prix total)">
                <Input name="priceTotal" type="number" placeholder="3500" />
              </FormField>

              <div className="mt-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Paiement en facilité
                </p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      name="monthlyCount"
                      type="number"
                      placeholder="Nb mensualités (3)"
                      value={monthlyCount}
                      onChange={(e) => { setMonthlyCount(e.target.value); setShowWarning(false); }}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      name="monthlyAmount"
                      type="number"
                      placeholder="Montant/mois (1200)"
                      value={monthlyAmount}
                      onChange={(e) => { setMonthlyAmount(e.target.value); setShowWarning(false); }}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                </div>
                {facilitéTotal !== null && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Total facilité : {facilitéTotal} {currency} (indicatif)
                  </p>
                )}
              </div>

              {showWarning && !hasAtLeastOne && (
                <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-600 dark:text-amber-400">
                  Configure au moins un mode de paiement, sinon tu ne pourras pas
                  inscrire de lead à cette formation.
                </p>
              )}
            </div>
          </div>
          <SubmitButtons isPending={isPending} createLabel="Créer" onCancel={close} />
        </form>
      )}
    </NewEntityButton>
  );
}
