"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiMagicIcon } from "@hugeicons/core-free-icons";
import { analyzeLeadsAction } from "@/app/actions";

/**
 * Relance l'action tant qu'il reste des leads : une fonction serverless ne peut
 * pas traiter 188 fiches en une passe. Effet de bord utile — la progression est
 * visible au lieu d'une attente muette.
 */
export function AnalyzeLeadsButton({
  bootcampId,
  pending,
  compact = false,
}: {
  bootcampId: string;
  /** Nombre de leads encore jamais lus par l'IA. */
  pending: number;
  /** Version icône, pour la barre d'une formation. */
  compact?: boolean;
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

  if (compact) {
    // Dans la barre, l'icône reste TOUJOURS visible, même sans rien à lire :
    // un bouton qui disparaît décale les autres et fait douter de son existence.
    const titre = error
      ? error
      : running
        ? `Lecture en cours — ${done} lus`
        : left === 0
          ? "Tous les leads de cette formation sont déjà lus"
          : `Analyser ${left} lead${left > 1 ? "s" : ""} avec l'IA`;
    return (
      <button
        onClick={run}
        disabled={running || left === 0}
        title={titre}
        aria-label={titre}
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <HugeiconsIcon icon={AiMagicIcon} size={16} className={running ? "animate-pulse" : undefined} />
        {left > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[15px] rounded-full bg-primary px-1 text-[9px] font-semibold leading-[15px] text-primary-foreground tabular-nums">
            {left > 99 ? "99+" : left}
          </span>
        )}
        {error && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />
        )}
      </button>
    );
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
