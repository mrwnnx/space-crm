"use client";

import { useState, useTransition } from "react";
import { sendCampaignTestAction } from "@/app/(dashboard)/campaigns/actions";

/**
 * Envoi d'un test depuis l'étape « Rédiger ».
 *
 * Porte sur le contenu EN COURS D'ÉDITION, pas sur la version enregistrée :
 * sinon il faudrait sauvegarder avant chaque essai, et on testerait autre chose
 * que ce qu'on a sous les yeux.
 */
export function CampaignTestSend({
  campaignId,
  subject,
  content,
  defaultTo,
}: {
  campaignId: string;
  subject: string;
  content: string;
  defaultTo: string;
}) {
  const [to, setTo] = useState(defaultTo);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function send() {
    setResult(null);
    startTransition(async () => {
      setResult(await sendCampaignTestAction(campaignId, to, subject, content));
    });
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <p className="mb-2 text-[11px] text-muted-foreground">
        Le test part avec le même rendu qu&apos;un envoi réel, objet préfixé
        <span className="font-mono"> [TEST]</span>. Il ne touche pas aux destinataires.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="adresse de test"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        <button
          onClick={send}
          disabled={isPending || !to.trim()}
          className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
        >
          {isPending ? "Envoi…" : "Envoyer un test"}
        </button>
      </div>
      {result && (
        <p
          className={`mt-2 text-[11px] ${
            result.ok ? "text-green-600" : "text-red-600"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
