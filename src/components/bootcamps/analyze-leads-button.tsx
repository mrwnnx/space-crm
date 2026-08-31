"use client";

import { useState } from "react";
import { analyzeLeadsAction } from "@/app/actions";

/**
 * Relance l'action tant qu'il reste des leads : une fonction serverless ne peut
 * pas traiter 188 fiches en une passe. Effet de bord utile — la progression est
 * visible au lieu d'une attente muette.
 */
export function AnalyzeLeadsButton({
  bootcampId,
  pending,
}: {
  bootcampId: string;
  /** Nombre de leads encore jamais lus par l'IA. */
  pending: number;
}) {
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(pending);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    let total = 0;
    // Garde-fou : sans plafond, une erreur qui ne fait pas décroître `remaining`
    // ferait tourner la boucle indéfiniment.
    for (let pass = 0; pass < 60; pass++) {
      const res = await analyzeLeadsAction(bootcampId);
      total += res.analysed;
      setDone(total);
      setLeft(res.remaining);
      if (res.message) setError(res.message);
      if (!res.ok || res.remaining === 0 || res.analysed === 0) break;
    }
    setRunning(false);
  }

  if (left === 0 && done === 0 && !error) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={run}
        disabled={running || left === 0}
        className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-50"
      >
        {running ? `Lecture… ${done} lus` : `Analyser ${left} lead${left > 1 ? "s" : ""}`}
      </button>
      {done > 0 && !running && (
        <span className="text-[11px] text-green-600">{done} lead(s) analysé(s).</span>
      )}
      {error && (
        <span className="text-[11px] text-red-600">{error}</span>
      )}
    </div>
  );
}
