"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { relancerEchecsAction } from "@/app/whatsapp-actions";

/**
 * « Renvoyer aux échecs » : après avoir corrigé un numéro, par exemple. Ne
 * touche jamais quelqu'un qui a reçu le message ; chaque renvoi repasse par
 * les contrôles du premier envoi.
 */
export function RelancerEchecs({ blastId, bootcampId, n }: { blastId: string; bootcampId: string; n: number }) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (message) return <span className="text-[12.5px] text-green-700 dark:text-green-400">{message}</span>;
  if (!confirme) {
    return (
      <button
        type="button"
        onClick={() => setConfirme(true)}
        className="rounded-lg border border-border px-2.5 py-1 text-xs text-foreground hover:bg-muted"
      >
        Renvoyer aux échecs ({n})
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-[12.5px]">
      <span className="text-muted-foreground">
        Renvoyer à ceux qui n&apos;ont rien reçu ? Un marketing déjà tenté attend 24 h (règle de Meta).
      </span>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await relancerEchecsAction(blastId, bootcampId);
            setMessage(`${r.n} remis en file : ils partent au prochain passage (quelques minutes).`);
            router.refresh();
          })
        }
        className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
      >
        {isPending ? "…" : "Oui, renvoyer"}
      </button>
      <button type="button" onClick={() => setConfirme(false)} className="text-muted-foreground hover:underline">
        Annuler
      </button>
    </span>
  );
}
