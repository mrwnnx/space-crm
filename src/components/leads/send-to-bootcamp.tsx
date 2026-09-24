"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { carryLeadToAction } from "@/app/actions";

type Target = { id: string; name: string; columns: { id: string; name: string }[] };

/**
 * « Il a dit oui, mais pour octobre » : envoyer CE lead vers une autre
 * formation, dans la colonne choisie. La fiche actuelle reste pour
 * l'historique ; une fois reportée, elle renvoie vers la nouvelle.
 */
export function SendToBootcamp({
  leadId,
  targets,
  carriedTo,
}: {
  leadId: string;
  targets: Target[];
  carriedTo: { lead_id: string; bootcamp_name: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bootcampId, setBootcampId] = useState(targets[0]?.id ?? "");
  const [statusId, setStatusId] = useState(targets[0]?.columns[0]?.id ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (carriedTo) {
    return (
      <div className="border-b border-border bg-slate-50 px-4 py-2.5">
        <p className="text-xs font-medium text-slate-800">
          ↪ Reporté vers « {carriedTo.bootcamp_name} » — sa suite se joue sur la nouvelle fiche
        </p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Retiré des colonnes de cette formation, sans être compté perdu ·{" "}
          <a href={`/leads/${carriedTo.lead_id}`} className="underline">
            ouvrir la nouvelle fiche
          </a>
        </p>
      </div>
    );
  }

  if (targets.length === 0) return null;
  const colonnes = targets.find((t) => t.id === bootcampId)?.columns ?? [];

  function envoyer() {
    setErreur(null);
    startTransition(async () => {
      const r = await carryLeadToAction(leadId, bootcampId, statusId);
      if (!r.ok || !r.leadId) return setErreur(r.message);
      router.push(`/leads/${r.leadId}`);
    });
  }

  return (
    <div className="border-b border-border px-4 py-2">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
        >
          Envoyer vers une autre formation…
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={bootcampId}
            onChange={(e) => {
              setBootcampId(e.target.value);
              setStatusId(targets.find((t) => t.id === e.target.value)?.columns[0]?.id ?? "");
            }}
            className="rounded-lg border border-border bg-background px-2 py-1.5 outline-none focus:border-ring"
          >
            {targets.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select
            value={statusId}
            onChange={(e) => setStatusId(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 outline-none focus:border-ring"
          >
            {colonnes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={envoyer}
            disabled={isPending || !statusId}
            className="rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground disabled:opacity-50"
          >
            {isPending ? "Envoi…" : "Envoyer"}
          </button>
          <button
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="rounded-lg border border-border px-3 py-1.5 text-muted-foreground hover:bg-muted"
          >
            Annuler
          </button>
          <p className="w-full text-[12.5px] text-muted-foreground">
            Une nouvelle fiche naît dans cette formation (même personne, mêmes tags) ; celle-ci reste pour
            l&apos;historique et quitte ses colonnes. Les envois de la colonne choisie partent.
          </p>
          {erreur && <p className="w-full text-red-600">{erreur}</p>}
        </div>
      )}
    </div>
  );
}
