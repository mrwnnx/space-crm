"use client";

import { useState, useTransition } from "react";
import {
  retryFailedAction,
  sendCampaignAction,
} from "@/app/(dashboard)/campaigns/actions";
import type { RecipientRow } from "@/lib/campaigns/queries";


export function CampaignSend({
  campaignId,
  status,
  recipients,
  canSend,
}: {
  campaignId: string;
  status: string;
  recipients: RecipientRow[];
  canSend: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const counts = recipients.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const failedCount = counts.failed ?? 0;

  function run(action: () => Promise<{ ok: boolean; sent: number; failed: number; remaining: number; quotaReached: boolean; error?: string }>) {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const r = await action();
      setConfirming(false);
      if (!r.ok) {
        setError(r.error ?? "Échec de l'envoi");
        return;
      }
      setResult(
        r.quotaReached || r.remaining > 0
          ? `${r.sent} envoyé${r.sent > 1 ? "s" : ""} — ${r.remaining} en attente, plafond quotidien atteint. Relancez demain.`
          : `${r.sent} envoyé${r.sent > 1 ? "s" : ""}${r.failed > 0 ? `, ${r.failed} en échec` : ""}.`
      );
    });
  }

  return (
    <div className="space-y-3">
      {status === "draft" && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          {!confirming ? (
            <>
              <button
                onClick={() => setConfirming(true)}
                disabled={!canSend}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                Envoyer la campagne
              </button>
              {!canSend && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Il faut un sujet, un contenu et au moins un destinataire.
                </p>
              )}
            </>
          ) : (
            <>
              {/* Un envoi ne s'annule pas : la confirmation est explicite. */}
              <p className="text-sm text-foreground">
                Envoyer maintenant ? Les emails partent immédiatement et ne
                peuvent pas être rappelés.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => run(() => sendCampaignAction(campaignId))}
                  disabled={isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {isPending ? "Envoi en cours…" : "Oui, envoyer"}
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
        </div>
      )}

      {status === "sending" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            Envoi interrompu — {counts.pending ?? 0} destinataire
            {(counts.pending ?? 0) > 1 ? "s" : ""} en attente.
          </p>
          <button
            onClick={() => run(() => sendCampaignAction(campaignId))}
            disabled={isPending}
            className="mt-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {isPending ? "Reprise…" : "Reprendre l'envoi"}
          </button>
        </div>
      )}

      {result && <p className="text-xs text-green-700">{result}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {recipients.length > 0 && failedCount > 0 && (
        <button
          onClick={() => run(() => retryFailedAction(campaignId))}
          disabled={isPending}
          className="text-xs font-medium text-foreground underline hover:no-underline disabled:opacity-50"
        >
          Relancer les {failedCount} échec{failedCount > 1 ? "s" : ""}
        </button>
      )}

    </div>
  );
}
