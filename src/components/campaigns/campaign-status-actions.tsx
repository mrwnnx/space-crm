"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCampaignStatusAction } from "@/app/(dashboard)/campaigns/actions";

type Next = "paused" | "sending" | "cancelled" | "archived" | "draft";

/** Actions offertes selon l'état courant — rien d'autre n'est proposé. */
function actionsFor(status: string): { label: string; next: Next; confirm?: string }[] {
  switch (status) {
    case "scheduled":
      return [
        { label: "Suspendre", next: "paused" },
        { label: "Annuler", next: "cancelled", confirm: "Annuler définitivement ? Elle ne partira jamais." },
      ];
    case "sending":
      return [
        { label: "Suspendre l'envoi", next: "paused" },
        { label: "Annuler", next: "cancelled", confirm: "Arrêter définitivement ? Les destinataires restants ne recevront rien." },
      ];
    case "paused":
      return [
        { label: "Reprendre", next: "sending" },
        { label: "Annuler", next: "cancelled", confirm: "Annuler définitivement ?" },
      ];
    case "draft":
      return [
        { label: "Annuler", next: "cancelled", confirm: "Abandonner ce brouillon ?" },
        { label: "Archiver", next: "archived" },
      ];
    case "sent":
    case "failed":
    case "cancelled":
      return [{ label: "Archiver", next: "archived" }];
    case "archived":
      return [{ label: "Désarchiver", next: "draft" }];
    default:
      return [];
  }
}

export function CampaignStatusActions({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<Next | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const actions = actionsFor(status);
  if (actions.length === 0) return null;

  function run(next: Next) {
    setError(null);
    startTransition(async () => {
      const r = await setCampaignStatusAction(campaignId, next);
      setConfirming(null);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  const pending = actions.find((a) => a.next === confirming);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {pending ? (
        <>
          {/* Confirmation en ligne : jamais de confirm() natif, il gèle la page. */}
          <span className="text-xs text-muted-foreground">{pending.confirm}</span>
          <button
            onClick={() => run(pending.next)}
            disabled={isPending}
            className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
          >
            {isPending ? "…" : "Confirmer"}
          </button>
          <button
            onClick={() => setConfirming(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Annuler
          </button>
        </>
      ) : (
        actions.map((a) => (
          <button
            key={a.next}
            onClick={() => (a.confirm ? setConfirming(a.next) : run(a.next))}
            disabled={isPending}
            className="text-xs font-medium text-foreground underline hover:no-underline disabled:opacity-50"
          >
            {a.label}
          </button>
        ))
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
