"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { updateBootcampFieldAction, deleteBootcampAction } from "@/app/actions";
import type { Bootcamp } from "@/db/schema";

type BootcampStatus = "draft" | "open" | "in_progress" | "completed" | "cancelled";

const statusOptions: { value: BootcampStatus; label: string }[] = [
  { value: "draft", label: "Brouillon" },
  { value: "open", label: "Ouvert" },
  { value: "in_progress", label: "En cours" },
  { value: "completed", label: "Terminé" },
  { value: "cancelled", label: "Annulé" },
];

export function BootcampActions({ bootcamp }: { bootcamp: Bootcamp }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  const [priceTotal, setPriceTotal] = useState(bootcamp.priceTotal || "");
  const [monthlyCount, setMonthlyCount] = useState(bootcamp.monthlyCount || "");
  const [monthlyAmount, setMonthlyAmount] = useState(bootcamp.monthlyAmount || "");
  const [currency, setCurrency] = useState(bootcamp.currency || "TND");

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    startTransition(async () => {
      await updateBootcampFieldAction(bootcamp.id, "status", e.target.value);
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteBootcampAction(bootcamp.id);
      router.push("/bootcamps");
    });
  }

  function savePricing() {
    startTransition(async () => {
      await updateBootcampFieldAction(bootcamp.id, "currency", currency);
      await updateBootcampFieldAction(bootcamp.id, "priceTotal", String(priceTotal || ""));
      await updateBootcampFieldAction(bootcamp.id, "monthlyCount", String(monthlyCount || ""));
      await updateBootcampFieldAction(bootcamp.id, "monthlyAmount", String(monthlyAmount || ""));
      setShowPricing(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <select
        value={bootcamp.status}
        onChange={handleStatusChange}
        disabled={isPending}
        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring"
      >
        {statusOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <button
        onClick={() => setShowPricing(!showPricing)}
        className="rounded-lg border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted"
      >
        Offre
      </button>

      {showPricing && (
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="mb-3 text-xs font-semibold text-foreground">Offre &amp; paiement</p>

          <label className="mb-1 block text-[10px] text-muted-foreground">Devise</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mb-2 w-full rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
          >
            <option value="TND">TND</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>

          <label className="mb-1 block text-[10px] text-muted-foreground">Prix total (comptant)</label>
          <input
            type="number"
            value={priceTotal}
            onChange={(e) => setPriceTotal(e.target.value)}
            className="mb-2 w-full rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
          />

          <label className="mb-1 block text-[10px] text-muted-foreground">Nb mensualités</label>
          <input
            type="number"
            value={monthlyCount}
            onChange={(e) => setMonthlyCount(e.target.value)}
            className="mb-2 w-full rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
          />

          <label className="mb-1 block text-[10px] text-muted-foreground">Montant / mois</label>
          <input
            type="number"
            value={monthlyAmount}
            onChange={(e) => setMonthlyAmount(e.target.value)}
            className="mb-3 w-full rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
          />

          <div className="flex gap-2">
            <button
              onClick={savePricing}
              disabled={isPending}
              className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "…" : "Enregistrer"}
            </button>
            <button
              onClick={() => setShowPricing(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {showDelete ? (
        <div className="flex items-center gap-1">
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "…" : "Confirmer"}
          </button>
          <button
            onClick={() => setShowDelete(false)}
            className="rounded-lg border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted"
          >
            Annuler
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowDelete(true)}
          className="rounded-lg border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-red-500"
        >
          Supprimer
        </button>
      )}
    </div>
  );
}
