"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { FileImportIcon } from "@hugeicons/core-free-icons";
import { importBootcampFormsAction } from "@/app/actions";

/**
 * « Va chercher maintenant les nouvelles soumissions des formulaires liés. »
 *
 * L'import tourne déjà tout seul côté serveur, mais à heure fixe. Ce bouton
 * sert au moment où on en a besoin : quelqu'un vient de remplir le formulaire
 * et on veut l'avoir sous les yeux sans attendre le prochain passage.
 *
 * Même action que le bouton « Importer » du menu ⋯ — ici en icône, dans la
 * barre, parce que c'est un geste fréquent.
 */
export function ImportFormsButton({
  bootcampId,
  linkedCount,
}: {
  bootcampId: string;
  /** Nombre de formulaires liés et actifs : à zéro, il n'y a rien à aller chercher. */
  linkedCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Le compte rendu s'efface tout seul : c'est une confirmation, pas une alerte
  // qu'il faudrait aller fermer.
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 12000);
    return () => clearTimeout(t);
  }, [result]);

  function run() {
    setResult(null);
    startTransition(async () => {
      const res = await importBootcampFormsAction(bootcampId);
      setResult(res);
      if (res.ok) router.refresh();
    });
  }

  const titre =
    linkedCount === 0
      ? "Aucun formulaire lié à cette formation"
      : isPending
        ? "Import en cours…"
        : `Importer les nouvelles soumissions (${linkedCount} formulaire${linkedCount > 1 ? "s" : ""})`;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        onClick={run}
        disabled={isPending || linkedCount === 0}
        title={titre}
        aria-label={titre}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <HugeiconsIcon
          icon={FileImportIcon}
          size={16}
          className={isPending ? "animate-pulse" : undefined}
        />
      </button>

      {result && (
        <button
          onClick={() => setResult(null)}
          title="Masquer"
          className={`hidden max-w-[220px] truncate rounded-full px-2 py-0.5 text-[11px] font-medium sm:block ${
            result.ok
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          }`}
        >
          {result.message}
        </button>
      )}
    </div>
  );
}
