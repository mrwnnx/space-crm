"use client";

import { useState, useTransition } from "react";
import { scheduleCampaignAction } from "@/app/(dashboard)/campaigns/actions";

/** Valeur `datetime-local` (heure du navigateur) pour « dans N minutes ». */
function localInputValue(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Programmer l'envoi à une date et heure.
 *
 * Le champ est en heure locale du navigateur (Tunis pour l'équipe) ; la date
 * part au serveur en ISO/UTC. Le départ réel est fait par le cron, à ~15 min
 * près — le texte le dit, pour que personne n'attende un envoi à la seconde.
 */
export function CampaignSchedule({
  campaignId,
  canSend,
  recipientCount,
}: {
  campaignId: string;
  canSend: boolean;
  recipientCount: number;
}) {
  const [value, setValue] = useState(() => localInputValue(new Date(Date.now() + 60 * 60_000)));
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const at = value ? new Date(value) : null;
  const valid = !!at && !Number.isNaN(at.getTime()) && at.getTime() > Date.now() + 60_000;

  function run() {
    if (!at) return;
    setError(null);
    startTransition(async () => {
      const r = await scheduleCampaignAction(campaignId, at.toISOString());
      setConfirming(false);
      if (!r.ok) setError(r.error ?? "La programmation a échoué.");
      // Succès : revalidatePath côté serveur rafraîchit la page en « Programmée ».
    });
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
      <input
        type="datetime-local"
        value={value}
        min={localInputValue(new Date(Date.now() + 5 * 60_000))}
        onChange={(e) => {
          setValue(e.target.value);
          setConfirming(false);
        }}
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        Heure de Tunis. Le départ se fait dans les 15 minutes qui suivent, jamais avant.
      </p>

      {!confirming ? (
        <>
          <button
            onClick={() => setConfirming(true)}
            disabled={!canSend || !valid}
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Programmer l&apos;envoi
          </button>
          {!canSend && (
            <p className="mt-2 text-xs text-muted-foreground">
              Il faut un sujet, un contenu et au moins un destinataire.
            </p>
          )}
          {canSend && !valid && (
            <p className="mt-2 text-xs text-muted-foreground">La date doit être dans le futur.</p>
          )}
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-foreground">
            Programmer l&apos;envoi à <strong>{recipientCount} destinataire{recipientCount > 1 ? "s" : ""}</strong>{" "}
            le{" "}
            <strong>
              {at!.toLocaleString("fr-FR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
            </strong>{" "}
            ? Jusque-là, vous pouvez la suspendre, l&apos;annuler ou la repasser en brouillon.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={run}
              disabled={isPending}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {isPending ? "Programmation…" : "Oui, programmer"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
            >
              Annuler
            </button>
          </div>
        </>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
