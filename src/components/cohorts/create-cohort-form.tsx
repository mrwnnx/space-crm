"use client";

import { useState, useTransition } from "react";
import { createCohort } from "@/app/actions";
import { cn } from "@/lib/utils";

export function CreateCohortForm() {
  const [isPending, startTransition] = useTransition();
  const [month, setMonth] = useState("");

  function autoFillName(dateStr: string) {
    setMonth(dateStr);
    if (dateStr) {
      const d = new Date(dateStr + "-01");
      const name = d.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      });
      const nameInput = document.getElementById(
        "cohort-name"
      ) as HTMLInputElement;
      if (nameInput && !nameInput.value) {
        nameInput.value = `Cohort ${name}`;
      }
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-700">
        Nouvelle cohort
      </h2>
      <form
        action={(formData) => startTransition(() => createCohort(formData))}
        className="space-y-3"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Mois
          </label>
          <input
            type="month"
            name="month"
            value={month}
            onChange={(e) => autoFillName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Nom
          </label>
          <input
            id="cohort-name"
            type="text"
            name="name"
            required
            placeholder="Cohort Janvier 2026"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Début
            </label>
            <input
              type="date"
              name="start_date"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Fin
            </label>
            <input
              type="date"
              name="end_date"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Capacité
          </label>
          <input
            type="number"
            name="capacity"
            min="1"
            placeholder="30"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            "w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700",
            isPending && "opacity-50"
          )}
        >
          {isPending ? "Création..." : "Créer la cohort"}
        </button>
      </form>
    </div>
  );
}
